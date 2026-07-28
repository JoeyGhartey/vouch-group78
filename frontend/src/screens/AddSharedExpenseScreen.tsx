import React, { useState, useMemo } from 'react';
import {
  View, Text, StyleSheet, TextInput, TouchableOpacity,
  ScrollView, ActivityIndicator, KeyboardAvoidingView, Platform, Switch,
} from 'react-native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { RouteProp } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { createSharedExpense } from '../services/api';
import { useAppAlert } from '../components/AppAlert';
import { useTheme } from '../context/ThemeContext';
import { RootStackParamList } from '../navigation/AppNavigator';
import { ColorScheme } from '../theme/colors';
import { formatMoney } from '../utils/formatMoney';
import { fonts } from '../theme/fonts';

type Props = {
  route: RouteProp<RootStackParamList, 'AddSharedExpense'>;
  navigation: NativeStackNavigationProp<RootStackParamList, 'AddSharedExpense'>;
};

interface Member {
  userId: number;
  firstName: string;
  lastName: string;
}

const CATEGORIES = ['Food', 'Transport', 'Entertainment', 'Utilities', 'Shopping', 'Other'];

const createStyles = (c: ColorScheme) => StyleSheet.create({
  container: { flex: 1, backgroundColor: c.bg },
  header: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    backgroundColor: c.surface, paddingHorizontal: 20, paddingTop: 56, paddingBottom: 16,
    borderBottomWidth: 1, borderBottomColor: c.border,
  },
  back: { color: c.accent, fontSize: 16, fontWeight: '600', fontFamily: fonts.semibold },
  title: { fontSize: 18, fontWeight: '700', fontFamily: fonts.bold, color: c.dark },
  form: { padding: 16 },
  label: { fontSize: 12, color: c.muted, fontWeight: '600', fontFamily: fonts.semibold, marginBottom: 6, marginTop: 16 },
  input: {
    backgroundColor: c.surface, borderRadius: 12, padding: 14,
    fontSize: 15, color: c.dark, borderWidth: 1, borderColor: c.border,
  },
  catChip: {
    backgroundColor: c.surface, borderRadius: 20, paddingHorizontal: 14,
    paddingVertical: 8, marginRight: 8, borderWidth: 1, borderColor: c.border,
  },
  catChipSel: { backgroundColor: c.buttonDark, borderColor: c.buttonDark },
  catChipText: { color: c.muted, fontSize: 12, fontWeight: '600', fontFamily: fonts.semibold },
  catChipTextSel: { color: c.buttonDarkText },
  memberBtn: {
    backgroundColor: c.surface, borderRadius: 12, padding: 14, marginTop: 8,
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    borderWidth: 1.5, borderColor: c.border,
  },
  memberBtnSel: { borderColor: c.success, backgroundColor: c.successBgTint },
  memberLeft: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  memberAvatar: {
    width: 36, height: 36, borderRadius: 18,
    backgroundColor: c.buttonDark, justifyContent: 'center', alignItems: 'center',
  },
  memberAvatarText: { color: c.buttonDarkText, fontSize: 13, fontWeight: '700', fontFamily: fonts.bold },
  memberName: { fontSize: 14, fontWeight: '600', fontFamily: fonts.semibold, color: c.muted },
  paidToggleRow: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    backgroundColor: c.surface, borderRadius: 12, padding: 14, marginTop: 16,
    borderWidth: 1, borderColor: c.border,
  },
  paidToggleText: { fontSize: 14, fontWeight: '600', fontFamily: fonts.semibold, color: c.dark, flex: 1, marginRight: 12 },
  preview: {
    backgroundColor: c.surface, borderRadius: 14, padding: 16,
    marginTop: 20, borderWidth: 1, borderColor: c.border,
  },
  previewHeader: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 12 },
  previewTitle: { fontSize: 14, fontWeight: '700', fontFamily: fonts.bold, color: c.dark },
  previewRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: c.border },
  previewLabel: { fontSize: 13, color: c.muted },
  previewValue: { fontSize: 14, fontWeight: '700', fontFamily: fonts.bold, color: c.dark },
  submitBtn: { backgroundColor: c.buttonDark, borderRadius: 12, padding: 16, alignItems: 'center', marginTop: 24 },
  submitText: { color: c.buttonDarkText, fontSize: 16, fontWeight: '700', fontFamily: fonts.bold },
});

