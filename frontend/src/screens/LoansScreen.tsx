import React, { useState, useCallback, useMemo } from 'react';
import {
  View, Text, StyleSheet, FlatList, TouchableOpacity,
  ActivityIndicator, RefreshControl, Modal, TextInput,
  KeyboardAvoidingView, Platform, ScrollView, TouchableWithoutFeedback,
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { Ionicons } from '@expo/vector-icons';
import { getMyBorrowedLoans, getMyLentLoans, getMyCircles, requestLoan } from '../services/api';
import { useAppAlert } from '../components/AppAlert';
import { useTheme } from '../context/ThemeContext';
import { RootStackParamList } from '../navigation/AppNavigator';
import { ColorScheme } from '../theme/colors';
import { formatMoney } from '../utils/formatMoney';

type Props = {
  navigation: NativeStackNavigationProp<RootStackParamList>;
};

interface Loan {
  id: number;
  amount: number;
  status: string;
  reason: string;
  circleName: string;
  lenderName?: string;
  borrowerName: string;
  interestRate: number;
  totalRepaymentAmount: number;
  amountRepaid: number;
  dueDate?: string;
  isGroupFunded?: boolean;
}

interface Circle {
  id: number;
  name: string;
}

const createStyles = (c: ColorScheme) => StyleSheet.create({
  container: { flex: 1, backgroundColor: c.bg },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: c.bg },
  header: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    backgroundColor: c.surface, paddingHorizontal: 20, paddingTop: 56, paddingBottom: 16,
    borderBottomWidth: 1, borderBottomColor: c.border,
  },
  title: { fontSize: 22, fontWeight: '700', color: c.dark },
  addBtn: { flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: c.buttonDark, borderRadius: 10, paddingHorizontal: 14, paddingVertical: 8 },
  addBtnText: { color: c.buttonDarkText, fontSize: 14, fontWeight: '600' },
  modalBg: { flex: 1, backgroundColor: 'rgba(0,0,0,0.6)', justifyContent: 'flex-end' },
  modal: { backgroundColor: c.surface, borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 24, maxHeight: '90%' as const },
  modalTitle: { fontSize: 20, fontWeight: '700', color: c.dark, textAlign: 'center', marginBottom: 20 },
  label: { fontSize: 12, color: c.muted, fontWeight: '600', marginBottom: 6, marginTop: 14 },
  input: { backgroundColor: c.bg, borderRadius: 10, padding: 14, fontSize: 14, color: c.dark, borderWidth: 1, borderColor: c.border },
  circleChip: {
    backgroundColor: c.bg, borderRadius: 20, paddingHorizontal: 14,
    paddingVertical: 8, marginRight: 8, borderWidth: 1, borderColor: c.border,
  },
  circleChipSel: { backgroundColor: c.buttonDark, borderColor: c.buttonDark },
  circleChipText: { color: c.muted, fontSize: 12, fontWeight: '600' },
  circleChipTextSel: { color: c.buttonDarkText },
  noCirclesBox: { alignItems: 'center', padding: 24 },
  noCirclesText: { fontSize: 13, color: c.muted, textAlign: 'center', marginTop: 10, lineHeight: 20 },
  submitBtn: { backgroundColor: c.buttonDark, borderRadius: 12, padding: 16, alignItems: 'center', marginTop: 24 },
  submitBtnText: { color: c.buttonDarkText, fontSize: 15, fontWeight: '700' },
  cancelModalBtn: { padding: 14, alignItems: 'center', marginTop: 4 },
  cancelModalText: { color: c.muted, fontSize: 14 },
  summaryCard: {
    backgroundColor: c.surface, marginHorizontal: 16, marginTop: 16, marginBottom: 8,
    borderRadius: 16, padding: 20, alignItems: 'center',
    borderWidth: 1, borderColor: c.border,
  },
  summaryLabel: { fontSize: 12, color: c.muted, fontWeight: '600', letterSpacing: 0.5 },
  summaryAmount: { fontSize: 36, fontWeight: '800', marginTop: 6, letterSpacing: -1 },
  summarySub: { fontSize: 12, color: c.muted, marginTop: 4 },
  tabRow: {
    flexDirection: 'row', backgroundColor: c.surface,
    borderBottomWidth: 1, borderBottomColor: c.border, marginBottom: 4,
  },
  tab: { flex: 1, paddingVertical: 14, alignItems: 'center', borderBottomWidth: 2, borderBottomColor: 'transparent' },
  activeTab: { borderBottomColor: c.accent },
  tabText: { fontSize: 13, fontWeight: '600', color: c.muted },
  activeTabText: { color: c.accent },
  emptyContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 24 },
  emptyTitle: { fontSize: 17, fontWeight: '700', color: c.dark, marginTop: 12, marginBottom: 6 },
  emptyText: { fontSize: 13, color: c.muted, textAlign: 'center' },
  loanCard: {
    backgroundColor: c.surface, borderRadius: 14, padding: 16,
    borderWidth: 1, borderColor: c.border,
  },
  loanTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 },
  loanAmount: { fontSize: 22, fontWeight: '800', color: c.dark },
  badge: { borderRadius: 6, paddingHorizontal: 8, paddingVertical: 3 },
  badgeText: { fontSize: 10, fontWeight: '700' },
  loanReason: { fontSize: 13, color: c.muted, marginBottom: 2 },
  loanCircle: { fontSize: 12, color: c.muted, marginBottom: 8 },
  loanMeta: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 4 },
  metaText: { fontSize: 12, color: c.muted },
  interest: { fontSize: 12, color: c.accent, fontWeight: '600' },
  dueDate: { fontSize: 12, color: c.warning, marginTop: 4 },
  progressRow: { marginTop: 10 },
  progressBg: { height: 5, backgroundColor: c.border, borderRadius: 3, overflow: 'hidden' },
  progressFill: { height: '100%', backgroundColor: c.success, borderRadius: 3 },
  progressText: { fontSize: 11, color: c.muted, marginTop: 4, textAlign: 'right' },
  chevron: { position: 'absolute', right: 14, top: '50%' },
});

