import React, { useState } from 'react';
import {
  View, Text, StyleSheet, TextInput, TouchableOpacity,
  ScrollView, Alert, ActivityIndicator,
} from 'react-native';
import { requestLoan } from '../services/api';

export default function RequestLoanScreen({ route, navigation }) {
  const { circleId } = route.params;
  const [amount, setAmount] = useState('');
  const [reason, setReason] = useState('');
  const [repaymentType, setRepaymentType] = useState('FIXED');
  const [repaymentPeriod, setRepaymentPeriod] = useState('1');
  const [loading, setLoading] = useState(false);

  const handleRequest = async () => {
    if (!amount || parseFloat(amount) <= 0) { if (typeof window !== 'undefined') window.alert('Enter a valid amount'); return; }
      if (!reason.trim()) { if (typeof window !== 'undefined') window.alert('Enter a reason'); return; }
    setLoading(true);
    try {
      await requestLoan({ circleId, amount: parseFloat(amount), reason, repaymentType, repaymentPeriodMonths: parseInt(repaymentPeriod) || 1 });
      if (typeof window !== 'undefined') { window.alert('Loan request posted to your circle'); }
      navigation.goBack();
    } catch (error) {
      if (typeof window !== 'undefined') window.alert(error.message);
    } finally { setLoading(false); }
  };

  return (
    <ScrollView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()}><Text style={styles.back}>← Back</Text></TouchableOpacity>
        <Text style={styles.title}>Request a Loan</Text>
        <View style={{ width: 50 }} />
      </View>

      <View style={styles.form}>
        <Text style={styles.label}>Amount (GHS) *</Text>
        <TextInput style={styles.input} placeholder="e.g. 500" placeholderTextColor="#555" value={amount} onChangeText={setAmount} keyboardType="numeric" />

        <Text style={styles.label}>Reason *</Text>
        <TextInput style={[styles.input, { height: 100 }]} placeholder="Why do you need this loan?" placeholderTextColor="#555" value={reason} onChangeText={setReason} multiline />

        <Text style={styles.label}>Repayment Type</Text>
        <View style={styles.typeRow}>
          {['FIXED', 'FLEXIBLE'].map(t => (
            <TouchableOpacity key={t} style={[styles.typeBtn, repaymentType === t && styles.typeSel]} onPress={() => setRepaymentType(t)}>
              <Text style={[styles.typeText, repaymentType === t && styles.typeTextSel]}>{t === 'FIXED' ? 'Fixed' : 'Flexible'}</Text>
              <Text style={styles.typeDesc}>{t === 'FIXED' ? 'One-time payment' : 'Monthly installments'}</Text>
            </TouchableOpacity>
          ))}
        </View>

        <Text style={styles.label}>Repayment Period (months)</Text>
        <TextInput style={styles.input} placeholder="1" placeholderTextColor="#555" value={repaymentPeriod} onChangeText={setRepaymentPeriod} keyboardType="numeric" />

        {parseFloat(amount) > 0 && (
          <View style={styles.preview}>
            <Text style={styles.previewTitle}>Loan Preview</Text>
            <Text style={styles.previewText}>Amount: GHS {parseFloat(amount).toFixed(2)}</Text>
            <Text style={styles.previewText}>Type: {repaymentType === 'FIXED' ? 'One-time payment' : 'Monthly installments'}</Text>
            <Text style={styles.previewText}>Period: {repaymentPeriod} month(s)</Text>
            <Text style={styles.previewNote}>Interest rate will be set by the lender</Text>
          </View>
        )}

        <TouchableOpacity style={[styles.submitBtn, loading && { opacity: 0.6 }]} onPress={handleRequest} disabled={loading}>
          {loading ? <ActivityIndicator color="#fff" /> : <Text style={styles.submitText}>Submit Loan Request</Text>}
        </TouchableOpacity>
      </View>
      <View style={{ height: 40 }} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#1a1a2e' },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 24, paddingTop: 60 },
  back: { color: '#e94560', fontSize: 16 },
  title: { color: '#fff', fontSize: 20, fontWeight: 'bold' },
  form: { paddingHorizontal: 24 },
  label: { color: '#a0a0b0', fontSize: 14, marginBottom: 6, marginTop: 16 },
  input: { backgroundColor: '#16213e', borderRadius: 12, padding: 14, fontSize: 16, color: '#fff', borderWidth: 1, borderColor: '#2a2a4a' },
  typeRow: { flexDirection: 'row', justifyContent: 'space-between' },
  typeBtn: { flex: 1, backgroundColor: '#16213e', borderRadius: 12, padding: 16, marginHorizontal: 4, alignItems: 'center', borderWidth: 1, borderColor: '#2a2a4a' },
  typeSel: { backgroundColor: '#e94560', borderColor: '#e94560' },
  typeText: { color: '#a0a0b0', fontSize: 16, fontWeight: '600' },
  typeTextSel: { color: '#fff' },
  typeDesc: { color: '#666', fontSize: 12, marginTop: 4 },
  preview: { backgroundColor: '#16213e', borderRadius: 12, padding: 16, marginTop: 20 },
  previewTitle: { color: '#fff', fontSize: 16, fontWeight: 'bold', marginBottom: 10 },
  previewText: { color: '#a0a0b0', fontSize: 14, marginBottom: 4 },
  previewNote: { color: '#FFC107', fontSize: 13, marginTop: 8, fontStyle: 'italic' },
  submitBtn: { backgroundColor: '#e94560', borderRadius: 12, padding: 16, alignItems: 'center', marginTop: 24 },
  submitText: { color: '#fff', fontSize: 18, fontWeight: 'bold' },
});
