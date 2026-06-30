import React, { useState, useCallback, useMemo } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  ActivityIndicator, RefreshControl, TextInput, Modal,
  KeyboardAvoidingView, Platform,
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { RouteProp } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import {
  getCircle, inviteMember, leaveCircle,
  getCircleLoans, getCircleExpenses, getCircleBalances, getCircleInsights,
  settleExpense,
} from '../services/api';
import { useAppAlert } from '../components/AppAlert';
import { useConfirmModal } from '../components/ConfirmModal';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';
import { RootStackParamList } from '../navigation/AppNavigator';
import { ColorScheme } from '../theme/colors';

type Props = {
  route: RouteProp<RootStackParamList, 'CircleDetail'>;
  navigation: NativeStackNavigationProp<RootStackParamList, 'CircleDetail'>;
};

interface CircleMember {
  userId: number;
  firstName: string;
  lastName: string;
  memberRole: string;
  circleTrustScore: number;
  loansGivenInCircle: number;
  loansReceivedInCircle: number;
  defaultsInCircle: number;
}

interface Circle {
  name: string;
  description?: string;
  memberCount: number;
  maxLoanAmount: number;
  members: CircleMember[];
}

interface Loan {
  id: number;
  amount: number;
  status: string;
  reason: string;
  borrowerName: string;
  lenderName?: string;
  interestRate: number;
  totalRepaymentAmount: number;
}

interface ExpenseSplit {
  id: number;
  userId: number;
  amountOwed: number;
  settled: boolean;
}

interface Expense {
  expenseId: number;
  description: string;
  totalAmount: number;
  paidBy: string;
  paidById: number;
  category?: string;
  splits: ExpenseSplit[];
}

interface Insights {
  circleHealth: string;
  totalLoans: number;
  activeLoans: number;
  repaidLoans: number;
  defaultedLoans: number;
  circleRepaymentRate: number;
  totalAmountCirculated: number;
  averageTrustScore: number;
  topLender?: string;
  topBorrower?: string;
}

