import React, { useState, useCallback } from 'react';
import {
  View, Text, StyleSheet, FlatList, TouchableOpacity,
  ActivityIndicator, RefreshControl,
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { getMyBorrowedLoans, getMyLentLoans } from '../services/api';

export default function LoansScreen({ navigation }) {
  const [borrowed, setBorrowed] = useState([]);
  const [lent, setLent] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [activeTab, setActiveTab] = useState('borrowed');

  const loadLoans = async () => {
    try {
      const [b, l] = await Promise.all([getMyBorrowedLoans(), getMyLentLoans()]);
      setBorrowed(b);
      setLent(l);
    } catch (error) {
      console.error(error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useFocusEffect(useCallback(() => { loadLoans(); }, []));

  const statusColor = (s) => ({ REQUESTED:'#FFC107', AGREEMENT_PENDING:'#FF9800', AGREEMENT_SIGNED:'#2196F3', ACTIVE:'#4CAF50', DUE:'#FF9800', GRACE_PERIOD:'#e94560', REPAID:'#4CAF50', DEFAULTED:'#f44336', DISPUTED:'#9C27B0', CANCELLED:'#666' }[s] || '#666');

  const fmtDate = (d) => d ? new Date(d).toLocaleDateString('en-GB', { day:'numeric', month:'short', year:'numeric' }) : '';

  const loans = activeTab === 'borrowed' ? borrowed : lent;
  const totalActive = loans.filter(l => ['ACTIVE','DUE','GRACE_PERIOD'].includes(l.status)).reduce((s, l) => s + (l.totalRepaymentAmount - l.amountRepaid), 0);

  if (loading) return <View style={styles.center}><ActivityIndicator size="large" color="#e94560" /></View>;

  return (
    <View style={styles.container}>
      <View style={styles.header}><Text style={styles.title}>My Loans</Text></View>

      <View style={styles.summaryCard}>
        <Text style={styles.summaryLabel}>{activeTab === 'borrowed' ? 'Total You Owe' : 'Total Owed to You'}</Text>
        <Text style={styles.summaryAmount}>GHS {totalActive.toFixed(2)}</Text>
      </View>

      <View style={styles.tabRow}>
        {['borrowed', 'lent'].map(t => (
          <TouchableOpacity key={t} style={[styles.tab, activeTab === t && styles.activeTab]} onPress={() => setActiveTab(t)}>
            <Text style={[styles.tabText, activeTab === t && styles.activeTabText]}>
              {t === 'borrowed' ? `Borrowed (${borrowed.length})` : `Lent (${lent.length})`}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {loans.length === 0 ? (
        <View style={styles.emptyContainer}>
          <Text style={styles.emptyIcon}>{activeTab === 'borrowed' ? '📩' : '💰'}</Text>
          <Text style={styles.emptyText}>{activeTab === 'borrowed' ? 'No borrowed loans' : 'No lent loans'}</Text>
          <Text style={styles.emptySubtext}>{activeTab === 'borrowed' ? 'Request a loan from your circles' : 'Fund a loan request in your circles'}</Text>
        </View>
      ) : (
        <FlatList
          data={loans}
          keyExtractor={i => i.id.toString()}
          renderItem={({ item }) => (
            <TouchableOpacity style={styles.loanCard} onPress={() => navigation.navigate('LoanDetail', { loanId: item.id })}>
              <View style={styles.loanHeader}>
                <Text style={styles.loanAmount}>GHS {item.amount}</Text>
                <View style={[styles.badge, { backgroundColor: statusColor(item.status) }]}>
                  <Text style={styles.badgeText}>{item.status.replace(/_/g, ' ')}</Text>
                </View>
              </View>
              <Text style={styles.loanReason}>{item.reason}</Text>
              <Text style={styles.loanCircle}>Circle: {item.circleName}</Text>
              <View style={styles.loanMeta}>
                <Text style={styles.metaText}>{activeTab === 'borrowed' ? `Lender: ${item.lenderName || 'Waiting...'}` : `Borrower: ${item.borrowerName}`}</Text>
                {item.interestRate > 0 && <Text style={styles.interest}>{item.interestRate}% interest</Text>}
              </View>
              {item.dueDate && <Text style={styles.dueDate}>Due: {fmtDate(item.dueDate)}</Text>}
              {item.totalRepaymentAmount > 0 && !['REPAID','CANCELLED','REQUESTED'].includes(item.status) && (
                <View style={styles.progressRow}>
                  <View style={styles.progressBar}><View style={[styles.progressFill, { width: `${(item.amountRepaid / item.totalRepaymentAmount) * 100}%` }]} /></View>
                  <Text style={styles.progressText}>GHS {item.amountRepaid} / {item.totalRepaymentAmount}</Text>
                </View>
              )}
            </TouchableOpacity>
          )}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); loadLoans(); }} tintColor="#e94560" />}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#1a1a2e' },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#1a1a2e' },
  header: { padding: 24, paddingTop: 60 },
  title: { color: '#fff', fontSize: 24, fontWeight: 'bold' },
  summaryCard: { backgroundColor: '#16213e', marginHorizontal: 24, borderRadius: 16, padding: 20, alignItems: 'center', marginBottom: 16 },
  summaryLabel: { color: '#a0a0b0', fontSize: 14 },
  summaryAmount: { color: '#e94560', fontSize: 32, fontWeight: 'bold', marginTop: 4 },
  tabRow: { flexDirection: 'row', marginHorizontal: 24, marginBottom: 16 },
  tab: { flex: 1, padding: 12, alignItems: 'center', borderBottomWidth: 2, borderBottomColor: 'transparent' },
  activeTab: { borderBottomColor: '#e94560' },
  tabText: { color: '#666', fontSize: 15, fontWeight: '600' },
  activeTabText: { color: '#e94560' },
  emptyContainer: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  emptyIcon: { fontSize: 48, marginBottom: 16 },
  emptyText: { color: '#fff', fontSize: 18, fontWeight: '600' },
  emptySubtext: { color: '#a0a0b0', fontSize: 14, marginTop: 8, textAlign: 'center', paddingHorizontal: 40 },
  loanCard: { backgroundColor: '#16213e', marginHorizontal: 24, marginBottom: 10, borderRadius: 14, padding: 18 },
  loanHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  loanAmount: { color: '#fff', fontSize: 22, fontWeight: 'bold' },
  badge: { borderRadius: 8, paddingHorizontal: 10, paddingVertical: 4 },
  badgeText: { color: '#fff', fontSize: 11, fontWeight: '700' },
  loanReason: { color: '#a0a0b0', fontSize: 14, marginTop: 8 },
  loanCircle: { color: '#666', fontSize: 13, marginTop: 4 },
  loanMeta: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 8 },
  metaText: { color: '#a0a0b0', fontSize: 13 },
  interest: { color: '#FFC107', fontSize: 13, fontWeight: '600' },
  dueDate: { color: '#FF9800', fontSize: 13, marginTop: 6 },
  progressRow: { marginTop: 10 },
  progressBar: { height: 6, backgroundColor: '#2a2a4a', borderRadius: 3, overflow: 'hidden' },
  progressFill: { height: '100%', backgroundColor: '#4CAF50', borderRadius: 3 },
  progressText: { color: '#a0a0b0', fontSize: 12, marginTop: 4, textAlign: 'right' },
});
