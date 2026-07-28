import React, { useState, useCallback, useMemo } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity,
  ActivityIndicator, RefreshControl, TextInput, Modal,
  ScrollView, KeyboardAvoidingView, Platform, TouchableWithoutFeedback,
} from 'react-native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { Ionicons } from '@expo/vector-icons';
import { getMyCircles, getPendingInvites, acceptInvite, rejectInvite, createCircle } from '../services/api';
import { useAppAlert } from '../components/AppAlert';
import { useConfirmModal } from '../components/ConfirmModal';
import { useTheme } from '../context/ThemeContext';
import { RootStackParamList } from '../navigation/AppNavigator';
import { ColorScheme } from '../theme/colors';
import { formatMoney } from '../utils/formatMoney';
import { getRecentCircleOrder } from '../utils/recentCircles';
import { useFreshFocus } from '../utils/useFreshFocus';
import { fonts } from '../theme/fonts';

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


const createStyles = (c: ColorScheme) => StyleSheet.create({
  container: { flex: 1, backgroundColor: c.bg },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: c.bg, padding: 24 },
  header: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    backgroundColor: c.surface, paddingHorizontal: 20, paddingTop: 56, paddingBottom: 16,
    borderBottomWidth: 1, borderBottomColor: c.border,
  },
  title: { fontSize: 22, fontWeight: '700', fontFamily: fonts.bold, color: c.dark },
  subtitle: { fontSize: 12.5, color: c.muted, fontFamily: fonts.medium, marginTop: 2 },
  addBtn: { flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: c.buttonDark, borderRadius: 10, paddingHorizontal: 14, paddingVertical: 9 },
  addBtnText: { color: c.buttonDarkText, fontSize: 14, fontWeight: '600', fontFamily: fonts.semibold },
  emptyIconBox: {
    width: 76, height: 76, borderRadius: 38, backgroundColor: c.surface,
    justifyContent: 'center', alignItems: 'center', marginBottom: 4,
    borderWidth: 1, borderColor: c.border,
  },
  emptyTitle: { fontSize: 18, fontWeight: '700', fontFamily: fonts.bold, color: c.dark, marginTop: 14, marginBottom: 6 },
  emptyText: { fontSize: 13, color: c.muted, fontFamily: fonts.regular, textAlign: 'center', lineHeight: 19, marginBottom: 20 },
  emptyBtn: { backgroundColor: c.buttonDark, borderRadius: 12, paddingHorizontal: 24, paddingVertical: 12 },
  emptyBtnText: { color: c.buttonDarkText, fontSize: 14, fontWeight: '700', fontFamily: fonts.bold },
  circleCard: {
    backgroundColor: c.surface, borderRadius: 18, padding: 16,
    borderWidth: 1, borderColor: c.border,
  },
  circleTop: { flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 12 },
  circleIconBox: { width: 44, height: 44, borderRadius: 13, backgroundColor: c.goldBgTint, justifyContent: 'center', alignItems: 'center' },
  circleInfo: { flex: 1 },
  circleNameRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  circleName: { fontSize: 16, fontWeight: '700', fontFamily: fonts.bold, color: c.dark },
  recentBadge: { backgroundColor: c.goldBgTint, borderRadius: 6, paddingHorizontal: 6, paddingVertical: 2 },
  recentBadgeText: { fontSize: 9, fontWeight: '700', fontFamily: fonts.bold, color: c.accentDark, letterSpacing: 0.3 },
  circleMeta: { fontSize: 12, color: c.muted, fontFamily: fonts.medium, marginTop: 2 },
  circleDesc: { fontSize: 13, color: c.muted, fontFamily: fonts.regular, lineHeight: 18, marginBottom: 12 },
  statsRow: { flexDirection: 'row', borderTopWidth: 1, borderTopColor: c.border, paddingTop: 12 },
  // flexBasis: 0 (alongside flex: 1) forces the three columns to stay equal
  // width regardless of content length, and the value text shrinks to fit
  // instead of overflowing and pushing its neighbors out of alignment.
  statItem: { flex: 1, flexBasis: 0, alignItems: 'center', paddingHorizontal: 2 },
  statDivider: { width: 1, backgroundColor: c.border },
  statValue: { fontSize: 13, fontWeight: '700', fontFamily: fonts.bold, color: c.dark },
  statLabel: { fontSize: 10, color: c.muted, fontFamily: fonts.medium, marginTop: 3 },
  modalBg: { flex: 1, backgroundColor: 'rgba(0,0,0,0.6)', justifyContent: 'flex-end' },
  modal: { backgroundColor: c.surface, borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 24, maxHeight: '90%' as const },
  modalTitle: { fontSize: 20, fontWeight: '700', fontFamily: fonts.bold, color: c.dark, textAlign: 'center', marginBottom: 20 },
  label: { fontSize: 12, color: c.muted, fontWeight: '600', fontFamily: fonts.semibold, marginBottom: 6, marginTop: 14 },
  input: { backgroundColor: c.bg, borderRadius: 10, padding: 14, fontSize: 14, fontFamily: fonts.regular, color: c.dark, borderWidth: 1, borderColor: c.border },
  createBtn: { backgroundColor: c.buttonDark, borderRadius: 12, padding: 16, alignItems: 'center', marginTop: 24 },
  createBtnText: { color: c.buttonDarkText, fontSize: 15, fontWeight: '700', fontFamily: fonts.bold },
  cancelBtn: { padding: 14, alignItems: 'center', marginTop: 4 },
  cancelBtnText: { color: c.muted, fontSize: 14, fontFamily: fonts.medium },
  sectionTitle: { fontSize: 13, fontWeight: '700', fontFamily: fonts.bold, color: c.muted, textTransform: 'uppercase' as const, letterSpacing: 0.6, marginBottom: 4 },
  pendingCard: { borderLeftWidth: 3, borderLeftColor: c.accent, backgroundColor: c.goldBgTint },
  inviteActions: { flexDirection: 'row', gap: 8, marginTop: 12 },
  acceptBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, backgroundColor: c.accent, borderRadius: 10, paddingVertical: 10, flex: 1 },
  acceptBtnText: { color: c.surface, fontSize: 14, fontWeight: '600', fontFamily: fonts.semibold },
  rejectBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, backgroundColor: c.danger, borderRadius: 10, paddingVertical: 10, flex: 1 },
  rejectBtnText: { color: c.surface, fontSize: 14, fontWeight: '600', fontFamily: fonts.semibold },
});