const createStyles = (c: ColorScheme) => StyleSheet.create({
  container: { flex: 1, backgroundColor: c.bg },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: c.bg },
  header: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    backgroundColor: c.surface, paddingHorizontal: 20, paddingTop: 56, paddingBottom: 16,
    borderBottomWidth: 1, borderBottomColor: c.border,
  },
  back: { color: c.accent, fontSize: 16, fontWeight: '600' },
  title: { flex: 1, fontSize: 18, fontWeight: '700', color: c.dark, textAlign: 'center', marginHorizontal: 12 },
  inviteBtn: { width: 36, height: 36, borderRadius: 10, backgroundColor: c.buttonDark, justifyContent: 'center', alignItems: 'center' },
  infoBar: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10, backgroundColor: c.surface, paddingBottom: 12, borderBottomWidth: 1, borderBottomColor: c.border },
  infoItem: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  infoText: { fontSize: 12, color: c.muted },
  infoDot: { width: 4, height: 4, borderRadius: 2, backgroundColor: c.border },
  tabRow: { flexDirection: 'row', backgroundColor: c.surface, borderBottomWidth: 1, borderBottomColor: c.border },
  tab: { flex: 1, paddingVertical: 12, alignItems: 'center', borderBottomWidth: 2, borderBottomColor: 'transparent' },
  activeTab: { borderBottomColor: c.accent },
  tabText: { fontSize: 12, fontWeight: '600', color: c.muted },
  activeTabText: { color: c.accent },
  content: { flex: 1 },
  section: { padding: 16, gap: 10 },
  memberCard: { backgroundColor: c.surface, borderRadius: 14, padding: 14, flexDirection: 'row', alignItems: 'center', gap: 12, borderWidth: 1, borderColor: c.border },
  memberAvatar: { width: 40, height: 40, borderRadius: 20, backgroundColor: c.buttonDark, justifyContent: 'center', alignItems: 'center' },
  memberAvatarText: { color: c.buttonDarkText, fontSize: 14, fontWeight: '700' },
  memberInfo: { flex: 1 },
  memberName: { fontSize: 14, fontWeight: '600', color: c.dark },
  memberMeta: { fontSize: 11, color: c.muted, marginTop: 2 },
  memberRight: { alignItems: 'center' },
  memberScore: { fontSize: 18, fontWeight: '800', color: c.dark },
  memberScoreLabel: { fontSize: 9, color: c.muted },
  creatorBadge: { backgroundColor: c.warningBgTint, borderRadius: 4, paddingHorizontal: 6, paddingVertical: 2, marginTop: 4 },
  creatorBadgeText: { fontSize: 9, fontWeight: '700', color: c.accent },
  leaveBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', padding: 14, borderRadius: 12, borderWidth: 1, borderColor: c.border, backgroundColor: c.surface, marginTop: 8 },
  leaveBtnText: { color: c.danger, fontSize: 14, fontWeight: '600' },
  primaryBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', backgroundColor: c.buttonDark, borderRadius: 12, padding: 14 },
  primaryBtnText: { color: c.buttonDarkText, fontSize: 14, fontWeight: '700' },
  loanCard: { backgroundColor: c.surface, borderRadius: 14, padding: 14, borderWidth: 1, borderColor: c.border },
  loanTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 },
  loanAmount: { fontSize: 20, fontWeight: '800', color: c.dark },
  statusBadge: { borderRadius: 6, paddingHorizontal: 8, paddingVertical: 3 },
  statusText: { fontSize: 10, fontWeight: '700' },
  loanReason: { fontSize: 13, color: c.muted, marginBottom: 4 },
  loanParties: { fontSize: 12, color: c.muted },
  loanInterest: { fontSize: 12, color: c.accent, marginTop: 4 },
  expenseCard: { backgroundColor: c.surface, borderRadius: 14, padding: 14, borderWidth: 1, borderColor: c.border },
  expenseTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 },
  expenseDesc: { fontSize: 14, fontWeight: '600', color: c.dark, flex: 1 },
  expenseAmount: { fontSize: 16, fontWeight: '800', color: c.danger },
  expenseMeta: { fontSize: 12, color: c.muted },
  expenseCategory: { fontSize: 11, color: c.muted, marginTop: 2 },
  splitsContainer: { marginTop: 10, borderTopWidth: 1, borderTopColor: c.border, paddingTop: 10 },
  splitRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 6, borderBottomWidth: 1, borderBottomColor: c.border },
  splitName: { fontSize: 13, color: c.dark },
  splitAmount: { fontSize: 12, color: c.muted, marginTop: 1 },
  settledBadge: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  settledText: { fontSize: 12, color: c.success, fontWeight: '600' },
  settleBtn: { backgroundColor: c.accent, borderRadius: 8, paddingHorizontal: 14, paddingVertical: 6 },
  settleBtnText: { color: c.surface, fontSize: 12, fontWeight: '600' },
  splitPending: { fontSize: 12, color: c.muted, fontStyle: 'italic' as const },
  balancesCard: { backgroundColor: c.surface, borderRadius: 14, padding: 14, borderWidth: 1, borderColor: c.border },
  balancesTitle: { fontSize: 13, fontWeight: '700', color: c.dark, marginBottom: 10 },
  balanceRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 6, borderBottomWidth: 1, borderBottomColor: c.border },
  balanceKey: { fontSize: 13, color: c.muted, flex: 1 },
  balanceAmount: { fontSize: 13, fontWeight: '700', color: c.danger },
  insightHero: { backgroundColor: c.surface, borderRadius: 14, padding: 20, alignItems: 'center', borderWidth: 1, borderColor: c.border },
  insightHealthLabel: { fontSize: 11, color: c.slate400, fontWeight: '600', letterSpacing: 0.8 },
  insightHealth: { fontSize: 28, fontWeight: '800', color: c.dark, marginTop: 4 },
  card: { backgroundColor: c.surface, borderRadius: 14, padding: 14, borderWidth: 1, borderColor: c.border },
  insightRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: c.border },
  insightLabel: { fontSize: 13, color: c.muted },
  insightValue: { fontSize: 13, fontWeight: '700', color: c.dark },
  emptyCard: { backgroundColor: c.surface, borderRadius: 14, padding: 28, alignItems: 'center', borderWidth: 1, borderColor: c.border },
  emptyTitle: { fontSize: 14, fontWeight: '600', color: c.muted, marginTop: 10 },
  modalBg: { flex: 1, backgroundColor: 'rgba(0,0,0,0.6)', justifyContent: 'flex-end' },
  modal: { backgroundColor: c.surface, borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 24 },
  modalTitle: { fontSize: 18, fontWeight: '700', color: c.dark, textAlign: 'center', marginBottom: 16 },
  label: { fontSize: 12, color: c.muted, fontWeight: '600', marginBottom: 6, marginTop: 14 },
  input: { backgroundColor: c.bg, borderRadius: 10, padding: 14, fontSize: 14, color: c.dark, borderWidth: 1, borderColor: c.border },
  cancelBtn: { padding: 14, alignItems: 'center', marginTop: 4 },
  cancelBtnText: { color: c.muted, fontSize: 14 },
});

