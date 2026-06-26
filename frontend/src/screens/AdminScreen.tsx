import React, { useState, useCallback, useMemo } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  ActivityIndicator, RefreshControl, TextInput, Modal,
  KeyboardAvoidingView, Platform,
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { Ionicons } from '@expo/vector-icons';
import { getAdminOpenDisputes, resolveDispute } from '../services/api';
import { useAppAlert } from '../components/AppAlert';
import { useTheme } from '../context/ThemeContext';
import { RootStackParamList } from '../navigation/AppNavigator';
import { ColorScheme } from '../theme/colors';

type Props = {
  navigation: NativeStackNavigationProp<RootStackParamList>;
};

interface Dispute {
  id: number;
  loanId: number;
  loanAmount: number;
  borrowerName: string;
  lenderName: string;
  openedByName: string;
  reason: string;
  evidence?: string;
  status: string;
  createdAt: string;
}

const createStyles = (c: ColorScheme) => StyleSheet.create({
  container: { flex: 1, backgroundColor: c.bg },
  loadingContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: c.bg },
  header: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    backgroundColor: c.surface, paddingHorizontal: 20, paddingTop: 56, paddingBottom: 16,
    borderBottomWidth: 1, borderBottomColor: c.border,
  },
  back: { color: c.accent, fontSize: 16, fontWeight: '600' },
  title: { color: c.dark, fontSize: 16, fontWeight: '700' },
  list: { padding: 16, gap: 12 },
  disputeCard: { backgroundColor: c.surface, borderRadius: 14, padding: 16, borderWidth: 1, borderColor: c.border },
  disputeHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 },
  disputeBadge: { backgroundColor: c.dangerBgTint, borderRadius: 6, paddingHorizontal: 8, paddingVertical: 3 },
  disputeBadgeText: { fontSize: 10, fontWeight: '800', color: c.danger },
  disputeDate: { fontSize: 12, color: c.muted },
  disputeAmount: { fontSize: 20, fontWeight: '800', color: c.dark, marginBottom: 12 },
  partiesRow: { flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 12 },
  partyItem: { flex: 1 },
  partyLabel: { fontSize: 11, color: c.muted, fontWeight: '600', marginBottom: 2 },
  partyName: { fontSize: 14, fontWeight: '600', color: c.dark },
  divider: { height: 1, backgroundColor: c.border, marginBottom: 12 },
  reasonLabel: { fontSize: 11, color: c.muted, fontWeight: '600', marginBottom: 4 },
  reasonText: { fontSize: 14, color: c.dark, marginBottom: 12, lineHeight: 20 },
  resolveBtn: { backgroundColor: c.buttonDark, borderRadius: 10, padding: 14, alignItems: 'center', marginTop: 8 },
  resolveBtnText: { color: c.buttonDarkText, fontSize: 14, fontWeight: '700' },
  emptyCard: { margin: 16, backgroundColor: c.surface, borderRadius: 14, padding: 40, alignItems: 'center', borderWidth: 1, borderColor: c.border },
  emptyTitle: { fontSize: 16, fontWeight: '700', color: c.dark, marginTop: 12, marginBottom: 4 },
  emptyText: { fontSize: 13, color: c.muted },
  modalBg: { flex: 1, backgroundColor: 'rgba(0,0,0,0.6)', justifyContent: 'center' },
  modal: { backgroundColor: c.surface, borderRadius: 16, padding: 24 },
  modalTitle: { fontSize: 20, fontWeight: '700', color: c.dark, textAlign: 'center' },
  modalSub: { fontSize: 13, color: c.muted, textAlign: 'center', marginTop: 4, marginBottom: 16 },
  label: { fontSize: 12, color: c.muted, fontWeight: '600', marginTop: 12, marginBottom: 6 },
  outcomeRow: { flexDirection: 'row', gap: 10 },
  outcomeBtn: { flex: 1, padding: 12, borderRadius: 10, borderWidth: 1.5, borderColor: c.border, alignItems: 'center' },
  outcomeBtnActive: { backgroundColor: c.buttonDark, borderColor: c.buttonDark },
  outcomeBtnText: { fontSize: 13, fontWeight: '600', color: c.muted },
  outcomeBtnTextActive: { color: c.buttonDarkText },
  input: { backgroundColor: c.bg, borderRadius: 10, padding: 12, fontSize: 14, color: c.dark, borderWidth: 1, borderColor: c.border },
  cancelBtn: { padding: 14, alignItems: 'center', marginTop: 4 },
  cancelText: { color: c.muted, fontSize: 14 },
});

