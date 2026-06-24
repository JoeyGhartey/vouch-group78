import React, { useState, useCallback } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity,
  ActivityIndicator, RefreshControl, TextInput, Modal, ScrollView,
  KeyboardAvoidingView, Platform,
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { getPersonalTransactions, addPersonalExpense, getMonthlySummary, getSpendingLimits, setSpendingLimit } from '../services/api';
import { useAppAlert } from '../components/AppAlert';

interface Transaction {
  id: number;
  description: string;
  category: string;
  amount: number;
  type: string;
  transactionDate: string;
}

interface SpendingLimitData {
  percentUsed: number;
  exceeded: boolean;
  spent: number;
  limit: number;
}

interface Summary {
  totalIncome: number;
  totalExpenses: number;
  netBalance: number;
  categoryBreakdown?: Record<string, number>;
  spendingLimits?: Record<string, SpendingLimitData>;
}

interface LimitRecord {
  id: number;
  category: string;
  monthlyLimit: number;
}

interface NewExpense {
  amount: string;
  description: string;
  category: string;
  type: string;
}

interface NewLimit {
  category: string;
  monthlyLimit: string;
}

const BG = '#F8F9FA';
const WHITE = '#FFFFFF';
const DARK = '#0f172a';
const MUTED = '#6B7280';
const BORDER = '#E5E7EB';
const ACCENT = '#C9A84C';
const DANGER = '#dc2626';
const SUCCESS = '#16a34a';

const CATEGORIES = ['Food', 'Transport', 'Airtime', 'Rent', 'Utilities', 'Entertainment', 'Education', 'Health', 'Other'];

