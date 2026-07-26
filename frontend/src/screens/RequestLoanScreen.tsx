import React, { useState, useMemo, useEffect } from 'react';
import {
  View, Text, StyleSheet, TextInput, TouchableOpacity,
  ScrollView, ActivityIndicator, KeyboardAvoidingView, Platform,
} from 'react-native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { RouteProp } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { requestLoan, getCircle, getProfile } from '../services/api';
import { useAppAlert } from '../components/AppAlert';
import { useTheme } from '../context/ThemeContext';
import { RootStackParamList } from '../navigation/AppNavigator';
import { ColorScheme } from '../theme/colors';
import { formatMoney } from '../utils/formatMoney';
import { LOAN_REASONS, getCustomLoanReasons, addCustomLoanReason } from '../utils/customLoanReasons';
import { formatCategoryName } from '../utils/customCategories';

// Mirrors LoanService.effectiveGroupFundingThreshold on the backend -- a
// higher-trust borrower can go further above the circle's base threshold
// before a loan is required to be group-funded. Keep both in sync.
const effectiveGroupFundingThreshold = (base: number, trustScore: number): number => {
  if (trustScore >= 90) return base * 2.0;
  if (trustScore >= 70) return base * 1.5;
  if (trustScore >= 50) return base;
  return base * 0.5;
};

type Props = {
  route: RouteProp<RootStackParamList, 'RequestLoan'>;
  navigation: NativeStackNavigationProp<RootStackParamList, 'RequestLoan'>;
};

const createStyles = (c: ColorScheme) => StyleSheet.create({
  container: { flex: 1, backgroundColor: c.bg },
  header: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    backgroundColor: c.surface, paddingHorizontal: 20, paddingTop: 56, paddingBottom: 16,
    borderBottomWidth: 1, borderBottomColor: c.border,
  },
  back: { color: c.accent, fontSize: 16, fontWeight: '600' },
  title: { fontSize: 18, fontWeight: '700', color: c.dark },
  form: { padding: 16 },
  label: { fontSize: 12, color: c.muted, fontWeight: '600', marginBottom: 6, marginTop: 16 },
  input: {
    backgroundColor: c.surface, borderRadius: 12, padding: 14,
    fontSize: 15, color: c.dark, borderWidth: 1, borderColor: c.border,
  },
  typeRow: { flexDirection: 'row', gap: 10 },
  typeBtn: {
    flex: 1, backgroundColor: c.surface, borderRadius: 12, padding: 14,
    alignItems: 'center', borderWidth: 1.5, borderColor: c.border,
  },
  typeSel: { backgroundColor: c.buttonDark, borderColor: c.buttonDark },
  typeText: { fontSize: 14, fontWeight: '700', color: c.muted },
  typeTextSel: { color: c.buttonDarkText },
  typeDesc: { fontSize: 11, color: c.muted, marginTop: 4, textAlign: 'center' },
  preview: {
    backgroundColor: c.surface, borderRadius: 14, padding: 16,
    marginTop: 20, borderWidth: 1, borderColor: c.border,
  },
  previewHeader: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 12 },
  previewTitle: { fontSize: 14, fontWeight: '700', color: c.dark },
  previewRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 6, borderBottomWidth: 1, borderBottomColor: c.border },
  previewLabel: { fontSize: 13, color: c.muted },
  previewValue: { fontSize: 13, fontWeight: '600', color: c.dark },
  previewNote: { fontSize: 12, color: c.accent, marginTop: 10, fontStyle: 'italic' as const },
  submitBtn: { backgroundColor: c.buttonDark, borderRadius: 12, padding: 16, alignItems: 'center', marginTop: 24 },
  submitText: { color: c.buttonDarkText, fontSize: 16, fontWeight: '700' },
  catChip: { backgroundColor: c.surface, borderRadius: 20, paddingHorizontal: 14, paddingVertical: 8, marginRight: 8, borderWidth: 1, borderColor: c.border },
  catChipSel: { backgroundColor: c.buttonDark, borderColor: c.buttonDark },
  catChipText: { color: c.muted, fontSize: 12, fontWeight: '600' },
  catChipTextSel: { color: c.buttonDarkText },
  saveReasonRow: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    marginTop: 10, padding: 12, borderRadius: 12,
    backgroundColor: c.goldBgTint, borderWidth: 1, borderColor: c.border,
  },
  saveReasonCheckbox: {
    width: 20, height: 20, borderRadius: 5,
    borderWidth: 2, borderColor: c.border,
    justifyContent: 'center', alignItems: 'center',
  },
  saveReasonCheckboxChecked: { backgroundColor: c.accent, borderColor: c.accent },
  saveReasonText: { fontSize: 12, color: c.dark, fontWeight: '600', flex: 1 },
});