export default function AdminScreen({ navigation }: Props) {
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const { showAlert } = useAppAlert();
  const [disputes, setDisputes] = useState<Dispute[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [refreshing, setRefreshing] = useState<boolean>(false);
  const [showResolve, setShowResolve] = useState<boolean>(false);
  const [selectedDispute, setSelectedDispute] = useState<Dispute | null>(null);
  const [resolution, setResolution] = useState<string>('');
  const [adminNotes, setAdminNotes] = useState<string>('');
  const [outcome, setOutcome] = useState<string>('BORROWER_FAVOR');
  const [resolving, setResolving] = useState<boolean>(false);

  const loadDisputes = async (): Promise<void> => {
    try {
      const data = await getAdminOpenDisputes();
      setDisputes(data as Dispute[]);
    } catch (e) {
      showAlert('error', 'Error', (e as Error).message);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useFocusEffect(useCallback(() => { loadDisputes(); }, []));

  const handleResolve = async (): Promise<void> => {
    if (!resolution.trim()) { showAlert('error', 'Error', 'Enter a resolution'); return; }
    setResolving(true);
    try {
      await resolveDispute(selectedDispute!.id, { outcome, resolution, adminNotes });
      showAlert('success', 'Success', 'Dispute resolved. Both parties have been notified.');
      setShowResolve(false);
      setResolution('');
      setAdminNotes('');
      loadDisputes();
    } catch (e) {
      showAlert('error', 'Error', (e as Error).message);
    } finally {
      setResolving(false);
    }
  };

  const formatDate = (dateStr: string) =>
    new Date(dateStr).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={colors.accent} />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()}>
          <Text style={styles.back}>← Back</Text>
        </TouchableOpacity>
        <Text style={styles.title}>Admin — Disputes</Text>
        <View style={{ width: 50 }} />
      </View>

      <ScrollView
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); loadDisputes(); }} tintColor={colors.accent} />}
        showsVerticalScrollIndicator={false}
      >
        {disputes.length === 0 ? (
          <View style={styles.emptyCard}>
            <Ionicons name="checkmark-circle-outline" size={40} color={colors.success} />
            <Text style={styles.emptyTitle}>No open disputes</Text>
            <Text style={styles.emptyText}>All disputes have been resolved</Text>
          </View>
        ) : (
          <View style={styles.list}>
            {disputes.map((dispute) => (
              <View key={dispute.id} style={styles.disputeCard}>
                <View style={styles.disputeHeader}>
                  <View style={styles.disputeBadge}>
                    <Text style={styles.disputeBadgeText}>OPEN</Text>
                  </View>
                  <Text style={styles.disputeDate}>{formatDate(dispute.createdAt)}</Text>
                </View>
                <Text style={styles.disputeAmount}>GHS {dispute.loanAmount} Loan</Text>
                <View style={styles.partiesRow}>
                  <View style={styles.partyItem}>
                    <Text style={styles.partyLabel}>Borrower</Text>
                    <Text style={styles.partyName}>{dispute.borrowerName}</Text>
                  </View>
                  <Ionicons name="arrow-forward" size={16} color={colors.muted} />
                  <View style={styles.partyItem}>
                    <Text style={styles.partyLabel}>Lender</Text>
                    <Text style={styles.partyName}>{dispute.lenderName}</Text>
                  </View>
                </View>
                <View style={styles.divider} />
                <Text style={styles.reasonLabel}>Opened by {dispute.openedByName}</Text>
                <Text style={styles.reasonText}>{dispute.reason}</Text>
                {dispute.evidence ? (
                  <>
                    <Text style={styles.reasonLabel}>Evidence</Text>
                    <Text style={styles.reasonText}>{dispute.evidence}</Text>
                  </>
                ) : null}
                <TouchableOpacity
                  style={styles.resolveBtn}
                  onPress={() => { setSelectedDispute(dispute); setShowResolve(true); }}
                >
                  <Text style={styles.resolveBtnText}>Review & Resolve</Text>
                </TouchableOpacity>
              </View>
            ))}
          </View>
        )}
        <View style={{ height: 40 }} />
      </ScrollView>

      <Modal visible={showResolve} animationType="slide" transparent>
        <KeyboardAvoidingView
          style={{ flex: 1 }}
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        >
          <View style={styles.modalBg}>
            <ScrollView style={{ width: '100%' }} contentContainerStyle={{ flexGrow: 1, justifyContent: 'center', padding: 20 }}>
              <View style={styles.modal}>
                <Text style={styles.modalTitle}>Resolve Dispute</Text>
                {selectedDispute && (
                  <Text style={styles.modalSub}>
                    GHS {selectedDispute.loanAmount} · {selectedDispute.borrowerName} vs {selectedDispute.lenderName}
                  </Text>
                )}
                <Text style={styles.label}>Outcome</Text>
                <View style={styles.outcomeRow}>
                  <TouchableOpacity
                    style={[styles.outcomeBtn, outcome === 'BORROWER_FAVOR' && styles.outcomeBtnActive]}
                    onPress={() => setOutcome('BORROWER_FAVOR')}
                  >
                    <Text style={[styles.outcomeBtnText, outcome === 'BORROWER_FAVOR' && styles.outcomeBtnTextActive]}>
                      Favour Borrower
                    </Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[styles.outcomeBtn, outcome === 'LENDER_FAVOR' && styles.outcomeBtnActive]}
                    onPress={() => setOutcome('LENDER_FAVOR')}
                  >
                    <Text style={[styles.outcomeBtnText, outcome === 'LENDER_FAVOR' && styles.outcomeBtnTextActive]}>
                      Favour Lender
                    </Text>
                  </TouchableOpacity>
                </View>
                <Text style={styles.label}>Resolution *</Text>
                <TextInput
                  style={[styles.input, { height: 80 }]}
                  placeholder="Describe the resolution decision"
                  placeholderTextColor={colors.muted}
                  value={resolution}
                  onChangeText={setResolution}
                  multiline
                />
                <Text style={styles.label}>Admin Notes</Text>
                <TextInput
                  style={[styles.input, { height: 60 }]}
                  placeholder="Internal notes (optional)"
                  placeholderTextColor={colors.muted}
                  value={adminNotes}
                  onChangeText={setAdminNotes}
                  multiline
                />
                <TouchableOpacity
                  style={[styles.resolveBtn, resolving && { opacity: 0.6 }]}
                  onPress={handleResolve}
                  disabled={resolving}
                >
                  {resolving ? <ActivityIndicator color={colors.buttonDarkText} /> : <Text style={styles.resolveBtnText}>Confirm Resolution</Text>}
                </TouchableOpacity>
                <TouchableOpacity style={styles.cancelBtn} onPress={() => setShowResolve(false)}>
                  <Text style={styles.cancelText}>Cancel</Text>
                </TouchableOpacity>
              </View>
            </ScrollView>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </View>
  );
}