export default function LoansScreen({ navigation }: Props) {
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const { showAlert } = useAppAlert();
  const [borrowed, setBorrowed] = useState<Loan[]>([]);
  const [lent, setLent] = useState<Loan[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [refreshing, setRefreshing] = useState<boolean>(false);
  const [activeTab, setActiveTab] = useState<string>('borrowed');

  const [showRequestModal, setShowRequestModal] = useState<boolean>(false);
  const [circles, setCircles] = useState<Circle[]>([]);
  const [circlesLoading, setCirclesLoading] = useState<boolean>(false);
  const [selectedCircleId, setSelectedCircleId] = useState<number | 'ALL' | null>(null);
  const [reqAmount, setReqAmount] = useState<string>('');
  const [reqReason, setReqReason] = useState<string>('');
  const [reqPeriod, setReqPeriod] = useState<string>('1');
  const [submitting, setSubmitting] = useState<boolean>(false);

  const loadLoans = async (): Promise<void> => {
    try {
      const [b, l] = await Promise.all([getMyBorrowedLoans(), getMyLentLoans()]);
      setBorrowed(b as Loan[]);
      setLent(l as Loan[]);
    } catch (error) {
      console.error(error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useFocusEffect(useCallback(() => { loadLoans(); }, []));

  const openRequestModal = async (): Promise<void> => {
    setShowRequestModal(true);
    setSelectedCircleId(null);
    setReqAmount('');
    setReqReason('');
    setReqPeriod('1');
    setCirclesLoading(true);
    try {
      const data = await getMyCircles();
      setCircles(data as Circle[]);
    } catch (error) {
      setCircles([]);
    } finally {
      setCirclesLoading(false);
    }
  };

  const handleRequestLoan = async (): Promise<void> => {
    if (!selectedCircleId) { showAlert('error', 'Error', 'Select a circle'); return; }
    const amt = parseFloat(reqAmount);
    if (!reqAmount || isNaN(amt) || amt <= 0) { showAlert('error', 'Error', 'Enter a valid amount'); return; }
    if (!reqReason.trim()) { showAlert('error', 'Error', 'Enter a purpose for the loan'); return; }
    const period = parseInt(reqPeriod, 10) || 1;

    setSubmitting(true);
    try {
      if (selectedCircleId === 'ALL') {
        const results = await Promise.allSettled(circles.map((c) => requestLoan({
          circleId: c.id, amount: amt, reason: reqReason.trim(), repaymentPeriodMonths: period,
        })));
        const failures = results.filter((r) => r.status === 'rejected').length;
        const successes = results.length - failures;
        if (failures === 0) {
          showAlert('success', 'Requested', `Loan request posted to all ${successes} of your circles.`);
        } else if (successes === 0) {
          showAlert('error', 'Failed', 'Could not post the request to any circle.');
        } else {
          showAlert('success', 'Partially Posted', `Posted to ${successes} of ${results.length} circles. ${failures} failed (e.g. amount may exceed a circle's max loan limit).`);
        }
      } else {
        await requestLoan({
          circleId: selectedCircleId, amount: amt, reason: reqReason.trim(), repaymentPeriodMonths: period,
        });
        showAlert('success', 'Requested', 'Loan request posted to the circle.');
      }
      setShowRequestModal(false);
      loadLoans();
    } catch (error) {
      showAlert('error', 'Error', (error as Error).message);
    } finally {
      setSubmitting(false);
    }
  };

  const statusColor = (s: string): string => ({
    REQUESTED: colors.warning, AGREEMENT_PENDING: colors.statusOrange, AGREEMENT_SIGNED: colors.statusBlue,
    ACTIVE: colors.success, DUE: colors.warning, GRACE_PERIOD: colors.danger,
    REPAID: colors.success, DEFAULTED: colors.danger, DISPUTED: colors.statusPurple, CANCELLED: colors.muted,
  }[s] || colors.muted);

  const fmtDate = (d?: string): string =>
    d ? new Date(d).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }) : '';

  const loans = activeTab === 'borrowed' ? borrowed : lent;
  const totalActive = loans
    .filter((l) => ['ACTIVE', 'DUE', 'GRACE_PERIOD'].includes(l.status))
    .reduce((s, l) => s + (l.totalRepaymentAmount - l.amountRepaid), 0);

  if (loading) return <View style={styles.center}><ActivityIndicator size="large" color={colors.accent} /></View>;

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>My Loans</Text>
        <TouchableOpacity style={styles.addBtn} onPress={openRequestModal}>
          <Ionicons name="add" size={18} color={colors.buttonDarkText} />
          <Text style={styles.addBtnText}>Request</Text>
        </TouchableOpacity>
      </View>

      <View style={styles.summaryCard}>
        <Text style={styles.summaryLabel}>
          {activeTab === 'borrowed' ? 'Total You Owe' : 'Total Owed to You'}
        </Text>
        <Text style={[styles.summaryAmount, { color: activeTab === 'borrowed' ? colors.danger : colors.success }]}>
          GHS {formatMoney(totalActive)}
        </Text>
        <Text style={styles.summarySub}>
          {loans.filter(l => ['ACTIVE', 'DUE', 'GRACE_PERIOD'].includes(l.status)).length} active loans
        </Text>
      </View>

      <View style={styles.tabRow}>
        {['borrowed', 'lent'].map((t) => (
          <TouchableOpacity
            key={t}
            style={[styles.tab, activeTab === t && styles.activeTab]}
            onPress={() => setActiveTab(t)}
          >
            <Text style={[styles.tabText, activeTab === t && styles.activeTabText]}>
              {t === 'borrowed' ? `Borrowed (${borrowed.length})` : `Lent (${lent.length})`}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {loans.length === 0 ? (
        <View style={styles.emptyContainer}>
          <Ionicons name={activeTab === 'borrowed' ? 'card-outline' : 'cash-outline'} size={48} color={colors.muted} />
          <Text style={styles.emptyTitle}>{activeTab === 'borrowed' ? 'No borrowed loans' : 'No lent loans'}</Text>
          <Text style={styles.emptyText}>
            {activeTab === 'borrowed' ? 'Request a loan from your circles' : 'Fund a loan request in your circles'}
          </Text>
        </View>
      ) : (
        <FlatList
          data={loans}
          keyExtractor={(item) => item.id.toString()}
          contentContainerStyle={{ padding: 16, gap: 10 }}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); loadLoans(); }} tintColor={colors.accent} />}
          renderItem={({ item }) => (
            <TouchableOpacity
              style={styles.loanCard}
              onPress={() => navigation.navigate('LoanDetail', { loanId: item.id })}
            >
              <View style={styles.loanTop}>
                <Text style={styles.loanAmount}>GHS {formatMoney(item.amount)}</Text>
                <View style={[styles.badge, { backgroundColor: `${statusColor(item.status)}18` }]}>
                  <Text style={[styles.badgeText, { color: statusColor(item.status) }]}>
                    {item.status.replace(/_/g, ' ')}
                  </Text>
                </View>
              </View>
              <Text style={styles.loanReason}>{item.reason}</Text>
              <Text style={styles.loanCircle}>{item.circleName}</Text>
              <View style={styles.loanMeta}>
                <Text style={styles.metaText}>
                  {activeTab === 'borrowed'
                    ? `Lender: ${item.lenderName || (item.isGroupFunded ? 'Group Funded' : 'Waiting...')}`
                    : `Borrower: ${item.borrowerName}`}
                </Text>
                {item.interestRate > 0 && (
                  <Text style={styles.interest}>{item.interestRate}% interest</Text>
                )}
              </View>
              {item.dueDate && (
                <Text style={styles.dueDate}>Due: {fmtDate(item.dueDate)}</Text>
              )}
              {item.totalRepaymentAmount > 0 && !['REPAID', 'CANCELLED', 'REQUESTED'].includes(item.status) && (
                <View style={styles.progressRow}>
                  <View style={styles.progressBg}>
                    <View style={[styles.progressFill, {
                      width: `${Math.min((item.amountRepaid / item.totalRepaymentAmount) * 100, 100)}%` as any
                    }]} />
                  </View>
                  <Text style={styles.progressText}>
                    GHS {formatMoney(item.amountRepaid)} / {formatMoney(item.totalRepaymentAmount)}
                  </Text>
                </View>
              )}
              <Ionicons name="chevron-forward" size={14} color={colors.muted} style={styles.chevron} />
            </TouchableOpacity>
          )}
        />
      )}

      <Modal visible={showRequestModal} animationType="slide" transparent onRequestClose={() => setShowRequestModal(false)}>
        <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
          <TouchableWithoutFeedback onPress={() => setShowRequestModal(false)}>
          <View style={styles.modalBg}>
            <TouchableWithoutFeedback onPress={() => {}}>
            <View style={styles.modal}>
              <ScrollView showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
                <Text style={styles.modalTitle}>Request a Loan</Text>

                {circlesLoading ? (
                  <ActivityIndicator size="large" color={colors.accent} style={{ marginVertical: 24 }} />
                ) : circles.length === 0 ? (
                  <View style={styles.noCirclesBox}>
                    <Ionicons name="people-outline" size={36} color={colors.muted} />
                    <Text style={styles.noCirclesText}>
                      You&apos;re not part of any circles yet. Join or create a circle before requesting a loan.
                    </Text>
                  </View>
                ) : (
                  <>
                    <Text style={styles.label}>Circle</Text>
                    <ScrollView horizontal showsHorizontalScrollIndicator={false} keyboardShouldPersistTaps="handled" style={{ marginTop: 4 }}>
                      <TouchableOpacity
                        style={[styles.circleChip, selectedCircleId === 'ALL' && styles.circleChipSel]}
                        onPress={() => setSelectedCircleId('ALL')}
                      >
                        <Text style={[styles.circleChipText, selectedCircleId === 'ALL' && styles.circleChipTextSel]}>All Circles</Text>
                      </TouchableOpacity>
                      {circles.map((c) => (
                        <TouchableOpacity
                          key={c.id}
                          style={[styles.circleChip, selectedCircleId === c.id && styles.circleChipSel]}
                          onPress={() => setSelectedCircleId(c.id)}
                        >
                          <Text style={[styles.circleChipText, selectedCircleId === c.id && styles.circleChipTextSel]}>{c.name}</Text>
                        </TouchableOpacity>
                      ))}
                    </ScrollView>

                    <Text style={styles.label}>Amount (GHS) *</Text>
                    <TextInput
                      style={styles.input}
                      placeholder="e.g. 500"
                      placeholderTextColor={colors.muted}
                      value={reqAmount}
                      onChangeText={setReqAmount}
                      keyboardType="numeric"
                    />

                    <Text style={styles.label}>Purpose *</Text>
                    <TextInput
                      style={styles.input}
                      placeholder="What is this loan for?"
                      placeholderTextColor={colors.muted}
                      value={reqReason}
                      onChangeText={setReqReason}
                    />

                    <Text style={styles.label}>Repayment Period (months)</Text>
                    <TextInput
                      style={styles.input}
                      placeholder="1"
                      placeholderTextColor={colors.muted}
                      value={reqPeriod}
                      onChangeText={setReqPeriod}
                      keyboardType="numeric"
                    />

                    <TouchableOpacity
                      style={[styles.submitBtn, submitting && { opacity: 0.6 }]}
                      onPress={handleRequestLoan}
                      disabled={submitting}
                    >
                      {submitting ? <ActivityIndicator color={colors.buttonDarkText} /> : <Text style={styles.submitBtnText}>Submit Request</Text>}
                    </TouchableOpacity>
                  </>
                )}

                <TouchableOpacity style={styles.cancelModalBtn} onPress={() => setShowRequestModal(false)}>
                  <Text style={styles.cancelModalText}>Cancel</Text>
                </TouchableOpacity>
              </ScrollView>
            </View>
            </TouchableWithoutFeedback>
          </View>
          </TouchableWithoutFeedback>
        </KeyboardAvoidingView>
      </Modal>
    </View>
  );
}
