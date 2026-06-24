import React, { useState } from 'react';
import {
  View, Text, StyleSheet, TextInput, TouchableOpacity,
  ScrollView, ActivityIndicator, KeyboardAvoidingView, Platform,
} from 'react-native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { RouteProp } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { createSharedExpense } from '../services/api';
import { useAppAlert } from '../components/AppAlert';
import { RootStackParamList } from '../navigation/AppNavigator';

type Props = {
  route: RouteProp<RootStackParamList, 'AddSharedExpense'>;
  navigation: NativeStackNavigationProp<RootStackParamList, 'AddSharedExpense'>;
};

interface Member {
  userId: number;
  firstName: string;
  lastName: string;
}

const BG = '#EDEEF2';
const WHITE = '#FFFFFF';
const DARK = '#0f172a';
const MUTED = '#6B7280';
const BORDER = '#E5E7EB';
const ACCENT = '#C9A84C';
const SUCCESS = '#16a34a';

const CATEGORIES = ['Food', 'Transport', 'Entertainment', 'Utilities', 'Shopping', 'Other'];

export default function AddSharedExpenseScreen({ route, navigation }: Props) {
  const { showAlert } = useAppAlert();
  const { circleId, members } = route.params as { circleId: number; members: Member[] };
  const [description, setDescription] = useState<string>('');
  const [amount, setAmount] = useState<string>('');
  const [category, setCategory] = useState<string>('Food');
  const [selectedMembers, setSelectedMembers] = useState<number[]>(
    members ? members.map((m) => m.userId) : []
  );
  const [loading, setLoading] = useState<boolean>(false);

  const toggleMember = (userId: number): void => {
    setSelectedMembers(prev =>
      prev.includes(userId) ? prev.filter((id) => id !== userId) : [...prev, userId]
    );
  };

  const handleSubmit = async (): Promise<void> => {
    if (!amount || parseFloat(amount) <= 0) { showAlert('error', 'Error', 'Enter a valid amount'); return; }
    if (!description.trim()) { showAlert('error', 'Error', 'Enter a description'); return; }
    if (selectedMembers.length < 2) { showAlert('error', 'Error', 'Select at least 2 members'); return; }
    setLoading(true);
    try {
      await createSharedExpense({
        circleId, description,
        totalAmount: parseFloat(amount),
        category, participantIds: selectedMembers,
      });
      showAlert('success', 'Success', 'Shared expense created');
      navigation.goBack();
    } catch (e) {
      showAlert('error', 'Error', (e as Error).message);
    } finally {
      setLoading(false);
    }
  };

  const splitAmount = selectedMembers.length > 0 ? parseFloat(amount || '0') / selectedMembers.length : 0;

  return (
    <KeyboardAvoidingView style={styles.container} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()}>
          <Text style={styles.back}>← Back</Text>
        </TouchableOpacity>
        <Text style={styles.title}>Add Shared Expense</Text>
        <View style={{ width: 50 }} />
      </View>

      <ScrollView showsVerticalScrollIndicator={false}>
        <View style={styles.form}>

          <Text style={styles.label}>Total Amount (GHS) *</Text>
          <TextInput
            style={styles.input}
            placeholder="e.g. 120"
            placeholderTextColor={MUTED}
            value={amount}
            onChangeText={setAmount}
            keyboardType="numeric"
          />

          <Text style={styles.label}>Description *</Text>
          <TextInput
            style={styles.input}
            placeholder="What was this for?"
            placeholderTextColor={MUTED}
            value={description}
            onChangeText={setDescription}
          />

          <Text style={styles.label}>Category</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginTop: 4, marginBottom: 4 }}>
            {CATEGORIES.map((c) => (
              <TouchableOpacity
                key={c}
                style={[styles.catChip, category === c && styles.catChipSel]}
                onPress={() => setCategory(c)}
              >
                <Text style={[styles.catChipText, category === c && styles.catChipTextSel]}>{c}</Text>
              </TouchableOpacity>
            ))}
          </ScrollView>

          <Text style={styles.label}>Split Between</Text>
          {members && members.map((m) => {
            const selected = selectedMembers.includes(m.userId);
            return (
              <TouchableOpacity
                key={m.userId}
                style={[styles.memberBtn, selected && styles.memberBtnSel]}
                onPress={() => toggleMember(m.userId)}
              >
                <View style={styles.memberLeft}>
                  <View style={[styles.memberAvatar, selected && { backgroundColor: SUCCESS }]}>
                    <Text style={styles.memberAvatarText}>{m.firstName[0]}{m.lastName[0]}</Text>
                  </View>
                  <Text style={[styles.memberName, selected && { color: DARK }]}>
                    {m.firstName} {m.lastName}
                  </Text>
                </View>
                {selected && <Ionicons name="checkmark-circle" size={22} color={SUCCESS} />}
              </TouchableOpacity>
            );
          })}

          {parseFloat(amount) > 0 && selectedMembers.length > 0 && (
            <View style={styles.preview}>
              <View style={styles.previewHeader}>
                <Ionicons name="calculator-outline" size={18} color={ACCENT} />
                <Text style={styles.previewTitle}>Split Preview</Text>
              </View>
              <View style={styles.previewRow}>
                <Text style={styles.previewLabel}>Total</Text>
                <Text style={styles.previewValue}>GHS {parseFloat(amount).toFixed(2)}</Text>
              </View>
              <View style={styles.previewRow}>
                <Text style={styles.previewLabel}>Split</Text>
                <Text style={styles.previewValue}>{selectedMembers.length} people</Text>
              </View>
              <View style={[styles.previewRow, { borderBottomWidth: 0 }]}>
                <Text style={styles.previewLabel}>Each pays</Text>
                <Text style={[styles.previewValue, { color: SUCCESS, fontSize: 18 }]}>
                  GHS {splitAmount.toFixed(2)}
                </Text>
              </View>
            </View>
          )}

          <TouchableOpacity
            style={[styles.submitBtn, loading && { opacity: 0.6 }]}
            onPress={handleSubmit}
            disabled={loading}
          >
            {loading ? <ActivityIndicator color={WHITE} /> : <Text style={styles.submitText}>Add Expense</Text>}
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
  catChip: {
    backgroundColor: WHITE, borderRadius: 20, paddingHorizontal: 14,
    paddingVertical: 8, marginRight: 8, borderWidth: 1, borderColor: BORDER,
  },
  catChipSel: { backgroundColor: DARK, borderColor: DARK },
  catChipText: { color: MUTED, fontSize: 12, fontWeight: '600' },
  catChipTextSel: { color: WHITE },
  memberBtn: {
    backgroundColor: WHITE, borderRadius: 12, padding: 14, marginTop: 8,
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    borderWidth: 1.5, borderColor: BORDER,
  },
  memberBtnSel: { borderColor: SUCCESS, backgroundColor: '#f0fdf4' },
  memberLeft: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  memberAvatar: {
    width: 36, height: 36, borderRadius: 18,
    backgroundColor: DARK, justifyContent: 'center', alignItems: 'center',
  },
  memberAvatarText: { color: WHITE, fontSize: 13, fontWeight: '700' },
  memberName: { fontSize: 14, fontWeight: '600', color: MUTED },
  preview: {
    backgroundColor: WHITE, borderRadius: 14, padding: 16,
    marginTop: 20, borderWidth: 1, borderColor: BORDER,
  },
  previewHeader: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 12 },
  previewTitle: { fontSize: 14, fontWeight: '700', color: DARK },
  previewRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: BORDER },
  previewLabel: { fontSize: 13, color: MUTED },
  previewValue: { fontSize: 14, fontWeight: '700', color: DARK },
  submitBtn: { backgroundColor: DARK, borderRadius: 12, padding: 16, alignItems: 'center', marginTop: 24 },
  submitText: { color: WHITE, fontSize: 16, fontWeight: '700' },
});