export default function CircleDetailScreen({ route, navigation }: Props) {
  const { circleId } = route.params;
  const { showAlert } = useAppAlert();
  const { confirm } = useConfirmModal();
  const { user } = useAuth();
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const [circle, setCircle] = useState<Circle | null>(null);
  const [loans, setLoans] = useState<Loan[]>([]);
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [balances, setBalances] = useState<Record<string, number>>({});
  const [expandedExpense, setExpandedExpense] = useState<number | null>(null);
  const [settlingId, setSettlingId] = useState<number | null>(null);
  const [settleError, setSettleError] = useState<Record<number, string>>({});
  const [insights, setInsights] = useState<Insights | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [refreshing, setRefreshing] = useState<boolean>(false);
  const [activeTab, setActiveTab] = useState<string>('members');
  const [showInvite, setShowInvite] = useState<boolean>(false);
  const [invitePhone, setInvitePhone] = useState<string>('');
  const [inviteError, setInviteError] = useState<string>('');
  const [inviting, setInviting] = useState<boolean>(false);

  const loadData = async (): Promise<void> => {
    try {
      const [circleData, loansData, expensesData, balancesData] = await Promise.all([
        getCircle(circleId),
        getCircleLoans(circleId).catch(() => []),
        getCircleExpenses(circleId).catch(() => []),
        getCircleBalances(circleId).catch(() => ({ balances: {} })),
      ]);
      setCircle(circleData as Circle);
      setLoans(loansData as Loan[]);
      setExpenses(expensesData as Expense[]);
      setBalances((balancesData as { balances: Record<string, number> }).balances || {});
      try {
        const insightsData = await getCircleInsights(circleId);
        setInsights(insightsData as Insights);
      } catch (e) {}
    } catch (error) {
      console.error('Error loading circle:', error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useFocusEffect(useCallback(() => { loadData(); }, []));

  const handleSettle = async (splitId: number): Promise<void> => {
    setSettlingId(splitId);
    setSettleError(prev => { const next = { ...prev }; delete next[splitId]; return next; });
    try {
      await settleExpense(splitId);
      showAlert('success', 'Settled', 'Expense split settled successfully');
      loadData();
    } catch (error) {
      setSettleError(prev => ({ ...prev, [splitId]: (error as Error).message }));
    } finally {
      setSettlingId(null);
    }
  };

  const handleInvite = async (): Promise<void> => {
    if (!invitePhone.trim()) { setInviteError('Enter a phone number'); return; }
    setInviting(true);
    setInviteError('');
    try {
      const result = await inviteMember(circleId, invitePhone) as { message: string };
      showAlert('success', 'Invite Sent', result.message);
      setShowInvite(false);
      setInvitePhone('');
      loadData();
    } catch (error) {
      const raw = (error as Error).message;
      setInviteError(raw.includes('User not found')
        ? "No user found with this phone number. Make sure they've registered."
        : raw);
    } finally {
      setInviting(false);
    }
  };

  const handleLeave = async (): Promise<void> => {
    const ok = await confirm('Leave Circle', 'Are you sure you want to leave this circle?', 'Yes, Leave');
    if (!ok) return;
    try {
      await leaveCircle(circleId);
      navigation.goBack();
    } catch (error) {
      showAlert('error', 'Error', (error as Error).message);
    }
  };

  const getStatusColor = (status: string): string => ({
    REQUESTED: colors.warning, AGREEMENT_PENDING: colors.statusOrange, AGREEMENT_SIGNED: colors.statusBlue,
    ACTIVE: colors.success, DUE: colors.warning, GRACE_PERIOD: colors.danger,
    REPAID: colors.success, DEFAULTED: colors.danger, DISPUTED: colors.statusPurple, CANCELLED: colors.muted,
  }[status] || colors.muted);

  if (loading) return <View style={styles.center}><ActivityIndicator size="large" color={colors.accent} /></View>;
  if (!circle) return <View style={styles.center}><Text style={{ color: colors.danger }}>Circle not found</Text></View>;

  const tabs = ['members', 'loans', 'expenses', 'insights'];

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()}>
          <Text style={styles.back}>← Back</Text>
        </TouchableOpacity>
        <Text style={styles.title} numberOfLines={1}>{circle.name}</Text>
        <TouchableOpacity style={styles.inviteBtn} onPress={() => { setInviteError(''); setShowInvite(true); }}>
          <Ionicons name="person-add-outline" size={16} color={colors.buttonDarkText} />
        </TouchableOpacity>
      </View>

      {/* Info bar */}
      <View style={styles.infoBar}>
        <View style={styles.infoItem}>
          <Ionicons name="people-outline" size={14} color={colors.muted} />
          <Text style={styles.infoText}>{circle.memberCount} members</Text>
        </View>
        <View style={styles.infoDot} />
        <View style={styles.infoItem}>
          <Ionicons name="cash-outline" size={14} color={colors.muted} />
          <Text style={styles.infoText}>Max GHS {circle.maxLoanAmount?.toLocaleString()}</Text>
        </View>
      </View>

      {/* Tabs */}
      <View style={styles.tabRow}>
        {tabs.map((tab) => (
          <TouchableOpacity key={tab} style={[styles.tab, activeTab === tab && styles.activeTab]} onPress={() => setActiveTab(tab)}>
            <Text style={[styles.tabText, activeTab === tab && styles.activeTabText]}>
              {tab.charAt(0).toUpperCase() + tab.slice(1)}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      <ScrollView
        style={styles.content}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); loadData(); }} tintColor={colors.accent} />}
        showsVerticalScrollIndicator={false}
      >
        {/* Members Tab */}
        {activeTab === 'members' && (
          <View style={styles.section}>
            {circle.members.map((member) => (
              <View key={member.userId} style={styles.memberCard}>
                <View style={styles.memberAvatar}>
                  <Text style={styles.memberAvatarText}>{member.firstName[0]}{member.lastName[0]}</Text>
                </View>
                <View style={styles.memberInfo}>
                  <Text style={styles.memberName}>{member.firstName} {member.lastName}</Text>
                  <Text style={styles.memberMeta}>
                    Lent: {member.loansGivenInCircle} · Borrowed: {member.loansReceivedInCircle} · Defaults: {member.defaultsInCircle}
                  </Text>
                </View>
                <View style={styles.memberRight}>
                  <Text style={styles.memberScore}>{member.circleTrustScore?.toFixed(0)}</Text>
                  <Text style={styles.memberScoreLabel}>score</Text>
                  {member.memberRole === 'CREATOR' && (
                    <View style={styles.creatorBadge}>
                      <Text style={styles.creatorBadgeText}>Admin</Text>
                    </View>
                  )}
                </View>
              </View>
            ))}
            <TouchableOpacity style={styles.leaveBtn} onPress={handleLeave}>
              <Ionicons name="exit-outline" size={16} color={colors.danger} style={{ marginRight: 6 }} />
              <Text style={styles.leaveBtnText}>Leave Circle</Text>
            </TouchableOpacity>
          </View>
        )}

        {/* Loans Tab */}
        {activeTab === 'loans' && (
          <View style={styles.section}>
            <TouchableOpacity style={styles.primaryBtn} onPress={() => navigation.navigate('RequestLoan', { circleId })}>
              <Ionicons name="add-circle-outline" size={18} color={colors.buttonDarkText} style={{ marginRight: 6 }} />
              <Text style={styles.primaryBtnText}>Request a Loan</Text>
            </TouchableOpacity>
            {loans.length === 0 ? (
              <View style={styles.emptyCard}>
                <Ionicons name="card-outline" size={32} color={colors.muted} />
                <Text style={styles.emptyTitle}>No loans yet</Text>
              </View>
            ) : (
              loans.map((loan) => (
                <TouchableOpacity key={loan.id} style={styles.loanCard} onPress={() => navigation.navigate('LoanDetail', { loanId: loan.id })}>
                  <View style={styles.loanTop}>
                    <Text style={styles.loanAmount}>GHS {loan.amount}</Text>
                    <View style={[styles.statusBadge, { backgroundColor: `${getStatusColor(loan.status)}18` }]}>
                      <Text style={[styles.statusText, { color: getStatusColor(loan.status) }]}>{loan.status.replace(/_/g, ' ')}</Text>
                    </View>
                  </View>
                  <Text style={styles.loanReason}>{loan.reason}</Text>
                  <Text style={styles.loanParties}>{loan.borrowerName} ← {loan.lenderName || 'Waiting for lender'}</Text>
                  {loan.interestRate > 0 && (
                    <Text style={styles.loanInterest}>{loan.interestRate}% · Repay GHS {loan.totalRepaymentAmount}</Text>
                  )}
                </TouchableOpacity>
              ))
            )}
          </View>
        )}

        {/* Expenses Tab */}
        {activeTab === 'expenses' && (
          <View style={styles.section}>
            <TouchableOpacity style={styles.primaryBtn} onPress={() => navigation.navigate('AddSharedExpense', { circleId, members: circle.members })}>
              <Ionicons name="add-circle-outline" size={18} color={colors.buttonDarkText} style={{ marginRight: 6 }} />
              <Text style={styles.primaryBtnText}>Add Shared Expense</Text>
            </TouchableOpacity>
            {Object.keys(balances).length > 0 && (
              <View style={styles.balancesCard}>
                <Text style={styles.balancesTitle}>Outstanding Balances</Text>
                {Object.entries(balances).map(([key, amount]) => (
                  <View key={key} style={styles.balanceRow}>
                    <Text style={styles.balanceKey}>{key}</Text>
                    <Text style={styles.balanceAmount}>GHS {(amount as number).toFixed(2)}</Text>
                  </View>
                ))}
              </View>
            )}
            {expenses.length === 0 ? (
              <View style={styles.emptyCard}>
                <Ionicons name="receipt-outline" size={32} color={colors.muted} />
                <Text style={styles.emptyTitle}>No shared expenses yet</Text>
              </View>
            ) : (
              expenses.map((expense) => (
                <View key={expense.expenseId} style={styles.expenseCard}>
                  <TouchableOpacity activeOpacity={0.7} onPress={() => setExpandedExpense(expandedExpense === expense.expenseId ? null : expense.expenseId)}>
                    <View style={styles.expenseTop}>
                      <Text style={styles.expenseDesc}>{expense.description}</Text>
                      <Text style={styles.expenseAmount}>GHS {expense.totalAmount}</Text>
                    </View>
                    <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
                      <Text style={styles.expenseMeta}>Paid by {expense.paidBy}</Text>
                      <Ionicons name={expandedExpense === expense.expenseId ? 'chevron-up' : 'chevron-down'} size={14} color={colors.muted} />
                    </View>
                    {expense.category && <Text style={styles.expenseCategory}>{expense.category}</Text>}
                  </TouchableOpacity>
                  {expandedExpense === expense.expenseId && expense.splits && (
                    <View style={styles.splitsContainer}>
                      {expense.splits.map((split) => {
                        const memberInfo = circle.members.find(m => m.userId === split.userId);
                        const name = memberInfo ? `${memberInfo.firstName} ${memberInfo.lastName}` : `User #${split.userId}`;
                        const isMe = user?.id === split.userId;
                        const isPayer = split.userId === expense.paidById;
                        return (
                          <View key={split.id} style={styles.splitRow}>
                            <View style={{ flex: 1 }}>
                              <Text style={[styles.splitName, isMe && { fontWeight: '700' }]}>{name}{isMe ? ' (You)' : ''}</Text>
                              <Text style={styles.splitAmount}>GHS {split.amountOwed.toFixed(2)}</Text>
                            </View>
                            {split.settled || isPayer ? (
                              <View style={styles.settledBadge}>
                                <Ionicons name="checkmark-circle" size={14} color={colors.success} />
                                <Text style={styles.settledText}>Settled</Text>
                              </View>
                            ) : isMe ? (
                              <View>
                                <TouchableOpacity
                                  style={[styles.settleBtn, settlingId === split.id && { opacity: 0.6 }]}
                                  onPress={() => handleSettle(split.id)}
                                  disabled={settlingId === split.id}
                                >
                                  {settlingId === split.id
                                    ? <ActivityIndicator size="small" color={colors.buttonDarkText} />
                                    : <Text style={styles.settleBtnText}>Settle</Text>}
                                </TouchableOpacity>
                                {settleError[split.id] && <Text style={{ color: colors.danger, fontSize: 11, marginTop: 2 }}>{settleError[split.id]}</Text>}
                              </View>
                            ) : (
                              <Text style={styles.splitPending}>Pending</Text>
                            )}
                          </View>
                        );
                      })}
                    </View>
                  )}
                </View>
              ))
            )}
          </View>
        )}

        {/* Insights Tab */}
        {activeTab === 'insights' && insights && (
          <View style={styles.section}>
            <View style={styles.insightHero}>
              <Text style={styles.insightHealthLabel}>Circle Health</Text>
              <Text style={styles.insightHealth}>{insights.circleHealth}</Text>
            </View>
            <View style={styles.card}>
              {([
                ['Total Loans', insights.totalLoans],
                ['Active Loans', insights.activeLoans],
                ['Repaid', insights.repaidLoans],
                ['Defaulted', insights.defaultedLoans],
                ['Repayment Rate', `${insights.circleRepaymentRate}%`],
                ['Total Circulated', `GHS ${insights.totalAmountCirculated}`],
                ['Avg Trust Score', insights.averageTrustScore],
                ...(insights.topLender ? [['Top Lender', insights.topLender]] : []),
                ...(insights.topBorrower ? [['Top Borrower', insights.topBorrower]] : []),
              ] as [string, string | number][]).map(([label, value], i) => (
                <View key={i} style={styles.insightRow}>
                  <Text style={styles.insightLabel}>{label}</Text>
                  <Text style={styles.insightValue}>{value}</Text>
                </View>
              ))}
            </View>
          </View>
        )}

        <View style={{ height: 40 }} />
      </ScrollView>

      {/* Invite Modal */}
      <Modal visible={showInvite} animationType="slide" transparent>
        <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
          <View style={styles.modalBg}>
            <View style={styles.modal}>
              <Text style={styles.modalTitle}>Invite to {circle.name}</Text>
              <Text style={styles.label}>Phone Number</Text>
              <TextInput
                style={styles.input}
                placeholder="e.g. 0551234567"
                placeholderTextColor={colors.muted}
                value={invitePhone}
                onChangeText={(text) => { setInvitePhone(text); setInviteError(''); }}
                keyboardType="phone-pad"
              />
              {inviteError !== '' && <Text style={{ color: '#ef4444', fontSize: 13, marginTop: 6 }}>{inviteError}</Text>}
              <TouchableOpacity style={[styles.primaryBtn, { marginTop: 20 }, inviting && { opacity: 0.6 }]} onPress={handleInvite} disabled={inviting}>
                {inviting ? <ActivityIndicator color={colors.buttonDarkText} /> : <Text style={styles.primaryBtnText}>Send Invite</Text>}
              </TouchableOpacity>
              <TouchableOpacity style={styles.cancelBtn} onPress={() => setShowInvite(false)}>
                <Text style={styles.cancelBtnText}>Cancel</Text>
              </TouchableOpacity>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </View>
  );
}

