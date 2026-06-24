import React, { useState, useCallback, useMemo } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  ActivityIndicator, RefreshControl, TextInput, Modal,
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { Ionicons } from '@expo/vector-icons';
import { getProfile, updateProfile, getBorrowerInsights, getLenderInsights } from '../services/api';
import { useAppAlert } from '../components/AppAlert';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';
import { RootStackParamList } from '../navigation/AppNavigator';
import { ColorScheme } from '../theme/colors';

type Props = {
  navigation: NativeStackNavigationProp<RootStackParamList>;
};

interface Profile {
  firstName: string;
  lastName: string;
  phone: string;
  email?: string;
  momoProvider?: string;
  momoNumber?: string;
  trustScore: number;
  totalLoansGiven: number;
  totalLoansReceived: number;
  loansRepaidOnTime: number;
  defaults: number;
  permanentBan?: boolean;
  borrowingSuspended?: boolean;
  createdAt?: string;
  role?: string;
}

interface EditData {
  firstName: string;
  lastName: string;
  email: string;
  momoProvider: string;
  momoNumber: string;
  [key: string]: string;
}

interface BorrowerInsights {
  totalLoansTaken: number;
  activeLoans: number;
  totalAmountBorrowed: number;
  totalInterestPaid: number;
  repaymentRate: number;
  averageLoanSize: number;
  recommendations?: string[];
}

interface LenderInsights {
  totalLoansGiven: number;
  activeLoans: number;
  totalAmountLent: number;
  totalInterestEarned: number;
  returnRate: number;
  totalAmountAtRisk: number;
  recommendations?: string[];
}

