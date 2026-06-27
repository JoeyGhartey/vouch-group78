import React, { useState, useCallback, useMemo } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity,
  ActivityIndicator, RefreshControl, TextInput, Modal, ScrollView,
  KeyboardAvoidingView, Platform,
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { getPersonalTransactions, addPersonalExpense, getMonthlySummary, getSpendingLimits, setSpendingLimit } from '../services/api';
import { useAppAlert } from '../components/AppAlert';
import { useTheme } from '../context/ThemeContext';
import { ColorScheme } from '../theme/colors';

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

const CATEGORIES = ['Food', 'Transport', 'Airtime', 'Rent', 'Utilities', 'Entertainment', 'Education', 'Health', 'Other'];

const createStyles = (c: ColorScheme) => StyleSheet.create({
  container: { flex: 1, backgroundColor: c.bg },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: c.bg },
  header: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    backgroundColor: c.surface, paddingHorizontal: 20, paddingTop: 56, paddingBottom: 16,
    borderBottomWidth: 1, borderBottomColor: c.border,
  },
  title: { fontSize: 22, fontWeight: '700', color: c.dark },
  addBtn: { flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: c.buttonDark, borderRadius: 10, paddingHorizontal: 14, paddingVertical: 8 },
  addBtnText: { color: c.buttonDarkText, fontSize: 14, fontWeight: '600' },
  tabRow: { flexDirection: 'row', backgroundColor: c.surface, borderBottomWidth: 1, borderBottomColor: c.border },
  tab: { flex: 1, paddingVertical: 14, alignItems: 'center', borderBottomWidth: 2, borderBottomColor: 'transparent' },
  activeTab: { borderBottomColor: c.accent },
  tabText: { fontSize: 13, fontWeight: '600', color: c.muted },
  activeTabText: { color: c.accent },
  section: { padding: 16, gap: 12 },
  summaryCard: {
    backgroundColor: c.surface, borderRadius: 16, padding: 20,
    borderWidth: 1, borderColor: c.border,
  },
  summaryMonth: { color: c.muted, fontSize: 13, fontWeight: '600', textAlign: 'center', marginBottom: 16, letterSpacing: 0.5 },
  summaryRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  summaryItem: { flex: 1, alignItems: 'center' },
  summaryDivider: { width: 1, height: 40, backgroundColor: c.border },
  summaryLabel: { fontSize: 11, color: c.muted, fontWeight: '600', marginBottom: 4 },
  summaryValue: { fontSize: 16, fontWeight: '800' },
  card: { backgroundColor: c.surface, borderRadius: 14, padding: 16, borderWidth: 1, borderColor: c.border },
  cardTitle: { fontSize: 14, fontWeight: '700', color: c.dark, marginBottom: 12 },
  catRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: c.border },
  catName: { fontSize: 13, color: c.muted },
  catAmt: { fontSize: 13, fontWeight: '700', color: c.dark },
  limitRow: { marginBottom: 14 },
  limitHeader: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 6 },
  limitCat: { fontSize: 13, fontWeight: '700', color: c.dark },
  limitAmt: { fontSize: 12, color: c.muted },
  limitBar: { height: 5, backgroundColor: c.border, borderRadius: 3, overflow: 'hidden' },
  limitFill: { height: '100%', borderRadius: 3 },
  txCard: { backgroundColor: c.surface, borderRadius: 14, padding: 14, flexDirection: 'row', alignItems: 'center', gap: 12, borderWidth: 1, borderColor: c.border },
  txIconBox: { width: 40, height: 40, borderRadius: 12, justifyContent: 'center', alignItems: 'center' },
  txInfo: { flex: 1 },
  txDesc: { fontSize: 14, fontWeight: '600', color: c.dark },
  txMeta: { fontSize: 11, color: c.muted, marginTop: 2 },
  txAmt: { fontSize: 14, fontWeight: '800' },
  emptyCard: { backgroundColor: c.surface, borderRadius: 14, padding: 32, alignItems: 'center', borderWidth: 1, borderColor: c.border },
  emptyTitle: { fontSize: 15, fontWeight: '700', color: c.dark, marginTop: 12, marginBottom: 4 },
  emptyText: { fontSize: 12, color: c.muted, textAlign: 'center' },
  primaryBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', backgroundColor: c.buttonDark, borderRadius: 12, padding: 14 },
  primaryBtnText: { color: c.buttonDarkText, fontSize: 14, fontWeight: '700' },
  modalBg: { flex: 1, backgroundColor: 'rgba(0,0,0,0.6)', justifyContent: 'flex-end' },
  modal: { backgroundColor: c.surface, borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 24, maxHeight: '90%' as const },
  modalTitle: { fontSize: 20, fontWeight: '700', color: c.dark, textAlign: 'center', marginBottom: 16 },
  label: { fontSize: 12, color: c.muted, fontWeight: '600', marginBottom: 6, marginTop: 14 },
  input: { backgroundColor: c.bg, borderRadius: 10, padding: 14, fontSize: 14, color: c.dark, borderWidth: 1, borderColor: c.border },
  typeRow: { flexDirection: 'row', gap: 10, marginBottom: 8 },
  typeBtn: { flex: 1, padding: 12, borderRadius: 10, borderWidth: 1.5, borderColor: c.border, alignItems: 'center' },
  typeSel: { backgroundColor: c.buttonDark, borderColor: c.buttonDark },
  typeText: { fontSize: 13, fontWeight: '600', color: c.muted },
  typeTextSel: { color: c.buttonDarkText },
  catChip: { backgroundColor: c.bg, borderRadius: 20, paddingHorizontal: 14, paddingVertical: 8, marginRight: 8, borderWidth: 1, borderColor: c.border },
  catChipSel: { backgroundColor: c.buttonDark, borderColor: c.buttonDark },
  catChipText: { color: c.muted, fontSize: 12, fontWeight: '600' },
  catChipTextSel: { color: c.buttonDarkText },
  cancelBtn: { padding: 14, alignItems: 'center', marginTop: 4 },
  cancelText: { color: c.muted, fontSize: 14 },
});

