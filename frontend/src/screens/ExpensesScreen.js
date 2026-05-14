import React, { useState, useCallback } from 'react';
import {
  View, Text, StyleSheet, FlatList, TouchableOpacity,
  ActivityIndicator, RefreshControl, TextInput, Modal, ScrollView,
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { getPersonalTransactions, addPersonalExpense, getMonthlySummary, getSpendingLimits, setSpendingLimit } from '../services/api';

export default function ExpensesScreen() {
  const [transactions, setTransactions] = useState([]);
  const [summary, setSummary] = useState(null);
  const [limits, setLimits] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [activeTab, setActiveTab] = useState('summary');
  const [showAdd, setShowAdd] = useState(false);
  const [showLimit, setShowLimit] = useState(false);
  const [adding, setAdding] = useState(false);

  const [newExpense, setNewExpense] = useState({ amount: '', description: '', category: 'Food', type: 'EXPENSE' });
  const [newLimit, setNewLimit] = useState({ category: '', monthlyLimit: '' });

  const now = new Date();
  const [year] = useState(now.getFullYear());
  const [month] = useState(now.getMonth() + 1);

  const categories = ['Food', 'Transport', 'Airtime', 'Rent', 'Utilities', 'Entertainment', 'Education', 'Health', 'Other'];

  const loadData = async () => {
    try {
      const [txs, sum, lims] = await Promise.all([
        getPersonalTransactions(),
        getMonthlySummary(year, month),
        getSpendingLimits(),
      ]);
      setTransactions(txs);
      setSummary(sum);
      setLimits(lims);
    } catch (e) { console.error(e); }
    finally { setLoading(false); setRefreshing(false); }
  };

  useFocusEffect(useCallback(() => { loadData(); }, []));

  const handleAdd = async () => {
    if (!newExpense.amount || parseFloat(newExpense.amount) <= 0) { if (typeof window !== 'undefined') window.alert('Enter a valid amount'); return; }
    if (!newExpense.description.trim()) { if (typeof window !== 'undefined') window.alert('Enter a description'); return; }
    setAdding(true);
    try {
      await addPersonalExpense({ amount: parseFloat(newExpense.amount), description: newExpense.description, category: newExpense.category, type: newExpense.type });
      setShowAdd(false);
      setNewExpense({ amount: '', description: '', category: 'Food', type: 'EXPENSE' });
      loadData();
    } catch (e) { if (typeof window !== 'undefined') window.alert(e.message); }
    finally { setAdding(false); }
  };

  const handleSetLimit = async () => {
    if (!newLimit.category.trim() || !newLimit.monthlyLimit) { if (typeof window !== 'undefined') window.alert('Fill in all fields'); return; }
    try {
      await setSpendingLimit({ category: newLimit.category, monthlyLimit: parseFloat(newLimit.monthlyLimit) });
      setShowLimit(false);
      setNewLimit({ category: '', monthlyLimit: '' });
      loadData();
    } catch (e) { if (typeof window !== 'undefined') window.alert(e.message); }
  };

  const formatDate = (d) => d ? new Date(d).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' }) : '';

  if (loading) return <View style={styles.center}><ActivityIndicator size="large" color="#e94560" /></View>;

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>My Finances</Text>
        <TouchableOpacity style={styles.addBtn} onPress={() => setShowAdd(true)}>
          <Text style={styles.addBtnText}>+ Add</Text>
        </TouchableOpacity>
      </View>

      <View style={styles.tabRow}>
        {['summary', 'transactions', 'limits'].map(t => (
          <TouchableOpacity key={t} style={[styles.tab, activeTab === t && styles.activeTab]} onPress={() => setActiveTab(t)}>
            <Text style={[styles.tabText, activeTab === t && styles.activeTabText]}>{t.charAt(0).toUpperCase() + t.slice(1)}</Text>
          </TouchableOpacity>
        ))}
      </View>

      <ScrollView refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); loadData(); }} tintColor="#e94560" />}>

        {/* Summary Tab */}
        {activeTab === 'summary' && summary && (
          <>
            <View style={styles.summaryCard}>
              <Text style={styles.summaryMonth}>{new Date(year, month - 1).toLocaleDateString('en-GB', { month: 'long', year: 'numeric' })}</Text>
              <View style={styles.summaryRow}>
                <View style={styles.summaryItem}>
                  <Text style={styles.summaryLabel}>Income</Text>
                  <Text style={[styles.summaryValue, { color: '#4CAF50' }]}>GHS {summary.totalIncome?.toFixed(2)}</Text>
                </View>
                <View style={styles.summaryItem}>
                  <Text style={styles.summaryLabel}>Expenses</Text>
                  <Text style={[styles.summaryValue, { color: '#e94560' }]}>GHS {summary.totalExpenses?.toFixed(2)}</Text>
                </View>
                <View style={styles.summaryItem}>
                  <Text style={styles.summaryLabel}>Net</Text>
                  <Text style={[styles.summaryValue, { color: summary.netBalance >= 0 ? '#4CAF50' : '#e94560' }]}>GHS {summary.netBalance?.toFixed(2)}</Text>
                </View>
              </View>
            </View>

            {summary.categoryBreakdown && Object.keys(summary.categoryBreakdown).length > 0 && (
              <View style={styles.card}>
                <Text style={styles.cardTitle}>Spending by Category</Text>
                {Object.entries(summary.categoryBreakdown).sort((a, b) => b[1] - a[1]).map(([cat, amt]) => (
                  <View key={cat} style={styles.catRow}>
                    <Text style={styles.catName}>{cat}</Text>
                    <Text style={styles.catAmount}>GHS {amt.toFixed(2)}</Text>
                  </View>
                ))}
              </View>
            )}

            {summary.spendingLimits && Object.keys(summary.spendingLimits).length > 0 && (
              <View style={styles.card}>
                <Text style={styles.cardTitle}>Spending Limits</Text>
                {Object.entries(summary.spendingLimits).map(([cat, data]) => (
                  <View key={cat} style={styles.limitRow}>
                    <Text style={styles.limitCat}>{cat}</Text>
                    <View style={styles.limitBar}>
                      <View style={[styles.limitFill, { width: `${Math.min(data.percentUsed, 100)}%`, backgroundColor: data.exceeded ? '#e94560' : '#4CAF50' }]} />
                    </View>
                    <Text style={[styles.limitText, data.exceeded && { color: '#e94560' }]}>GHS {data.spent?.toFixed(0)} / {data.limit}</Text>
                  </View>
                ))}
              </View>
            )}
          </>
        )}

        {/* Transactions Tab */}
        {activeTab === 'transactions' && (
          transactions.length === 0 ? (
            <View style={styles.emptyContainer}>
              <Text style={styles.emptyIcon}>📊</Text>
              <Text style={styles.emptyText}>No transactions yet</Text>
            </View>
          ) : (
            transactions.sort((a, b) => new Date(b.transactionDate) - new Date(a.transactionDate)).map((tx) => (
              <View key={tx.id} style={styles.txCard}>
                <View style={styles.txHeader}>
                  <View>
                    <Text style={styles.txDesc}>{tx.description}</Text>
                    <Text style={styles.txCat}>{tx.category} • {formatDate(tx.transactionDate)}</Text>
                  </View>
                  <Text style={[styles.txAmount, { color: tx.type === 'INCOME' ? '#4CAF50' : '#e94560' }]}>
                    {tx.type === 'INCOME' ? '+' : '-'} GHS {tx.amount}
                  </Text>
                </View>
              </View>
            ))
          )
        )}

        {/* Limits Tab */}
        {activeTab === 'limits' && (
          <>
            <TouchableOpacity style={styles.actionBtn} onPress={() => setShowLimit(true)}>
              <Text style={styles.actionBtnText}>Set Spending Limit</Text>
            </TouchableOpacity>
            {limits.length === 0 ? (
              <View style={styles.emptyContainer}>
                <Text style={styles.emptyText}>No spending limits set</Text>
              </View>
            ) : (
              limits.map((l) => (
                <View key={l.id} style={styles.txCard}>
                  <Text style={styles.txDesc}>{l.category}</Text>
                  <Text style={styles.txCat}>Monthly limit: GHS {l.monthlyLimit}</Text>
                </View>
              ))
            )}
          </>
        )}

        <View style={{ height: 40 }} />
      </ScrollView>

      {/* Add Transaction Modal */}
      <Modal visible={showAdd} animationType="slide" transparent>
        <View style={styles.modalBg}>
          <View style={styles.modal}>
            <Text style={styles.modalTitle}>Add Transaction</Text>

            <View style={styles.typeRow}>
              {['EXPENSE', 'INCOME'].map(t => (
                <TouchableOpacity key={t} style={[styles.typeBtn, newExpense.type === t && styles.typeSel]} onPress={() => setNewExpense({ ...newExpense, type: t })}>
                  <Text style={[styles.typeText, newExpense.type === t && styles.typeTextSel]}>{t === 'EXPENSE' ? 'Expense' : 'Income'}</Text>
                </TouchableOpacity>
              ))}
            </View>

            <Text style={styles.label}>Amount (GHS) *</Text>
            <TextInput style={styles.input} placeholder="0.00" placeholderTextColor="#555" value={newExpense.amount} onChangeText={t => setNewExpense({ ...newExpense, amount: t })} keyboardType="numeric" />

            <Text style={styles.label}>Description *</Text>
            <TextInput style={styles.input} placeholder="What was this for?" placeholderTextColor="#555" value={newExpense.description} onChangeText={t => setNewExpense({ ...newExpense, description: t })} />

            <Text style={styles.label}>Category</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginTop: 4 }}>
              {categories.map(c => (
                <TouchableOpacity key={c} style={[styles.catBtn, newExpense.category === c && styles.catBtnSel]} onPress={() => setNewExpense({ ...newExpense, category: c })}>
                  <Text style={[styles.catBtnText, newExpense.category === c && styles.catBtnTextSel]}>{c}</Text>
                </TouchableOpacity>
              ))}
            </ScrollView>

            <TouchableOpacity style={[styles.primaryBtn, adding && { opacity: 0.6 }]} onPress={handleAdd} disabled={adding}>
              {adding ? <ActivityIndicator color="#fff" /> : <Text style={styles.btnText}>Save Transaction</Text>}
            </TouchableOpacity>
            <TouchableOpacity style={styles.cancelBtn} onPress={() => setShowAdd(false)}><Text style={styles.cancelText}>Cancel</Text></TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* Set Limit Modal */}
      <Modal visible={showLimit} animationType="slide" transparent>
        <View style={styles.modalBg}>
          <View style={styles.modal}>
            <Text style={styles.modalTitle}>Set Spending Limit</Text>
            <Text style={styles.label}>Category</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginTop: 4 }}>
              {categories.map(c => (
                <TouchableOpacity key={c} style={[styles.catBtn, newLimit.category === c && styles.catBtnSel]} onPress={() => setNewLimit({ ...newLimit, category: c })}>
                  <Text style={[styles.catBtnText, newLimit.category === c && styles.catBtnTextSel]}>{c}</Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
            <Text style={styles.label}>Monthly Limit (GHS)</Text>
            <TextInput style={styles.input} placeholder="e.g. 500" placeholderTextColor="#555" value={newLimit.monthlyLimit} onChangeText={t => setNewLimit({ ...newLimit, monthlyLimit: t })} keyboardType="numeric" />
            <TouchableOpacity style={styles.primaryBtn} onPress={handleSetLimit}><Text style={styles.btnText}>Set Limit</Text></TouchableOpacity>
            <TouchableOpacity style={styles.cancelBtn} onPress={() => setShowLimit(false)}><Text style={styles.cancelText}>Cancel</Text></TouchableOpacity>
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
  title: { color: '#fff', fontSize: 24, fontWeight: 'bold' },
  addBtn: { backgroundColor: '#e94560', borderRadius: 8, paddingHorizontal: 16, paddingVertical: 8 },
  addBtnText: { color: '#fff', fontWeight: '600' },
  tabRow: { flexDirection: 'row', marginHorizontal: 24, marginBottom: 16 },
  tab: { flex: 1, padding: 12, alignItems: 'center', borderBottomWidth: 2, borderBottomColor: 'transparent' },
  activeTab: { borderBottomColor: '#e94560' },
  tabText: { color: '#666', fontSize: 14, fontWeight: '600' },
  activeTabText: { color: '#e94560' },
  summaryCard: { backgroundColor: '#16213e', marginHorizontal: 24, borderRadius: 16, padding: 20, marginBottom: 16 },
  summaryMonth: { color: '#fff', fontSize: 16, fontWeight: 'bold', textAlign: 'center', marginBottom: 16 },
  summaryRow: { flexDirection: 'row', justifyContent: 'space-around' },
  summaryItem: { alignItems: 'center' },
  summaryLabel: { color: '#a0a0b0', fontSize: 12 },
  summaryValue: { fontSize: 18, fontWeight: 'bold', marginTop: 4 },
  card: { backgroundColor: '#16213e', marginHorizontal: 24, borderRadius: 16, padding: 20, marginBottom: 16 },
  cardTitle: { color: '#fff', fontSize: 16, fontWeight: 'bold', marginBottom: 12 },
  catRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: '#2a2a4a' },
  catName: { color: '#a0a0b0', fontSize: 14 },
  catAmount: { color: '#fff', fontSize: 14, fontWeight: '600' },
  limitRow: { marginBottom: 12 },
  limitCat: { color: '#fff', fontSize: 14, fontWeight: '600', marginBottom: 4 },
  limitBar: { height: 6, backgroundColor: '#2a2a4a', borderRadius: 3, overflow: 'hidden' },
  limitFill: { height: '100%', borderRadius: 3 },
  limitText: { color: '#a0a0b0', fontSize: 12, marginTop: 4 },
  txCard: { backgroundColor: '#16213e', marginHorizontal: 24, marginBottom: 8, borderRadius: 12, padding: 16 },
  txHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  txDesc: { color: '#fff', fontSize: 15, fontWeight: '600' },
  txCat: { color: '#a0a0b0', fontSize: 12, marginTop: 4 },
  txAmount: { fontSize: 16, fontWeight: 'bold' },
  emptyContainer: { alignItems: 'center', marginTop: 40 },
  emptyIcon: { fontSize: 48, marginBottom: 16 },
  emptyText: { color: '#a0a0b0', fontSize: 16 },
  actionBtn: { backgroundColor: '#e94560', marginHorizontal: 24, borderRadius: 12, padding: 14, alignItems: 'center', marginBottom: 16 },
  actionBtnText: { color: '#fff', fontSize: 16, fontWeight: '600' },
  modalBg: { flex: 1, backgroundColor: 'rgba(0,0,0,0.7)', justifyContent: 'center', padding: 24 },
  modal: { backgroundColor: '#16213e', borderRadius: 16, padding: 24, maxHeight: '80%' },
  modalTitle: { color: '#fff', fontSize: 20, fontWeight: 'bold', textAlign: 'center', marginBottom: 16 },
  label: { color: '#a0a0b0', fontSize: 14, marginBottom: 6, marginTop: 12 },
  input: { backgroundColor: '#1a1a2e', borderRadius: 12, padding: 14, fontSize: 16, color: '#fff', borderWidth: 1, borderColor: '#2a2a4a' },
  typeRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 8 },
  typeBtn: { flex: 1, backgroundColor: '#1a1a2e', borderRadius: 12, padding: 12, marginHorizontal: 4, alignItems: 'center', borderWidth: 1, borderColor: '#2a2a4a' },
  typeSel: { backgroundColor: '#e94560', borderColor: '#e94560' },
  typeText: { color: '#a0a0b0', fontSize: 14, fontWeight: '600' },
  typeTextSel: { color: '#fff' },
  catBtn: { backgroundColor: '#1a1a2e', borderRadius: 20, paddingHorizontal: 16, paddingVertical: 8, marginRight: 8, borderWidth: 1, borderColor: '#2a2a4a' },
  catBtnSel: { backgroundColor: '#e94560', borderColor: '#e94560' },
  catBtnText: { color: '#a0a0b0', fontSize: 13 },
  catBtnTextSel: { color: '#fff' },
  primaryBtn: { backgroundColor: '#e94560', borderRadius: 12, padding: 16, alignItems: 'center', marginTop: 20 },
  btnText: { color: '#fff', fontSize: 16, fontWeight: 'bold' },
  cancelBtn: { padding: 16, alignItems: 'center', marginTop: 4 },
  cancelText: { color: '#a0a0b0', fontSize: 16 },
});
