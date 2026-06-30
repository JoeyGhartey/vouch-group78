import React, { useState, useCallback, useMemo } from 'react';
import {
  View, Text, StyleSheet, FlatList, TouchableOpacity,
  ActivityIndicator, RefreshControl,
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { Ionicons } from '@expo/vector-icons';
import { getMyBorrowedLoans, getMyLentLoans } from '../services/api';
import { useTheme } from '../context/ThemeContext';
import { RootStackParamList } from '../navigation/AppNavigator';
import { ColorScheme } from '../theme/colors';

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

const createStyles = (c: ColorScheme) => StyleSheet.create({
  container: { flex: 1, backgroundColor: c.bg },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: c.bg },
  header: {
    backgroundColor: c.surface, paddingHorizontal: 20, paddingTop: 56, paddingBottom: 16,
    borderBottomWidth: 1, borderBottomColor: c.border,
  },
  title: { fontSize: 22, fontWeight: '700', color: c.dark },
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
      </View>

      <View style={styles.summaryCard}>
        <Text style={styles.summaryLabel}>
          {activeTab === 'borrowed' ? 'Total You Owe' : 'Total Owed to You'}
        </Text>
        <Text style={[styles.summaryAmount, { color: activeTab === 'borrowed' ? colors.danger : colors.success }]}>
          GHS {totalActive.toFixed(2)}
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
              <Ionicons name="chevron-forward" size={14} color={colors.muted} style={styles.chevron} />
            </TouchableOpacity>
          )}
        />
      )}
    </View>
  );
}
