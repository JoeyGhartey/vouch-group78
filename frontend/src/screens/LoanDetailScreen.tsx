import React, { useState, useCallback } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  ActivityIndicator, TextInput, Modal,
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { RouteProp } from '@react-navigation/native';
import * as WebBrowser from 'expo-web-browser';
import {
  getLoan, fundLoan, signAgreement, disburseLoan, repayLoan,
  cancelLoan, defaultLoan, openDispute, getProfile,
  initializeDisbursement, initializeRepayment, verifyPayment,
} from '../services/api';
import { useAppAlert } from '../components/AppAlert';
import { useConfirmModal } from '../components/ConfirmModal';
import { RootStackParamList } from '../navigation/AppNavigator';

type Props = {
  route: RouteProp<RootStackParamList, 'LoanDetail'>;
  navigation: NativeStackNavigationProp<RootStackParamList, 'LoanDetail'>;
};

interface Loan {
  id: number;
  amount: number;
  status: string;
  reason: string;
  borrowerName: string;
  borrowerId: number;
  lenderName?: string;
  lenderId?: number;
  circleName: string;
  interestRate: number;
  totalRepaymentAmount: number;
  amountRepaid: number;
  overdueInterestAccrued: number;
  repaymentType: string;
  repaymentPeriodMonths: number;
  dueDate?: string;
  createdAt: string;
  disbursedAt?: string;
  gracePeriodEnd?: string;
}

interface Profile {
  id: number;
}

interface PaymentInitResponse {
  authorizationUrl: string;
  reference: string;
  message: string;
}

const BG = '#F8F9FA';
const WHITE = '#FFFFFF';
const DARK = '#0f172a';
const MUTED = '#6B7280';
const BORDER = '#E5E7EB';
const ACCENT = '#C9A84C';
const SUCCESS = '#16a34a';
const DANGER = '#dc2626';
const WARNING = '#d97706';

