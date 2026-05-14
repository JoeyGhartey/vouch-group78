import React, { useState } from 'react';
import {
  View, Text, StyleSheet, TextInput, TouchableOpacity,
  ScrollView, ActivityIndicator,
} from 'react-native';
import { createSharedExpense } from '../services/api';

export default function AddSharedExpenseScreen({ route, navigation }) {
  const { circleId, members } = route.params;
  const [description, setDescription] = useState('');
  const [amount, setAmount] = useState('');
  const [category, setCategory] = useState('Food');
  const [selectedMembers, setSelectedMembers] = useState(members ? members.map(m => m.userId) : []);
  const [loading, setLoading] = useState(false);

  const categories = ['Food', 'Transport', 'Entertainment', 'Utilities', 'Shopping', 'Other'];

  const toggleMember = (userId) => {
    if (selectedMembers.includes(userId)) {
      setSelectedMembers(selectedMembers.filter(id => id !== userId));
    } else {
      setSelectedMembers([...selectedMembers, userId]);
    }
  };

  const handleSubmit = async () => {
    if (!amount || parseFloat(amount) <= 0) { if (typeof window !== 'undefined') window.alert('Enter a valid amount'); return; }
    if (!description.trim()) { if (typeof window !== 'undefined') window.alert('Enter a description'); return; }
    if (selectedMembers.length < 2) { if (typeof window !== 'undefined') window.alert('Select at least 2 members'); return; }

    setLoading(true);
    try {
      await createSharedExpense({
        circleId,
        description,
        totalAmount: parseFloat(amount),
        category,
        participantIds: selectedMembers,
      });
      if (typeof window !== 'undefined') window.alert('Shared expense created');
      navigation.goBack();
    } catch (e) {
      if (typeof window !== 'undefined') window.alert(e.message);
    } finally { setLoading(false); }
  };

  const splitAmount = selectedMembers.length > 0 ? parseFloat(amount || 0) / selectedMembers.length : 0;

  return (
    <ScrollView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()}><Text style={styles.back}>← Back</Text></TouchableOpacity>
        <Text style={styles.title}>Add Shared Expense</Text>
        <View style={{ width: 50 }} />
      </View>

      <View style={styles.form}>
        <Text style={styles.label}>Total Amount (GHS) *</Text>
        <TextInput style={styles.input} placeholder="e.g. 120" placeholderTextColor="#555" value={amount} onChangeText={setAmount} keyboardType="numeric" />

        <Text style={styles.label}>Description *</Text>
        <TextInput style={styles.input} placeholder="What was this for?" placeholderTextColor="#555" value={description} onChangeText={setDescription} />

        <Text style={styles.label}>Category</Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginTop: 4 }}>
          {categories.map(c => (
            <TouchableOpacity key={c} style={[styles.catBtn, category === c && styles.catBtnSel]} onPress={() => setCategory(c)}>
              <Text style={[styles.catBtnText, category === c && styles.catBtnTextSel]}>{c}</Text>
            </TouchableOpacity>
          ))}
        </ScrollView>

        <Text style={styles.label}>Split Between</Text>
        {members && members.map(m => (
          <TouchableOpacity key={m.userId} style={[styles.memberBtn, selectedMembers.includes(m.userId) && styles.memberBtnSel]} onPress={() => toggleMember(m.userId)}>
            <Text style={[styles.memberText, selectedMembers.includes(m.userId) && styles.memberTextSel]}>
              {m.firstName} {m.lastName}
            </Text>
            {selectedMembers.includes(m.userId) && <Text style={styles.checkmark}>✓</Text>}
          </TouchableOpacity>
        ))}

        {parseFloat(amount) > 0 && selectedMembers.length > 0 && (
          <View style={styles.preview}>
            <Text style={styles.previewTitle}>Split Preview</Text>
            <Text style={styles.previewText}>Total: GHS {parseFloat(amount).toFixed(2)}</Text>
            <Text style={styles.previewText}>Split {selectedMembers.length} ways</Text>
            <Text style={styles.previewAmount}>GHS {splitAmount.toFixed(2)} per person</Text>
          </View>
        )}

        <TouchableOpacity style={[styles.submitBtn, loading && { opacity: 0.6 }]} onPress={handleSubmit} disabled={loading}>
          {loading ? <ActivityIndicator color="#fff" /> : <Text style={styles.submitText}>Add Expense</Text>}
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
  catBtn: { backgroundColor: '#16213e', borderRadius: 20, paddingHorizontal: 16, paddingVertical: 8, marginRight: 8, borderWidth: 1, borderColor: '#2a2a4a' },
  catBtnSel: { backgroundColor: '#e94560', borderColor: '#e94560' },
  catBtnText: { color: '#a0a0b0', fontSize: 13 },
  catBtnTextSel: { color: '#fff' },
  memberBtn: { backgroundColor: '#16213e', borderRadius: 12, padding: 14, marginTop: 8, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', borderWidth: 1, borderColor: '#2a2a4a' },
  memberBtnSel: { borderColor: '#4CAF50', backgroundColor: '#1a2744' },
  memberText: { color: '#a0a0b0', fontSize: 15 },
  memberTextSel: { color: '#fff' },
  checkmark: { color: '#4CAF50', fontSize: 18, fontWeight: 'bold' },
  preview: { backgroundColor: '#16213e', borderRadius: 12, padding: 16, marginTop: 20, alignItems: 'center' },
  previewTitle: { color: '#fff', fontSize: 16, fontWeight: 'bold', marginBottom: 8 },
  previewText: { color: '#a0a0b0', fontSize: 14, marginBottom: 4 },
  previewAmount: { color: '#4CAF50', fontSize: 20, fontWeight: 'bold', marginTop: 8 },
  submitBtn: { backgroundColor: '#e94560', borderRadius: 12, padding: 16, alignItems: 'center', marginTop: 24 },
  submitText: { color: '#fff', fontSize: 18, fontWeight: 'bold' },
});