export default function ExpensesScreen() {
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
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

  if (loading) return <View style={styles.center}><ActivityIndicator size="large" color={colors.accent} /></View>;

  const sortedTransactions = [...transactions].sort(
    (a, b) => new Date(b.transactionDate).getTime() - new Date(a.transactionDate).getTime()
  );

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>My Finances</Text>
        <TouchableOpacity style={styles.addBtn} onPress={() => setShowAdd(true)}>
          <Ionicons name="add" size={18} color={colors.buttonDarkText} />
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
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); loadData(); }} tintColor={colors.accent} />}
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
                  <Text style={[styles.summaryValue, { color: colors.success }]}>GHS {summary.totalIncome?.toFixed(2)}</Text>
                </View>
                <View style={styles.summaryDivider} />
                <View style={styles.summaryItem}>
                  <Text style={styles.summaryLabel}>Expenses</Text>
                  <Text style={[styles.summaryValue, { color: colors.danger }]}>GHS {summary.totalExpenses?.toFixed(2)}</Text>
                </View>
                <View style={styles.summaryDivider} />
                <View style={styles.summaryItem}>
                  <Text style={styles.summaryLabel}>Net</Text>
                  <Text style={[styles.summaryValue, { color: (summary.netBalance ?? 0) >= 0 ? colors.success : colors.danger }]}>
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
                      <Text style={[styles.limitAmt, (data as SpendingLimitData).exceeded && { color: colors.danger }]}>
                        GHS {(data as SpendingLimitData).spent?.toFixed(0)} / {(data as SpendingLimitData).limit}
                      </Text>
                    </View>
                    <View style={styles.limitBar}>
                      <View style={[styles.limitFill, {
                        width: `${Math.min((data as SpendingLimitData).percentUsed, 100)}%` as any,
                        backgroundColor: (data as SpendingLimitData).exceeded ? colors.danger : colors.success,
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
                <Ionicons name="receipt-outline" size={36} color={colors.muted} />
                <Text style={styles.emptyTitle}>No transactions yet</Text>
                <Text style={styles.emptyText}>Tap + Add to record your first transaction</Text>
              </View>
            ) : (
              sortedTransactions.map((tx) => (
                <View key={tx.id} style={styles.txCard}>
                  <View style={[styles.txIconBox, { backgroundColor: tx.type === 'INCOME' ? colors.successBgTint : colors.dangerBgTint }]}>
                    <Ionicons
                      name={tx.type === 'INCOME' ? 'arrow-down-outline' : 'arrow-up-outline'}
                      size={18}
                      color={tx.type === 'INCOME' ? colors.success : colors.danger}
                    />
                  </View>
                  <View style={styles.txInfo}>
                    <Text style={styles.txDesc}>{tx.description}</Text>
                    <Text style={styles.txMeta}>{tx.category} · {formatDate(tx.transactionDate)}</Text>
                  </View>
                  <Text style={[styles.txAmt, { color: tx.type === 'INCOME' ? colors.success : colors.danger }]}>
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
              <Ionicons name="add-circle-outline" size={18} color={colors.buttonDarkText} style={{ marginRight: 6 }} />
              <Text style={styles.primaryBtnText}>Set Spending Limit</Text>
            </TouchableOpacity>
            {limits.length === 0 ? (
              <View style={styles.emptyCard}>
                <Ionicons name="bar-chart-outline" size={36} color={colors.muted} />
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
                <TextInput style={styles.input} placeholder="0.00" placeholderTextColor={colors.muted} value={newExpense.amount} onChangeText={(t) => setNewExpense({ ...newExpense, amount: t })} keyboardType="numeric" />
                <Text style={styles.label}>Description *</Text>
                <TextInput style={styles.input} placeholder="What was this for?" placeholderTextColor={colors.muted} value={newExpense.description} onChangeText={(t) => setNewExpense({ ...newExpense, description: t })} />
                <Text style={styles.label}>Category</Text>
                <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginTop: 4, marginBottom: 8 }}>
                  {CATEGORIES.map((cat) => (
                    <TouchableOpacity key={cat} style={[styles.catChip, newExpense.category === cat && styles.catChipSel]} onPress={() => setNewExpense({ ...newExpense, category: cat })}>
                      <Text style={[styles.catChipText, newExpense.category === cat && styles.catChipTextSel]}>{cat}</Text>
                    </TouchableOpacity>
                  ))}
                </ScrollView>
                <TouchableOpacity style={[styles.primaryBtn, adding && { opacity: 0.6 }]} onPress={handleAdd} disabled={adding}>
                  {adding ? <ActivityIndicator color={colors.buttonDarkText} /> : <Text style={styles.primaryBtnText}>Save Transaction</Text>}
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
                {CATEGORIES.map((cat) => (
                  <TouchableOpacity key={cat} style={[styles.catChip, newLimit.category === cat && styles.catChipSel]} onPress={() => setNewLimit({ ...newLimit, category: cat })}>
                    <Text style={[styles.catChipText, newLimit.category === cat && styles.catChipTextSel]}>{cat}</Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>
              <Text style={styles.label}>Monthly Limit (GHS)</Text>
              <TextInput style={styles.input} placeholder="e.g. 500" placeholderTextColor={colors.muted} value={newLimit.monthlyLimit} onChangeText={(t) => setNewLimit({ ...newLimit, monthlyLimit: t })} keyboardType="numeric" />
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
