import React, { useState, useCallback, useMemo } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  ActivityIndicator, RefreshControl, TextInput, Modal,
  KeyboardAvoidingView, Platform, Dimensions,
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { RouteProp } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { PieChart } from 'react-native-chart-kit';
import {
  getCircle, inviteMember, leaveCircle,
  getCircleLoans, getCircleExpenses, getCircleBalances, getCircleInsights,
  requestPayment, confirmPayment,
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
  phone?: string;
  memberRole: string;
  circleTrustScore: number;
  loansGivenInCircle: number;
  loansReceivedInCircle: number;
  loansRepaidInCircle: number;
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
  paymentRequested: boolean;
}

interface Expense {
  expenseId: number;
  description: string;
  totalAmount: number;
  paidBy: string;
  paidById: number;
  category?: string;
  createdAt?: string;
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
  infoBar: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 16, backgroundColor: c.surface, paddingVertical: 16, borderBottomWidth: 1, borderBottomColor: c.border },
  infoItem: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  infoText: { fontSize: 15, fontWeight: '600', color: c.dark },
  infoDot: { width: 5, height: 5, borderRadius: 3, backgroundColor: c.border },
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
  expenseCard: { backgroundColor: c.surface, borderRadius: 14, borderLeftWidth: 4, padding: 14, borderWidth: 1, borderColor: c.border },
  expenseTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 8 },
  expenseDesc: { fontSize: 16, fontWeight: '700', color: c.dark, flex: 1, marginRight: 8 },
  expenseAmount: { fontSize: 20, fontWeight: '800', color: c.dark, textAlign: 'right' },
  expenseMeta: { fontSize: 12, color: c.muted },
  categoryBadge: { borderRadius: 20, paddingHorizontal: 10, paddingVertical: 3, alignSelf: 'flex-start', marginBottom: 8 },
  categoryBadgeText: { fontSize: 10, fontWeight: '700' },
  expenseBottomRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  payerRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  payerAvatar: { width: 22, height: 22, borderRadius: 11, backgroundColor: c.buttonDark, justifyContent: 'center', alignItems: 'center' },
  payerAvatarText: { color: c.buttonDarkText, fontSize: 9, fontWeight: '700' },
  expenseDate: { fontSize: 11, color: c.muted },
  splitsContainer: { marginTop: 12, borderTopWidth: 1, borderTopColor: c.border, paddingTop: 12 },
  progressLabel: { fontSize: 11, color: c.muted, marginBottom: 6, fontWeight: '600' },
  progressBarTrack: { height: 6, borderRadius: 3, backgroundColor: c.border, overflow: 'hidden', marginBottom: 12 },
  progressBarFill: { height: 6, borderRadius: 3, backgroundColor: c.success },
  splitRow: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: c.border },
  splitAvatar: { width: 30, height: 30, borderRadius: 15, backgroundColor: c.bg, borderWidth: 1, borderColor: c.border, justifyContent: 'center', alignItems: 'center' },
  splitAvatarText: { fontSize: 11, fontWeight: '700', color: c.dark },
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
  healthBadge: { borderRadius: 999, paddingHorizontal: 20, paddingVertical: 8, marginTop: 10 },
  healthBadgeText: { fontSize: 26, fontWeight: '900' },
  categoryChartCard: { backgroundColor: c.surface, borderRadius: 14, padding: 16, borderWidth: 1, borderColor: c.border, alignItems: 'center' },
  categoryChartTitle: { fontSize: 14, fontWeight: '700', color: c.dark, alignSelf: 'flex-start', marginBottom: 4 },
  legendList: { width: '100%', marginTop: 14, gap: 2 },
  legendRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: c.border },
  legendDot: { width: 10, height: 10, borderRadius: 5, marginRight: 10 },
  legendCategory: { flex: 1, fontSize: 13, color: c.dark, fontWeight: '600' },
  legendPercent: { fontSize: 12, color: c.muted, marginRight: 10, width: 36, textAlign: 'right' },
  legendAmount: { fontSize: 13, color: c.dark, fontWeight: '700', width: 90, textAlign: 'right' },
  statGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  statCard: { width: '47%', backgroundColor: c.surface, borderRadius: 12, borderWidth: 1, borderColor: c.border, padding: 14 },
  statCardIconBox: { width: 34, height: 34, borderRadius: 10, justifyContent: 'center', alignItems: 'center', marginBottom: 8 },
  statCardValue: { fontSize: 17, fontWeight: '800', color: c.dark },
  statCardLabel: { fontSize: 11, color: c.muted, marginTop: 2 },
  emptyCard: { backgroundColor: c.surface, borderRadius: 14, padding: 28, alignItems: 'center', borderWidth: 1, borderColor: c.border },
  emptyTitle: { fontSize: 14, fontWeight: '600', color: c.muted, marginTop: 10 },
  modalBg: { flex: 1, backgroundColor: 'rgba(0,0,0,0.6)', justifyContent: 'flex-end' },
  modal: { backgroundColor: c.surface, borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 24 },
  modalTitle: { fontSize: 18, fontWeight: '700', color: c.dark, textAlign: 'center', marginBottom: 16 },
  label: { fontSize: 12, color: c.muted, fontWeight: '600', marginBottom: 6, marginTop: 14 },
  input: { backgroundColor: c.bg, borderRadius: 10, padding: 14, fontSize: 14, color: c.dark, borderWidth: 1, borderColor: c.border },
  cancelBtn: { padding: 14, alignItems: 'center', marginTop: 4 },
  cancelBtnText: { color: c.muted, fontSize: 14 },
  memberDetailRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: c.border },
  memberDetailLabel: { fontSize: 13, color: c.muted },
  memberDetailValue: { fontSize: 13, fontWeight: '700', color: c.dark },
  memberDetailScore: { fontSize: 32, fontWeight: '800', color: c.dark, textAlign: 'center', marginVertical: 4 },
  memberDetailScoreLabel: { fontSize: 11, color: c.muted, textAlign: 'center', marginBottom: 16 },
  memberDetailAvatar: { width: 56, height: 56, borderRadius: 28, backgroundColor: c.buttonDark, justifyContent: 'center', alignItems: 'center', alignSelf: 'center', marginBottom: 8 },
  memberDetailAvatarText: { color: c.buttonDarkText, fontSize: 20, fontWeight: '700' },
  memberDetailName: { fontSize: 17, fontWeight: '700', color: c.dark, textAlign: 'center', marginBottom: 2 },
  memberDetailRole: { fontSize: 12, color: c.muted, textAlign: 'center', marginBottom: 12 },
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
  const [requestingId, setRequestingId] = useState<number | null>(null);
  const [requestError, setRequestError] = useState<Record<number, string>>({});
  const [confirmingId, setConfirmingId] = useState<number | null>(null);
  const [confirmError, setConfirmError] = useState<Record<number, string>>({});
  const [insights, setInsights] = useState<Insights | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [refreshing, setRefreshing] = useState<boolean>(false);
  const [activeTab, setActiveTab] = useState<string>('members');
  const [showInvite, setShowInvite] = useState<boolean>(false);
  const [invitePhone, setInvitePhone] = useState<string>('');
  const [inviteError, setInviteError] = useState<string>('');
  const [inviting, setInviting] = useState<boolean>(false);
  const [selectedMember, setSelectedMember] = useState<CircleMember | null>(null);

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

  const handleRequestPayment = async (splitId: number): Promise<void> => {
    setRequestingId(splitId);
    setRequestError(prev => { const next = { ...prev }; delete next[splitId]; return next; });
    try {
      await requestPayment(splitId);
      showAlert('success', 'Payment Requested', 'Waiting for confirmation from the payer.');
      loadData();
    } catch (error) {
      setRequestError(prev => ({ ...prev, [splitId]: (error as Error).message }));
    } finally {
      setRequestingId(null);
    }
  };

  const handleConfirmPayment = async (splitId: number): Promise<void> => {
    setConfirmingId(splitId);
    setConfirmError(prev => { const next = { ...prev }; delete next[splitId]; return next; });
    try {
      await confirmPayment(splitId);
      showAlert('success', 'Confirmed', 'Payment confirmed and split settled.');
      loadData();
    } catch (error) {
      setConfirmError(prev => ({ ...prev, [splitId]: (error as Error).message }));
    } finally {
      setConfirmingId(null);
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

  const getCategoryColor = (category?: string): string => ({
    Food: colors.success, Transport: colors.statusBlue, Entertainment: colors.statusPurple,
    Utilities: colors.statusOrange, Shopping: colors.accent, Other: colors.slate400,
  }[category || ''] || colors.muted);

  const getInitials = (fullName: string): string => {
    const parts = fullName.trim().split(/\s+/);
    return parts.length > 1 ? (parts[0][0] + parts[parts.length - 1][0]).toUpperCase() : fullName.slice(0, 2).toUpperCase();
  };

  const formatExpenseDate = (dateString?: string): string => {
    if (!dateString) return '';
    return new Date(dateString).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });
  };

  const screenWidth = Dimensions.get('window').width;

  const categoryTotals: Record<string, number> = {};
  expenses.forEach((e) => {
    const cat = e.category || 'Other';
    categoryTotals[cat] = (categoryTotals[cat] || 0) + e.totalAmount;
  });
  const totalSpend = Object.values(categoryTotals).reduce((sum, v) => sum + v, 0);
  const categoryChartData = Object.entries(categoryTotals)
    .sort((a, b) => b[1] - a[1])
    .map(([category, amount]) => ({
      name: category,
      population: amount,
      color: getCategoryColor(category),
      legendFontColor: colors.muted,
      legendFontSize: 12,
      percentage: totalSpend > 0 ? Math.round((amount / totalSpend) * 100) : 0,
    }));

  const getHealthColor = (health: string): string => ({
    Excellent: colors.success, Good: colors.success, Fair: colors.warning, Poor: colors.danger,
  }[health] || colors.muted);

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
          <Ionicons name="people-outline" size={18} color={colors.muted} />
          <Text style={styles.infoText}>{circle.memberCount} members</Text>
        </View>
        <View style={styles.infoDot} />
        <View style={styles.infoItem}>
          <Ionicons name="cash-outline" size={18} color={colors.muted} />
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
              <TouchableOpacity key={member.userId} style={styles.memberCard} onPress={() => setSelectedMember(member)} activeOpacity={0.7}>
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
              </TouchableOpacity>
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
              expenses.map((expense) => {
                const settledCount = expense.splits.filter(s => s.settled || s.userId === expense.paidById).length;
                const totalCount = expense.splits.length;
                const progress = totalCount > 0 ? settledCount / totalCount : 0;
                const categoryColor = getCategoryColor(expense.category);
                return (
                  <View key={expense.expenseId} style={[styles.expenseCard, { borderLeftColor: categoryColor }]}>
                    <TouchableOpacity activeOpacity={0.7} onPress={() => setExpandedExpense(expandedExpense === expense.expenseId ? null : expense.expenseId)}>
                      <View style={styles.expenseTop}>
                        <Text style={styles.expenseDesc}>{expense.description}</Text>
                        <Text style={styles.expenseAmount}>GHS {expense.totalAmount}</Text>
                      </View>
                      {expense.category && (
                        <View style={[styles.categoryBadge, { backgroundColor: `${categoryColor}18` }]}>
                          <Text style={[styles.categoryBadgeText, { color: categoryColor }]}>{expense.category}</Text>
                        </View>
                      )}
                      <View style={styles.expenseBottomRow}>
                        <View style={styles.payerRow}>
                          <View style={styles.payerAvatar}>
                            <Text style={styles.payerAvatarText}>{getInitials(expense.paidBy)}</Text>
                          </View>
                          <Text style={styles.expenseMeta}>Paid by {expense.paidBy}</Text>
                        </View>
                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                          <Text style={styles.expenseDate}>{formatExpenseDate(expense.createdAt)}</Text>
                          <Ionicons name={expandedExpense === expense.expenseId ? 'chevron-up' : 'chevron-down'} size={14} color={colors.muted} />
                        </View>
                      </View>
                    </TouchableOpacity>
                    {expandedExpense === expense.expenseId && expense.splits && (
                      <View style={styles.splitsContainer}>
                        <Text style={styles.progressLabel}>{settledCount} of {totalCount} settled</Text>
                        <View style={styles.progressBarTrack}>
                          <View style={[styles.progressBarFill, { width: `${progress * 100}%` }]} />
                        </View>
                        {expense.splits.map((split) => {
                          const memberInfo = circle.members.find(m => m.userId === split.userId);
                          const name = memberInfo ? `${memberInfo.firstName} ${memberInfo.lastName}` : `User #${split.userId}`;
                          const isMe = user?.id === split.userId;
                          const isPayer = split.userId === expense.paidById;
                          const isCurrentUserPayer = user?.id === expense.paidById;
                          return (
                            <View key={split.id} style={styles.splitRow}>
                              <View style={styles.splitAvatar}>
                                <Text style={styles.splitAvatarText}>{getInitials(name)}</Text>
                              </View>
                              <View style={{ flex: 1 }}>
                                <Text style={[styles.splitName, isMe && { fontWeight: '700' }]}>{name}{isMe ? ' (You)' : ''}</Text>
                                <Text style={styles.splitAmount}>GHS {split.amountOwed.toFixed(2)}</Text>
                              </View>
                              {split.settled || isPayer ? (
                                <View style={styles.settledBadge}>
                                  <Ionicons name="checkmark-circle" size={14} color={colors.success} />
                                  <Text style={styles.settledText}>Settled</Text>
                                </View>
                              ) : isMe && !split.paymentRequested ? (
                                <View>
                                  <TouchableOpacity
                                    style={[styles.settleBtn, requestingId === split.id && { opacity: 0.6 }]}
                                    onPress={() => handleRequestPayment(split.id)}
                                    disabled={requestingId === split.id}
                                  >
                                    {requestingId === split.id
                                      ? <ActivityIndicator size="small" color={colors.buttonDarkText} />
                                      : <Text style={styles.settleBtnText}>I&apos;ve Paid</Text>}
                                  </TouchableOpacity>
                                  {requestError[split.id] && <Text style={{ color: colors.danger, fontSize: 11, marginTop: 2 }}>{requestError[split.id]}</Text>}
                                </View>
                              ) : isMe && split.paymentRequested ? (
                                <Text style={styles.splitPending}>Pending Confirmation</Text>
                              ) : split.paymentRequested && isCurrentUserPayer ? (
                                <View>
                                  <TouchableOpacity
                                    style={[styles.settleBtn, confirmingId === split.id && { opacity: 0.6 }]}
                                    onPress={() => handleConfirmPayment(split.id)}
                                    disabled={confirmingId === split.id}
                                  >
                                    {confirmingId === split.id
                                      ? <ActivityIndicator size="small" color={colors.buttonDarkText} />
                                      : <Text style={styles.settleBtnText}>Confirm Received</Text>}
                                  </TouchableOpacity>
                                  {confirmError[split.id] && <Text style={{ color: colors.danger, fontSize: 11, marginTop: 2 }}>{confirmError[split.id]}</Text>}
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
                );
              })
            )}
          </View>
        )}

        {/* Insights Tab */}
        {activeTab === 'insights' && insights && (
          <View style={styles.section}>
            <View style={styles.insightHero}>
              <Text style={styles.insightHealthLabel}>Circle Health</Text>
              <View style={[styles.healthBadge, { backgroundColor: `${getHealthColor(insights.circleHealth)}18` }]}>
                <Text style={[styles.healthBadgeText, { color: getHealthColor(insights.circleHealth) }]}>
                  {insights.circleHealth}
                </Text>
              </View>
            </View>
            {categoryChartData.length > 0 && (
              <View style={styles.categoryChartCard}>
                <Text style={styles.categoryChartTitle}>Shared Expenses by Category</Text>
                <PieChart
                  data={categoryChartData}
                  width={screenWidth - 64}
                  height={180}
                  chartConfig={{
                    color: () => colors.dark,
                    labelColor: () => colors.muted,
                  }}
                  accessor="population"
                  backgroundColor="transparent"
                  paddingLeft="8"
                  hasLegend={false}
                />
                <View style={styles.legendList}>
                  {categoryChartData.map((item, i) => (
                    <View key={i} style={styles.legendRow}>
                      <View style={[styles.legendDot, { backgroundColor: item.color }]} />
                      <Text style={styles.legendCategory}>{item.name}</Text>
                      <Text style={styles.legendPercent}>{item.percentage}%</Text>
                      <Text style={styles.legendAmount}>GHS {item.population.toFixed(2)}</Text>
                    </View>
                  ))}
                </View>
              </View>
            )}
            <View style={styles.statGrid}>
              {([
                ['Total Loans', insights.totalLoans, 'document-text-outline', colors.accent],
                ['Active Loans', insights.activeLoans, 'time-outline', colors.statusBlue],
                ['Repaid', insights.repaidLoans, 'checkmark-done-outline', colors.success],
                ['Defaulted', insights.defaultedLoans, 'warning-outline', colors.danger],
                ['Repayment Rate', `${insights.circleRepaymentRate}%`, 'trending-up-outline', colors.success],
                ['Total Circulated', `GHS ${insights.totalAmountCirculated}`, 'cash-outline', colors.dark],
                ['Avg Trust Score', insights.averageTrustScore, 'shield-checkmark-outline', colors.accent],
                ...(insights.topLender ? [['Top Lender', insights.topLender, 'star-outline', colors.warning]] : []),
                ...(insights.topBorrower ? [['Top Borrower', insights.topBorrower, 'person-outline', colors.statusPurple]] : []),
              ] as [string, string | number, keyof typeof Ionicons.glyphMap, string][]).map(([label, value, icon, color], i) => (
                <View key={i} style={styles.statCard}>
                  <View style={[styles.statCardIconBox, { backgroundColor: `${color}18` }]}>
                    <Ionicons name={icon} size={18} color={color} />
                  </View>
                  <Text style={styles.statCardValue}>{value}</Text>
                  <Text style={styles.statCardLabel}>{label}</Text>
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
              {inviteError !== '' && <Text style={{ color: colors.errorRed, fontSize: 13, marginTop: 6 }}>{inviteError}</Text>}
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

      {/* Member Detail Modal */}
      <Modal visible={selectedMember !== null} animationType="slide" transparent onRequestClose={() => setSelectedMember(null)}>
        <View style={styles.modalBg}>
          <View style={styles.modal}>
            {selectedMember && (
              <>
                <View style={styles.memberDetailAvatar}>
                  <Text style={styles.memberDetailAvatarText}>{selectedMember.firstName[0]}{selectedMember.lastName[0]}</Text>
                </View>
                <Text style={styles.memberDetailName}>{selectedMember.firstName} {selectedMember.lastName}</Text>
                <Text style={styles.memberDetailRole}>{selectedMember.memberRole === 'CREATOR' ? 'Admin' : 'Member'}</Text>
                <Text style={styles.memberDetailScore}>{selectedMember.circleTrustScore?.toFixed(0)}</Text>
                <Text style={styles.memberDetailScoreLabel}>Circle Trust Score</Text>
                {([
                  ['Phone', selectedMember.phone ?? '—'],
                  ['Loans Given', selectedMember.loansGivenInCircle],
                  ['Loans Received', selectedMember.loansReceivedInCircle],
                  ['Repaid On Time', selectedMember.loansRepaidInCircle],
                  ['Defaults', selectedMember.defaultsInCircle],
                ] as [string, string | number][]).map(([label, value]) => (
                  <View key={label} style={styles.memberDetailRow}>
                    <Text style={styles.memberDetailLabel}>{label}</Text>
                    <Text style={styles.memberDetailValue}>{value}</Text>
                  </View>
                ))}
                <TouchableOpacity style={styles.cancelBtn} onPress={() => setSelectedMember(null)}>
                  <Text style={styles.cancelBtnText}>Close</Text>
                </TouchableOpacity>
              </>
            )}
          </View>
        </View>
      </Modal>
    </View>
  );
}

