import React, { useState, useCallback, useMemo, useRef, useEffect } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity,
  ActivityIndicator, RefreshControl, TextInput, Modal, ScrollView,
  KeyboardAvoidingView, Platform, Dimensions, TouchableWithoutFeedback,
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { LineChart, PieChart } from 'react-native-chart-kit';
import DateTimePicker, { DateTimePickerEvent } from '@react-native-community/datetimepicker';
import { getPersonalTransactions, addPersonalExpense, getMonthlySummary, getSpendingLimits, setSpendingLimit, deleteSpendingLimit, resetSpendingLimit, deletePersonalTransaction } from '../services/api';
import { aggregateTransactions, ChartPeriod } from '../utils/chartData';
import { getCustomCategories, addCustomCategory, formatCategoryName } from '../utils/customCategories';
import { useAppAlert } from '../components/AppAlert';
import { useConfirmModal } from '../components/ConfirmModal';
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
  chartHeaderRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  trendControlsRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 14 },
  chartSectionLabel: { fontSize: 11, fontWeight: '700', color: c.muted, letterSpacing: 1 },
  periodPillRow: { flexDirection: 'row', backgroundColor: c.bg, borderRadius: 8, borderWidth: 1, borderColor: c.border, padding: 2 },
  periodPillBtn: { paddingVertical: 4, paddingHorizontal: 9, borderRadius: 6 },
  periodPillBtnActive: { backgroundColor: c.goldBgTint, borderWidth: 1, borderColor: c.accent },
  periodPillText: { fontSize: 10, fontWeight: '600', color: c.muted },
  periodPillTextActive: { color: c.accentDark },
  chartTotalValue: { fontSize: 26, fontWeight: '900', color: c.dark, marginTop: 4, marginBottom: 14 },
  chartCard: {
    backgroundColor: c.surface, borderRadius: 14, padding: 16,
    borderWidth: 1, borderColor: c.border, borderTopWidth: 3, borderTopColor: c.accent,
  },
  chartLabel: { fontSize: 13, fontWeight: '700', marginBottom: 4 },
  tappedPoint: { fontSize: 12, fontWeight: '600', textAlign: 'center', marginTop: 6 },
  customBtn: { paddingVertical: 8, paddingHorizontal: 14, alignItems: 'center', borderRadius: 8, borderWidth: 1, borderColor: c.border, marginTop: 8 },
  customBtnActive: { backgroundColor: c.goldBgTint, borderColor: c.accent },
  customBtnText: { fontSize: 12, fontWeight: '600', color: c.muted },
  customBtnTextActive: { color: c.accent },
  customRow: { flexDirection: 'row', gap: 10, marginTop: 10, justifyContent: 'center' },
  customInput: { backgroundColor: c.bg, borderRadius: 8, paddingVertical: 9, paddingHorizontal: 14, borderWidth: 1, borderColor: c.border, alignItems: 'center' },
  customInputText: { fontSize: 13, textAlign: 'center' },
  iosPickerCard: { backgroundColor: c.bg, borderRadius: 10, marginTop: 10, overflow: 'hidden' },
  iosPickerDoneBtn: { alignItems: 'center', paddingVertical: 12, borderTopWidth: 1, borderTopColor: c.border },
  iosPickerDoneText: { color: c.accent, fontWeight: '700', fontSize: 14 },
  customEmptyState: { paddingVertical: 40, alignItems: 'center', justifyContent: 'center' },
  customEmptyText: { fontSize: 13, color: c.muted, textAlign: 'center' },
  summaryMonth: { color: c.muted, fontSize: 13, fontWeight: '600', textAlign: 'center', marginBottom: 16, letterSpacing: 0.5 },
  summaryRow: { flexDirection: 'row', gap: 12 },
  summaryCard: {
    flex: 1, backgroundColor: c.surface, borderRadius: 16, padding: 18,
    borderWidth: 1, borderColor: c.border, alignItems: 'center',
  },
  summaryIconBadge: {
    width: 44, height: 44, borderRadius: 22,
    justifyContent: 'center', alignItems: 'center', marginBottom: 10,
  },
  summaryValue: { fontSize: 18, fontWeight: '800', color: c.dark },
  summaryCurrency: { fontSize: 11, fontWeight: '500', color: c.muted },
  summaryLabel: { fontSize: 11, color: c.muted, fontWeight: '600', marginTop: 4 },
  netRow: { flexDirection: 'row', justifyContent: 'center', alignItems: 'baseline', marginTop: 14, gap: 6 },
  netLabel: { fontSize: 12, color: c.muted, fontWeight: '600' },
  netValue: { fontSize: 15, fontWeight: '800' },
  card: { backgroundColor: c.surface, borderRadius: 14, padding: 16, borderWidth: 1, borderColor: c.border, borderTopWidth: 3, borderTopColor: c.accent },
  cardTitle: { fontSize: 14, fontWeight: '700', color: c.dark, marginBottom: 12 },
  manageSectionLabel: { fontSize: 12, fontWeight: '700', color: c.muted, letterSpacing: 0.8, marginBottom: 10 },
  recapCard: {
    backgroundColor: c.goldBgTint, borderRadius: 14, padding: 16,
    borderWidth: 1, borderColor: c.border, borderTopWidth: 3, borderTopColor: c.accent, marginTop: 12,
  },
  recapText: { fontSize: 14, color: c.dark, lineHeight: 21 },
  recapHighlight: { fontWeight: '700', color: c.dark },
  legendRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: c.border },
  legendDot: { width: 10, height: 10, borderRadius: 5, marginRight: 10 },
  legendCategory: { flex: 1, fontSize: 13, color: c.dark, fontWeight: '600' },
  legendPercent: { fontSize: 12, color: c.muted, marginRight: 10, width: 36, textAlign: 'right' },
  legendAmount: { fontSize: 13, color: c.dark, fontWeight: '700', width: 90, textAlign: 'right' },
  limitRow: { marginBottom: 14 },
  limitHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 },
  limitHeaderLeft: { flexDirection: 'row', alignItems: 'center', gap: 8, flex: 1 },
  limitHeaderActions: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  limitActionBtn: { padding: 4 },
  limitCat: { fontSize: 15, fontWeight: '800', color: c.dark },
  limitAmt: { fontSize: 14, fontWeight: '700', color: c.muted },
  limitBar: { height: 8, backgroundColor: c.border, borderRadius: 4, overflow: 'hidden' },
  limitFill: { height: '100%', borderRadius: 3 },
  limitSpentText: { fontSize: 12, color: c.muted, marginTop: 6 },
  txCard: { backgroundColor: c.surface, borderRadius: 14, padding: 14, flexDirection: 'row', alignItems: 'center', gap: 12, borderWidth: 1, borderColor: c.border },
  txIconBox: { width: 40, height: 40, borderRadius: 12, justifyContent: 'center', alignItems: 'center' },
  txInfo: { flex: 1 },
  txDesc: { fontSize: 14, fontWeight: '600', color: c.dark },
  txMeta: { fontSize: 11, color: c.muted, marginTop: 2 },
  txAmt: { fontSize: 14, fontWeight: '800' },
  txDeleteBtn: { padding: 4 },
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
  typeBtn: { flex: 1, flexDirection: 'row', justifyContent: 'center', padding: 12, borderRadius: 10, borderWidth: 1.5, borderColor: c.border, alignItems: 'center' },
  typeSel: { backgroundColor: c.buttonDark, borderColor: c.buttonDark },
  typeText: { fontSize: 13, fontWeight: '600', color: c.muted },
  typeTextSel: { color: c.buttonDarkText },
  catChip: { backgroundColor: c.bg, borderRadius: 20, paddingHorizontal: 14, paddingVertical: 8, marginRight: 8, borderWidth: 1, borderColor: c.border },
  catChipSel: { backgroundColor: c.buttonDark, borderColor: c.buttonDark },
  catChipText: { color: c.muted, fontSize: 12, fontWeight: '600' },
  catChipTextSel: { color: c.buttonDarkText },
  cancelBtn: { padding: 14, alignItems: 'center', marginTop: 4 },
  cancelText: { color: c.muted, fontSize: 14 },

  saveCategoryRow: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    marginTop: 4, padding: 12, borderRadius: 12,
    backgroundColor: c.goldBgTint, borderWidth: 1, borderColor: c.border,
  },
  saveCategoryCheckbox: {
    width: 20, height: 20, borderRadius: 5,
    borderWidth: 2, borderColor: c.border,
    justifyContent: 'center', alignItems: 'center',
  },
  saveCategoryCheckboxChecked: { backgroundColor: c.accent, borderColor: c.accent },
  saveCategoryText: { fontSize: 12, color: c.dark, fontWeight: '600', flex: 1 },

  // Income banner
  incomeBanner: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    backgroundColor: '#f0fdf4', borderRadius: 10, padding: 12,
    borderWidth: 1, borderColor: '#bbf7d0', marginBottom: 4,
  },
  incomeBannerText: { fontSize: 13, color: '#16a34a', fontWeight: '600', flex: 1 },
});