const createStyles = (c: ColorScheme) => StyleSheet.create({
  container: { flex: 1, backgroundColor: c.bg },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: c.bg },
  header: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    padding: 20, paddingTop: 56, backgroundColor: c.surface,
    borderBottomWidth: 1, borderBottomColor: c.border,
  },
  title: { color: c.dark, fontSize: 22, fontWeight: '700' },
  editBtn: { color: c.accent, fontSize: 15, fontWeight: '600' },
  profileCard: {
    backgroundColor: c.dark, marginHorizontal: 16, borderRadius: 16,
    padding: 24, alignItems: 'center', marginTop: 16, marginBottom: 12,
  },
  avatar: {
    width: 72, height: 72, borderRadius: 36,
    backgroundColor: c.accent, justifyContent: 'center', alignItems: 'center', marginBottom: 12,
  },
  avatarText: { color: c.surface, fontSize: 26, fontWeight: '800' },
  name: { color: c.surface, fontSize: 20, fontWeight: '700' },
  phone: { color: c.slate400, fontSize: 13, marginTop: 4 },
  scoreContainer: { alignItems: 'center', marginTop: 12 },
  score: { fontSize: 32, fontWeight: '800' },
  scoreLabel: { color: c.slate400, fontSize: 12, marginTop: 2 },
  statsCard: {
    flexDirection: 'row', justifyContent: 'space-around',
    backgroundColor: c.surface, marginHorizontal: 16, borderRadius: 14,
    padding: 16, marginBottom: 12, borderWidth: 1, borderColor: c.border,
  },
  statItem: { alignItems: 'center' },
  statValue: { color: c.dark, fontSize: 20, fontWeight: '800' },
  statLabel: { color: c.muted, fontSize: 11, marginTop: 4, textAlign: 'center' },
  card: {
    backgroundColor: c.surface, marginHorizontal: 16, borderRadius: 14,
    padding: 16, marginBottom: 12, borderWidth: 1, borderColor: c.border,
  },
  cardTitle: { color: c.dark, fontSize: 15, fontWeight: '700', marginBottom: 12 },
  detailRow: {
    flexDirection: 'row', justifyContent: 'space-between',
    paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: c.border,
  },
  detailLabel: { color: c.muted, fontSize: 13 },
  detailValue: { color: c.dark, fontSize: 13, fontWeight: '600' },
  tabRow: { flexDirection: 'row', marginHorizontal: 16, marginBottom: 12 },
  tab: { flex: 1, padding: 12, alignItems: 'center', borderBottomWidth: 2, borderBottomColor: 'transparent' },
  activeTab: { borderBottomColor: c.accent },
  tabText: { color: c.muted, fontSize: 13, fontWeight: '600' },
  activeTabText: { color: c.accent },
  recTitle: { color: c.accent, fontSize: 13, fontWeight: '700', marginBottom: 8 },
  recText: { color: c.muted, fontSize: 13, marginBottom: 4 },
  adminBtn: {
    marginHorizontal: 16, marginTop: 8, padding: 16, borderRadius: 12,
    backgroundColor: c.dark, alignItems: 'center', flexDirection: 'row', justifyContent: 'center',
  },
  adminBtnText: { color: c.surface, fontSize: 14, fontWeight: '700' },
  logoutBtn: {
    marginHorizontal: 16, marginTop: 10, padding: 14, borderRadius: 12,
    borderWidth: 1, borderColor: c.border, alignItems: 'center',
    backgroundColor: c.surface, flexDirection: 'row', justifyContent: 'center',
  },
  logoutText: { color: c.danger, fontSize: 14, fontWeight: '700' },
  modalBg: { flex: 1, backgroundColor: 'rgba(0,0,0,0.6)', justifyContent: 'center', padding: 24 },
  modal: { backgroundColor: c.surface, borderRadius: 16, padding: 24, maxHeight: '80%' as const },
  modalTitle: { color: c.dark, fontSize: 20, fontWeight: '700', textAlign: 'center', marginBottom: 16 },
  label: { color: c.muted, fontSize: 13, marginBottom: 6, marginTop: 12 },
  input: {
    backgroundColor: c.bg, borderRadius: 10, padding: 12,
    fontSize: 14, color: c.dark, borderWidth: 1, borderColor: c.border,
  },
  primaryBtn: { backgroundColor: c.dark, borderRadius: 12, padding: 16, alignItems: 'center', marginTop: 20 },
  btnText: { color: c.surface, fontSize: 15, fontWeight: '700' },
  cancelBtn: { padding: 14, alignItems: 'center', marginTop: 4 },
  cancelText: { color: c.muted, fontSize: 14 },
});

