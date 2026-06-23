import React, { useState, useCallback } from 'react';
import {
  View, Text, StyleSheet, FlatList, TouchableOpacity,
  ActivityIndicator, RefreshControl, TextInput, Modal, Alert,
  ScrollView, KeyboardAvoidingView, Platform,
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { Ionicons } from '@expo/vector-icons';
import { getMyCircles, getPendingInvites, acceptInvite, createCircle } from '../services/api';
import { useAppAlert } from '../components/AppAlert';
import { RootStackParamList } from '../navigation/AppNavigator';

type Props = {
  navigation: NativeStackNavigationProp<RootStackParamList>;
};

interface Circle {
  id: number;
  name: string;
  description?: string;
  memberCount: number;
  maxLoanAmount: number;
  minTrustScore: number;
  groupFundingThreshold: number;
}

interface NewCircleForm {
  name: string;
  description: string;
  maxLoanAmount: string;
  groupFundingThreshold: string;
  minTrustScore: string;
}

const BG = '#EDEEF2';
const WHITE = '#FFFFFF';
const DARK = '#0f172a';
const MUTED = '#6B7280';
const BORDER = '#E5E7EB';
const ACCENT = '#C9A84C';
const DANGER = '#dc2626';

export default function CirclesScreen({ navigation }: Props) {
  const { showAlert } = useAppAlert();
  const [circles, setCircles] = useState<Circle[]>([]);
  const [pending, setPending] = useState<Circle[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [refreshing, setRefreshing] = useState<boolean>(false);
  const [acceptingId, setAcceptingId] = useState<number | null>(null);
  const [showCreate, setShowCreate] = useState<boolean>(false);
  const [newCircle, setNewCircle] = useState<NewCircleForm>({
    name: '', description: '', maxLoanAmount: '5000',
    groupFundingThreshold: '3000', minTrustScore: '0',
  });
  const [creating, setCreating] = useState<boolean>(false);

  const loadCircles = async (): Promise<void> => {
    try {
      const [activeData, pendingData] = await Promise.all([getMyCircles(), getPendingInvites()]);
      setCircles(activeData as Circle[]);
      setPending(pendingData as Circle[]);
    } catch (error) {
      console.error('Error loading circles:', error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useFocusEffect(useCallback(() => { loadCircles(); }, []));

  const handleAcceptInvite = async (circleId: number): Promise<void> => {
    setAcceptingId(circleId);
    try {
      const result = await acceptInvite(circleId) as { message: string };
      showAlert('success', 'Circle Joined', result.message);
      setPending(prev => prev.filter(c => c.id !== circleId));
      const activeData = await getMyCircles();
      setCircles(activeData as Circle[]);
    } catch (error) {
      showAlert('error', 'Failed', (error as Error).message);
    } finally {
      setAcceptingId(null);
    }
  };

  const handleCreate = async (): Promise<void> => {
    if (!newCircle.name.trim()) { Alert.alert('Error', 'Circle name is required'); return; }
    setCreating(true);
    try {
      await createCircle({
        name: newCircle.name,
        description: newCircle.description,
        maxLoanAmount: parseFloat(newCircle.maxLoanAmount) || 5000,
        groupFundingThreshold: parseFloat(newCircle.groupFundingThreshold) || 3000,
        minTrustScore: parseFloat(newCircle.minTrustScore) || 0,
      });
      setShowCreate(false);
      setNewCircle({ name: '', description: '', maxLoanAmount: '5000', groupFundingThreshold: '3000', minTrustScore: '0' });
      loadCircles();
    } catch (error) {
      Alert.alert('Error', (error as Error).message);
    } finally {
      setCreating(false);
    }
  };

  if (loading) {
    return <View style={styles.center}><ActivityIndicator size="large" color={ACCENT} /></View>;
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>My Circles</Text>
        <TouchableOpacity style={styles.addBtn} onPress={() => setShowCreate(true)}>
          <Ionicons name="add" size={18} color={WHITE} />
          <Text style={styles.addBtnText}>Create</Text>
        </TouchableOpacity>
      </View>

      {circles.length === 0 && pending.length === 0 ? (
        <View style={styles.center}>
          <Ionicons name="people-outline" size={48} color={MUTED} />
          <Text style={styles.emptyTitle}>No circles yet</Text>
          <Text style={styles.emptyText}>Create one to start lending with friends</Text>
          <TouchableOpacity style={styles.emptyBtn} onPress={() => setShowCreate(true)}>
            <Text style={styles.emptyBtnText}>Create Circle</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <ScrollView
          contentContainerStyle={{ padding: 16, gap: 12 }}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); loadCircles(); }} tintColor={ACCENT} />}
        >
          {pending.length > 0 && (
            <>
              <Text style={styles.sectionTitle}>Pending Invites</Text>
              {pending.map(item => (
                <View key={`pending-${item.id}`} style={[styles.circleCard, styles.pendingCard]}>
                  <View style={styles.circleTop}>
                    <View style={[styles.circleIconBox, { borderColor: ACCENT }]}>
                      <Ionicons name="mail-outline" size={20} color={ACCENT} />
                    </View>
                    <View style={styles.circleInfo}>
                      <Text style={styles.circleName}>{item.name}</Text>
                      <Text style={styles.circleMeta}>{item.memberCount} members</Text>
                    </View>
                  </View>
                  {item.description ? <Text style={styles.circleDesc}>{item.description}</Text> : null}
                  <TouchableOpacity
                    style={[styles.acceptBtn, acceptingId === item.id && { opacity: 0.6 }]}
                    onPress={() => handleAcceptInvite(item.id)}
                    disabled={acceptingId === item.id}
                  >
                    {acceptingId === item.id
                      ? <ActivityIndicator size="small" color={WHITE} />
                      : <><Ionicons name="checkmark-circle-outline" size={16} color={WHITE} /><Text style={styles.acceptBtnText}>Accept Invite</Text></>}
                  </TouchableOpacity>
                </View>
              ))}
              {circles.length > 0 && <Text style={styles.sectionTitle}>My Circles</Text>}
            </>
          )}
          {circles.map(item => (
            <TouchableOpacity
              key={item.id}
              style={styles.circleCard}
              onPress={() => navigation.navigate('CircleDetail', { circleId: item.id })}
            >
              <View style={styles.circleTop}>
                <View style={styles.circleIconBox}>
                  <Ionicons name="people-outline" size={20} color={ACCENT} />
                </View>
                <View style={styles.circleInfo}>
                  <Text style={styles.circleName}>{item.name}</Text>
                  <Text style={styles.circleMeta}>{item.memberCount} members</Text>
                </View>
                <Ionicons name="chevron-forward" size={16} color={MUTED} />
              </View>
              {item.description ? (
                <Text style={styles.circleDesc}>{item.description}</Text>
              ) : null}
              <View style={styles.statsRow}>
                <View style={styles.statItem}>
                  <Text style={styles.statValue}>GHS {item.maxLoanAmount?.toLocaleString()}</Text>
                  <Text style={styles.statLabel}>Max Loan</Text>
                </View>
                <View style={styles.statDivider} />
                <View style={styles.statItem}>
                  <Text style={styles.statValue}>{item.minTrustScore}</Text>
                  <Text style={styles.statLabel}>Min Score</Text>
                </View>
                <View style={styles.statDivider} />
                <View style={styles.statItem}>
                  <Text style={styles.statValue}>GHS {item.groupFundingThreshold?.toLocaleString()}</Text>
                  <Text style={styles.statLabel}>Group Threshold</Text>
                </View>
              </View>
            </TouchableOpacity>
          ))}
        </ScrollView>
      )}

      <Modal visible={showCreate} animationType="slide" transparent>
        <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
          <View style={styles.modalBg}>
            <View style={styles.modal}>
              <ScrollView showsVerticalScrollIndicator={false}>
                <Text style={styles.modalTitle}>Create a Circle</Text>

                <Text style={styles.label}>Circle Name *</Text>
                <TextInput style={styles.input} placeholder="e.g. The Boys" placeholderTextColor={MUTED} value={newCircle.name} onChangeText={(t) => setNewCircle({ ...newCircle, name: t })} />

                <Text style={styles.label}>Description</Text>
                <TextInput style={[styles.input, { height: 80 }]} placeholder="What's this circle about?" placeholderTextColor={MUTED} value={newCircle.description} onChangeText={(t) => setNewCircle({ ...newCircle, description: t })} multiline />

                <Text style={styles.label}>Max Loan Amount (GHS)</Text>
                <TextInput style={styles.input} placeholder="5000" placeholderTextColor={MUTED} value={newCircle.maxLoanAmount} onChangeText={(t) => setNewCircle({ ...newCircle, maxLoanAmount: t })} keyboardType="numeric" />

                <Text style={styles.label}>Group Funding Threshold (GHS)</Text>
                <TextInput style={styles.input} placeholder="3000" placeholderTextColor={MUTED} value={newCircle.groupFundingThreshold} onChangeText={(t) => setNewCircle({ ...newCircle, groupFundingThreshold: t })} keyboardType="numeric" />

                <Text style={styles.label}>Minimum Trust Score</Text>
                <TextInput style={styles.input} placeholder="0" placeholderTextColor={MUTED} value={newCircle.minTrustScore} onChangeText={(t) => setNewCircle({ ...newCircle, minTrustScore: t })} keyboardType="numeric" />

                <TouchableOpacity style={[styles.createBtn, creating && { opacity: 0.6 }]} onPress={handleCreate} disabled={creating}>
                  {creating ? <ActivityIndicator color={WHITE} /> : <Text style={styles.createBtnText}>Create Circle</Text>}
                </TouchableOpacity>

                <TouchableOpacity style={styles.cancelBtn} onPress={() => setShowCreate(false)}>
                  <Text style={styles.cancelBtnText}>Cancel</Text>
                </TouchableOpacity>
              </ScrollView>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: BG },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: BG, padding: 24 },
  header: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    backgroundColor: WHITE, paddingHorizontal: 20, paddingTop: 56, paddingBottom: 16,
    borderBottomWidth: 1, borderBottomColor: BORDER,
  },
  title: { fontSize: 22, fontWeight: '700', color: DARK },
  addBtn: { flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: DARK, borderRadius: 10, paddingHorizontal: 14, paddingVertical: 8 },
  addBtnText: { color: WHITE, fontSize: 14, fontWeight: '600' },
  emptyTitle: { fontSize: 18, fontWeight: '700', color: DARK, marginTop: 12, marginBottom: 6 },
  emptyText: { fontSize: 13, color: MUTED, textAlign: 'center', marginBottom: 20 },
  emptyBtn: { backgroundColor: DARK, borderRadius: 12, paddingHorizontal: 24, paddingVertical: 12 },
  emptyBtnText: { color: WHITE, fontSize: 14, fontWeight: '700' },
  circleCard: {
    backgroundColor: WHITE, borderRadius: 16, padding: 16,
    borderWidth: 1, borderColor: BORDER,
  },
  circleTop: { flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 12 },
  circleIconBox: { width: 42, height: 42, borderRadius: 12, backgroundColor: BG, justifyContent: 'center', alignItems: 'center', borderWidth: 1, borderColor: BORDER },
  circleInfo: { flex: 1 },
  circleName: { fontSize: 16, fontWeight: '700', color: DARK },
  circleMeta: { fontSize: 12, color: MUTED, marginTop: 2 },
  circleDesc: { fontSize: 13, color: MUTED, marginBottom: 12 },
  statsRow: { flexDirection: 'row', borderTopWidth: 1, borderTopColor: BORDER, paddingTop: 12 },
  statItem: { flex: 1, alignItems: 'center' },
  statDivider: { width: 1, backgroundColor: BORDER },
  statValue: { fontSize: 13, fontWeight: '700', color: DARK },
  statLabel: { fontSize: 10, color: MUTED, marginTop: 3 },
  modalBg: { flex: 1, backgroundColor: 'rgba(0,0,0,0.6)', justifyContent: 'flex-end' },
  modal: { backgroundColor: WHITE, borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 24, maxHeight: '90%' as const },
  modalTitle: { fontSize: 20, fontWeight: '700', color: DARK, textAlign: 'center', marginBottom: 20 },
  label: { fontSize: 12, color: MUTED, fontWeight: '600', marginBottom: 6, marginTop: 14 },
  input: { backgroundColor: BG, borderRadius: 10, padding: 14, fontSize: 14, color: DARK, borderWidth: 1, borderColor: BORDER },
  createBtn: { backgroundColor: DARK, borderRadius: 12, padding: 16, alignItems: 'center', marginTop: 24 },
  createBtnText: { color: WHITE, fontSize: 15, fontWeight: '700' },
  cancelBtn: { padding: 14, alignItems: 'center', marginTop: 4 },
  cancelBtnText: { color: MUTED, fontSize: 14 },
  sectionTitle: { fontSize: 14, fontWeight: '700', color: MUTED, textTransform: 'uppercase' as const, letterSpacing: 0.5, marginBottom: 4 },
  pendingCard: { borderLeftWidth: 3, borderLeftColor: ACCENT, backgroundColor: '#FFFDF5' },
  acceptBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, backgroundColor: ACCENT, borderRadius: 10, paddingVertical: 10, marginTop: 12 },
  acceptBtnText: { color: WHITE, fontSize: 14, fontWeight: '600' },
});