export default function ExpensesScreen() {
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const { showAlert } = useAppAlert();
  const { confirm } = useConfirmModal();
  const deletingLimitRef = useRef(false);
  const resettingLimitRef = useRef(false);
  const deletingTxRef = useRef(false);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [summary, setSummary] = useState<Summary | null>(null);
  const [limits, setLimits] = useState<LimitRecord[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [refreshing, setRefreshing] = useState<boolean>(false);
  const [activeTab, setActiveTab] = useState<string>('overview');
  const [showAdd, setShowAdd] = useState<boolean>(false);
  const [showLimit, setShowLimit] = useState<boolean>(false);
  const [adding, setAdding] = useState<boolean>(false);
  const [newExpense, setNewExpense] = useState<NewExpense>({ amount: '', description: '', category: 'Food', type: 'EXPENSE' });
  const [newLimit, setNewLimit] = useState<NewLimit>({ category: '', monthlyLimit: '' });
  const [chartPeriod, setChartPeriod] = useState<ChartPeriod>('week');
  const [tappedPoint, setTappedPoint] = useState<{ label: string; value: number; type: string } | null>(null);
  const [customFrom, setCustomFrom] = useState<string>('');
  const [customTo, setCustomTo] = useState<string>('');
  const [showCustomRange, setShowCustomRange] = useState<boolean>(false);
  const [pickerField, setPickerField] = useState<'from' | 'to' | null>(null);
  const [chartView, setChartView] = useState<'trend' | 'category'>('trend');
  const [showCustomModal, setShowCustomModal] = useState<boolean>(false);
  const [customCategories, setCustomCategories] = useState<string[]>([]);
  const [saveAsCategory, setSaveAsCategory] = useState<boolean>(false);

  useEffect(() => {
    getCustomCategories().then(setCustomCategories);
  }, []);

  // Built-in categories plus any the user has permanently saved on this device,
  // with "Other" always pinned last as the fallback/catch-all.
  const allCategories = useMemo(() => {
    const base = CATEGORIES.slice(0, -1);
    const extras = customCategories.filter(
      (cc) => !base.some((b) => b.toLowerCase() === cc.toLowerCase())
    );
    return [...base, ...extras, 'Other'];
  }, [customCategories]);

  const toDateInputString = (d: Date): string =>
    `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

  const handleDateChange = (event: DateTimePickerEvent, date?: Date): void => {
    if (Platform.OS === 'android') {
      setPickerField(null);
      if (event.type !== 'set' || !date) return;
    }
    if (date) {
      const formatted = toDateInputString(date);
      if (pickerField === 'from') setCustomFrom(formatted);
      else if (pickerField === 'to') setCustomTo(formatted);
    }
  };

  const now = new Date();
  const [year] = useState<number>(now.getFullYear());
  const [month] = useState<number>(now.getMonth() + 1);

  const isIncome = newExpense.type === 'INCOME';

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

  const chartData = useMemo(() => aggregateTransactions(transactions, chartPeriod, customFrom || undefined, customTo || undefined), [transactions, chartPeriod, customFrom, customTo]);
  const periodTotal = chartData.datasets[1].data.reduce((sum, v) => sum + v, 0);

  const chartLabels = useMemo(() => {
    const labels = chartData.labels;
    const n = labels.length;
    if (n <= 8) return labels;
    let step: number;
    if (n <= 16) step = 2;
    else if (n <= 30) step = 3;
    else step = Math.ceil(n / 7); // wide ranges: cap at ~7-8 visible labels total

    const lastSteppedIndex = Math.floor((n - 1) / step) * step;
    const skipLastStepped = lastSteppedIndex !== n - 1 && lastSteppedIndex !== 0 && (n - 1 - lastSteppedIndex) < step;

    return labels.map((l, i) => {
      if (i === n - 1) return l;
      if (i === lastSteppedIndex && skipLastStepped) return '';
      return i % step === 0 ? l : '';
    });
  }, [chartData.labels]);

  const chartPointCount = chartData.datasets[1].data.length;
  const screenWidth = Dimensions.get('window').width;

  // Each category gets a fully distinct hue from the existing theme palette —
  // no two are alpha-blended variants of the same base color (that's what
  // made the old palette hard to read on the pie chart), and none of them
  // are pulled from a generic rainbow set; they're the same status colors
  // already used for badges/pills elsewhere in the app.
  const getCategoryColor = (category?: string): string => ({
    Food: colors.statusOrange, Loan: colors.accent, Shopping: colors.statusPurple,
    Entertainment: colors.statusRose, Transport: colors.statusBlue,
    Utilities: colors.statusTeal, 'Shared Expense': colors.slate700,
    Other: colors.slate400,
  }[category || ''] || colors.muted);

  const getLimitColor = (percentUsed: number): string => {
    if (percentUsed > 80) return colors.danger;
    if (percentUsed >= 50) return colors.warning;
    return colors.success;
  };

  const categoryChartData = summary?.categoryBreakdown
    ? Object.entries(summary.categoryBreakdown)
        .sort((a, b) => (b[1] as number) - (a[1] as number))
        .map(([category, amount]) => {
          const totalSpend = Object.values(summary.categoryBreakdown as Record<string, number>).reduce((sum, v) => sum + v, 0);
          return {
            name: category,
            population: amount as number,
            color: getCategoryColor(category),
            legendFontColor: colors.muted,
            legendFontSize: 12,
            percentage: totalSpend > 0 ? Math.round(((amount as number) / totalSpend) * 100) : 0,
          };
        })
    : [];

  const handleAdd = async (): Promise<void> => {
    if (!newExpense.amount || parseFloat(newExpense.amount) <= 0) { showAlert('error', 'Error', 'Enter a valid amount'); return; }
    const descriptionOptional = newExpense.type === 'EXPENSE' && !!newExpense.category;
    if (!newExpense.description.trim() && !descriptionOptional) { showAlert('error', 'Error', 'Enter a description'); return; }
    const finalDescription = newExpense.description.trim() || newExpense.category;

    // If "Other" was picked and the user opted to save it, the typed description
    // becomes a real category from now on instead of being tagged generically "Other".
    const isOtherWithSave = !isIncome && newExpense.category === 'Other' && saveAsCategory && !!newExpense.description.trim();
    const resolvedCategory = isOtherWithSave ? formatCategoryName(newExpense.description) : newExpense.category;
    const finalCategory = isIncome ? 'Income' : resolvedCategory;

    const persistCategoryIfNeeded = async (): Promise<void> => {
      if (isOtherWithSave) {
        const updated = await addCustomCategory(resolvedCategory);
        setCustomCategories(updated);
      }
    };

    setAdding(true);
    try {
      await addPersonalExpense({
        amount: parseFloat(newExpense.amount),
        description: finalDescription,
        category: finalCategory,
        type: newExpense.type,
      });
      setShowAdd(false);
      setNewExpense({ amount: '', description: '', category: 'Food', type: 'EXPENSE' });
      setSaveAsCategory(false);
      await persistCategoryIfNeeded();
      loadData();
      showAlert('success', isIncome ? 'Income Added' : 'Expense Added', `GHS ${parseFloat(newExpense.amount).toFixed(2)} recorded.`);
    } catch (e) {
      const msg = (e as Error).message;
      if (msg.includes('Spending limit exceeded')) {
        setAdding(false);
        setShowAdd(false);
        const ok = await confirm('Limit Exceeded', msg, 'Add Anyway');
        if (ok) {
          setAdding(true);
          try {
            await addPersonalExpense({
              amount: parseFloat(newExpense.amount),
              description: finalDescription,
              category: finalCategory,
              type: newExpense.type,
              overrideLimit: true,
            });
            setNewExpense({ amount: '', description: '', category: 'Food', type: 'EXPENSE' });
            setSaveAsCategory(false);
            await persistCategoryIfNeeded();
            loadData();
            showAlert('success', 'Expense Added', 'Your expense was added, exceeding the spending limit.');
          } catch (retryError) {
            showAlert('error', 'Error', (retryError as Error).message);
          } finally {
            setAdding(false);
          }
        }
        return;
      }
      showAlert('error', 'Error', msg);
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

  const handleDeleteLimit = async (limitId: number, category: string): Promise<void> => {
    if (deletingLimitRef.current) return;
    deletingLimitRef.current = true;
    try {
      const ok = await confirm('Delete Limit', `Delete this spending limit for ${category}?`, 'Delete');
      if (!ok) return;
      await deleteSpendingLimit(limitId);
      loadData();
    } catch (e) {
      showAlert('error', 'Error', (e as Error).message);
    } finally {
      deletingLimitRef.current = false;
    }
  };

  const handleResetLimit = async (limitId: number, category: string): Promise<void> => {
    if (resettingLimitRef.current) return;
    resettingLimitRef.current = true;
    try {
      const ok = await confirm('Reset Limit', `Reset tracking for this ${category} limit? This clears spend history for the current period without changing the limit amount.`, 'Reset');
      if (!ok) return;
      await resetSpendingLimit(limitId);
      loadData();
    } catch (error) {
      showAlert('error', 'Error', (error as Error).message);
    } finally {
      resettingLimitRef.current = false;
    }
  };

  const handleDeleteTransaction = async (transactionId: number, description: string): Promise<void> => {
    if (deletingTxRef.current) return;
    deletingTxRef.current = true;
    try {
      const ok = await confirm('Delete Transaction', `Delete "${description}"?`, 'Delete');
      if (!ok) return;
      await deletePersonalTransaction(transactionId);
      loadData();
    } catch (e) {
      showAlert('error', 'Error', (e as Error).message);
    } finally {
      deletingTxRef.current = false;
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
        {['overview', 'manage'].map((t) => (
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
        {/* Overview Tab — view-only: summary cards, recap, charts */}
        {activeTab === 'overview' && summary && (
          <View style={styles.section}>
            <Text style={styles.summaryMonth}>
              {new Date(year, month - 1).toLocaleDateString('en-GB', { month: 'long', year: 'numeric' })}
            </Text>
            <View style={styles.summaryRow}>
              <View style={styles.summaryCard}>
                <View style={[styles.summaryIconBadge, { backgroundColor: `${colors.success}18` }]}>
                  <Ionicons name="arrow-up-circle" size={26} color={colors.success} />
                </View>
                <Text style={styles.summaryValue} numberOfLines={1} adjustsFontSizeToFit>
                  <Text style={styles.summaryCurrency}>GHS </Text>{summary.totalIncome?.toFixed(2)}
                </Text>
                <Text style={styles.summaryLabel}>Income</Text>
              </View>
              <View style={styles.summaryCard}>
                <View style={[styles.summaryIconBadge, { backgroundColor: `${colors.danger}18` }]}>
                  <Ionicons name="arrow-down-circle" size={26} color={colors.danger} />
                </View>
                <Text style={styles.summaryValue} numberOfLines={1} adjustsFontSizeToFit>
                  <Text style={styles.summaryCurrency}>GHS </Text>{summary.totalExpenses?.toFixed(2)}
                </Text>
                <Text style={styles.summaryLabel}>Expenses</Text>
              </View>
            </View>
            <View style={styles.netRow}>
              <Text style={styles.netLabel}>Net</Text>
              <Text style={[styles.netValue, { color: (summary.netBalance ?? 0) >= 0 ? colors.success : colors.danger }]}>
                GHS {summary.netBalance?.toFixed(2)}
              </Text>
            </View>

            {categoryChartData.length > 0 ? (
              <View style={styles.recapCard}>
                <Text style={styles.recapText}>
                  You spent <Text style={styles.recapHighlight}>GHS {summary.totalExpenses?.toFixed(2)}</Text> this month, most on{' '}
                  <Text style={styles.recapHighlight}>{categoryChartData[0].name} ({categoryChartData[0].percentage}%)</Text>.
                  Income was <Text style={styles.recapHighlight}>GHS {summary.totalIncome?.toFixed(2)}</Text>, net{' '}
                  <Text style={[styles.recapHighlight, { color: (summary.netBalance ?? 0) >= 0 ? colors.success : colors.danger }]}>
                    GHS {summary.netBalance?.toFixed(2)}
                  </Text>.
                </Text>
              </View>
            ) : (
              <View style={styles.recapCard}>
                <Text style={styles.recapText}>
                  Income was <Text style={styles.recapHighlight}>GHS {summary.totalIncome?.toFixed(2)}</Text>, expenses{' '}
                  <Text style={styles.recapHighlight}>GHS {summary.totalExpenses?.toFixed(2)}</Text>, net{' '}
                  <Text style={[styles.recapHighlight, { color: (summary.netBalance ?? 0) >= 0 ? colors.success : colors.danger }]}>
                    GHS {summary.netBalance?.toFixed(2)}
                  </Text>.
                </Text>
              </View>
            )}

            <View style={styles.chartCard}>
              <View style={styles.chartHeaderRow}>
                <Text style={styles.chartSectionLabel}>SPENDING ACTIVITY</Text>
                <View style={styles.periodPillRow}>
                  <TouchableOpacity style={[styles.periodPillBtn, chartView === 'trend' && styles.periodPillBtnActive]} onPress={() => setChartView('trend')}>
                    <Text style={[styles.periodPillText, chartView === 'trend' && styles.periodPillTextActive]}>Trend</Text>
                  </TouchableOpacity>
                  <TouchableOpacity style={[styles.periodPillBtn, chartView === 'category' && styles.periodPillBtnActive]} onPress={() => setChartView('category')}>
                    <Text style={[styles.periodPillText, chartView === 'category' && styles.periodPillTextActive]}>Category</Text>
                  </TouchableOpacity>
                </View>
              </View>

              {chartView === 'trend' ? (
                <>
                  <View style={styles.trendControlsRow}>
                    <View style={styles.periodPillRow}>
                      {(['day', 'week', 'month', 'year'] as const).map((p) => (
                        <TouchableOpacity key={p} style={[styles.periodPillBtn, chartPeriod === p && styles.periodPillBtnActive]} onPress={() => { setChartPeriod(p); setShowCustomRange(false); }}>
                          <Text style={[styles.periodPillText, chartPeriod === p && styles.periodPillTextActive]}>
                            {({ day: 'D', week: 'W', month: 'M', year: 'Y' } as const)[p]}
                          </Text>
                        </TouchableOpacity>
                      ))}
                    </View>
                    <TouchableOpacity
                      style={[styles.customBtn, chartPeriod === 'custom' && styles.customBtnActive]}
                      onPress={() => { setChartPeriod('custom'); setShowCustomRange(true); setShowCustomModal(true); }}
                    >
                      <Text style={[styles.customBtnText, chartPeriod === 'custom' && styles.customBtnTextActive]}>
                        {chartPeriod === 'custom' && customFrom && customTo ? `${customFrom} → ${customTo}` : 'Custom'}
                      </Text>
                    </TouchableOpacity>
                  </View>

                  <Text style={styles.chartTotalValue}>GHS {periodTotal.toLocaleString('en-GB', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</Text>

                  {chartPeriod === 'custom' && (!customFrom || !customTo) ? (
                    <View style={styles.customEmptyState}>
                      <Text style={styles.customEmptyText}>Tap Custom above to choose a date range</Text>
                    </View>
                  ) : (
                    <LineChart
                      data={{ labels: chartLabels, datasets: [{ data: chartData.datasets[1].data }] }}
                      width={screenWidth - 64}
                      height={180}
                      fromZero
                      bezier
                      withInnerLines
                      withHorizontalLabels={false}
                      withDots={chartPointCount <= 60}
                      yAxisLabel=""
                      yAxisSuffix=""
                      onDataPointClick={({ value, index }: { value: number; index: number }) => setTappedPoint({ label: chartData.labels[index], value, type: 'Expenses' })}
                      chartConfig={{
                        backgroundColor: colors.surface,
                        backgroundGradientFrom: colors.surface,
                        backgroundGradientTo: colors.surface,
                        decimalPlaces: 0,
                        color: () => colors.accentDark,
                        labelColor: () => colors.muted,
                        propsForDots: { r: chartPointCount > 30 ? '2' : '4', strokeWidth: '2', stroke: colors.accentDark },
                        propsForLabels: { fontSize: 9 },
                        propsForBackgroundLines: { stroke: colors.border, strokeWidth: 1, strokeDasharray: '' },
                      }}
                      style={{ borderRadius: 10, paddingBottom: 4, paddingRight: 24 }}
                    />
                  )}

                  {tappedPoint && (
                    <Text style={[styles.tappedPoint, { color: colors.accentDark }]}>
                      GHS {tappedPoint.value.toFixed(2)} on {tappedPoint.label}
                    </Text>
                  )}
                </>
              ) : (
                categoryChartData.length > 0 ? (
                  <>
                    <PieChart
                      data={categoryChartData}
                      width={screenWidth - 72}
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
                    {categoryChartData.map((item, i) => (
                      <View key={i} style={styles.legendRow}>
                        <View style={[styles.legendDot, { backgroundColor: item.color }]} />
                        <Text style={styles.legendCategory}>{item.name}</Text>
                        <Text style={styles.legendPercent}>{item.percentage}%</Text>
                        <Text style={styles.legendAmount}>GHS {item.population.toFixed(2)}</Text>
                      </View>
                    ))}
                  </>
                ) : (
                  <View style={styles.customEmptyState}>
                    <Text style={styles.customEmptyText}>No category data yet</Text>
                  </View>
                )
              )}
            </View>

            {/* Custom Range picker — modal instead of inline expansion */}
            <Modal visible={showCustomModal} animationType="slide" transparent onRequestClose={() => setShowCustomModal(false)}>
              <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
                <TouchableWithoutFeedback onPress={() => setShowCustomModal(false)}>
                  <View style={styles.modalBg}>
                  <TouchableWithoutFeedback onPress={() => {}}>
                  <View style={styles.modal}>
                    <Text style={styles.modalTitle}>Custom Date Range</Text>
                    <View style={styles.customRow}>
                      <TouchableOpacity style={styles.customInput} onPress={() => setPickerField('from')}>
                        <Text style={[styles.customInputText, { color: customFrom ? colors.dark : colors.muted }]}>
                          {customFrom || 'From (YYYY-MM-DD)'}
                        </Text>
                      </TouchableOpacity>
                      <TouchableOpacity style={styles.customInput} onPress={() => setPickerField('to')}>
                        <Text style={[styles.customInputText, { color: customTo ? colors.dark : colors.muted }]}>
                          {customTo || 'To (YYYY-MM-DD)'}
                        </Text>
                      </TouchableOpacity>
                    </View>

                    {pickerField && Platform.OS === 'android' && (
                      <DateTimePicker
                        value={(pickerField === 'from' ? customFrom : customTo) ? new Date(`${pickerField === 'from' ? customFrom : customTo}T00:00:00`) : new Date()}
                        mode="date"
                        display="default"
                        onChange={handleDateChange}
                      />
                    )}

                    {pickerField && Platform.OS === 'ios' && (
                      <View style={styles.iosPickerCard}>
                        <DateTimePicker
                          value={(pickerField === 'from' ? customFrom : customTo) ? new Date(`${pickerField === 'from' ? customFrom : customTo}T00:00:00`) : new Date()}
                          mode="date"
                          display="inline"
                          onChange={handleDateChange}
                        />
                        <TouchableOpacity style={styles.iosPickerDoneBtn} onPress={() => setPickerField(null)}>
                          <Text style={styles.iosPickerDoneText}>Done</Text>
                        </TouchableOpacity>
                      </View>
                    )}

                    <TouchableOpacity
                      style={styles.primaryBtn}
                      disabled={!customFrom || !customTo}
                      onPress={() => setShowCustomModal(false)}
                    >
                      <Text style={styles.primaryBtnText}>Apply</Text>
                    </TouchableOpacity>
                    <TouchableOpacity style={styles.cancelBtn} onPress={() => setShowCustomModal(false)}>
                      <Text style={styles.cancelText}>Close</Text>
                    </TouchableOpacity>
                  </View>
                  </TouchableWithoutFeedback>
                  </View>
                </TouchableWithoutFeedback>
              </KeyboardAvoidingView>
            </Modal>

          </View>
        )}

        {/* Manage Tab — actionable: transactions + spending limits */}
        {activeTab === 'manage' && (
          <View style={styles.section}>
            <Text style={styles.manageSectionLabel}>SPENDING LIMITS</Text>
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
              limits.map((l) => {
                const data = summary?.spendingLimits?.[l.category];
                const spent = data?.spent ?? 0;
                const percentUsed = data?.percentUsed ?? 0;
                return (
                  <View key={l.id} style={styles.card}>
                    <View style={styles.limitRow}>
                      <View style={styles.limitHeader}>
                        <View style={styles.limitHeaderLeft}>
                          <Text style={styles.limitCat}>{l.category}</Text>
                        </View>
                        <Text style={styles.limitAmt}>{percentUsed.toFixed(0)}%</Text>
                        <View style={styles.limitHeaderActions}>
                          <TouchableOpacity style={styles.limitActionBtn} onPress={() => handleResetLimit(l.id, l.category)}>
                            <Ionicons name="refresh-outline" size={18} color={colors.muted} />
                          </TouchableOpacity>
                          <TouchableOpacity style={styles.limitActionBtn} onPress={() => handleDeleteLimit(l.id, l.category)}>
                            <Ionicons name="trash-outline" size={18} color={colors.danger} />
                          </TouchableOpacity>
                        </View>
                      </View>
                      <View style={styles.limitBar}>
                        <View style={[styles.limitFill, {
                          width: `${Math.min(percentUsed, 100)}%` as any,
                          backgroundColor: getLimitColor(percentUsed),
                        }]} />
                      </View>
                      <Text style={styles.limitSpentText}>
                        GHS {spent.toFixed(0)} spent of GHS {l.monthlyLimit} limit
                      </Text>
                    </View>
                  </View>
                );
              })
            )}

            <Text style={[styles.manageSectionLabel, { marginTop: 20 }]}>TRANSACTIONS</Text>
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
                  <TouchableOpacity style={styles.txDeleteBtn} onPress={() => handleDeleteTransaction(tx.id, tx.description)}>
                    <Ionicons name="trash-outline" size={18} color={colors.danger} />
                  </TouchableOpacity>
                </View>
              ))
            )}
          </View>
        )}

        <View style={{ height: 40 }} />
      </ScrollView>

      {/* Add Transaction Modal */}
      <Modal visible={showAdd} animationType="slide" transparent onRequestClose={() => setShowAdd(false)}>
        <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
          <TouchableWithoutFeedback onPress={() => setShowAdd(false)}>
          <View style={styles.modalBg}>
            <TouchableWithoutFeedback onPress={() => {}}>
            <View style={styles.modal}>
              <ScrollView showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
                <Text style={styles.modalTitle}>
                  {isIncome ? 'Add Income' : 'Add Expense'}
                </Text>

                {/* Type toggle */}
                <View style={styles.typeRow}>
                  {['EXPENSE', 'INCOME'].map((t) => {
                    const selected = newExpense.type === t;
                    const icon = t === 'EXPENSE'
                      ? (selected ? 'trending-down' : 'trending-down-outline')
                      : (selected ? 'trending-up' : 'trending-up-outline');
                    return (
                      <TouchableOpacity
                        key={t}
                        style={[styles.typeBtn, selected && styles.typeSel]}
                        onPress={() => { setNewExpense({ ...newExpense, type: t, description: '', category: 'Food' }); setSaveAsCategory(false); }}
                      >
                        <Ionicons name={icon} size={16} color={selected ? colors.buttonDarkText : colors.muted} style={{ marginRight: 6 }} />
                        <Text style={[styles.typeText, selected && styles.typeTextSel]}>
                          {t === 'EXPENSE' ? 'Expense' : 'Income'}
                        </Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>

                {/* Income banner */}
                {isIncome && (
                  <View style={styles.incomeBanner}>
                    <Ionicons name="checkmark-circle" size={18} color="#16a34a" />
                    <Text style={styles.incomeBannerText}>Recording income — category not required</Text>
                  </View>
                )}

                {/* Amount label changes based on type */}
                <Text style={styles.label}>
                  {isIncome ? 'Income Amount (GHS) *' : 'Amount (GHS) *'}
                </Text>
                <TextInput
                  style={styles.input}
                  placeholder="0.00"
                  placeholderTextColor={colors.muted}
                  value={newExpense.amount}
                  onChangeText={(t) => setNewExpense({ ...newExpense, amount: t })}
                  keyboardType="numeric"
                />

                {/* Description placeholder changes based on type */}
                <Text style={styles.label}>
                  {isIncome || !newExpense.category ? 'Description *' : 'Description'}
                </Text>
                <TextInput
                  style={styles.input}
                  placeholder={isIncome ? 'Source of income (e.g. Salary, Freelance)' : 'What was this for?'}
                  placeholderTextColor={colors.muted}
                  value={newExpense.description}
                  onChangeText={(t) => setNewExpense({ ...newExpense, description: t })}
                />

                {/* Category picker — hidden for INCOME */}
                {!isIncome && (
                  <>
                    <Text style={styles.label}>Category</Text>
                    <ScrollView horizontal showsHorizontalScrollIndicator={false} keyboardShouldPersistTaps="handled" style={{ marginTop: 4, marginBottom: 8 }}>
                      {allCategories.map((cat) => (
                        <TouchableOpacity
                          key={cat}
                          style={[styles.catChip, newExpense.category === cat && styles.catChipSel]}
                          onPress={() => { setNewExpense({ ...newExpense, category: cat }); if (cat !== 'Other') setSaveAsCategory(false); }}
                        >
                          <Text style={[styles.catChipText, newExpense.category === cat && styles.catChipTextSel]}>{cat}</Text>
                        </TouchableOpacity>
                      ))}
                    </ScrollView>

                    {newExpense.category === 'Other' && newExpense.description.trim().length > 0 && (
                      <TouchableOpacity style={styles.saveCategoryRow} onPress={() => setSaveAsCategory((v) => !v)} activeOpacity={0.7}>
                        <View style={[styles.saveCategoryCheckbox, saveAsCategory && styles.saveCategoryCheckboxChecked]}>
                          {saveAsCategory && <Ionicons name="checkmark" size={13} color={colors.buttonDarkText} />}
                        </View>
                        <Text style={styles.saveCategoryText}>
                          Save "{formatCategoryName(newExpense.description)}" as a category for next time
                        </Text>
                      </TouchableOpacity>
                    )}
                  </>
                )}

                {/* Submit button label changes based on type */}
                <TouchableOpacity
                  style={[styles.primaryBtn, adding && { opacity: 0.6 }, { marginTop: 16 }]}
                  onPress={handleAdd}
                  disabled={adding}
                >
                  {adding
                    ? <ActivityIndicator color={colors.buttonDarkText} />
                    : <Text style={styles.primaryBtnText}>
                        {isIncome ? 'Add Income' : 'Save Expense'}
                      </Text>}
                </TouchableOpacity>
                <TouchableOpacity style={styles.cancelBtn} onPress={() => { setShowAdd(false); setSaveAsCategory(false); }}>
                  <Text style={styles.cancelText}>Cancel</Text>
                </TouchableOpacity>
              </ScrollView>
            </View>
            </TouchableWithoutFeedback>
          </View>
          </TouchableWithoutFeedback>
        </KeyboardAvoidingView>
      </Modal>

      {/* Set Limit Modal */}
      <Modal visible={showLimit} animationType="slide" transparent onRequestClose={() => setShowLimit(false)}>
        <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
          <TouchableWithoutFeedback onPress={() => setShowLimit(false)}>
          <View style={styles.modalBg}>
            <TouchableWithoutFeedback onPress={() => {}}>
            <View style={styles.modal}>
              <Text style={styles.modalTitle}>Set Spending Limit</Text>
              <Text style={styles.label}>Category</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} keyboardShouldPersistTaps="handled" style={{ marginTop: 4, marginBottom: 8 }}>
                {allCategories.map((cat) => (
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
            </TouchableWithoutFeedback>
          </View>
          </TouchableWithoutFeedback>
        </KeyboardAvoidingView>
      </Modal>
    </View>
  );
}