export default function ProfileScreen({ navigation }: Props) {
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const { showAlert } = useAppAlert();
  const [profile, setProfile] = useState<Profile | null>(null);
  const [borrowerInsights, setBorrowerInsights] = useState<BorrowerInsights | null>(null);
  const [lenderInsights, setLenderInsights] = useState<LenderInsights | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [refreshing, setRefreshing] = useState<boolean>(false);
  const [activeTab, setActiveTab] = useState<string>('borrower');
  const [showEdit, setShowEdit] = useState<boolean>(false);
  const [editData, setEditData] = useState<EditData>({ firstName: '', lastName: '', email: '', momoProvider: '', momoNumber: '' });
  const [saving, setSaving] = useState<boolean>(false);
  const { signOut } = useAuth();

  const loadData = async (): Promise<void> => {
    try {
      const [p, bi, li] = await Promise.all([
        getProfile(),
        getBorrowerInsights().catch(() => null),
        getLenderInsights().catch(() => null),
      ]);
      setProfile(p as Profile);
      setBorrowerInsights(bi as BorrowerInsights | null);
      setLenderInsights(li as LenderInsights | null);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useFocusEffect(useCallback(() => { loadData(); }, []));

  const handleEdit = async (): Promise<void> => {
    setSaving(true);
    try {
      const updated = await updateProfile(editData);
      setProfile(updated as Profile);
      setShowEdit(false);
      showAlert('success', 'Success', 'Profile updated');
    } catch (e) {
      showAlert('error', 'Error', (e as Error).message);
    } finally {
      setSaving(false);
    }
  };

  const openEdit = (): void => {
    if (!profile) return;
    setEditData({
      firstName: profile.firstName,
      lastName: profile.lastName,
      email: profile.email || '',
      momoProvider: profile.momoProvider || '',
      momoNumber: profile.momoNumber || '',
    });
    setShowEdit(true);
  };

  const getTrustColor = (s: number): string => s >= 70 ? colors.success : s >= 40 ? colors.accent : colors.danger;

  if (loading) return <View style={styles.center}><ActivityIndicator size="large" color={colors.accent} /></View>;

  const editFields: [string, keyof EditData][] = [
    ['First Name', 'firstName'],
    ['Last Name', 'lastName'],
    ['Email', 'email'],
    ['MoMo Provider', 'momoProvider'],
    ['MoMo Number', 'momoNumber'],
  ];

  return (
    <View style={styles.container}>
      <ScrollView refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); loadData(); }} tintColor={colors.accent} />}>
        <View style={styles.header}>
          <Text style={styles.title}>Profile</Text>
          <TouchableOpacity onPress={openEdit}>
            <Text style={styles.editBtn}>Edit</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.profileCard}>
          <View style={styles.avatar}>
            <Text style={styles.avatarText}>{profile?.firstName?.[0]}{profile?.lastName?.[0]}</Text>
          </View>
          <Text style={styles.name}>{profile?.firstName} {profile?.lastName}</Text>
          <Text style={styles.phone}>{profile?.phone}</Text>
          <View style={styles.scoreContainer}>
            <Text style={[styles.score, { color: getTrustColor(profile?.trustScore ?? 0) }]}>
              {profile?.trustScore?.toFixed(1)}
            </Text>
            <Text style={styles.scoreLabel}>Trust Score</Text>
          </View>
        </View>

        <View style={styles.statsCard}>
          {([
            ['Lent', profile?.totalLoansGiven],
            ['Borrowed', profile?.totalLoansReceived],
            ['On Time', profile?.loansRepaidOnTime],
            ['Defaults', profile?.defaults],
          ] as [string, number | undefined][]).map(([label, value], i) => (
            <View key={i} style={styles.statItem}>
              <Text style={styles.statValue}>{value || 0}</Text>
              <Text style={styles.statLabel}>{label}</Text>
            </View>
          ))}
        </View>

        <View style={styles.card}>
          <Text style={styles.cardTitle}>Account Details</Text>
          {([
            ['Email', profile?.email || 'Not set'],
            ['MoMo Provider', profile?.momoProvider || 'Not set'],
            ['MoMo Number', profile?.momoNumber || 'Not set'],
            ['Member Since', profile?.createdAt ? new Date(profile.createdAt).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' }) : ''],
            ['Borrowing Status', profile?.permanentBan ? 'Permanently Banned' : profile?.borrowingSuspended ? 'Suspended' : 'Active'],
          ] as [string, string][]).map(([label, value], i) => (
            <View key={i} style={styles.detailRow}>
              <Text style={styles.detailLabel}>{label}</Text>
              <Text style={[styles.detailValue, label === 'Borrowing Status' && value !== 'Active' && { color: colors.danger }]}>
                {value}
              </Text>
            </View>
          ))}
        </View>

        <View style={styles.tabRow}>
          {['borrower', 'lender'].map((t) => (
            <TouchableOpacity key={t} style={[styles.tab, activeTab === t && styles.activeTab]} onPress={() => setActiveTab(t)}>
              <Text style={[styles.tabText, activeTab === t && styles.activeTabText]}>
                {t === 'borrower' ? 'Borrower Insights' : 'Lender Insights'}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        {activeTab === 'borrower' && borrowerInsights && (
          <View style={styles.card}>
            {([
              ['Total Loans Taken', borrowerInsights.totalLoansTaken],
              ['Active Loans', borrowerInsights.activeLoans],
              ['Total Borrowed', `GHS ${borrowerInsights.totalAmountBorrowed}`],
              ['Interest Paid', `GHS ${borrowerInsights.totalInterestPaid}`],
              ['Repayment Rate', `${borrowerInsights.repaymentRate}%`],
              ['Avg Loan Size', `GHS ${borrowerInsights.averageLoanSize}`],
            ] as [string, string | number][]).map(([label, value], i) => (
              <View key={i} style={styles.detailRow}>
                <Text style={styles.detailLabel}>{label}</Text>
                <Text style={styles.detailValue}>{value}</Text>
              </View>
            ))}
            {borrowerInsights.recommendations && borrowerInsights.recommendations.length > 0 && (
              <View style={{ marginTop: 12 }}>
                <Text style={styles.recTitle}>Recommendations</Text>
                {borrowerInsights.recommendations.map((r, i) => (
                  <Text key={i} style={styles.recText}>• {r}</Text>
                ))}
              </View>
            )}
          </View>
        )}

        {activeTab === 'lender' && lenderInsights && (
          <View style={styles.card}>
            {([
              ['Total Loans Given', lenderInsights.totalLoansGiven],
              ['Active Loans', lenderInsights.activeLoans],
              ['Total Lent', `GHS ${lenderInsights.totalAmountLent}`],
              ['Interest Earned', `GHS ${lenderInsights.totalInterestEarned}`],
              ['Return Rate', `${lenderInsights.returnRate}%`],
              ['Amount At Risk', `GHS ${lenderInsights.totalAmountAtRisk}`],
            ] as [string, string | number][]).map(([label, value], i) => (
              <View key={i} style={styles.detailRow}>
                <Text style={styles.detailLabel}>{label}</Text>
                <Text style={styles.detailValue}>{value}</Text>
              </View>
            ))}
            {lenderInsights.recommendations && lenderInsights.recommendations.length > 0 && (
              <View style={{ marginTop: 12 }}>
                <Text style={styles.recTitle}>Recommendations</Text>
                {lenderInsights.recommendations.map((r, i) => (
                  <Text key={i} style={styles.recText}>• {r}</Text>
                ))}
              </View>
            )}
          </View>
        )}

        {profile?.role === 'ADMIN' && (
          <TouchableOpacity
            style={styles.adminBtn}
            onPress={() => navigation.navigate('Admin')}
          >
            <Ionicons name="shield-checkmark-outline" size={18} color={colors.surface} style={{ marginRight: 8 }} />
            <Text style={styles.adminBtnText}>Admin Panel — Open Disputes</Text>
          </TouchableOpacity>
        )}

        <TouchableOpacity style={styles.logoutBtn} onPress={signOut}>
          <Ionicons name="log-out-outline" size={16} color={colors.danger} style={{ marginRight: 6 }} />
          <Text style={styles.logoutText}>Log Out</Text>
        </TouchableOpacity>

        <View style={{ height: 40 }} />
      </ScrollView>

      <Modal visible={showEdit} animationType="slide" transparent>
        <View style={styles.modalBg}>
          <View style={styles.modal}>
            <Text style={styles.modalTitle}>Edit Profile</Text>
            {editFields.map(([label, key]) => (
              <View key={key}>
                <Text style={styles.label}>{label}</Text>
                <TextInput
                  style={styles.input}
                  value={editData[key]}
                  onChangeText={(t) => setEditData({ ...editData, [key]: t })}
                  placeholderTextColor={colors.muted}
                />
              </View>
            ))}
            <TouchableOpacity style={[styles.primaryBtn, saving && { opacity: 0.6 }]} onPress={handleEdit} disabled={saving}>
              {saving ? <ActivityIndicator color={colors.surface} /> : <Text style={styles.btnText}>Save Changes</Text>}
            </TouchableOpacity>
            <TouchableOpacity style={styles.cancelBtn} onPress={() => setShowEdit(false)}>
              <Text style={styles.cancelText}>Cancel</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </View>
  );
}
