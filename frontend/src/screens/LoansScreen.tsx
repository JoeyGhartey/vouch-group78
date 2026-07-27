import React, { useState, useCallback, useMemo, useEffect } from 'react';
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
import { LOAN_REASONS, getCustomLoanReasons, addCustomLoanReason } from '../utils/customLoanReasons';
import { formatCategoryName } from '../utils/customCategories';
import { fonts } from '../theme/fonts';

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
  title: { fontSize: 22, fontWeight: '700', fontFamily: fonts.bold, color: c.dark },
  addBtn: { flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: c.buttonDark, borderRadius: 10, paddingHorizontal: 14, paddingVertical: 9 },
  addBtnText: { color: c.buttonDarkText, fontSize: 14, fontWeight: '600', fontFamily: fonts.semibold },
  modalBg: { flex: 1, backgroundColor: 'rgba(0,0,0,0.6)', justifyContent: 'flex-end' },
  modal: { backgroundColor: c.surface, borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 24, maxHeight: '90%' as const },
  modalTitle: { fontSize: 20, fontWeight: '700', fontFamily: fonts.bold, color: c.dark, textAlign: 'center', marginBottom: 20 },
  label: { fontSize: 12, color: c.muted, fontWeight: '600', fontFamily: fonts.semibold, marginBottom: 6, marginTop: 14 },
  input: { backgroundColor: c.bg, borderRadius: 10, padding: 14, fontSize: 14, fontFamily: fonts.regular, color: c.dark, borderWidth: 1, borderColor: c.border },
  circleChip: {
    backgroundColor: c.bg, borderRadius: 20, paddingHorizontal: 14,
    paddingVertical: 8, marginRight: 8, borderWidth: 1, borderColor: c.border,
  },
  circleChipSel: { backgroundColor: c.buttonDark, borderColor: c.buttonDark },
  circleChipText: { color: c.muted, fontSize: 12, fontWeight: '600', fontFamily: fonts.semibold },
  circleChipTextSel: { color: c.buttonDarkText },
  noCirclesBox: { alignItems: 'center', padding: 24 },
  noCirclesText: { fontSize: 13, color: c.muted, fontFamily: fonts.regular, textAlign: 'center', marginTop: 10, lineHeight: 20 },
  saveReasonRow: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    marginTop: 10, padding: 12, borderRadius: 12,
    backgroundColor: c.goldBgTint, borderWidth: 1, borderColor: c.border,
  },
  saveReasonCheckbox: {
    width: 20, height: 20, borderRadius: 5,
    borderWidth: 2, borderColor: c.border,
    justifyContent: 'center', alignItems: 'center',
  },
  saveReasonCheckboxChecked: { backgroundColor: c.accent, borderColor: c.accent },
  saveReasonText: { fontSize: 12, color: c.dark, fontWeight: '600', fontFamily: fonts.semibold, flex: 1 },
  submitBtn: { backgroundColor: c.buttonDark, borderRadius: 12, padding: 16, alignItems: 'center', marginTop: 24 },
  submitBtnText: { color: c.buttonDarkText, fontSize: 15, fontWeight: '700', fontFamily: fonts.bold },
  cancelModalBtn: { padding: 14, alignItems: 'center', marginTop: 4 },
  cancelModalText: { color: c.muted, fontSize: 14, fontFamily: fonts.medium },
  summaryCard: {
    backgroundColor: c.surface, marginHorizontal: 16, marginTop: 16, marginBottom: 8,
    borderRadius: 18, padding: 22, alignItems: 'center',
    borderWidth: 1, borderColor: c.border,
  },
  summaryIconBox: {
    width: 40, height: 40, borderRadius: 20,
    justifyContent: 'center', alignItems: 'center', marginBottom: 10,
  },
  summaryLabel: { fontSize: 12, color: c.muted, fontWeight: '600', fontFamily: fonts.semibold, letterSpacing: 0.6, textTransform: 'uppercase' as const },
  summaryAmount: { fontSize: 38, fontWeight: '800', fontFamily: fonts.extrabold, marginTop: 8, letterSpacing: -1 },
  summarySub: { fontSize: 12, color: c.muted, fontFamily: fonts.medium, marginTop: 6 },
  tabRow: {
    flexDirection: 'row', backgroundColor: c.surface,
    borderBottomWidth: 1, borderBottomColor: c.border, marginBottom: 4,
  },
  tab: { flex: 1, paddingVertical: 14, alignItems: 'center', borderBottomWidth: 2, borderBottomColor: 'transparent' },
  activeTab: { borderBottomColor: c.accent },
  tabText: { fontSize: 13, fontWeight: '600', fontFamily: fonts.semibold, color: c.muted },
  activeTabText: { color: c.accent },
  emptyContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 24 },
  emptyIconBox: {
    width: 72, height: 72, borderRadius: 36, backgroundColor: c.bg,
    justifyContent: 'center', alignItems: 'center', marginBottom: 4,
    borderWidth: 1, borderColor: c.border,
  },
  emptyTitle: { fontSize: 17, fontWeight: '700', fontFamily: fonts.bold, color: c.dark, marginTop: 14, marginBottom: 6 },
  emptyText: { fontSize: 13, color: c.muted, fontFamily: fonts.regular, textAlign: 'center', lineHeight: 19 },
  loanCard: {
    backgroundColor: c.surface, borderRadius: 16, padding: 16,
    borderWidth: 1, borderColor: c.border, flexDirection: 'row', gap: 12,
  },
  loanIconBox: {
    width: 42, height: 42, borderRadius: 12,
    justifyContent: 'center', alignItems: 'center',
  },
  loanCardBody: { flex: 1 },
  loanTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 6 },
  loanAmount: { fontSize: 21, fontWeight: '800', fontFamily: fonts.extrabold, color: c.dark },
  badge: { borderRadius: 8, paddingHorizontal: 9, paddingVertical: 4 },
  badgeText: { fontSize: 10, fontWeight: '700', fontFamily: fonts.bold, letterSpacing: 0.3 },
  loanReason: { fontSize: 14, fontWeight: '600', fontFamily: fonts.semibold, color: c.dark, marginBottom: 3 },
  loanCircle: { fontSize: 12, color: c.muted, fontFamily: fonts.medium, marginBottom: 10 },
  loanMeta: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 },
  metaText: { fontSize: 12, color: c.muted, fontFamily: fonts.medium, flexShrink: 1 },
  interest: { fontSize: 12, color: c.accent, fontWeight: '600', fontFamily: fonts.semibold },
  dueDateRow: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 6 },
  dueDate: { fontSize: 12, color: c.warning, fontFamily: fonts.medium },
  progressRow: { marginTop: 12 },
  progressBg: { height: 6, backgroundColor: c.border, borderRadius: 3, overflow: 'hidden' },
  progressFill: { height: '100%', borderRadius: 3 },
  progressText: { fontSize: 11, color: c.muted, fontFamily: fonts.medium, marginTop: 5, textAlign: 'right' },
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
  const [reasonChip, setReasonChip] = useState<string>('');
  const [customReason, setCustomReason] = useState<string>('');
  const [saveAsReason, setSaveAsReason] = useState<boolean>(false);
  const [customReasons, setCustomReasons] = useState<string[]>([]);
  const [reqPeriod, setReqPeriod] = useState<string>('1');
  const [submitting, setSubmitting] = useState<boolean>(false);
  const [circleError, setCircleError] = useState<string>('');
  const [amountError, setAmountError] = useState<string>('');
  const [reasonError, setReasonError] = useState<string>('');

  const reqReason = reasonChip === 'Other' ? customReason : reasonChip;

  // Preset reasons plus any the user has permanently saved on this device,
  // with "Other" always pinned last as the fallback/custom-entry option.
  const allReasons = useMemo(() => {
    const base = LOAN_REASONS.slice(0, -1);
    const extras = customReasons.filter(
      (r) => !base.some((b) => b.toLowerCase() === r.toLowerCase())
    );
    return [...base, ...extras, 'Other'];
  }, [customReasons]);

  useEffect(() => {
    getCustomLoanReasons().then(setCustomReasons);
  }, []);

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
    setReasonChip('');
    setCustomReason('');
    setSaveAsReason(false);
    setReqPeriod('1');
    setCircleError('');
    setAmountError('');
    setReasonError('');
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
    setCircleError('');
    setAmountError('');
    setReasonError('');
    if (!selectedCircleId) { setCircleError('Select a circle'); return; }
    const amt = parseFloat(reqAmount);
    if (!reqAmount || isNaN(amt) || amt <= 0) { setAmountError('Enter a valid amount'); return; }
    if (!reqReason.trim()) { setReasonError('Select or enter a purpose for the loan'); return; }
    const period = parseInt(reqPeriod, 10) || 1;

    setSubmitting(true);
    try {
      if (reasonChip === 'Other' && saveAsReason) {
        await addCustomLoanReason(customReason);
      }
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
        <View style={[styles.summaryIconBox, { backgroundColor: activeTab === 'borrowed' ? colors.dangerBgTint : colors.successBgTint }]}>
          <Ionicons
            name={activeTab === 'borrowed' ? 'arrow-up-circle-outline' : 'arrow-down-circle-outline'}
            size={22}
            color={activeTab === 'borrowed' ? colors.danger : colors.success}
          />
        </View>
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
          <View style={styles.emptyIconBox}>
            <Ionicons name={activeTab === 'borrowed' ? 'card-outline' : 'cash-outline'} size={30} color={colors.muted} />
          </View>
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
              activeOpacity={0.7}
            >
              <View style={[styles.loanIconBox, { backgroundColor: `${statusColor(item.status)}18` }]}>
                <Ionicons
                  name={activeTab === 'borrowed' ? 'arrow-down-outline' : 'arrow-up-outline'}
                  size={20}
                  color={statusColor(item.status)}
                />
              </View>
              <View style={styles.loanCardBody}>
                <View style={styles.loanTop}>
                  <Text style={styles.loanAmount}>GHS {formatMoney(item.amount)}</Text>
                  <View style={[styles.badge, { backgroundColor: `${statusColor(item.status)}18` }]}>
                    <Text style={[styles.badgeText, { color: statusColor(item.status) }]}>
                      {item.status.replace(/_/g, ' ')}
                    </Text>
                  </View>
                </View>
                <Text style={styles.loanReason} numberOfLines={1}>{item.reason}</Text>
                <Text style={styles.loanCircle}>{item.circleName}</Text>
                <View style={styles.loanMeta}>
                  <Text style={styles.metaText} numberOfLines={1}>
                    {activeTab === 'borrowed'
                      ? `Lender: ${item.lenderName || (item.isGroupFunded ? 'Group Funded' : 'Waiting...')}`
                      : `Borrower: ${item.borrowerName}`}
                  </Text>
                  {item.interestRate > 0 && (
                    <Text style={styles.interest}>{item.interestRate}%</Text>
                  )}
                </View>
                {item.dueDate && (
                  <View style={styles.dueDateRow}>
                    <Ionicons name="time-outline" size={13} color={colors.warning} />
                    <Text style={styles.dueDate}>Due {fmtDate(item.dueDate)}</Text>
                  </View>
                )}
                {item.totalRepaymentAmount > 0 && !['REPAID', 'CANCELLED', 'REQUESTED'].includes(item.status) && (
                  <View style={styles.progressRow}>
                    <View style={styles.progressBg}>
                      <View style={[styles.progressFill, {
                        backgroundColor: statusColor(item.status),
                        width: `${Math.min((item.amountRepaid / item.totalRepaymentAmount) * 100, 100)}%` as any
                      }]} />
                    </View>
                    <Text style={styles.progressText}>
                      GHS {formatMoney(item.amountRepaid)} / {formatMoney(item.totalRepaymentAmount)}
                    </Text>
                  </View>
                )}
              </View>
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
                        onPress={() => { setSelectedCircleId('ALL'); setCircleError(''); }}
                      >
                        <Text style={[styles.circleChipText, selectedCircleId === 'ALL' && styles.circleChipTextSel]}>All Circles</Text>
                      </TouchableOpacity>
                      {circles.map((c) => (
                        <TouchableOpacity
                          key={c.id}
                          style={[styles.circleChip, selectedCircleId === c.id && styles.circleChipSel]}
                          onPress={() => { setSelectedCircleId(c.id); setCircleError(''); }}
                        >
                          <Text style={[styles.circleChipText, selectedCircleId === c.id && styles.circleChipTextSel]}>{c.name}</Text>
                        </TouchableOpacity>
                      ))}
                    </ScrollView>
                    {circleError !== '' && <Text style={{ color: colors.errorRed, fontSize: 13, marginTop: 6 }}>{circleError}</Text>}

                    <Text style={styles.label}>Amount (GHS) *</Text>
                    <TextInput
                      style={styles.input}
                      placeholder="e.g. 500"
                      placeholderTextColor={colors.muted}
                      value={reqAmount}
                      onChangeText={(t) => { setReqAmount(t); setAmountError(''); }}
                      keyboardType="numeric"
                    />
                    {amountError !== '' && <Text style={{ color: colors.errorRed, fontSize: 13, marginTop: 6 }}>{amountError}</Text>}

                    <Text style={styles.label}>Purpose *</Text>
                    <ScrollView horizontal showsHorizontalScrollIndicator={false} keyboardShouldPersistTaps="handled">
                      {allReasons.map((r) => (
                        <TouchableOpacity
                          key={r}
                          style={[styles.circleChip, reasonChip === r && styles.circleChipSel]}
                          onPress={() => { setReasonChip(r); setReasonError(''); if (r !== 'Other') setSaveAsReason(false); }}
                        >
                          <Text style={[styles.circleChipText, reasonChip === r && styles.circleChipTextSel]}>{r}</Text>
                        </TouchableOpacity>
                      ))}
                    </ScrollView>

                    {reasonChip === 'Other' && (
                      <>
                        <TextInput
                          style={[styles.input, { marginTop: 10 }]}
                          placeholder="What is this loan for?"
                          placeholderTextColor={colors.muted}
                          value={customReason}
                          onChangeText={(t) => { setCustomReason(t); setReasonError(''); }}
                        />
                        {customReason.trim().length > 0 && (
                          <TouchableOpacity style={styles.saveReasonRow} onPress={() => setSaveAsReason((v) => !v)} activeOpacity={0.7}>
                            <View style={[styles.saveReasonCheckbox, saveAsReason && styles.saveReasonCheckboxChecked]}>
                              {saveAsReason && <Ionicons name="checkmark" size={13} color={colors.buttonDarkText} />}
                            </View>
                            <Text style={styles.saveReasonText}>
                              Save "{formatCategoryName(customReason)}" as a reason for next time
                            </Text>
                          </TouchableOpacity>
                        )}
                      </>
                    )}
                    {reasonError !== '' && <Text style={{ color: colors.errorRed, fontSize: 13, marginTop: 6 }}>{reasonError}</Text>}

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