export default function CirclesScreen({ navigation }: Props) {
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const { showAlert } = useAppAlert();
  const { confirm } = useConfirmModal();
  const [circles, setCircles] = useState<Circle[]>([]);
  const [recentIds, setRecentIds] = useState<number[]>([]);
  const [pending, setPending] = useState<Circle[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [refreshing, setRefreshing] = useState<boolean>(false);
  const [acceptingId, setAcceptingId] = useState<number | null>(null);
  const [rejectingId, setRejectingId] = useState<number | null>(null);
  const [showCreate, setShowCreate] = useState<boolean>(false);
  const [newCircle, setNewCircle] = useState<NewCircleForm>({
    name: '', description: '', maxLoanAmount: '5000',
    groupFundingThreshold: '3000', minTrustScore: '0',
  });
  const [creating, setCreating] = useState<boolean>(false);
  const [nameError, setNameError] = useState<string>('');
  const [maxLoanAmountError, setMaxLoanAmountError] = useState<string>('');
  const [groupFundingThresholdError, setGroupFundingThresholdError] = useState<string>('');

  const loadCircles = async (): Promise<void> => {
    try {
      const [activeData, pendingData, recentOrder] = await Promise.all([
        getMyCircles(), getPendingInvites(), getRecentCircleOrder(),
      ]);
      const active = activeData as Circle[];
      // Pin the 3 most-recently-accessed circles to the top, in that order.
      // Everything else keeps its original (backend) order below them --
      // nothing is hidden, just reordered.
      const topRecentIds = recentOrder.slice(0, 3);
      const pinned = topRecentIds
        .map((id) => active.find((c) => c.id === id))
        .filter((c): c is Circle => c !== undefined);
      const rest = active.filter((c) => !topRecentIds.includes(c.id));
      setCircles([...pinned, ...rest]);
      setRecentIds(topRecentIds);
      setPending(pendingData as Circle[]);
    } catch (error) {
      console.error('Error loading circles:', error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const { markFresh } = useFreshFocus(loadCircles);

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

  const handleRejectInvite = async (circleId: number): Promise<void> => {
    const ok = await confirm('Reject Invite', 'Are you sure you want to reject this circle invitation?', 'Reject');
    if (!ok) return;
    setRejectingId(circleId);
    try {
      await rejectInvite(circleId);
      setPending(prev => prev.filter(c => c.id !== circleId));
    } catch (error) {
      showAlert('error', 'Failed', (error as Error).message);
    } finally {
      setRejectingId(null);
    }
  };

  const handleCreate = async (): Promise<void> => {
    setNameError('');
    setMaxLoanAmountError('');
    setGroupFundingThresholdError('');
    if (!newCircle.name.trim()) { setNameError('Circle name is required'); return; }

    const parseWithDefault = (value: string, fallback: number): number => {
      const parsed = parseFloat(value);
      return Number.isNaN(parsed) ? fallback : parsed;
    };
    const maxLoanAmount = parseWithDefault(newCircle.maxLoanAmount, 5000);
    const groupFundingThreshold = parseWithDefault(newCircle.groupFundingThreshold, 3000);
    let hasError = false;
    if (maxLoanAmount <= 0) { setMaxLoanAmountError('Must be greater than 0'); hasError = true; }
    if (groupFundingThreshold <= 0) { setGroupFundingThresholdError('Must be greater than 0'); hasError = true; }
    if (hasError) return;

    setCreating(true);
    try {
      await createCircle({
        name: newCircle.name,
        description: newCircle.description,
        maxLoanAmount,
        groupFundingThreshold,
        minTrustScore: parseWithDefault(newCircle.minTrustScore, 0),
      });
      setShowCreate(false);
      setNewCircle({ name: '', description: '', maxLoanAmount: '5000', groupFundingThreshold: '3000', minTrustScore: '0' });
      loadCircles();
    } catch (error) {
      showAlert('error', 'Error', (error as Error).message);
    } finally {
      setCreating(false);
    }
  };

  if (loading) {
    return <View style={styles.center}><ActivityIndicator size="large" color={colors.accent} /></View>;
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <View>
          <Text style={styles.title}>My Circles</Text>
          <Text style={styles.subtitle}>
            {circles.length} circle{circles.length === 1 ? '' : 's'}
            {pending.length > 0 ? ` · ${pending.length} pending invite${pending.length === 1 ? '' : 's'}` : ''}
          </Text>
        </View>
        <TouchableOpacity style={styles.addBtn} onPress={() => { setNameError(''); setMaxLoanAmountError(''); setGroupFundingThresholdError(''); setShowCreate(true); }}>
          <Ionicons name="add" size={18} color={colors.buttonDarkText} />
          <Text style={styles.addBtnText}>Create</Text>
        </TouchableOpacity>
      </View>

      {circles.length === 0 && pending.length === 0 ? (
        <View style={styles.center}>
          <View style={styles.emptyIconBox}>
            <Ionicons name="people-outline" size={32} color={colors.muted} />
          </View>
          <Text style={styles.emptyTitle}>No circles yet</Text>
          <Text style={styles.emptyText}>Create one to start lending with friends</Text>
          <TouchableOpacity style={styles.emptyBtn} onPress={() => { setNameError(''); setShowCreate(true); }}>
            <Text style={styles.emptyBtnText}>Create Circle</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <ScrollView
          contentContainerStyle={{ padding: 16, gap: 12 }}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); markFresh(); loadCircles(); }} tintColor={colors.accent} />}
        >
          {pending.length > 0 && (
            <>
              <Text style={styles.sectionTitle}>Pending Invites</Text>
              {pending.map(item => (
                <View key={`pending-${item.id}`} style={[styles.circleCard, styles.pendingCard]}>
                  <View style={styles.circleTop}>
                    <View style={styles.circleIconBox}>
                      <Ionicons name="mail-outline" size={20} color={colors.accentDark} />
                    </View>
                    <View style={styles.circleInfo}>
                      <Text style={styles.circleName}>{item.name}</Text>
                      <Text style={styles.circleMeta}>{item.memberCount} members</Text>
                    </View>
                  </View>
                  {item.description ? <Text style={styles.circleDesc}>{item.description}</Text> : null}
                  <View style={styles.inviteActions}>
                    <TouchableOpacity
                      style={[styles.acceptBtn, acceptingId === item.id && { opacity: 0.6 }]}
                      onPress={() => handleAcceptInvite(item.id)}
                      disabled={acceptingId === item.id || rejectingId === item.id}
                    >
                      {acceptingId === item.id
                        ? <ActivityIndicator size="small" color={colors.surface} />
                        : <><Ionicons name="checkmark-circle-outline" size={16} color={colors.surface} /><Text style={styles.acceptBtnText}>Accept</Text></>}
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={[styles.rejectBtn, rejectingId === item.id && { opacity: 0.6 }]}
                      onPress={() => handleRejectInvite(item.id)}
                      disabled={acceptingId === item.id || rejectingId === item.id}
                    >
                      {rejectingId === item.id
                        ? <ActivityIndicator size="small" color={colors.surface} />
                        : <><Ionicons name="close-circle-outline" size={16} color={colors.surface} /><Text style={styles.rejectBtnText}>Reject</Text></>}
                    </TouchableOpacity>
                  </View>
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
                  <Ionicons name="people" size={20} color={colors.accentDark} />
                </View>
                <View style={styles.circleInfo}>
                  <View style={styles.circleNameRow}>
                    <Text style={styles.circleName}>{item.name}</Text>
                    {recentIds.includes(item.id) && (
                      <View style={styles.recentBadge}>
                        <Text style={styles.recentBadgeText}>RECENT</Text>
                      </View>
                    )}
                  </View>
                  <Text style={styles.circleMeta}>{item.memberCount} members</Text>
                </View>
                <Ionicons name="chevron-forward" size={16} color={colors.muted} />
              </View>
              {item.description ? (
                <Text style={styles.circleDesc}>{item.description}</Text>
              ) : null}
              <View style={styles.statsRow}>
                <View style={styles.statItem}>
                  <Text style={styles.statValue} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.75}>
                    GHS {formatMoney(item.maxLoanAmount)}
                  </Text>
                  <Text style={styles.statLabel}>Max Loan</Text>
                </View>
                <View style={styles.statDivider} />
                <View style={styles.statItem}>
                  <Text style={styles.statValue} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.75}>
                    {item.minTrustScore}
                  </Text>
                  <Text style={styles.statLabel}>Min Score</Text>
                </View>
                <View style={styles.statDivider} />
                <View style={styles.statItem}>
                  <Text style={styles.statValue} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.75}>
                    GHS {formatMoney(item.groupFundingThreshold)}
                  </Text>
                  <Text style={styles.statLabel}>Group Threshold</Text>
                </View>
              </View>
            </TouchableOpacity>
          ))}
        </ScrollView>
      )}

      <Modal visible={showCreate} animationType="slide" transparent onRequestClose={() => setShowCreate(false)}>
        <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
          <TouchableWithoutFeedback onPress={() => setShowCreate(false)}>
          <View style={styles.modalBg}>
            <TouchableWithoutFeedback onPress={() => {}}>
            <View style={styles.modal}>
              <ScrollView showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
                <Text style={styles.modalTitle}>Create a Circle</Text>

                <Text style={styles.label}>Circle Name *</Text>
                <TextInput style={styles.input} placeholder="e.g. The Boys" placeholderTextColor={colors.muted} value={newCircle.name} onChangeText={(t) => { setNewCircle({ ...newCircle, name: t }); setNameError(''); }} />
                {nameError !== '' && <Text style={{ color: colors.errorRed, fontSize: 13, marginTop: 6 }}>{nameError}</Text>}

                <Text style={styles.label}>Description</Text>
                <TextInput style={[styles.input, { height: 80 }]} placeholder="What's this circle about?" placeholderTextColor={colors.muted} value={newCircle.description} onChangeText={(t) => setNewCircle({ ...newCircle, description: t })} multiline />

                <Text style={styles.label}>Max Loan Amount (GHS)</Text>
                <TextInput style={styles.input} placeholder="5000" placeholderTextColor={colors.muted} value={newCircle.maxLoanAmount} onChangeText={(t) => { setNewCircle({ ...newCircle, maxLoanAmount: t }); setMaxLoanAmountError(''); }} keyboardType="numeric" />
                {maxLoanAmountError !== '' && <Text style={{ color: colors.errorRed, fontSize: 13, marginTop: 6 }}>{maxLoanAmountError}</Text>}

                <Text style={styles.label}>Group Funding Threshold (GHS)</Text>
                <TextInput style={styles.input} placeholder="3000" placeholderTextColor={colors.muted} value={newCircle.groupFundingThreshold} onChangeText={(t) => { setNewCircle({ ...newCircle, groupFundingThreshold: t }); setGroupFundingThresholdError(''); }} keyboardType="numeric" />
                {groupFundingThresholdError !== '' && <Text style={{ color: colors.errorRed, fontSize: 13, marginTop: 6 }}>{groupFundingThresholdError}</Text>}

                <Text style={styles.label}>Minimum Trust Score</Text>
                <TextInput style={styles.input} placeholder="0" placeholderTextColor={colors.muted} value={newCircle.minTrustScore} onChangeText={(t) => setNewCircle({ ...newCircle, minTrustScore: t })} keyboardType="numeric" />

                <TouchableOpacity style={[styles.createBtn, creating && { opacity: 0.6 }]} onPress={handleCreate} disabled={creating}>
                  {creating ? <ActivityIndicator color={colors.buttonDarkText} /> : <Text style={styles.createBtnText}>Create Circle</Text>}
                </TouchableOpacity>

                <TouchableOpacity style={styles.cancelBtn} onPress={() => setShowCreate(false)}>
                  <Text style={styles.cancelBtnText}>Cancel</Text>
                </TouchableOpacity>
              </ScrollView>
            </View>
            </TouchableWithoutFeedback>
          </View>
          </TouchableWithoutFeedback>
        </KeyboardAvoidingView>
      </Modal>
    </View>
  );
}