export default function RequestLoanScreen({ route, navigation }: Props) {
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const { showAlert } = useAppAlert();
  const { circleId } = route.params;
  const [amount, setAmount] = useState<string>('');
  const [reasonChip, setReasonChip] = useState<string>('');
  const [customReason, setCustomReason] = useState<string>('');
  const [saveAsReason, setSaveAsReason] = useState<boolean>(false);
  const [customReasons, setCustomReasons] = useState<string[]>([]);
  const [amountError, setAmountError] = useState<string>('');
  const [reasonError, setReasonError] = useState<string>('');
  const [repaymentType, setRepaymentType] = useState<string>('FIXED');
  const [repaymentPeriod, setRepaymentPeriod] = useState<string>('1');
  const [loading, setLoading] = useState<boolean>(false);
  const [groupFundingThreshold, setGroupFundingThreshold] = useState<number | null>(null);
  const [trustScore, setTrustScore] = useState<number>(50);

  // Preset reasons plus any the user has permanently saved on this device,
  // with "Other" always pinned last as the fallback/custom-entry option.
  const allReasons = useMemo(() => {
    const base = LOAN_REASONS.slice(0, -1);
    const extras = customReasons.filter(
      (r) => !base.some((b) => b.toLowerCase() === r.toLowerCase())
    );
    return [...base, ...extras, 'Other'];
  }, [customReasons]);

  const reason = reasonChip === 'Other' ? customReason : reasonChip;

  useEffect(() => {
    getCustomLoanReasons().then(setCustomReasons);
  }, []);

  useEffect(() => {
    (async () => {
      try {
        const [circle, profile] = await Promise.all([getCircle(circleId), getProfile()]);
        setGroupFundingThreshold((circle as { groupFundingThreshold: number }).groupFundingThreshold);
        setTrustScore((profile as { trustScore: number }).trustScore ?? 50);
      } catch {
        // Non-critical -- just skip the pre-submit warning if this fails.
      }
    })();
  }, [circleId]);

  const effectiveThreshold = groupFundingThreshold != null
    ? effectiveGroupFundingThreshold(groupFundingThreshold, trustScore)
    : null;
  const willRequireGroupFunding = effectiveThreshold != null && parseFloat(amount) >= effectiveThreshold;

  const handleRequest = async (): Promise<void> => {
    setAmountError('');
    setReasonError('');
    if (!amount || parseFloat(amount) <= 0) { setAmountError('Enter a valid amount'); return; }
    if (!reason.trim()) { setReasonError('Select or enter a reason'); return; }
    setLoading(true);
    try {
      if (reasonChip === 'Other' && saveAsReason) {
        await addCustomLoanReason(customReason);
      }
      await requestLoan({
        circleId, amount: parseFloat(amount), reason: reason.trim(),
        repaymentType, repaymentPeriodMonths: parseInt(repaymentPeriod) || 1,
      });
      showAlert('success', 'Success', 'Loan request posted to your circle');
      navigation.goBack();
    } catch (error) {
      showAlert('error', 'Error', (error as Error).message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView style={styles.container} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()}>
          <Text style={styles.back}>← Back</Text>
        </TouchableOpacity>
        <Text style={styles.title}>Request a Loan</Text>
        <View style={{ width: 50 }} />
      </View>

      <ScrollView showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
        <View style={styles.form}>

          <Text style={styles.label}>Amount (GHS) *</Text>
          <TextInput
            style={styles.input}
            placeholder="e.g. 500"
            placeholderTextColor={colors.muted}
            value={amount}
            onChangeText={(t) => { setAmount(t); setAmountError(''); }}
            keyboardType="numeric"
          />
          {amountError !== '' && <Text style={{ color: colors.errorRed, fontSize: 13, marginTop: 6 }}>{amountError}</Text>}

          <Text style={styles.label}>Reason *</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} keyboardShouldPersistTaps="handled">
            {allReasons.map((r) => (
              <TouchableOpacity
                key={r}
                style={[styles.catChip, reasonChip === r && styles.catChipSel]}
                onPress={() => { setReasonChip(r); setReasonError(''); if (r !== 'Other') setSaveAsReason(false); }}
              >
                <Text style={[styles.catChipText, reasonChip === r && styles.catChipTextSel]}>{r}</Text>
              </TouchableOpacity>
            ))}
          </ScrollView>

          {reasonChip === 'Other' && (
            <>
              <TextInput
                style={[styles.input, { height: 100, textAlignVertical: 'top', marginTop: 10 }]}
                placeholder="Describe why you need this loan"
                placeholderTextColor={colors.muted}
                value={customReason}
                onChangeText={(t) => { setCustomReason(t); setReasonError(''); }}
                multiline
              />
              {customReason.trim().length > 0 && (
                <TouchableOpacity style={styles.saveReasonRow} onPress={() => setSaveAsReason((v) => !v)} activeOpacity={0.7}>
                  <View style={[styles.saveReasonCheckbox, saveAsReason && styles.saveReasonCheckboxChecked]}>
                    {saveAsReason && <Ionicons name="checkmark" size={13} color={colors.buttonDarkText} />}
                  </View>
                  <Text style={styles.saveReasonText}>
                    Save "{formatCategoryName(customReason)}" as a reason for next time
                  </Text>
                </TouchableOpacity>
              )}
            </>
          )}
          {reasonError !== '' && <Text style={{ color: colors.errorRed, fontSize: 13, marginTop: 6 }}>{reasonError}</Text>}

          <Text style={styles.label}>Repayment Type</Text>
          <View style={styles.typeRow}>
            {[
              { key: 'FIXED', label: 'Fixed', desc: 'One-time payment' },
              { key: 'FLEXIBLE', label: 'Flexible', desc: 'Monthly installments' },
            ].map((t) => (
              <TouchableOpacity
                key={t.key}
                style={[styles.typeBtn, repaymentType === t.key && styles.typeSel]}
                onPress={() => setRepaymentType(t.key)}
              >
                <Text style={[styles.typeText, repaymentType === t.key && styles.typeTextSel]}>{t.label}</Text>
                <Text style={[styles.typeDesc, repaymentType === t.key && { color: colors.slate400 }]}>{t.desc}</Text>
              </TouchableOpacity>
            ))}
          </View>

          <Text style={styles.label}>Repayment Period (months)</Text>
          <TextInput
            style={styles.input}
            placeholder="1"
            placeholderTextColor={colors.muted}
            value={repaymentPeriod}
            onChangeText={setRepaymentPeriod}
            keyboardType="numeric"
          />

          {parseFloat(amount) > 0 && (
            <View style={styles.preview}>
              <View style={styles.previewHeader}>
                <Ionicons name="information-circle-outline" size={18} color={colors.accent} />
                <Text style={styles.previewTitle}>Loan Preview</Text>
              </View>
              {[
                ['Amount', `GHS ${formatMoney(parseFloat(amount))}`],
                ['Type', repaymentType === 'FIXED' ? 'One-time payment' : 'Monthly installments'],
                ['Period', `${repaymentPeriod} month(s)`],
              ].map(([label, value], i) => (
                <View key={i} style={styles.previewRow}>
                  <Text style={styles.previewLabel}>{label}</Text>
                  <Text style={styles.previewValue}>{value}</Text>
                </View>
              ))}
              <Text style={styles.previewNote}>Interest rate will be set by the lender</Text>
              {willRequireGroupFunding && (
                <Text style={[styles.previewNote, { color: colors.warning, fontStyle: 'normal' }]}>
                  This amount is above your GHS {formatMoney(effectiveThreshold)} threshold (based on your trust tier) — it will need funding from multiple circle members instead of a single lender.
                </Text>
              )}
            </View>
          )}

          <TouchableOpacity
            style={[styles.submitBtn, loading && { opacity: 0.6 }]}
            onPress={handleRequest}
            disabled={loading}
          >
            {loading ? <ActivityIndicator color={colors.buttonDarkText} /> : <Text style={styles.submitText}>Submit Loan Request</Text>}
          </TouchableOpacity>
        </View>
        <View style={{ height: 40 }} />
      </ScrollView>
    </KeyboardAvoidingView>
  );
}