export default function LoanDetailScreen({ route, navigation }: Props) {
  const { loanId } = route.params;
  const { confirm } = useConfirmModal();
  const { showAlert } = useAppAlert();
  const [loan, setLoan] = useState<Loan | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [acting, setActing] = useState<boolean>(false);
  const [showFund, setShowFund] = useState<boolean>(false);
  const [showRepay, setShowRepay] = useState<boolean>(false);
  const [showDispute, setShowDispute] = useState<boolean>(false);
  const [interestRate, setInterestRate] = useState<string>('5');
  const [repayAmount, setRepayAmount] = useState<string>('');
  const [disputeReason, setDisputeReason] = useState<string>('');
  const [disputeEvidence, setDisputeEvidence] = useState<string>('');

  const loadData = async (): Promise<void> => {
    try {
      const [l, p] = await Promise.all([getLoan(loanId), getProfile()]);
      setLoan(l as Loan);
      setProfile(p as Profile);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  useFocusEffect(useCallback(() => { loadData(); }, []));

  const isBorrower = profile && loan && profile.id === loan.borrowerId;
  const isLender = profile && loan && profile.id === loan.lenderId;

  const doAction = async (action: () => Promise<void>, successMsg?: string): Promise<void> => {
    setActing(true);
    try {
      await action();
      loadData();
      if (successMsg) showAlert('success', 'Success', successMsg);
    } catch (e) {
      showAlert('error', 'Error', (e as Error).message);
    } finally {
      setActing(false);
    }
  };

  const handleFund = (): void => {
    if (!interestRate || parseFloat(interestRate) < 0) {
      showAlert('error', 'Error', 'Enter a valid interest rate');
      return;
    }
    doAction(async () => {
      await fundLoan({ loanId: loan!.id, interestRate: parseFloat(interestRate) });
      setShowFund(false);
    }, 'Loan funded. Agreement pending signatures.');
  };

  const handleSign = async (): Promise<void> => {
    const ok = await confirm('Sign Agreement', 'Are you sure you want to sign this loan agreement? This action is binding.', 'Yes, Sign');
    if (!ok) return;
    doAction(async () => { await signAgreement(loan!.id); }, 'Agreement signed.');
  };

  const handleDisburse = async (): Promise<void> => {
    const ok = await confirm('Disburse Loan', `You will be taken to Paystack to send GHS ${loan!.amount} to ${loan!.borrowerName}. Continue?`, 'Continue to Payment');
    if (!ok) return;
    setActing(true);
    try {
      const response = await initializeDisbursement(loan!.id) as PaymentInitResponse;
      if (response.authorizationUrl) {
        const result = await WebBrowser.openBrowserAsync(response.authorizationUrl);
        if (result.type === 'dismiss' || result.type === 'cancel') {
          setActing(true);
          try {
            const verification = await verifyPayment(response.reference) as { status: string; message: string };
            if (verification.status === 'SUCCESS') {
              showAlert('success', 'Success', 'Payment successful. Loan is now active.');
              loadData();
            } else {
              showAlert('error', 'Payment Pending', 'Payment not confirmed yet. Pull down to refresh.');
              loadData();
            }
          } catch (e) {
            loadData();
          } finally {
            setActing(false);
          }
        }
      } else {
        await disburseLoan(loan!.id);
        showAlert('success', 'Success', 'Loan disbursed and active.');
        loadData();
      }
    } catch (e) {
      showAlert('error', 'Error', (e as Error).message);
    } finally {
      setActing(false);
    }
  };

  const handleRepay = async (): Promise<void> => {
    const amt = repayAmount ? parseFloat(repayAmount) : undefined;
    const ok = await confirm('Confirm Repayment', `You will be taken to Paystack to repay GHS ${amt?.toFixed(2) || totalOwed.toFixed(2)}. Continue?`, 'Continue to Payment');
    if (!ok) return;
    setActing(true);
    setShowRepay(false);
    try {
      const response = await initializeRepayment(loan!.id, amt) as PaymentInitResponse;
      if (response.authorizationUrl) {
        const result = await WebBrowser.openBrowserAsync(response.authorizationUrl);
        if (result.type === 'dismiss' || result.type === 'cancel') {
          setActing(true);
          try {
            const verification = await verifyPayment(response.reference) as { status: string; message: string };
            if (verification.status === 'SUCCESS') {
              showAlert('success', 'Success', 'Repayment successful.');
              loadData();
            } else {
              showAlert('error', 'Payment Pending', 'Payment not confirmed yet. Pull down to refresh.');
              loadData();
            }
          } catch (e) {
            loadData();
          } finally {
            setActing(false);
          }
        }
      } else {
        await repayLoan(loan!.id, amt);
        showAlert('success', 'Success', 'Repayment recorded.');
        loadData();
      }
    } catch (e) {
      showAlert('error', 'Error', (e as Error).message);
    } finally {
      setActing(false);
      setRepayAmount('');
    }
  };

  const handleCancel = async (): Promise<void> => {
    const ok = await confirm('Cancel Loan', 'Cancel this request?', 'Yes, Cancel');
    if (!ok) return;
    doAction(async () => { await cancelLoan(loan!.id); }, 'Loan cancelled.');
  };

  const handleDefault = async (): Promise<void> => {
    const ok = await confirm('Mark Defaulted', "This will significantly impact the borrower's trust score.", 'Mark Defaulted');
    if (!ok) return;
    doAction(async () => { await defaultLoan(loan!.id); }, 'Loan defaulted.');
  };

  const handleDispute = (): void => {
    if (!disputeReason.trim()) { showAlert('error', 'Error', 'Enter a reason'); return; }
    doAction(async () => {
      await openDispute({ loanId: loan!.id, reason: disputeReason, evidence: disputeEvidence });
      setShowDispute(false);
      setDisputeReason('');
      setDisputeEvidence('');
    }, 'Dispute opened. Admin will review.');
  };

  const statusColor = (s: string): string => ({
    REQUESTED: WARNING,
    AGREEMENT_PENDING: '#FF9800',
    AGREEMENT_SIGNED: '#2196F3',
    ACTIVE: SUCCESS,
    DUE: WARNING,
    GRACE_PERIOD: DANGER,
    REPAID: SUCCESS,
    DEFAULTED: DANGER,
    DISPUTED: '#9C27B0',
    CANCELLED: MUTED,
  }[s] || MUTED);

  const fmtDate = (d?: string): string =>
    d ? new Date(d).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : 'N/A';

  if (loading) return <View style={styles.center}><ActivityIndicator size="large" color={ACCENT} /></View>;
  if (!loan) return <View style={styles.center}><Text style={{ color: DANGER, fontSize: 16 }}>Loan not found</Text></View>;

  const totalOwed = loan.totalRepaymentAmount + loan.overdueInterestAccrued - loan.amountRepaid;

  const details: [string, string][] = [
    ['Borrower', loan.borrowerName],
    ['Lender', loan.lenderName || 'Waiting for lender'],
    ['Circle', loan.circleName],
    ['Reason', loan.reason],
    ['Interest Rate', `${loan.interestRate}%`],
    ['Total Repayment', `GHS ${loan.totalRepaymentAmount}`],
    ['Amount Repaid', `GHS ${loan.amountRepaid}`],
    ['Repayment Type', loan.repaymentType],
    ['Period', `${loan.repaymentPeriodMonths} month(s)`],
    ['Due Date', fmtDate(loan.dueDate)],
    ['Created', fmtDate(loan.createdAt)],
    ...(loan.disbursedAt ? [['Disbursed', fmtDate(loan.disbursedAt)] as [string, string]] : []),
    ...(loan.overdueInterestAccrued > 0 ? [['Overdue Interest', `GHS ${loan.overdueInterestAccrued.toFixed(2)}`] as [string, string]] : []),
    ...(loan.gracePeriodEnd ? [['Grace Period Ends', fmtDate(loan.gracePeriodEnd)] as [string, string]] : []),
  ];

  return (
    <ScrollView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()}>
          <Text style={styles.back}>← Back</Text>
        </TouchableOpacity>
        <Text style={styles.title}>Loan Details</Text>
        <View style={{ width: 50 }} />
      </View>

      <View style={styles.amountCard}>
        <Text style={styles.amountLabel}>Loan Amount</Text>
        <Text style={styles.amount}>GHS {loan.amount}</Text>
        <View style={[styles.badge, { backgroundColor: statusColor(loan.status) }]}>
          <Text style={styles.badgeText}>{loan.status.replace(/_/g, ' ')}</Text>
        </View>
      </View>

      <View style={styles.card}>
        {details.map(([label, value], i) => (
          <View key={i} style={styles.row}>
            <Text style={styles.rowLabel}>{label}</Text>
            <Text style={[styles.rowValue, label === 'Overdue Interest' && { color: DANGER }]}>{value}</Text>
          </View>
        ))}
      </View>

      {loan.totalRepaymentAmount > 0 && !['REPAID', 'CANCELLED', 'REQUESTED'].includes(loan.status) && (
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Repayment Progress</Text>
          <View style={styles.progressBar}>
            <View style={[styles.progressFill, {
              width: `${Math.min((loan.amountRepaid / (loan.totalRepaymentAmount + loan.overdueInterestAccrued)) * 100, 100)}%` as any
            }]} />
          </View>
          <Text style={styles.progressText}>
            GHS {loan.amountRepaid.toFixed(2)} / {(loan.totalRepaymentAmount + loan.overdueInterestAccrued).toFixed(2)}
          </Text>
          {totalOwed > 0 && <Text style={styles.remaining}>Remaining: GHS {totalOwed.toFixed(2)}</Text>}
        </View>
      )}

      <View style={styles.actions}>
        {loan.status === 'REQUESTED' && !isBorrower && (
          <TouchableOpacity style={styles.primaryBtn} onPress={() => setShowFund(true)}>
            <Text style={styles.btnText}>Fund This Loan</Text>
          </TouchableOpacity>
        )}
        {loan.status === 'AGREEMENT_PENDING' && (isBorrower || isLender) && (
          <TouchableOpacity style={styles.primaryBtn} onPress={handleSign} disabled={acting}>
            {acting ? <ActivityIndicator color={WHITE} /> : <Text style={styles.btnText}>Sign Agreement</Text>}
          </TouchableOpacity>
        )}
        {loan.status === 'AGREEMENT_SIGNED' && isLender && (
          <TouchableOpacity style={styles.primaryBtn} onPress={handleDisburse} disabled={acting}>
          <Text style={styles.btnText}>Send GHS {loan.amount} to {loan.borrowerName}</Text>
          </TouchableOpacity>
        )}
        {['ACTIVE', 'DUE', 'GRACE_PERIOD'].includes(loan.status) && isBorrower && (
          <TouchableOpacity style={styles.primaryBtn} onPress={() => { setRepayAmount(totalOwed.toFixed(2)); setShowRepay(true); }}>
            <Text style={styles.btnText}>Repay via Paystack</Text>
          </TouchableOpacity>
        )}
        {loan.status === 'REQUESTED' && isBorrower && (
          <TouchableOpacity style={styles.dangerBtn} onPress={handleCancel}>
            <Text style={styles.btnText}>Cancel Request</Text>
          </TouchableOpacity>
        )}
        {loan.status === 'GRACE_PERIOD' && isLender && (
          <TouchableOpacity style={styles.dangerBtn} onPress={handleDefault}>
            <Text style={styles.btnText}>Mark as Defaulted</Text>
          </TouchableOpacity>
        )}
        {['ACTIVE', 'DUE', 'GRACE_PERIOD', 'REPAID'].includes(loan.status) && (isBorrower || isLender) && (
          <TouchableOpacity style={styles.outlineBtn} onPress={() => setShowDispute(true)}>
            <Text style={styles.outlineText}>Open Dispute</Text>
          </TouchableOpacity>
        )}
      </View>

      {/* Fund Modal */}
      <Modal visible={showFund} animationType="slide" transparent>
        <View style={styles.modalBg}>
          <View style={styles.modal}>
            <Text style={styles.modalTitle}>Fund This Loan</Text>
            <Text style={styles.modalSub}>GHS {loan.amount} to {loan.borrowerName}</Text>
            <Text style={styles.label}>Interest Rate (%)</Text>
            <TextInput
              style={styles.input}
              placeholder="e.g. 5"
              placeholderTextColor={MUTED}
              value={interestRate}
              onChangeText={setInterestRate}
              keyboardType="numeric"
            />
            {parseFloat(interestRate) > 0 && (
              <Text style={styles.calcText}>
                Total repayment: GHS {(loan.amount * (1 + parseFloat(interestRate || '0') / 100)).toFixed(2)}
              </Text>
            )}
            <TouchableOpacity style={styles.primaryBtn} onPress={handleFund} disabled={acting}>
              {acting ? <ActivityIndicator color={WHITE} /> : <Text style={styles.btnText}>Confirm & Fund</Text>}
            </TouchableOpacity>
            <TouchableOpacity style={styles.cancelBtn} onPress={() => setShowFund(false)}>
              <Text style={styles.cancelText}>Cancel</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* Repay Modal */}
      <Modal visible={showRepay} animationType="slide" transparent>
        <View style={styles.modalBg}>
          <View style={styles.modal}>
            <Text style={styles.modalTitle}>Repay Loan</Text>
            <Text style={styles.modalSub}>Outstanding: GHS {totalOwed.toFixed(2)}</Text>
            <Text style={styles.label}>Amount (GHS)</Text>
            <TextInput
              style={styles.input}
              placeholder={totalOwed.toFixed(2)}
              placeholderTextColor={MUTED}
              value={repayAmount}
              onChangeText={setRepayAmount}
              keyboardType="numeric"
            />
            <TouchableOpacity style={styles.primaryBtn} onPress={handleRepay} disabled={acting}>
              {acting ? <ActivityIndicator color={WHITE} /> : <Text style={styles.btnText}>Confirm Repayment</Text>}
            </TouchableOpacity>
            <TouchableOpacity style={styles.cancelBtn} onPress={() => setShowRepay(false)}>
              <Text style={styles.cancelText}>Cancel</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* Dispute Modal */}
      <Modal visible={showDispute} animationType="slide" transparent>
        <View style={styles.modalBg}>
          <View style={styles.modal}>
            <Text style={styles.modalTitle}>Open Dispute</Text>
            <Text style={styles.label}>Reason *</Text>
            <TextInput
              style={[styles.input, { height: 80 }]}
              placeholder="Why are you disputing?"
              placeholderTextColor={MUTED}
              value={disputeReason}
              onChangeText={setDisputeReason}
              multiline
            />
            <Text style={styles.label}>Evidence</Text>
            <TextInput
              style={[styles.input, { height: 80 }]}
              placeholder="Any supporting evidence"
              placeholderTextColor={MUTED}
              value={disputeEvidence}
              onChangeText={setDisputeEvidence}
              multiline
            />
            <TouchableOpacity style={styles.primaryBtn} onPress={handleDispute} disabled={acting}>
              {acting ? <ActivityIndicator color={WHITE} /> : <Text style={styles.btnText}>Submit Dispute</Text>}
            </TouchableOpacity>
            <TouchableOpacity style={styles.cancelBtn} onPress={() => setShowDispute(false)}>
              <Text style={styles.cancelText}>Cancel</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      <View style={{ height: 40 }} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: BG },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: BG },
  header: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    padding: 20, paddingTop: 56, backgroundColor: WHITE,
    borderBottomWidth: 1, borderBottomColor: BORDER,
  },
  back: { color: ACCENT, fontSize: 16, fontWeight: '600' },
  title: { color: DARK, fontSize: 18, fontWeight: '700' },
  amountCard: {
    backgroundColor: DARK, marginHorizontal: 16, borderRadius: 16,
    padding: 24, alignItems: 'center', marginTop: 16, marginBottom: 16,
  },
  amountLabel: { color: '#94a3b8', fontSize: 13 },
  amount: { color: WHITE, fontSize: 40, fontWeight: '800', marginTop: 4, letterSpacing: -1 },
  badge: { borderRadius: 8, paddingHorizontal: 16, paddingVertical: 6, marginTop: 12 },
  badgeText: { color: WHITE, fontSize: 12, fontWeight: '700' },
  card: {
    backgroundColor: WHITE, marginHorizontal: 16, borderRadius: 14,
    padding: 16, marginBottom: 12, borderWidth: 1, borderColor: BORDER,
  },
  cardTitle: { color: DARK, fontSize: 15, fontWeight: '700', marginBottom: 12 },
  row: {
    flexDirection: 'row', justifyContent: 'space-between',
    paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: BORDER,
  },
  rowLabel: { color: MUTED, fontSize: 13 },
  rowValue: { color: DARK, fontSize: 13, fontWeight: '600', textAlign: 'right', flex: 1, marginLeft: 16 },
  progressBar: { height: 6, backgroundColor: BORDER, borderRadius: 4, overflow: 'hidden' },
  progressFill: { height: '100%', backgroundColor: SUCCESS, borderRadius: 4 },
  progressText: { color: MUTED, fontSize: 12, marginTop: 8, textAlign: 'center' },
  remaining: { color: WARNING, fontSize: 13, fontWeight: '600', textAlign: 'center', marginTop: 4 },
  actions: { paddingHorizontal: 16, marginTop: 8 },
  primaryBtn: {
    backgroundColor: DARK, borderRadius: 12, padding: 16,
    alignItems: 'center', marginBottom: 10,
  },
  dangerBtn: {
    backgroundColor: DANGER, borderRadius: 12, padding: 16,
    alignItems: 'center', marginBottom: 10,
  },
  outlineBtn: {
    borderWidth: 1.5, borderColor: ACCENT, borderRadius: 12,
    padding: 16, alignItems: 'center', marginBottom: 10,
  },
  btnText: { color: WHITE, fontSize: 15, fontWeight: '700' },
  outlineText: { color: ACCENT, fontSize: 15, fontWeight: '600' },
  modalBg: { flex: 1, backgroundColor: 'rgba(0,0,0,0.6)', justifyContent: 'center', padding: 24 },
  modal: { backgroundColor: WHITE, borderRadius: 16, padding: 24 },
  modalTitle: { color: DARK, fontSize: 20, fontWeight: '700', textAlign: 'center' },
  modalSub: { color: MUTED, fontSize: 13, textAlign: 'center', marginTop: 4, marginBottom: 16 },
  label: { color: MUTED, fontSize: 13, marginBottom: 6, marginTop: 12 },
  input: {
    backgroundColor: BG, borderRadius: 12, padding: 14,
    fontSize: 15, color: DARK, borderWidth: 1, borderColor: BORDER,
  },
  calcText: { color: SUCCESS, fontSize: 13, marginTop: 8, textAlign: 'center' },
  cancelBtn: { padding: 14, alignItems: 'center', marginTop: 4 },
  cancelText: { color: MUTED, fontSize: 15 },
});