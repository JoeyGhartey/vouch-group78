import React, { useState, useCallback } from 'react';
import {
  View, Text, StyleSheet, FlatList, TouchableOpacity,
  ActivityIndicator, RefreshControl,
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { Ionicons } from '@expo/vector-icons';
import { getMyBorrowedLoans, getMyLentLoans } from '../services/api';
import { RootStackParamList } from '../navigation/AppNavigator';

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
}

const BG = '#F8F9FA';
const WHITE = '#FFFFFF';
const DARK = '#0f172a';
const MUTED = '#6B7280';
const BORDER = '#E5E7EB';
const ACCENT = '#C9A84C';
const DANGER = '#dc2626';
const SUCCESS = '#16a34a';
const WARNING = '#d97706';

export default function LoansScreen({ navigation }: Props) {
  const [borrowed, setBorrowed] = useState<Loan[]>([]);
  const [lent, setLent] = useState<Loan[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [refreshing, setRefreshing] = useState<boolean>(false);
  const [activeTab, setActiveTab] = useState<string>('borrowed');

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

  const statusColor = (s: string): string => ({
    REQUESTED: WARNING, AGREEMENT_PENDING: WARNING, AGREEMENT_SIGNED: '#2196F3',
    ACTIVE: SUCCESS, DUE: WARNING, GRACE_PERIOD: DANGER,
    REPAID: SUCCESS, DEFAULTED: DANGER, DISPUTED: '#9C27B0', CANCELLED: MUTED,
  }[s] || MUTED);

  const fmtDate = (d?: string): string =>
    d ? new Date(d).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }) : '';

  const loans = activeTab === 'borrowed' ? borrowed : lent;
  const totalActive = loans
    .filter((l) => ['ACTIVE', 'DUE', 'GRACE_PERIOD'].includes(l.status))
    .reduce((s, l) => s + (l.totalRepaymentAmount - l.amountRepaid), 0);

  if (loading) return <View style={styles.center}><ActivityIndicator size="large" color={ACCENT} /></View>;

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>My Loans</Text>
      </View>

      {/* Summary Card */}
      <View style={styles.summaryCard}>
        <Text style={styles.summaryLabel}>
          {activeTab === 'borrowed' ? 'Total You Owe' : 'Total Owed to You'}
        </Text>
        <Text style={[styles.summaryAmount, { color: activeTab === 'borrowed' ? DANGER : SUCCESS }]}>
          GHS {totalActive.toFixed(2)}
        </Text>
        <Text style={styles.summarySub}>
          {loans.filter(l => ['ACTIVE', 'DUE', 'GRACE_PERIOD'].includes(l.status)).length} active loans
        </Text>
      </View>

      {/* Tabs */}
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
          <Ionicons name={activeTab === 'borrowed' ? 'card-outline' : 'cash-outline'} size={48} color={MUTED} />
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
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); loadLoans(); }} tintColor={ACCENT} />}
          renderItem={({ item }) => (
            <TouchableOpacity
              style={styles.loanCard}
              onPress={() => navigation.navigate('LoanDetail', { loanId: item.id })}
            >
              <View style={styles.loanTop}>
                <Text style={styles.loanAmount}>GHS {item.amount}</Text>
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
                    ? `Lender: ${item.lenderName || 'Waiting...'}`
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
                    GHS {item.amountRepaid} / {item.totalRepaymentAmount}
                  </Text>
                </View>
              )}
              <Ionicons name="chevron-forward" size={14} color={MUTED} style={styles.chevron} />
            </TouchableOpacity>
          )}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: BG },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: BG },
  header: {
    backgroundColor: WHITE, paddingHorizontal: 20, paddingTop: 56, paddingBottom: 16,
    borderBottomWidth: 1, borderBottomColor: BORDER,
  },
  title: { fontSize: 22, fontWeight: '700', color: DARK },
  summaryCard: {
    backgroundColor: DARK, marginHorizontal: 16, marginTop: 16, marginBottom: 8,
    borderRadius: 16, padding: 20, alignItems: 'center',
  },
  summaryLabel: { fontSize: 12, color: '#94a3b8', fontWeight: '600', letterSpacing: 0.5 },
  summaryAmount: { fontSize: 36, fontWeight: '800', marginTop: 6, letterSpacing: -1 },
  summarySub: { fontSize: 12, color: '#64748b', marginTop: 4 },
  tabRow: {
    flexDirection: 'row', backgroundColor: WHITE,
    borderBottomWidth: 1, borderBottomColor: BORDER, marginBottom: 4,
  },
  tab: { flex: 1, paddingVertical: 14, alignItems: 'center', borderBottomWidth: 2, borderBottomColor: 'transparent' },
  activeTab: { borderBottomColor: ACCENT },
  tabText: { fontSize: 13, fontWeight: '600', color: MUTED },
  activeTabText: { color: ACCENT },
  emptyContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 24 },
  emptyTitle: { fontSize: 17, fontWeight: '700', color: DARK, marginTop: 12, marginBottom: 6 },
  emptyText: { fontSize: 13, color: MUTED, textAlign: 'center' },
  loanCard: {
    backgroundColor: WHITE, borderRadius: 14, padding: 16,
    borderWidth: 1, borderColor: BORDER,
  },
  loanTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 },
  loanAmount: { fontSize: 22, fontWeight: '800', color: DARK },
  badge: { borderRadius: 6, paddingHorizontal: 8, paddingVertical: 3 },
  badgeText: { fontSize: 10, fontWeight: '700' },
  loanReason: { fontSize: 13, color: MUTED, marginBottom: 2 },
  loanCircle: { fontSize: 12, color: MUTED, marginBottom: 8 },
  loanMeta: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 4 },
  metaText: { fontSize: 12, color: MUTED },
  interest: { fontSize: 12, color: ACCENT, fontWeight: '600' },
  dueDate: { fontSize: 12, color: WARNING, marginTop: 4 },
  progressRow: { marginTop: 10 },
  progressBg: { height: 5, backgroundColor: BORDER, borderRadius: 3, overflow: 'hidden' },
  progressFill: { height: '100%', backgroundColor: SUCCESS, borderRadius: 3 },
  progressText: { fontSize: 11, color: MUTED, marginTop: 4, textAlign: 'right' },
  chevron: { position: 'absolute', right: 14, top: '50%' },
});