import React, { useState, useMemo } from 'react';
import {
  View, Text, StyleSheet, TextInput, TouchableOpacity,
  ScrollView, ActivityIndicator, KeyboardAvoidingView, Platform,
} from 'react-native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { RouteProp } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { requestLoan } from '../services/api';
import { useAppAlert } from '../components/AppAlert';
import { useTheme } from '../context/ThemeContext';
import { RootStackParamList } from '../navigation/AppNavigator';
import { ColorScheme } from '../theme/colors';

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
});

export default function RequestLoanScreen({ route, navigation }: Props) {
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const { showAlert } = useAppAlert();
  const { circleId } = route.params;
  const [amount, setAmount] = useState<string>('');
  const [reason, setReason] = useState<string>('');
  const [repaymentType, setRepaymentType] = useState<string>('FIXED');
  const [repaymentPeriod, setRepaymentPeriod] = useState<string>('1');
  const [loading, setLoading] = useState<boolean>(false);

  const handleRequest = async (): Promise<void> => {
    if (!amount || parseFloat(amount) <= 0) { showAlert('error', 'Error', 'Enter a valid amount'); return; }
    if (!reason.trim()) { showAlert('error', 'Error', 'Enter a reason'); return; }
    setLoading(true);
    try {
      await requestLoan({
        circleId, amount: parseFloat(amount), reason,
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

      <ScrollView showsVerticalScrollIndicator={false}>
        <View style={styles.form}>

          <Text style={styles.label}>Amount (GHS) *</Text>
          <TextInput
            style={styles.input}
            placeholder="e.g. 500"
            placeholderTextColor={colors.muted}
            value={amount}
            onChangeText={setAmount}
            keyboardType="numeric"
          />

          <Text style={styles.label}>Reason *</Text>
          <TextInput
            style={[styles.input, { height: 100, textAlignVertical: 'top' }]}
            placeholder="Why do you need this loan?"
            placeholderTextColor={colors.muted}
            value={reason}
            onChangeText={setReason}
            multiline
          />

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
                ['Amount', `GHS ${parseFloat(amount).toFixed(2)}`],
                ['Type', repaymentType === 'FIXED' ? 'One-time payment' : 'Monthly installments'],
                ['Period', `${repaymentPeriod} month(s)`],
              ].map(([label, value], i) => (
                <View key={i} style={styles.previewRow}>
                  <Text style={styles.previewLabel}>{label}</Text>
                  <Text style={styles.previewValue}>{value}</Text>
                </View>
              ))}
              <Text style={styles.previewNote}>Interest rate will be set by the lender</Text>
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
