import React, { useState, useCallback } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  ActivityIndicator, RefreshControl, TextInput, Modal, Alert,
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { RouteProp } from '@react-navigation/native';
import {
  getCircle, inviteMember, approveMember, removeMember, leaveCircle,
  getCircleLoans, getCircleExpenses, getCircleBalances, getCircleInsights,
} from '../services/api';
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

export default function CircleDetailScreen({ route, navigation }: Props) {
  const { circleId } = route.params;
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
    if (!invitePhone.trim()) { Alert.alert('Error', 'Enter a phone number'); return; }
    setInviting(true);
    try {
      const result = await inviteMember(circleId, invitePhone) as { message: string };
      Alert.alert('Success', result.message);
      setShowInvite(false);
      setInvitePhone('');
      loadData();
    } catch (error) {
      Alert.alert('Error', (error as Error).message);
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

  const getStatusColor = (status: string): string => {
    const colors: Record<string, string> = {
      REQUESTED: '#FFC107', AGREEMENT_PENDING: '#FF9800', AGREEMENT_SIGNED: '#2196F3',
      ACTIVE: '#4CAF50', DUE: '#FF9800', GRACE_PERIOD: '#e94560',
      REPAID: '#4CAF50', DEFAULTED: '#f44336', DISPUTED: '#9C27B0', CANCELLED: '#666',
    };
    return colors[status] || '#666';
  };

  if (loading) return <View style={styles.center}><ActivityIndicator size="large" color="#e94560" /></View>;
  if (!circle) return <View style={styles.center}><Text style={styles.errorText}>Circle not found</Text></View>;

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()}>
          <Text style={styles.backButton}>← Back</Text>
        </TouchableOpacity>
        <Text style={styles.title}>{circle.name}</Text>
        <TouchableOpacity onPress={() => setShowInvite(true)}>
          <Text style={styles.inviteButton}>+ Invite</Text>
        </TouchableOpacity>
      </View>

      <View style={styles.infoCard}>
        <Text style={styles.infoText}>{circle.memberCount} members • Max GHS {circle.maxLoanAmount}</Text>
        {circle.description ? <Text style={styles.descText}>{circle.description}</Text> : null}
      </View>

      <View style={styles.tabRow}>
        {['members', 'loans', 'expenses', 'insights'].map((tab) => (
          <TouchableOpacity key={tab} style={[styles.tab, activeTab === tab && styles.activeTab]} onPress={() => setActiveTab(tab)}>
            <Text style={[styles.tabText, activeTab === tab && styles.activeTabText]}>
              {tab.charAt(0).toUpperCase() + tab.slice(1)}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      <ScrollView style={styles.content} refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); loadData(); }} tintColor="#e94560" />}>
        {activeTab === 'members' && (
          <>
            {circle.members.map((member) => (
              <View key={member.userId} style={styles.memberCard}>
                <View style={styles.memberInfo}>
                  <Text style={styles.memberName}>{member.firstName} {member.lastName}</Text>
                  <Text style={styles.memberRole}>{member.memberRole}</Text>
                </View>
                <View style={styles.memberStats}>
                  <Text style={styles.memberScore}>Score: {member.circleTrustScore?.toFixed(1)}</Text>
                  <Text style={styles.memberDetail}>
                    Lent: {member.loansGivenInCircle} • Borrowed: {member.loansReceivedInCircle} • Defaults: {member.defaultsInCircle}
                  </Text>
                </View>
              </View>
            ))}
            <TouchableOpacity style={styles.leaveButton} onPress={handleLeave}>
              <Text style={styles.leaveText}>Leave Circle</Text>
            </TouchableOpacity>
          </>
        )}

        {activeTab === 'loans' && (
          <>
            <TouchableOpacity style={styles.actionBtn} onPress={() => navigation.navigate('RequestLoan', { circleId })}>
              <Text style={styles.actionBtnText}>Request a Loan</Text>
            </TouchableOpacity>
            {loans.length === 0 ? (
              <Text style={styles.emptyText}>No loans in this circle yet</Text>
            ) : (
              loans.map((loan) => (
                <TouchableOpacity key={loan.id} style={styles.loanCard} onPress={() => navigation.navigate('LoanDetail', { loanId: loan.id })}>
                  <View style={styles.loanHeader}>
                    <Text style={styles.loanAmount}>GHS {loan.amount}</Text>
                    <View style={[styles.statusBadge, { backgroundColor: getStatusColor(loan.status) }]}>
                      <Text style={styles.statusText}>{loan.status}</Text>
                    </View>
                  </View>
                  <Text style={styles.loanReason}>{loan.reason}</Text>
                  <Text style={styles.loanParties}>{loan.borrowerName} ← {loan.lenderName || 'Waiting for lender'}</Text>
                  {loan.interestRate > 0 && (
                    <Text style={styles.loanInterest}>{loan.interestRate}% interest • Repay GHS {loan.totalRepaymentAmount}</Text>
                  )}
                </TouchableOpacity>
              ))
            )}
          </>
        )}

        {activeTab === 'expenses' && (
          <>
            <TouchableOpacity style={styles.actionBtn} onPress={() => navigation.navigate('AddSharedExpense', { circleId, members: circle.members })}>
              <Text style={styles.actionBtnText}>Add Shared Expense</Text>
            </TouchableOpacity>
            {Object.keys(balances).length > 0 && (
              <View style={styles.balancesCard}>
                <Text style={styles.balancesTitle}>Outstanding Balances</Text>
                {Object.entries(balances).map(([key, amount]) => (
                  <View key={key} style={styles.balanceRow}>
                    <Text style={styles.balanceText}>{key}</Text>
                    <Text style={styles.balanceAmount}>GHS {(amount as number).toFixed(2)}</Text>
                  </View>
                ))}
              </View>
            )}
            {expenses.length === 0 ? (
              <Text style={styles.emptyText}>No shared expenses yet</Text>
            ) : (
              expenses.map((expense) => (
                <View key={expense.expenseId} style={styles.expenseCard}>
                  <View style={styles.expenseHeader}>
                    <Text style={styles.expenseDesc}>{expense.description}</Text>
                    <Text style={styles.expenseAmount}>GHS {expense.totalAmount}</Text>
                  </View>
                  <Text style={styles.expensePaidBy}>Paid by {expense.paidBy}</Text>
                  {expense.category && <Text style={styles.expenseCategory}>{expense.category}</Text>}
                </View>
              ))
            )}
          </>
        )}

        {activeTab === 'insights' && insights && (
          <View style={styles.insightsCard}>
            <Text style={styles.insightsTitle}>Circle Health: {insights.circleHealth}</Text>
            {[
              ['Total Loans', insights.totalLoans],
              ['Active Loans', insights.activeLoans],
              ['Repaid', insights.repaidLoans],
              ['Defaulted', insights.defaultedLoans],
              ['Repayment Rate', `${insights.circleRepaymentRate}%`],
              ['Total Circulated', `GHS ${insights.totalAmountCirculated}`],
              ['Avg Trust Score', insights.averageTrustScore],
              ...(insights.topLender ? [['Top Lender', insights.topLender]] : []),
              ...(insights.topBorrower ? [['Top Borrower', insights.topBorrower]] : []),
            ].map(([label, value], i) => (
              <View key={i} style={styles.insightRow}>
                <Text style={styles.insightLabel}>{label}</Text>
                <Text style={styles.insightValue}>{value}</Text>
              </View>
            ))}
          </View>
        )}

        <View style={{ height: 40 }} />
      </ScrollView>

      <Modal visible={showInvite} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Invite to {circle.name}</Text>
            <Text style={styles.label}>Phone Number</Text>
            <TextInput style={styles.input} placeholder="e.g. 0551234567" placeholderTextColor="#555" value={invitePhone} onChangeText={setInvitePhone} keyboardType="phone-pad" />
            <TouchableOpacity style={[styles.createBtn, inviting && { opacity: 0.6 }]} onPress={handleInvite} disabled={inviting}>
              {inviting ? <ActivityIndicator color="#fff" /> : <Text style={styles.createBtnText}>Send Invite</Text>}
            </TouchableOpacity>
            <TouchableOpacity style={styles.cancelBtn} onPress={() => setShowInvite(false)}>
              <Text style={styles.cancelBtnText}>Cancel</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#1a1a2e' },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#1a1a2e' },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 24, paddingTop: 60 },
  backButton: { color: '#e94560', fontSize: 16 },
  title: { color: '#fff', fontSize: 20, fontWeight: 'bold' },
  inviteButton: { color: '#e94560', fontSize: 14, fontWeight: '600' },
  infoCard: { backgroundColor: '#16213e', marginHorizontal: 24, borderRadius: 12, padding: 16, marginBottom: 16 },
  infoText: { color: '#a0a0b0', fontSize: 14, textAlign: 'center' },
  descText: { color: '#fff', fontSize: 14, textAlign: 'center', marginTop: 8 },
  tabRow: { flexDirection: 'row', marginHorizontal: 24, marginBottom: 16 },
  tab: { flex: 1, padding: 10, alignItems: 'center', borderBottomWidth: 2, borderBottomColor: 'transparent' },
  activeTab: { borderBottomColor: '#e94560' },
  tabText: { color: '#666', fontSize: 14, fontWeight: '600' },
  activeTabText: { color: '#e94560' },
  content: { flex: 1 },
  memberCard: { backgroundColor: '#16213e', marginHorizontal: 24, marginBottom: 8, borderRadius: 12, padding: 16 },
  memberInfo: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  memberName: { color: '#fff', fontSize: 16, fontWeight: '600' },
  memberRole: { color: '#e94560', fontSize: 12, fontWeight: '600' },
  memberStats: { marginTop: 8 },
  memberScore: { color: '#4CAF50', fontSize: 14, fontWeight: '600' },
  memberDetail: { color: '#a0a0b0', fontSize: 12, marginTop: 4 },
  leaveButton: { marginHorizontal: 24, marginTop: 20, padding: 16, borderRadius: 12, borderWidth: 1, borderColor: '#e94560', alignItems: 'center' },
  leaveText: { color: '#e94560', fontSize: 16, fontWeight: '600' },
  actionBtn: { backgroundColor: '#e94560', marginHorizontal: 24, borderRadius: 12, padding: 14, alignItems: 'center', marginBottom: 16 },
  actionBtnText: { color: '#fff', fontSize: 16, fontWeight: '600' },
  emptyText: { color: '#a0a0b0', fontSize: 14, textAlign: 'center', marginTop: 20 },
  loanCard: { backgroundColor: '#16213e', marginHorizontal: 24, marginBottom: 8, borderRadius: 12, padding: 16 },
  loanHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  loanAmount: { color: '#fff', fontSize: 20, fontWeight: 'bold' },
  statusBadge: { borderRadius: 8, paddingHorizontal: 10, paddingVertical: 4 },
  statusText: { color: '#fff', fontSize: 11, fontWeight: '600' },
  loanReason: { color: '#a0a0b0', fontSize: 14, marginTop: 8 },
  loanParties: { color: '#a0a0b0', fontSize: 13, marginTop: 4 },
  loanInterest: { color: '#FFC107', fontSize: 13, marginTop: 4 },
  expenseCard: { backgroundColor: '#16213e', marginHorizontal: 24, marginBottom: 8, borderRadius: 12, padding: 16 },
  expenseHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  expenseDesc: { color: '#fff', fontSize: 16, fontWeight: '600', flex: 1 },
  expenseAmount: { color: '#e94560', fontSize: 16, fontWeight: 'bold' },
  expensePaidBy: { color: '#a0a0b0', fontSize: 13, marginTop: 4 },
  expenseCategory: { color: '#666', fontSize: 12, marginTop: 4 },
  balancesCard: { backgroundColor: '#16213e', marginHorizontal: 24, borderRadius: 12, padding: 16, marginBottom: 16 },
  balancesTitle: { color: '#fff', fontSize: 16, fontWeight: 'bold', marginBottom: 12 },
  balanceRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 6 },
  balanceText: { color: '#a0a0b0', fontSize: 14, flex: 1 },
  balanceAmount: { color: '#e94560', fontSize: 14, fontWeight: '600' },
  insightsCard: { backgroundColor: '#16213e', marginHorizontal: 24, borderRadius: 12, padding: 20 },
  insightsTitle: { color: '#fff', fontSize: 18, fontWeight: 'bold', marginBottom: 16, textAlign: 'center' },
  insightRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: '#2a2a4a' },
  insightLabel: { color: '#a0a0b0', fontSize: 14 },
  insightValue: { color: '#fff', fontSize: 14, fontWeight: '600' },
  errorText: { color: '#e94560', fontSize: 16 },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.7)', justifyContent: 'center', padding: 24 },
  modalContent: { backgroundColor: '#16213e', borderRadius: 16, padding: 24 },
  modalTitle: { color: '#fff', fontSize: 20, fontWeight: 'bold', marginBottom: 20, textAlign: 'center' },
  label: { color: '#a0a0b0', fontSize: 14, marginBottom: 6, marginTop: 12 },
  input: { backgroundColor: '#1a1a2e', borderRadius: 12, padding: 14, fontSize: 16, color: '#fff', borderWidth: 1, borderColor: '#2a2a4a' },
  createBtn: { backgroundColor: '#e94560', borderRadius: 12, padding: 16, alignItems: 'center', marginTop: 20 },
  createBtnText: { color: '#fff', fontSize: 16, fontWeight: 'bold' },
  cancelBtn: { padding: 16, alignItems: 'center', marginTop: 8 },
  cancelBtnText: { color: '#a0a0b0', fontSize: 16 },
}); 