import React, { useState, useCallback } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  ActivityIndicator, Alert, TextInput, Modal,
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import {
  getLoan, fundLoan, signAgreement, disburseLoan, repayLoan,
  cancelLoan, defaultLoan, openDispute, getProfile,
} from '../services/api';

export default function LoanDetailScreen({ route, navigation }) {
  const { loanId } = route.params;
  const [loan, setLoan] = useState(null);
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);
  const [acting, setActing] = useState(false);
  const [showFund, setShowFund] = useState(false);
  const [showRepay, setShowRepay] = useState(false);
  const [showDispute, setShowDispute] = useState(false);
  const [interestRate, setInterestRate] = useState('5');
  const [repayAmount, setRepayAmount] = useState('');
  const [disputeReason, setDisputeReason] = useState('');
  const [disputeEvidence, setDisputeEvidence] = useState('');

  const loadData = async () => {
    try {
      const [l, p] = await Promise.all([getLoan(loanId), getProfile()]);
      setLoan(l);
      setProfile(p);
    } catch (e) { console.error(e); }
    finally { setLoading(false); }
  };

  useFocusEffect(useCallback(() => { loadData(); }, []));

  const isBorrower = profile && loan && profile.id === loan.borrowerId;
  const isLender = profile && loan && profile.id === loan.lenderId;

  const doAction = async (action, successMsg) => {
    setActing(true);
    try { await action(); loadData(); if (successMsg) Alert.alert('Success', successMsg); }
    catch (e) { Alert.alert('Error', e.message); }
    finally { setActing(false); }
  };

  const handleFund = () => {
    if (!interestRate || parseFloat(interestRate) < 0) { Alert.alert('Error', 'Enter a valid interest rate'); return; }
    doAction(async () => {
      await fundLoan({ loanId: loan.id, interestRate: parseFloat(interestRate) });
      setShowFund(false);
    }, 'Loan funded. Agreement pending signatures.');
  };

  const handleSign = () => doAction(() => signAgreement(loan.id), 'Agreement signed.');
  
  const handleDisburse = () => {
    Alert.alert('Disburse Loan', `Send GHS ${loan.amount} to ${loan.borrowerName}?`, [
      { text: 'Cancel' },
      { text: 'Disburse', onPress: () => doAction(() => disburseLoan(loan.id), 'Loan disbursed and active.') },
    ]);
  };

  const handleRepay = () => {
    const amt = repayAmount ? parseFloat(repayAmount) : null;
    doAction(async () => { await repayLoan(loan.id, amt); setShowRepay(false); setRepayAmount(''); }, 'Repayment recorded.');
  };

  const handleCancel = () => {
    Alert.alert('Cancel Loan', 'Cancel this request?', [
      { text: 'No' },
      { text: 'Yes', style: 'destructive', onPress: () => doAction(() => cancelLoan(loan.id), 'Loan cancelled.') },
    ]);
  };

  const handleDefault = () => {
    Alert.alert('Mark Defaulted', 'This will significantly impact the borrower\'s trust score.', [
      { text: 'Cancel' },
      { text: 'Mark Defaulted', style: 'destructive', onPress: () => doAction(() => defaultLoan(loan.id), 'Loan defaulted.') },
    ]);
  };

  const handleDispute = () => {
    if (!disputeReason.trim()) { Alert.alert('Error', 'Enter a reason'); return; }
    doAction(async () => {
      await openDispute({ loanId: loan.id, reason: disputeReason, evidence: disputeEvidence });
      setShowDispute(false); setDisputeReason(''); setDisputeEvidence('');
    }, 'Dispute opened. Admin will review.');
  };

  const statusColor = (s) => ({ REQUESTED:'#FFC107', AGREEMENT_PENDING:'#FF9800', AGREEMENT_SIGNED:'#2196F3', ACTIVE:'#4CAF50', DUE:'#FF9800', GRACE_PERIOD:'#e94560', REPAID:'#4CAF50', DEFAULTED:'#f44336', DISPUTED:'#9C27B0', CANCELLED:'#666' }[s] || '#666');
  const fmtDate = (d) => d ? new Date(d).toLocaleDateString('en-GB', { day:'numeric', month:'short', year:'numeric', hour:'2-digit', minute:'2-digit' }) : 'N/A';

  if (loading) return <View style={styles.center}><ActivityIndicator size="large" color="#e94560" /></View>;
  if (!loan) return <View style={styles.center}><Text style={{ color:'#e94560', fontSize:16 }}>Loan not found</Text></View>;

  const totalOwed = loan.totalRepaymentAmount + loan.overdueInterestAccrued - loan.amountRepaid;

  return (
    <ScrollView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()}><Text style={styles.back}>← Back</Text></TouchableOpacity>
        <Text style={styles.title}>Loan Details</Text>
        <View style={{ width: 50 }} />
      </View>

      {/* Amount Card */}
      <View style={styles.amountCard}>
        <Text style={styles.amountLabel}>Loan Amount</Text>
        <Text style={styles.amount}>GHS {loan.amount}</Text>
        <View style={[styles.badge, { backgroundColor: statusColor(loan.status) }]}>
          <Text style={styles.badgeText}>{loan.status.replace(/_/g, ' ')}</Text>
        </View>
      </View>

      {/* Details */}
      <View style={styles.card}>
        {[
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
          ...(loan.disbursedAt ? [['Disbursed', fmtDate(loan.disbursedAt)]] : []),
          ...(loan.overdueInterestAccrued > 0 ? [['Overdue Interest', `GHS ${loan.overdueInterestAccrued.toFixed(2)}`]] : []),
          ...(loan.gracePeriodEnd ? [['Grace Period Ends', fmtDate(loan.gracePeriodEnd)]] : []),
        ].map(([label, value], i) => (
          <View key={i} style={styles.row}>
            <Text style={styles.rowLabel}>{label}</Text>
            <Text style={[styles.rowValue, label === 'Overdue Interest' && { color: '#e94560' }]}>{value}</Text>
          </View>
        ))}
      </View>

      {/* Progress */}
      {loan.totalRepaymentAmount > 0 && !['REPAID','CANCELLED','REQUESTED'].includes(loan.status) && (
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Repayment Progress</Text>
          <View style={styles.progressBar}>
            <View style={[styles.progressFill, { width: `${Math.min((loan.amountRepaid / (loan.totalRepaymentAmount + loan.overdueInterestAccrued)) * 100, 100)}%` }]} />
          </View>
          <Text style={styles.progressText}>GHS {loan.amountRepaid.toFixed(2)} / {(loan.totalRepaymentAmount + loan.overdueInterestAccrued).toFixed(2)}</Text>
          {totalOwed > 0 && <Text style={styles.remaining}>Remaining: GHS {totalOwed.toFixed(2)}</Text>}
        </View>
      )}

      {/* Actions */}
      <View style={styles.actions}>
        {loan.status === 'REQUESTED' && !isBorrower && (
          <TouchableOpacity style={styles.primaryBtn} onPress={() => setShowFund(true)}>
            <Text style={styles.btnText}>Fund This Loan</Text>
          </TouchableOpacity>
        )}
        {loan.status === 'AGREEMENT_PENDING' && (isBorrower || isLender) && (
          <TouchableOpacity style={styles.primaryBtn} onPress={handleSign} disabled={acting}>
            {acting ? <ActivityIndicator color="#fff" /> : <Text style={styles.btnText}>Sign Agreement</Text>}
          </TouchableOpacity>
        )}
        {loan.status === 'AGREEMENT_SIGNED' && isLender && (
          <TouchableOpacity style={styles.primaryBtn} onPress={handleDisburse} disabled={acting}>
            {acting ? <ActivityIndicator color="#fff" /> : <Text style={styles.btnText}>Disburse GHS {loan.amount}</Text>}
          </TouchableOpacity>
        )}
        {['ACTIVE','DUE','GRACE_PERIOD'].includes(loan.status) && isBorrower && (
          <TouchableOpacity style={styles.primaryBtn} onPress={() => { setRepayAmount(totalOwed.toFixed(2)); setShowRepay(true); }}>
            <Text style={styles.btnText}>Repay Loan</Text>
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
        {['ACTIVE','DUE','GRACE_PERIOD','REPAID'].includes(loan.status) && (isBorrower || isLender) && (
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
            <TextInput style={styles.input} placeholder="e.g. 5" placeholderTextColor="#555" value={interestRate} onChangeText={setInterestRate} keyboardType="numeric" />
            {parseFloat(interestRate) > 0 && <Text style={styles.calcText}>Total repayment: GHS {(loan.amount * (1 + parseFloat(interestRate || 0) / 100)).toFixed(2)}</Text>}
            <TouchableOpacity style={styles.primaryBtn} onPress={handleFund} disabled={acting}>
              {acting ? <ActivityIndicator color="#fff" /> : <Text style={styles.btnText}>Confirm & Fund</Text>}
            </TouchableOpacity>
            <TouchableOpacity style={styles.cancelBtn} onPress={() => setShowFund(false)}><Text style={styles.cancelText}>Cancel</Text></TouchableOpacity>
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
            <TextInput style={styles.input} placeholder={totalOwed.toFixed(2)} placeholderTextColor="#555" value={repayAmount} onChangeText={setRepayAmount} keyboardType="numeric" />
            <TouchableOpacity style={styles.primaryBtn} onPress={handleRepay} disabled={acting}>
              {acting ? <ActivityIndicator color="#fff" /> : <Text style={styles.btnText}>Confirm Repayment</Text>}
            </TouchableOpacity>
            <TouchableOpacity style={styles.cancelBtn} onPress={() => setShowRepay(false)}><Text style={styles.cancelText}>Cancel</Text></TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* Dispute Modal */}
      <Modal visible={showDispute} animationType="slide" transparent>
        <View style={styles.modalBg}>
          <View style={styles.modal}>
            <Text style={styles.modalTitle}>Open Dispute</Text>
            <Text style={styles.label}>Reason *</Text>
            <TextInput style={[styles.input, { height: 80 }]} placeholder="Why are you disputing?" placeholderTextColor="#555" value={disputeReason} onChangeText={setDisputeReason} multiline />
            <Text style={styles.label}>Evidence</Text>
            <TextInput style={[styles.input, { height: 80 }]} placeholder="Any supporting evidence" placeholderTextColor="#555" value={disputeEvidence} onChangeText={setDisputeEvidence} multiline />
            <TouchableOpacity style={styles.primaryBtn} onPress={handleDispute} disabled={acting}>
              {acting ? <ActivityIndicator color="#fff" /> : <Text style={styles.btnText}>Submit Dispute</Text>}
            </TouchableOpacity>
            <TouchableOpacity style={styles.cancelBtn} onPress={() => setShowDispute(false)}><Text style={styles.cancelText}>Cancel</Text></TouchableOpacity>
          </View>
        </View>
      </Modal>

      <View style={{ height: 40 }} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#1a1a2e' },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#1a1a2e' },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 24, paddingTop: 60 },
  back: { color: '#e94560', fontSize: 16 },
  title: { color: '#fff', fontSize: 20, fontWeight: 'bold' },
  amountCard: { backgroundColor: '#16213e', marginHorizontal: 24, borderRadius: 16, padding: 24, alignItems: 'center', marginBottom: 16 },
  amountLabel: { color: '#a0a0b0', fontSize: 14 },
  amount: { color: '#fff', fontSize: 40, fontWeight: 'bold', marginTop: 4 },
  badge: { borderRadius: 8, paddingHorizontal: 16, paddingVertical: 6, marginTop: 12 },
  badgeText: { color: '#fff', fontSize: 13, fontWeight: '700' },
  card: { backgroundColor: '#16213e', marginHorizontal: 24, borderRadius: 16, padding: 20, marginBottom: 16 },
  cardTitle: { color: '#fff', fontSize: 16, fontWeight: 'bold', marginBottom: 12 },
  row: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: '#2a2a4a' },
  rowLabel: { color: '#a0a0b0', fontSize: 14 },
  rowValue: { color: '#fff', fontSize: 14, fontWeight: '600', textAlign: 'right', flex: 1, marginLeft: 16 },
  progressBar: { height: 8, backgroundColor: '#2a2a4a', borderRadius: 4, overflow: 'hidden' },
  progressFill: { height: '100%', backgroundColor: '#4CAF50', borderRadius: 4 },
  progressText: { color: '#a0a0b0', fontSize: 13, marginTop: 8, textAlign: 'center' },
  remaining: { color: '#FFC107', fontSize: 14, fontWeight: '600', textAlign: 'center', marginTop: 4 },
  actions: { paddingHorizontal: 24, marginTop: 8 },
  primaryBtn: { backgroundColor: '#e94560', borderRadius: 12, padding: 16, alignItems: 'center', marginBottom: 10 },
  dangerBtn: { backgroundColor: '#f44336', borderRadius: 12, padding: 16, alignItems: 'center', marginBottom: 10 },
  outlineBtn: { borderWidth: 1, borderColor: '#9C27B0', borderRadius: 12, padding: 16, alignItems: 'center', marginBottom: 10 },
  btnText: { color: '#fff', fontSize: 16, fontWeight: 'bold' },
  outlineText: { color: '#9C27B0', fontSize: 16, fontWeight: '600' },
  modalBg: { flex: 1, backgroundColor: 'rgba(0,0,0,0.7)', justifyContent: 'center', padding: 24 },
  modal: { backgroundColor: '#16213e', borderRadius: 16, padding: 24 },
  modalTitle: { color: '#fff', fontSize: 20, fontWeight: 'bold', textAlign: 'center' },
  modalSub: { color: '#a0a0b0', fontSize: 14, textAlign: 'center', marginTop: 4, marginBottom: 16 },
  label: { color: '#a0a0b0', fontSize: 14, marginBottom: 6, marginTop: 12 },
  input: { backgroundColor: '#1a1a2e', borderRadius: 12, padding: 14, fontSize: 16, color: '#fff', borderWidth: 1, borderColor: '#2a2a4a' },
  calcText: { color: '#4CAF50', fontSize: 14, marginTop: 8, textAlign: 'center' },
  cancelBtn: { padding: 16, alignItems: 'center', marginTop: 4 },
  cancelText: { color: '#a0a0b0', fontSize: 16 },
});
