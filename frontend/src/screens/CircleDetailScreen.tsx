import React, { useState, useCallback } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  ActivityIndicator, RefreshControl, TextInput, Modal, Alert,
  KeyboardAvoidingView, Platform,
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { RouteProp } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import {
  getCircle, inviteMember, leaveCircle,
  getCircleLoans, getCircleExpenses, getCircleBalances, getCircleInsights,
} from '../services/api';
import { useAppAlert } from '../components/AppAlert';
import { RootStackParamList } from '../navigation/AppNavigator';

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

interface Expense {
  expenseId: number;
  description: string;
  totalAmount: number;
  paidBy: string;
  category?: string;
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

const BG = '#EDEEF2';
const WHITE = '#FFFFFF';
const DARK = '#0f172a';
const MUTED = '#6B7280';
const BORDER = '#E5E7EB';
const ACCENT = '#C9A84C';
const DANGER = '#dc2626';
const SUCCESS = '#16a34a';
const WARNING = '#d97706';

export default function CircleDetailScreen({ route, navigation }: Props) {
  const { circleId } = route.params;
  const { showAlert } = useAppAlert();
  const [circle, setCircle] = useState<Circle | null>(null);
  const [loans, setLoans] = useState<Loan[]>([]);
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [balances, setBalances] = useState<Record<string, number>>({});
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

  const handleLeave = (): void => {
    Alert.alert('Leave Circle', 'Are you sure you want to leave this circle?', [
      { text: 'Cancel' },
      {
        text: 'Leave', style: 'destructive',
        onPress: async () => {
          try {
            await leaveCircle(circleId);
            navigation.goBack();
          } catch (error) {
            Alert.alert('Error', (error as Error).message);
          }
        },
      },
    ]);
  };

  const getStatusColor = (status: string): string => ({
    REQUESTED: WARNING, AGREEMENT_PENDING: WARNING, AGREEMENT_SIGNED: '#2196F3',
    ACTIVE: SUCCESS, DUE: WARNING, GRACE_PERIOD: DANGER,
    REPAID: SUCCESS, DEFAULTED: DANGER, DISPUTED: '#9C27B0', CANCELLED: MUTED,
  }[status] || MUTED);

  if (loading) return <View style={styles.center}><ActivityIndicator size="large" color={ACCENT} /></View>;
  if (!circle) return <View style={styles.center}><Text style={{ color: DANGER }}>Circle not found</Text></View>;

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
          <Ionicons name="person-add-outline" size={16} color={WHITE} />
        </TouchableOpacity>
      </View>

      {/* Info bar */}
      <View style={styles.infoBar}>
        <View style={styles.infoItem}>
          <Ionicons name="people-outline" size={14} color={MUTED} />
          <Text style={styles.infoText}>{circle.memberCount} members</Text>
        </View>
        <View style={styles.infoDot} />
        <View style={styles.infoItem}>
          <Ionicons name="cash-outline" size={14} color={MUTED} />
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
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); loadData(); }} tintColor={ACCENT} />}
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
              <Ionicons name="exit-outline" size={16} color={DANGER} style={{ marginRight: 6 }} />
              <Text style={styles.leaveBtnText}>Leave Circle</Text>
            </TouchableOpacity>
          </View>
        )}

        {/* Loans Tab */}
        {activeTab === 'loans' && (
          <View style={styles.section}>
            <TouchableOpacity style={styles.primaryBtn} onPress={() => navigation.navigate('RequestLoan', { circleId })}>
              <Ionicons name="add-circle-outline" size={18} color={WHITE} style={{ marginRight: 6 }} />
              <Text style={styles.primaryBtnText}>Request a Loan</Text>
            </TouchableOpacity>
            {loans.length === 0 ? (
              <View style={styles.emptyCard}>
                <Ionicons name="card-outline" size={32} color={MUTED} />
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
              <Ionicons name="add-circle-outline" size={18} color={WHITE} style={{ marginRight: 6 }} />
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
                <Ionicons name="receipt-outline" size={32} color={MUTED} />
                <Text style={styles.emptyTitle}>No shared expenses yet</Text>
              </View>
            ) : (
              expenses.map((expense) => (
                <View key={expense.expenseId} style={styles.expenseCard}>
                  <View style={styles.expenseTop}>
                    <Text style={styles.expenseDesc}>{expense.description}</Text>
                    <Text style={styles.expenseAmount}>GHS {expense.totalAmount}</Text>
                  </View>
                  <Text style={styles.expenseMeta}>Paid by {expense.paidBy}</Text>
                  {expense.category && <Text style={styles.expenseCategory}>{expense.category}</Text>}
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
                placeholderTextColor={MUTED}
                value={invitePhone}
                onChangeText={(text) => { setInvitePhone(text); setInviteError(''); }}
                keyboardType="phone-pad"
              />
              {inviteError !== '' && <Text style={{ color: '#ef4444', fontSize: 13, marginTop: 6 }}>{inviteError}</Text>}
              <TouchableOpacity style={[styles.primaryBtn, { marginTop: 20 }, inviting && { opacity: 0.6 }]} onPress={handleInvite} disabled={inviting}>
                {inviting ? <ActivityIndicator color={WHITE} /> : <Text style={styles.primaryBtnText}>Send Invite</Text>}
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

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: BG },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: BG },
  header: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    backgroundColor: WHITE, paddingHorizontal: 20, paddingTop: 56, paddingBottom: 16,
    borderBottomWidth: 1, borderBottomColor: BORDER,
  },
  back: { color: ACCENT, fontSize: 16, fontWeight: '600' },
  title: { flex: 1, fontSize: 18, fontWeight: '700', color: DARK, textAlign: 'center', marginHorizontal: 12 },
  inviteBtn: { width: 36, height: 36, borderRadius: 10, backgroundColor: DARK, justifyContent: 'center', alignItems: 'center' },
  infoBar: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10, backgroundColor: WHITE, paddingBottom: 12, borderBottomWidth: 1, borderBottomColor: BORDER },
  infoItem: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  infoText: { fontSize: 12, color: MUTED },
  infoDot: { width: 4, height: 4, borderRadius: 2, backgroundColor: BORDER },
  tabRow: { flexDirection: 'row', backgroundColor: WHITE, borderBottomWidth: 1, borderBottomColor: BORDER },
  tab: { flex: 1, paddingVertical: 12, alignItems: 'center', borderBottomWidth: 2, borderBottomColor: 'transparent' },
  activeTab: { borderBottomColor: ACCENT },
  tabText: { fontSize: 12, fontWeight: '600', color: MUTED },
  activeTabText: { color: ACCENT },
  content: { flex: 1 },
  section: { padding: 16, gap: 10 },

  memberCard: { backgroundColor: WHITE, borderRadius: 14, padding: 14, flexDirection: 'row', alignItems: 'center', gap: 12, borderWidth: 1, borderColor: BORDER },
  memberAvatar: { width: 40, height: 40, borderRadius: 20, backgroundColor: DARK, justifyContent: 'center', alignItems: 'center' },
  memberAvatarText: { color: WHITE, fontSize: 14, fontWeight: '700' },
  memberInfo: { flex: 1 },
  memberName: { fontSize: 14, fontWeight: '600', color: DARK },
  memberMeta: { fontSize: 11, color: MUTED, marginTop: 2 },
  memberRight: { alignItems: 'center' },
  memberScore: { fontSize: 18, fontWeight: '800', color: DARK },
  memberScoreLabel: { fontSize: 9, color: MUTED },
  creatorBadge: { backgroundColor: '#FDF6E3', borderRadius: 4, paddingHorizontal: 6, paddingVertical: 2, marginTop: 4 },
  creatorBadgeText: { fontSize: 9, fontWeight: '700', color: ACCENT },

  leaveBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', padding: 14, borderRadius: 12, borderWidth: 1, borderColor: BORDER, backgroundColor: WHITE, marginTop: 8 },
  leaveBtnText: { color: DANGER, fontSize: 14, fontWeight: '600' },

  primaryBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', backgroundColor: DARK, borderRadius: 12, padding: 14 },
  primaryBtnText: { color: WHITE, fontSize: 14, fontWeight: '700' },

  loanCard: { backgroundColor: WHITE, borderRadius: 14, padding: 14, borderWidth: 1, borderColor: BORDER },
  loanTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 },
  loanAmount: { fontSize: 20, fontWeight: '800', color: DARK },
  statusBadge: { borderRadius: 6, paddingHorizontal: 8, paddingVertical: 3 },
  statusText: { fontSize: 10, fontWeight: '700' },
  loanReason: { fontSize: 13, color: MUTED, marginBottom: 4 },
  loanParties: { fontSize: 12, color: MUTED },
  loanInterest: { fontSize: 12, color: ACCENT, marginTop: 4 },

  expenseCard: { backgroundColor: WHITE, borderRadius: 14, padding: 14, borderWidth: 1, borderColor: BORDER },
  expenseTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 },
  expenseDesc: { fontSize: 14, fontWeight: '600', color: DARK, flex: 1 },
  expenseAmount: { fontSize: 16, fontWeight: '800', color: DANGER },
  expenseMeta: { fontSize: 12, color: MUTED },
  expenseCategory: { fontSize: 11, color: MUTED, marginTop: 2 },

  balancesCard: { backgroundColor: WHITE, borderRadius: 14, padding: 14, borderWidth: 1, borderColor: BORDER },
  balancesTitle: { fontSize: 13, fontWeight: '700', color: DARK, marginBottom: 10 },
  balanceRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 6, borderBottomWidth: 1, borderBottomColor: BORDER },
  balanceKey: { fontSize: 13, color: MUTED, flex: 1 },
  balanceAmount: { fontSize: 13, fontWeight: '700', color: DANGER },

  insightHero: { backgroundColor: DARK, borderRadius: 14, padding: 20, alignItems: 'center' },
  insightHealthLabel: { fontSize: 11, color: '#94a3b8', fontWeight: '600', letterSpacing: 0.8 },
  insightHealth: { fontSize: 28, fontWeight: '800', color: WHITE, marginTop: 4 },
  card: { backgroundColor: WHITE, borderRadius: 14, padding: 14, borderWidth: 1, borderColor: BORDER },
  insightRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: BORDER },
  insightLabel: { fontSize: 13, color: MUTED },
  insightValue: { fontSize: 13, fontWeight: '700', color: DARK },

  emptyCard: { backgroundColor: WHITE, borderRadius: 14, padding: 28, alignItems: 'center', borderWidth: 1, borderColor: BORDER },
  emptyTitle: { fontSize: 14, fontWeight: '600', color: MUTED, marginTop: 10 },

  modalBg: { flex: 1, backgroundColor: 'rgba(0,0,0,0.6)', justifyContent: 'flex-end' },
  modal: { backgroundColor: WHITE, borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 24 },
  modalTitle: { fontSize: 18, fontWeight: '700', color: DARK, textAlign: 'center', marginBottom: 16 },
  label: { fontSize: 12, color: MUTED, fontWeight: '600', marginBottom: 6, marginTop: 14 },
  input: { backgroundColor: BG, borderRadius: 10, padding: 14, fontSize: 14, color: DARK, borderWidth: 1, borderColor: BORDER },
  cancelBtn: { padding: 14, alignItems: 'center', marginTop: 4 },
  cancelBtnText: { color: MUTED, fontSize: 14 },
});