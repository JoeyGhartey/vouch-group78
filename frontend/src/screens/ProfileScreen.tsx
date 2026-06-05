import React, { useState, useCallback } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  ActivityIndicator, RefreshControl, TextInput, Modal, Alert,
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { getProfile, updateProfile, getBorrowerInsights, getLenderInsights } from '../services/api';
import { useAuth } from '../context/AuthContext';

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

export default function ProfileScreen() {
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
      Alert.alert('Success', 'Profile updated');
    } catch (e) {
      Alert.alert('Error', (e as Error).message);
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

  const getTrustColor = (s: number): string => s >= 70 ? '#4CAF50' : s >= 40 ? '#FFC107' : '#e94560';

  if (loading) return <View style={styles.center}><ActivityIndicator size="large" color="#e94560" /></View>;

  const editFields: [string, keyof EditData][] = [
    ['First Name', 'firstName'],
    ['Last Name', 'lastName'],
    ['Email', 'email'],
    ['MoMo Provider', 'momoProvider'],
    ['MoMo Number', 'momoNumber'],
  ];

  return (
    <View style={styles.container}>
      <ScrollView refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); loadData(); }} tintColor="#e94560" />}>
        <View style={styles.header}>
          <Text style={styles.title}>Profile</Text>
          <TouchableOpacity onPress={openEdit}><Text style={styles.editBtn}>Edit</Text></TouchableOpacity>
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
            ['Loans Given', profile?.totalLoansGiven],
            ['Loans Received', profile?.totalLoansReceived],
            ['Repaid On Time', profile?.loansRepaidOnTime],
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
              <Text style={[styles.detailValue, label === 'Borrowing Status' && value !== 'Active' && { color: '#e94560' }]}>
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

        <TouchableOpacity style={styles.logoutBtn} onPress={signOut}>
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
                  placeholderTextColor="#555"
                />
              </View>
            ))}
            <TouchableOpacity style={[styles.primaryBtn, saving && { opacity: 0.6 }]} onPress={handleEdit} disabled={saving}>
              {saving ? <ActivityIndicator color="#fff" /> : <Text style={styles.btnText}>Save Changes</Text>}
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

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#1a1a2e' },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#1a1a2e' },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 24, paddingTop: 60 },
  title: { color: '#fff', fontSize: 24, fontWeight: 'bold' },
  editBtn: { color: '#e94560', fontSize: 16, fontWeight: '600' },
  profileCard: { backgroundColor: '#16213e', marginHorizontal: 24, borderRadius: 16, padding: 24, alignItems: 'center', marginBottom: 16 },
  avatar: { width: 80, height: 80, borderRadius: 40, backgroundColor: '#e94560', justifyContent: 'center', alignItems: 'center', marginBottom: 12 },
  avatarText: { color: '#fff', fontSize: 28, fontWeight: 'bold' },
  name: { color: '#fff', fontSize: 22, fontWeight: 'bold' },
  phone: { color: '#a0a0b0', fontSize: 14, marginTop: 4 },
  scoreContainer: { alignItems: 'center', marginTop: 12 },
  score: { fontSize: 36, fontWeight: 'bold' },
  scoreLabel: { color: '#a0a0b0', fontSize: 12, marginTop: 2 },
  statsCard: { flexDirection: 'row', justifyContent: 'space-around', backgroundColor: '#16213e', marginHorizontal: 24, borderRadius: 16, padding: 20, marginBottom: 16 },
  statItem: { alignItems: 'center' },
  statValue: { color: '#fff', fontSize: 20, fontWeight: 'bold' },
  statLabel: { color: '#a0a0b0', fontSize: 11, marginTop: 4, textAlign: 'center' },
  card: { backgroundColor: '#16213e', marginHorizontal: 24, borderRadius: 16, padding: 20, marginBottom: 16 },
  cardTitle: { color: '#fff', fontSize: 16, fontWeight: 'bold', marginBottom: 12 },
  detailRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: '#2a2a4a' },
  detailLabel: { color: '#a0a0b0', fontSize: 14 },
  detailValue: { color: '#fff', fontSize: 14, fontWeight: '600' },
  tabRow: { flexDirection: 'row', marginHorizontal: 24, marginBottom: 16 },
  tab: { flex: 1, padding: 12, alignItems: 'center', borderBottomWidth: 2, borderBottomColor: 'transparent' },
  activeTab: { borderBottomColor: '#e94560' },
  tabText: { color: '#666', fontSize: 13, fontWeight: '600' },
  activeTabText: { color: '#e94560' },
  recTitle: { color: '#FFC107', fontSize: 14, fontWeight: 'bold', marginBottom: 8 },
  recText: { color: '#a0a0b0', fontSize: 13, marginBottom: 4 },
  logoutBtn: { marginHorizontal: 24, marginTop: 16, padding: 16, borderRadius: 12, borderWidth: 1, borderColor: '#e94560', alignItems: 'center' },
  logoutText: { color: '#e94560', fontSize: 16, fontWeight: '600' },
  modalBg: { flex: 1, backgroundColor: 'rgba(0,0,0,0.7)', justifyContent: 'center', padding: 24 },
  modal: { backgroundColor: '#16213e', borderRadius: 16, padding: 24, maxHeight: '80%' as const },
  modalTitle: { color: '#fff', fontSize: 20, fontWeight: 'bold', textAlign: 'center', marginBottom: 16 },
  label: { color: '#a0a0b0', fontSize: 14, marginBottom: 6, marginTop: 12 },
  input: { backgroundColor: '#1a1a2e', borderRadius: 12, padding: 14, fontSize: 16, color: '#fff', borderWidth: 1, borderColor: '#2a2a4a' },
  primaryBtn: { backgroundColor: '#e94560', borderRadius: 12, padding: 16, alignItems: 'center', marginTop: 20 },
  btnText: { color: '#fff', fontSize: 16, fontWeight: 'bold' },
  cancelBtn: { padding: 16, alignItems: 'center', marginTop: 4 },
  cancelText: { color: '#a0a0b0', fontSize: 16 },
});