export default function ExpensesScreen() {
  const { showAlert } = useAppAlert();
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [summary, setSummary] = useState<Summary | null>(null);
  const [limits, setLimits] = useState<LimitRecord[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [refreshing, setRefreshing] = useState<boolean>(false);
  const [activeTab, setActiveTab] = useState<string>('summary');
  const [showAdd, setShowAdd] = useState<boolean>(false);
  const [showLimit, setShowLimit] = useState<boolean>(false);
  const [adding, setAdding] = useState<boolean>(false);
  const [newExpense, setNewExpense] = useState<NewExpense>({ amount: '', description: '', category: 'Food', type: 'EXPENSE' });
  const [newLimit, setNewLimit] = useState<NewLimit>({ category: '', monthlyLimit: '' });

  const now = new Date();
  const [year] = useState<number>(now.getFullYear());
  const [month] = useState<number>(now.getMonth() + 1);

  const loadData = async (): Promise<void> => {
    try {
      const [txs, sum, lims] = await Promise.all([
        getPersonalTransactions(),
        getMonthlySummary(year, month),
        getSpendingLimits(),
      ]);
      setTransactions(txs as Transaction[]);
      setSummary(sum as Summary);
      setLimits(lims as LimitRecord[]);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useFocusEffect(useCallback(() => { loadData(); }, []));

  const handleAdd = async (): Promise<void> => {
    if (!newExpense.amount || parseFloat(newExpense.amount) <= 0) { showAlert('error', 'Error', 'Enter a valid amount'); return; }
    if (!newExpense.description.trim()) { showAlert('error', 'Error', 'Enter a description'); return; }
    setAdding(true);
    try {
      await addPersonalExpense({
        amount: parseFloat(newExpense.amount),
        description: newExpense.description,
        category: newExpense.category,
        type: newExpense.type,
      });
      setShowAdd(false);
      setNewExpense({ amount: '', description: '', category: 'Food', type: 'EXPENSE' });
      loadData();
    } catch (e) {
      showAlert('error', 'Error', (e as Error).message);
    } finally {
      setAdding(false);
    }
  };

  const handleSetLimit = async (): Promise<void> => {
    if (!newLimit.category.trim() || !newLimit.monthlyLimit) { showAlert('error', 'Error', 'Fill in all fields'); return; }
    try {
      await setSpendingLimit({ category: newLimit.category, monthlyLimit: parseFloat(newLimit.monthlyLimit) });
      setShowLimit(false);
      setNewLimit({ category: '', monthlyLimit: '' });
      loadData();
    } catch (e) {
      showAlert('error', 'Error', (e as Error).message);
    }
  };

  const formatDate = (d?: string): string =>
    d ? new Date(d).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' }) : '';

  if (loading) return <View style={styles.center}><ActivityIndicator size="large" color={ACCENT} /></View>;

  const sortedTransactions = [...transactions].sort(
    (a, b) => new Date(b.transactionDate).getTime() - new Date(a.transactionDate).getTime()
  );

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>My Finances</Text>
        <TouchableOpacity style={styles.addBtn} onPress={() => setShowAdd(true)}>
          <Ionicons name="add" size={18} color={WHITE} />
          <Text style={styles.addBtnText}>Add</Text>
        </TouchableOpacity>
      </View>

      <View style={styles.tabRow}>
        {['summary', 'transactions', 'limits'].map((t) => (
          <TouchableOpacity key={t} style={[styles.tab, activeTab === t && styles.activeTab]} onPress={() => setActiveTab(t)}>
            <Text style={[styles.tabText, activeTab === t && styles.activeTabText]}>
              {t.charAt(0).toUpperCase() + t.slice(1)}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      <ScrollView
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); loadData(); }} tintColor={ACCENT} />}
        showsVerticalScrollIndicator={false}
      >
        {/* Summary Tab */}
        {activeTab === 'summary' && summary && (
          <View style={styles.section}>
            <View style={styles.summaryCard}>
              <Text style={styles.summaryMonth}>
                {new Date(year, month - 1).toLocaleDateString('en-GB', { month: 'long', year: 'numeric' })}
              </Text>
              <View style={styles.summaryRow}>
                <View style={styles.summaryItem}>
                  <Text style={styles.summaryLabel}>Income</Text>
                  <Text style={[styles.summaryValue, { color: SUCCESS }]}>GHS {summary.totalIncome?.toFixed(2)}</Text>
                </View>
                <View style={styles.summaryDivider} />
                <View style={styles.summaryItem}>
                  <Text style={styles.summaryLabel}>Expenses</Text>
                  <Text style={[styles.summaryValue, { color: DANGER }]}>GHS {summary.totalExpenses?.toFixed(2)}</Text>
                </View>
                <View style={styles.summaryDivider} />
                <View style={styles.summaryItem}>
                  <Text style={styles.summaryLabel}>Net</Text>
                  <Text style={[styles.summaryValue, { color: (summary.netBalance ?? 0) >= 0 ? SUCCESS : DANGER }]}>
                    GHS {summary.netBalance?.toFixed(2)}
                  </Text>
                </View>
              </View>
            </View>

            {summary.categoryBreakdown && Object.keys(summary.categoryBreakdown).length > 0 && (
              <View style={styles.card}>
                <Text style={styles.cardTitle}>Spending by Category</Text>
                {Object.entries(summary.categoryBreakdown)
                  .sort((a, b) => b[1] - a[1])
                  .map(([cat, amt]) => (
                    <View key={cat} style={styles.catRow}>
                      <Text style={styles.catName}>{cat}</Text>
                      <Text style={styles.catAmt}>GHS {(amt as number).toFixed(2)}</Text>
                    </View>
                  ))}
              </View>
            )}

            {summary.spendingLimits && Object.keys(summary.spendingLimits).length > 0 && (
              <View style={styles.card}>
                <Text style={styles.cardTitle}>Spending Limits</Text>
                {Object.entries(summary.spendingLimits).map(([cat, data]) => (
                  <View key={cat} style={styles.limitRow}>
                    <View style={styles.limitHeader}>
                      <Text style={styles.limitCat}>{cat}</Text>
                      <Text style={[styles.limitAmt, (data as SpendingLimitData).exceeded && { color: DANGER }]}>
                        GHS {(data as SpendingLimitData).spent?.toFixed(0)} / {(data as SpendingLimitData).limit}
                      </Text>
                    </View>
                    <View style={styles.limitBar}>
                      <View style={[styles.limitFill, {
                        width: `${Math.min((data as SpendingLimitData).percentUsed, 100)}%` as any,
                        backgroundColor: (data as SpendingLimitData).exceeded ? DANGER : SUCCESS,
                      }]} />
                    </View>
                  </View>
                ))}
              </View>
            )}
          </View>
        )}

        {/* Transactions Tab */}
        {activeTab === 'transactions' && (
          <View style={styles.section}>
            {sortedTransactions.length === 0 ? (
              <View style={styles.emptyCard}>
                <Ionicons name="receipt-outline" size={36} color={MUTED} />
                <Text style={styles.emptyTitle}>No transactions yet</Text>
                <Text style={styles.emptyText}>Tap + Add to record your first transaction</Text>
              </View>
            ) : (
              sortedTransactions.map((tx) => (
                <View key={tx.id} style={styles.txCard}>
                  <View style={[styles.txIconBox, { backgroundColor: tx.type === 'INCOME' ? '#f0fdf4' : '#fef2f2' }]}>
                    <Ionicons
                      name={tx.type === 'INCOME' ? 'arrow-down-outline' : 'arrow-up-outline'}
                      size={18}
                      color={tx.type === 'INCOME' ? SUCCESS : DANGER}
                    />
                  </View>
                  <View style={styles.txInfo}>
                    <Text style={styles.txDesc}>{tx.description}</Text>
                    <Text style={styles.txMeta}>{tx.category} · {formatDate(tx.transactionDate)}</Text>
                  </View>
                  <Text style={[styles.txAmt, { color: tx.type === 'INCOME' ? SUCCESS : DANGER }]}>
                    {tx.type === 'INCOME' ? '+' : '-'}GHS {tx.amount}
                  </Text>
                </View>
              ))
            )}
          </View>
        )}

        {/* Limits Tab */}
        {activeTab === 'limits' && (
          <View style={styles.section}>
            <TouchableOpacity style={styles.primaryBtn} onPress={() => setShowLimit(true)}>
              <Ionicons name="add-circle-outline" size={18} color={WHITE} style={{ marginRight: 6 }} />
              <Text style={styles.primaryBtnText}>Set Spending Limit</Text>
            </TouchableOpacity>
            {limits.length === 0 ? (
              <View style={styles.emptyCard}>
                <Ionicons name="bar-chart-outline" size={36} color={MUTED} />
                <Text style={styles.emptyTitle}>No limits set</Text>
                <Text style={styles.emptyText}>Set monthly spending limits to track your budget</Text>
              </View>
            ) : (
              limits.map((l) => (
                <View key={l.id} style={styles.card}>
                  <Text style={styles.limitCat}>{l.category}</Text>
                  <Text style={styles.limitAmt}>GHS {l.monthlyLimit} / month</Text>
                </View>
              ))
            )}
          </View>
        )}

        <View style={{ height: 40 }} />
      </ScrollView>

      {/* Add Transaction Modal */}
      <Modal visible={showAdd} animationType="slide" transparent>
        <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
          <View style={styles.modalBg}>
            <View style={styles.modal}>
              <ScrollView showsVerticalScrollIndicator={false}>
                <Text style={styles.modalTitle}>Add Transaction</Text>
                <View style={styles.typeRow}>
                  {['EXPENSE', 'INCOME'].map((t) => (
                    <TouchableOpacity
                      key={t}
                      style={[styles.typeBtn, newExpense.type === t && styles.typeSel]}
                      onPress={() => setNewExpense({ ...newExpense, type: t })}
                    >
                      <Text style={[styles.typeText, newExpense.type === t && styles.typeTextSel]}>
                        {t === 'EXPENSE' ? 'Expense' : 'Income'}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
                <Text style={styles.label}>Amount (GHS) *</Text>
                <TextInput style={styles.input} placeholder="0.00" placeholderTextColor={MUTED} value={newExpense.amount} onChangeText={(t) => setNewExpense({ ...newExpense, amount: t })} keyboardType="numeric" />
                <Text style={styles.label}>Description *</Text>
                <TextInput style={styles.input} placeholder="What was this for?" placeholderTextColor={MUTED} value={newExpense.description} onChangeText={(t) => setNewExpense({ ...newExpense, description: t })} />
                <Text style={styles.label}>Category</Text>
                <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginTop: 4, marginBottom: 8 }}>
                  {CATEGORIES.map((c) => (
                    <TouchableOpacity key={c} style={[styles.catChip, newExpense.category === c && styles.catChipSel]} onPress={() => setNewExpense({ ...newExpense, category: c })}>
                      <Text style={[styles.catChipText, newExpense.category === c && styles.catChipTextSel]}>{c}</Text>
                    </TouchableOpacity>
                  ))}
                </ScrollView>
                <TouchableOpacity style={[styles.primaryBtn, adding && { opacity: 0.6 }]} onPress={handleAdd} disabled={adding}>
                  {adding ? <ActivityIndicator color={WHITE} /> : <Text style={styles.primaryBtnText}>Save Transaction</Text>}
                </TouchableOpacity>
                <TouchableOpacity style={styles.cancelBtn} onPress={() => setShowAdd(false)}>
                  <Text style={styles.cancelText}>Cancel</Text>
                </TouchableOpacity>
              </ScrollView>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>

      {/* Set Limit Modal */}
      <Modal visible={showLimit} animationType="slide" transparent>
        <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
          <View style={styles.modalBg}>
            <View style={styles.modal}>
              <Text style={styles.modalTitle}>Set Spending Limit</Text>
              <Text style={styles.label}>Category</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginTop: 4, marginBottom: 8 }}>
                {CATEGORIES.map((c) => (
                  <TouchableOpacity key={c} style={[styles.catChip, newLimit.category === c && styles.catChipSel]} onPress={() => setNewLimit({ ...newLimit, category: c })}>
                    <Text style={[styles.catChipText, newLimit.category === c && styles.catChipTextSel]}>{c}</Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>
              <Text style={styles.label}>Monthly Limit (GHS)</Text>
              <TextInput style={styles.input} placeholder="e.g. 500" placeholderTextColor={MUTED} value={newLimit.monthlyLimit} onChangeText={(t) => setNewLimit({ ...newLimit, monthlyLimit: t })} keyboardType="numeric" />
              <TouchableOpacity style={styles.primaryBtn} onPress={handleSetLimit}>
                <Text style={styles.primaryBtnText}>Set Limit</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.cancelBtn} onPress={() => setShowLimit(false)}>
                <Text style={styles.cancelText}>Cancel</Text>
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
  title: { fontSize: 22, fontWeight: '700', color: DARK },
  addBtn: { flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: DARK, borderRadius: 10, paddingHorizontal: 14, paddingVertical: 8 },
  addBtnText: { color: WHITE, fontSize: 14, fontWeight: '600' },
  tabRow: { flexDirection: 'row', backgroundColor: WHITE, borderBottomWidth: 1, borderBottomColor: BORDER },
  tab: { flex: 1, paddingVertical: 14, alignItems: 'center', borderBottomWidth: 2, borderBottomColor: 'transparent' },
  activeTab: { borderBottomColor: ACCENT },
  tabText: { fontSize: 13, fontWeight: '600', color: MUTED },
  activeTabText: { color: ACCENT },
  section: { padding: 16, gap: 12 },
  summaryCard: { backgroundColor: DARK, borderRadius: 16, padding: 20 },
  summaryMonth: { color: '#94a3b8', fontSize: 13, fontWeight: '600', textAlign: 'center', marginBottom: 16, letterSpacing: 0.5 },
  summaryRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  summaryItem: { flex: 1, alignItems: 'center' },
  summaryDivider: { width: 1, height: 40, backgroundColor: '#1e293b' },
  summaryLabel: { fontSize: 11, color: '#64748b', fontWeight: '600', marginBottom: 4 },
  summaryValue: { fontSize: 16, fontWeight: '800' },
  card: { backgroundColor: WHITE, borderRadius: 14, padding: 16, borderWidth: 1, borderColor: BORDER },
  cardTitle: { fontSize: 14, fontWeight: '700', color: DARK, marginBottom: 12 },
  catRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: BORDER },
  catName: { fontSize: 13, color: MUTED },
  catAmt: { fontSize: 13, fontWeight: '700', color: DARK },
  limitRow: { marginBottom: 14 },
  limitHeader: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 6 },
  limitCat: { fontSize: 13, fontWeight: '700', color: DARK },
  limitAmt: { fontSize: 12, color: MUTED },
  limitBar: { height: 5, backgroundColor: BORDER, borderRadius: 3, overflow: 'hidden' },
  limitFill: { height: '100%', borderRadius: 3 },
  txCard: { backgroundColor: WHITE, borderRadius: 14, padding: 14, flexDirection: 'row', alignItems: 'center', gap: 12, borderWidth: 1, borderColor: BORDER },
  txIconBox: { width: 40, height: 40, borderRadius: 12, justifyContent: 'center', alignItems: 'center' },
  txInfo: { flex: 1 },
  txDesc: { fontSize: 14, fontWeight: '600', color: DARK },
  txMeta: { fontSize: 11, color: MUTED, marginTop: 2 },
  txAmt: { fontSize: 14, fontWeight: '800' },
  emptyCard: { backgroundColor: WHITE, borderRadius: 14, padding: 32, alignItems: 'center', borderWidth: 1, borderColor: BORDER },
  emptyTitle: { fontSize: 15, fontWeight: '700', color: DARK, marginTop: 12, marginBottom: 4 },
  emptyText: { fontSize: 12, color: MUTED, textAlign: 'center' },
  primaryBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', backgroundColor: DARK, borderRadius: 12, padding: 14 },
  primaryBtnText: { color: WHITE, fontSize: 14, fontWeight: '700' },
  modalBg: { flex: 1, backgroundColor: 'rgba(0,0,0,0.6)', justifyContent: 'flex-end' },
  modal: { backgroundColor: WHITE, borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 24, maxHeight: '90%' as const },
  modalTitle: { fontSize: 20, fontWeight: '700', color: DARK, textAlign: 'center', marginBottom: 16 },
  label: { fontSize: 12, color: MUTED, fontWeight: '600', marginBottom: 6, marginTop: 14 },
  input: { backgroundColor: BG, borderRadius: 10, padding: 14, fontSize: 14, color: DARK, borderWidth: 1, borderColor: BORDER },
  typeRow: { flexDirection: 'row', gap: 10, marginBottom: 8 },
  typeBtn: { flex: 1, padding: 12, borderRadius: 10, borderWidth: 1.5, borderColor: BORDER, alignItems: 'center' },
  typeSel: { backgroundColor: DARK, borderColor: DARK },
  typeText: { fontSize: 13, fontWeight: '600', color: MUTED },
  typeTextSel: { color: WHITE },
  catChip: { backgroundColor: BG, borderRadius: 20, paddingHorizontal: 14, paddingVertical: 8, marginRight: 8, borderWidth: 1, borderColor: BORDER },
  catChipSel: { backgroundColor: DARK, borderColor: DARK },
  catChipText: { color: MUTED, fontSize: 12, fontWeight: '600' },
  catChipTextSel: { color: WHITE },
  cancelBtn: { padding: 14, alignItems: 'center', marginTop: 4 },
  cancelText: { color: MUTED, fontSize: 14 },
});