import React, { useState } from 'react';
import {
  View, Text, StyleSheet, TextInput, TouchableOpacity,
  ScrollView, Alert, ActivityIndicator, KeyboardAvoidingView, Platform,
} from 'react-native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { RouteProp } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { requestLoan } from '../services/api';
import { RootStackParamList } from '../navigation/AppNavigator';

type Props = {
  route: RouteProp<RootStackParamList, 'RequestLoan'>;
  navigation: NativeStackNavigationProp<RootStackParamList, 'RequestLoan'>;
};

const BG = '#F8F9FA';
const WHITE = '#FFFFFF';
const DARK = '#0f172a';
const MUTED = '#6B7280';
const BORDER = '#E5E7EB';
const ACCENT = '#C9A84C';
const SUCCESS = '#16a34a';

export default function RequestLoanScreen({ route, navigation }: Props) {
  const { circleId } = route.params;
  const [amount, setAmount] = useState<string>('');
  const [reason, setReason] = useState<string>('');
  const [repaymentType, setRepaymentType] = useState<string>('FIXED');
  const [repaymentPeriod, setRepaymentPeriod] = useState<string>('1');
  const [loading, setLoading] = useState<boolean>(false);

  const handleRequest = async (): Promise<void> => {
    if (!amount || parseFloat(amount) <= 0) { Alert.alert('Error', 'Enter a valid amount'); return; }
    if (!reason.trim()) { Alert.alert('Error', 'Enter a reason'); return; }
    setLoading(true);
    try {
      await requestLoan({
        circleId, amount: parseFloat(amount), reason,
        repaymentType, repaymentPeriodMonths: parseInt(repaymentPeriod) || 1,
      });
      Alert.alert('Success', 'Loan request posted to your circle');
      navigation.goBack();
    } catch (error) {
      Alert.alert('Error', (error as Error).message);
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
            placeholderTextColor={MUTED}
            value={amount}
            onChangeText={setAmount}
            keyboardType="numeric"
          />

          <Text style={styles.label}>Reason *</Text>
          <TextInput
            style={[styles.input, { height: 100, textAlignVertical: 'top' }]}
            placeholder="Why do you need this loan?"
            placeholderTextColor={MUTED}
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
                <Text style={[styles.typeDesc, repaymentType === t.key && { color: '#94a3b8' }]}>{t.desc}</Text>
              </TouchableOpacity>
            ))}
          </View>

          <Text style={styles.label}>Repayment Period (months)</Text>
          <TextInput
            style={styles.input}
            placeholder="1"
            placeholderTextColor={MUTED}
            value={repaymentPeriod}
            onChangeText={setRepaymentPeriod}
            keyboardType="numeric"
          />

          {parseFloat(amount) > 0 && (
            <View style={styles.preview}>
              <View style={styles.previewHeader}>
                <Ionicons name="information-circle-outline" size={18} color={ACCENT} />
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
            {loading ? <ActivityIndicator color={WHITE} /> : <Text style={styles.submitText}>Submit Loan Request</Text>}
          </TouchableOpacity>
        </View>
        <View style={{ height: 40 }} />
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: BG },
  header: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    backgroundColor: WHITE, paddingHorizontal: 20, paddingTop: 56, paddingBottom: 16,
    borderBottomWidth: 1, borderBottomColor: BORDER,
  },
  back: { color: ACCENT, fontSize: 16, fontWeight: '600' },
  title: { fontSize: 18, fontWeight: '700', color: DARK },
  form: { padding: 16 },
  label: { fontSize: 12, color: MUTED, fontWeight: '600', marginBottom: 6, marginTop: 16 },
  input: {
    backgroundColor: WHITE, borderRadius: 12, padding: 14,
    fontSize: 15, color: DARK, borderWidth: 1, borderColor: BORDER,
  },
  typeRow: { flexDirection: 'row', gap: 10 },
  typeBtn: {
    flex: 1, backgroundColor: WHITE, borderRadius: 12, padding: 14,
    alignItems: 'center', borderWidth: 1.5, borderColor: BORDER,
  },
  typeSel: { backgroundColor: DARK, borderColor: DARK },
  typeText: { fontSize: 14, fontWeight: '700', color: MUTED },
  typeTextSel: { color: WHITE },
  typeDesc: { fontSize: 11, color: MUTED, marginTop: 4, textAlign: 'center' },
  preview: {
    backgroundColor: WHITE, borderRadius: 14, padding: 16,
    marginTop: 20, borderWidth: 1, borderColor: BORDER,
  },
  previewHeader: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 12 },
  previewTitle: { fontSize: 14, fontWeight: '700', color: DARK },
  previewRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 6, borderBottomWidth: 1, borderBottomColor: BORDER },
  previewLabel: { fontSize: 13, color: MUTED },
  previewValue: { fontSize: 13, fontWeight: '600', color: DARK },
  previewNote: { fontSize: 12, color: ACCENT, marginTop: 10, fontStyle: 'italic' },
  submitBtn: { backgroundColor: DARK, borderRadius: 12, padding: 16, alignItems: 'center', marginTop: 24 },
  submitText: { color: WHITE, fontSize: 16, fontWeight: '700' },
});