export default function AddSharedExpenseScreen({ route, navigation }: Props) {
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const { showAlert } = useAppAlert();
  const { circleId, members } = route.params as { circleId: number; members: Member[] };
  const [amount, setAmount] = useState<string>('');
  const [category, setCategory] = useState<string>('Food');
  const [selectedMembers, setSelectedMembers] = useState<number[]>(
    members ? members.map((m) => m.userId) : []
  );
  const [payerAlreadyPaid, setPayerAlreadyPaid] = useState<boolean>(true);
  const [loading, setLoading] = useState<boolean>(false);
  const [amountError, setAmountError] = useState<string>('');
  const [membersError, setMembersError] = useState<string>('');

  const toggleMember = (userId: number): void => {
    setSelectedMembers(prev =>
      prev.includes(userId) ? prev.filter((id) => id !== userId) : [...prev, userId]
    );
  };

  const handleSubmit = async (): Promise<void> => {
    setAmountError('');
    setMembersError('');
    if (!amount || parseFloat(amount) <= 0) { setAmountError('Enter a valid amount'); return; }
    if (selectedMembers.length < 2) { setMembersError('Select at least 2 members'); return; }
    setLoading(true);
    try {
      await createSharedExpense({
        circleId, description: category,
        totalAmount: parseFloat(amount),
        category, participantIds: selectedMembers,
        payerAlreadyPaid,
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

      <ScrollView showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
        <View style={styles.form}>

          <Text style={styles.label}>Total Amount (GHS) *</Text>
          <TextInput
            style={styles.input}
            placeholder="e.g. 120"
            placeholderTextColor={colors.muted}
            value={amount}
            onChangeText={(text) => { setAmount(text); setAmountError(''); }}
            keyboardType="numeric"
          />
          {amountError !== '' && <Text style={{ color: colors.errorRed, fontSize: 13, marginTop: 6 }}>{amountError}</Text>}

          <Text style={styles.label}>Category</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} keyboardShouldPersistTaps="handled" style={{ marginTop: 4, marginBottom: 4 }}>
            {CATEGORIES.map((cat) => (
              <TouchableOpacity
                key={cat}
                style={[styles.catChip, category === cat && styles.catChipSel]}
                onPress={() => setCategory(cat)}
              >
                <Text style={[styles.catChipText, category === cat && styles.catChipTextSel]}>{cat}</Text>
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
                  <View style={[styles.memberAvatar, selected && { backgroundColor: colors.success }]}>
                    <Text style={styles.memberAvatarText}>{m.firstName[0]}{m.lastName[0]}</Text>
                  </View>
                  <Text style={[styles.memberName, selected && { color: colors.dark }]}>
                    {m.firstName} {m.lastName}
                  </Text>
                </View>
                {selected && <Ionicons name="checkmark-circle" size={22} color={colors.success} />}
              </TouchableOpacity>
            );
          })}
          {membersError !== '' && <Text style={{ color: colors.errorRed, fontSize: 13, marginTop: 6 }}>{membersError}</Text>}

          <View style={styles.paidToggleRow}>
            <Text style={styles.paidToggleText}>I have already paid my share</Text>
            <Switch
              value={payerAlreadyPaid}
              onValueChange={setPayerAlreadyPaid}
              trackColor={{ false: colors.border, true: colors.success }}
              thumbColor={colors.surface}
            />
          </View>

          {parseFloat(amount) > 0 && selectedMembers.length > 0 && (
            <View style={styles.preview}>
              <View style={styles.previewHeader}>
                <Ionicons name="calculator-outline" size={18} color={colors.accent} />
                <Text style={styles.previewTitle}>Split Preview</Text>
              </View>
              <View style={styles.previewRow}>
                <Text style={styles.previewLabel}>Total</Text>
                <Text style={styles.previewValue}>GHS {formatMoney(parseFloat(amount))}</Text>
              </View>
              <View style={styles.previewRow}>
                <Text style={styles.previewLabel}>Split</Text>
                <Text style={styles.previewValue}>{selectedMembers.length} people</Text>
              </View>
              <View style={[styles.previewRow, { borderBottomWidth: 0 }]}>
                <Text style={styles.previewLabel}>Each pays</Text>
                <Text style={[styles.previewValue, { color: colors.success, fontSize: 18 }]}>
                  GHS {formatMoney(splitAmount)}
                </Text>
              </View>
            </View>
          )}

          <TouchableOpacity
            style={[styles.submitBtn, loading && { opacity: 0.6 }]}
            onPress={handleSubmit}
            disabled={loading}
          >
            {loading ? <ActivityIndicator color={colors.buttonDarkText} /> : <Text style={styles.submitText}>Add Expense</Text>}
          </TouchableOpacity>
        </View>
        <View style={{ height: 40 }} />
      </ScrollView>
    </KeyboardAvoidingView>
  );
}
