import React, { useState, useCallback, useMemo } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  ActivityIndicator, RefreshControl, TextInput, Modal, TouchableWithoutFeedback,
} from 'react-native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { Ionicons } from '@expo/vector-icons';
import Svg, { Circle } from 'react-native-svg';
import { getProfile, updateProfile, getBorrowerInsights, getLenderInsights, getBadges, deleteAccount } from '../services/api';
import { useAppAlert } from '../components/AppAlert';
import { useConfirmModal } from '../components/ConfirmModal';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';
import { RootStackParamList } from '../navigation/AppNavigator';
import { ColorScheme } from '../theme/colors';
import { formatMoney } from '../utils/formatMoney';
import { useFreshFocus } from '../utils/useFreshFocus';
import { fonts } from '../theme/fonts';

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

interface Badge {
  id: string;
  name: string;
  description: string;
  icon: string;
  earned: boolean;
}

const BADGE_ICON_NAMES: Record<string, string> = {
  rising_star: 'star',
  trusted_borrower: 'people',
  reliable_lender: 'cash',
  circle_champion: 'trophy',
  elite_member: 'medal',
  zero_defaults: 'shield-checkmark',
};

const getBadgeIconName = (badgeId: string, earned: boolean): keyof typeof Ionicons.glyphMap => {
  const base = BADGE_ICON_NAMES[badgeId] || 'ribbon';
  return (earned ? base : `${base}-outline`) as keyof typeof Ionicons.glyphMap;
};

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
  headerLeft: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  helpBtn: {
    width: 34, height: 34, borderRadius: 10,
    backgroundColor: c.bg, borderWidth: 1, borderColor: c.border,
    justifyContent: 'center', alignItems: 'center',
  },
  title: { color: c.dark, fontSize: 22, fontWeight: '700', fontFamily: fonts.bold },
  editBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    paddingHorizontal: 14, height: 34, borderRadius: 10,
    backgroundColor: c.goldBgTint, borderWidth: 1, borderColor: c.border,
  },
  editBtnText: { color: c.accent, fontSize: 13, fontWeight: '700', fontFamily: fonts.bold },
  profileCard: {
    backgroundColor: c.heroCardBg, marginHorizontal: 16, borderRadius: 20,
    paddingHorizontal: 22, paddingVertical: 24, marginTop: 16, marginBottom: 12,
  },
  heroTopRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  heroIdentity: { flexDirection: 'row', alignItems: 'center', gap: 12, flexShrink: 1, paddingRight: 10 },
  avatar: {
    width: 56, height: 56, borderRadius: 28,
    backgroundColor: c.accent, justifyContent: 'center', alignItems: 'center',
    borderWidth: 2, borderColor: 'rgba(255,255,255,0.15)',
  },
  avatarText: { color: c.surface, fontSize: 20, fontWeight: '800', fontFamily: fonts.extrabold },
  identityCol: { flexShrink: 1 },
  name: { color: '#fff', fontSize: 18, fontWeight: '700', fontFamily: fonts.bold },
  phone: { color: 'rgba(255,255,255,0.55)', fontSize: 13, marginTop: 2, fontFamily: fonts.medium },
  ringWrap: { width: 72, height: 72, justifyContent: 'center', alignItems: 'center' },
  ringCenter: { position: 'absolute', alignItems: 'center' },
  ringScore: { fontSize: 19, fontWeight: '800', fontFamily: fonts.extrabold, color: '#fff' },
  ringScoreSub: { fontSize: 8, color: 'rgba(255,255,255,0.45)', fontFamily: fonts.semibold, letterSpacing: 0.6, marginTop: 1 },
  heroFooterRow: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    marginTop: 20, paddingTop: 16, borderTopWidth: 1, borderTopColor: 'rgba(255,255,255,0.1)',
  },
  trustPill: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    backgroundColor: 'rgba(255,255,255,0.1)', borderRadius: 20,
    paddingHorizontal: 12, paddingVertical: 6,
  },
  trustPillDot: { width: 6, height: 6, borderRadius: 3 },
  trustPillText: { fontSize: 12, fontWeight: '700', fontFamily: fonts.bold },
  memberSinceText: { color: 'rgba(255,255,255,0.4)', fontSize: 11, fontFamily: fonts.medium },
  statsCard: {
    flexDirection: 'row', justifyContent: 'space-between',
    backgroundColor: c.surface, marginHorizontal: 16, borderRadius: 14,
    padding: 14, marginBottom: 12, borderWidth: 1, borderColor: c.border,
  },
  statItem: { alignItems: 'center', flex: 1 },
  statIconBox: {
    width: 34, height: 34, borderRadius: 10,
    justifyContent: 'center', alignItems: 'center', marginBottom: 6,
  },
  statDivider: { width: 1, backgroundColor: c.border, marginVertical: 4 },
  statValue: { color: c.dark, fontSize: 18, fontWeight: '800', fontFamily: fonts.extrabold },
  statLabel: { color: c.muted, fontSize: 10.5, marginTop: 2, textAlign: 'center', fontFamily: fonts.medium },
  badgesCard: {
    backgroundColor: c.surface, marginHorizontal: 16, borderRadius: 14,
    padding: 16, marginBottom: 12, borderWidth: 1, borderColor: c.border,
  },
  badgesTitle: { color: c.dark, fontSize: 15, fontWeight: '700', fontFamily: fonts.bold },
  badgesHeaderRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  badgesTitleRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  badgesGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginTop: 12 },
  badgeItem: {
    width: '30%', alignItems: 'center', padding: 12,
    borderRadius: 12, borderWidth: 1, borderColor: c.border,
    backgroundColor: c.bg,
  },
  badgeItemEarned: { borderColor: c.accent, backgroundColor: c.goldBgTint },
  badgeName: { fontSize: 10, fontWeight: '700', fontFamily: fonts.bold, color: c.muted, textAlign: 'center' },
  badgeNameEarned: { color: c.accent },
  badgeIconWrap: { marginBottom: 6 },
  card: {
    backgroundColor: c.surface, marginHorizontal: 16, borderRadius: 14,
    padding: 16, marginBottom: 12, borderWidth: 1, borderColor: c.border,
  },
  cardTitleRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 12 },
  cardTitle: { color: c.dark, fontSize: 15, fontWeight: '700', fontFamily: fonts.bold, marginBottom: 12 },
  detailRow: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: c.border,
  },
  detailIconBox: {
    width: 30, height: 30, borderRadius: 9,
    justifyContent: 'center', alignItems: 'center', marginRight: 10,
  },
  detailLabelRow: { flexDirection: 'row', alignItems: 'center', gap: 6, flex: 1 },
  detailLabel: { color: c.muted, fontSize: 13, fontFamily: fonts.medium },
  detailValue: { color: c.dark, fontSize: 13, fontWeight: '600', fontFamily: fonts.semibold },
  statGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  statCard: {
    width: '47%', backgroundColor: c.bg, borderRadius: 12,
    borderWidth: 1, borderColor: c.border, padding: 14,
  },
  statCardIconBox: {
    width: 34, height: 34, borderRadius: 10,
    justifyContent: 'center', alignItems: 'center', marginBottom: 8,
  },
  statCardValue: { fontSize: 17, fontWeight: '800', fontFamily: fonts.extrabold, color: c.dark },
  statCardLabel: { fontSize: 11, color: c.muted, marginTop: 2, fontFamily: fonts.medium },
  insightsHeader: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    marginHorizontal: 16, marginBottom: 12,
  },
  tabRow: { flexDirection: 'row', marginHorizontal: 16, marginBottom: 12 },
  tab: { flex: 1, padding: 12, alignItems: 'center', borderBottomWidth: 2, borderBottomColor: 'transparent' },
  activeTab: { borderBottomColor: c.accent },
  tabText: { color: c.muted, fontSize: 13, fontWeight: '600', fontFamily: fonts.semibold },
  activeTabText: { color: c.accent },
  recTitle: { color: c.accent, fontSize: 13, fontWeight: '700', fontFamily: fonts.bold, marginBottom: 8 },
  recText: { color: c.muted, fontSize: 13, marginBottom: 4, fontFamily: fonts.regular },
  adminBtn: {
    marginHorizontal: 16, marginTop: 8, padding: 16, borderRadius: 12,
    backgroundColor: c.buttonDark, alignItems: 'center', flexDirection: 'row', justifyContent: 'center',
  },
  adminBtnText: { color: c.buttonDarkText, fontSize: 14, fontWeight: '700', fontFamily: fonts.bold },
  appearanceSection: {
    marginHorizontal: 16, marginTop: 16, backgroundColor: c.surface,
    borderRadius: 14, padding: 16, borderWidth: 1, borderColor: c.border,
  },
  appearanceTitle: { fontSize: 14, fontWeight: '700', fontFamily: fonts.bold, color: c.dark, marginBottom: 12 },
  themeRow: { flexDirection: 'row', gap: 10 },
  themeBtn: {
    flex: 1, paddingVertical: 12, borderRadius: 10, alignItems: 'center',
    borderWidth: 1.5, borderColor: c.border, backgroundColor: c.bg,
  },
  themeBtnActive: { backgroundColor: c.buttonDark, borderColor: c.buttonDark },
  themeBtnText: { fontSize: 12, fontWeight: '600', fontFamily: fonts.semibold, color: c.muted },
  themeBtnTextActive: { color: c.buttonDarkText },
  logoutBtn: {
    marginHorizontal: 16, marginTop: 10, padding: 14, borderRadius: 12,
    borderWidth: 1, borderColor: c.border, alignItems: 'center',
    backgroundColor: c.surface, flexDirection: 'row', justifyContent: 'center',
  },
  logoutText: { color: c.danger, fontSize: 14, fontWeight: '700', fontFamily: fonts.bold },
  deleteAccountBtn: {
    marginHorizontal: 16, marginTop: 10, padding: 10, borderRadius: 12,
    alignItems: 'center', flexDirection: 'row', justifyContent: 'center',
  },
  deleteAccountText: { color: c.danger, fontSize: 12, fontWeight: '600', fontFamily: fonts.semibold, opacity: 0.75 },
  modalBg: { flex: 1, backgroundColor: 'rgba(0,0,0,0.6)', justifyContent: 'center', padding: 24 },
  modal: { backgroundColor: c.surface, borderRadius: 16, padding: 24, maxHeight: '80%' as const },
  modalTitle: { color: c.dark, fontSize: 20, fontWeight: '700', fontFamily: fonts.bold, textAlign: 'center', marginBottom: 16 },
  label: { color: c.muted, fontSize: 13, marginBottom: 6, marginTop: 12, fontFamily: fonts.medium },
  input: {
    backgroundColor: c.bg, borderRadius: 10, padding: 12,
    fontSize: 14, color: c.dark, borderWidth: 1, borderColor: c.border, fontFamily: fonts.regular,
  },
  inputDisabled: { color: c.muted, opacity: 0.6 },
  checkboxRow: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    marginTop: 16, padding: 12, borderRadius: 12,
    backgroundColor: c.goldBgTint, borderWidth: 1, borderColor: c.border,
  },
  checkbox: {
    width: 20, height: 20, borderRadius: 5,
    borderWidth: 2, borderColor: c.border,
    justifyContent: 'center', alignItems: 'center',
  },
  checkboxChecked: { backgroundColor: c.accent, borderColor: c.accent },
  checkboxLabel: { fontSize: 13, color: c.muted, flex: 1, fontFamily: fonts.regular },
  checkboxLabelChecked: { color: c.dark, fontWeight: '600', fontFamily: fonts.semibold },
  primaryBtn: { backgroundColor: c.buttonDark, borderRadius: 12, padding: 16, alignItems: 'center', marginTop: 20 },
  btnText: { color: c.buttonDarkText, fontSize: 15, fontWeight: '700', fontFamily: fonts.bold },
  cancelBtn: { padding: 14, alignItems: 'center', marginTop: 4 },
  cancelText: { color: c.muted, fontSize: 14, fontFamily: fonts.medium },
});

export default function ProfileScreen({ navigation }: Props) {
  const { colors, preference, setThemeOverride, resetToSystem } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const { showAlert } = useAppAlert();
  const { confirm } = useConfirmModal();
  const [deleting, setDeleting] = useState(false);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [badges, setBadges] = useState<Badge[]>([]);
  const [borrowerInsights, setBorrowerInsights] = useState<BorrowerInsights | null>(null);
  const [lenderInsights, setLenderInsights] = useState<LenderInsights | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [refreshing, setRefreshing] = useState<boolean>(false);
  const [activeTab, setActiveTab] = useState<string>('borrower');
  const [showBadges, setShowBadges] = useState<boolean>(false);
  const [showInsights, setShowInsights] = useState<boolean>(false);
  const [showEdit, setShowEdit] = useState<boolean>(false);
  const [editData, setEditData] = useState<EditData>({ firstName: '', lastName: '', email: '', momoProvider: '', momoNumber: '' });
  const [momoSameAsPhone, setMomoSameAsPhone] = useState<boolean>(false);
  const [momoNumberError, setMomoNumberError] = useState<string>('');
  const [saving, setSaving] = useState<boolean>(false);
  const { signOut } = useAuth();

  const loadData = async (): Promise<void> => {
    try {
      const [p, bi, li, badgesData] = await Promise.all([
        getProfile(),
        getBorrowerInsights().catch(() => null),
        getLenderInsights().catch(() => null),
        getBadges().catch(() => []),
      ]);
      setProfile(p as Profile);
      setBorrowerInsights(bi as BorrowerInsights | null);
      setLenderInsights(li as LenderInsights | null);
      setBadges(badgesData as Badge[]);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const { markFresh } = useFreshFocus(loadData);

  const handleEdit = async (): Promise<void> => {
    setMomoNumberError('');
    if (!momoSameAsPhone && editData.momoNumber && editData.momoNumber.length !== 10) {
      setMomoNumberError('MoMo number must be exactly 10 digits, or left empty'); return;
    }
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
    setMomoSameAsPhone(!!profile.momoNumber && profile.momoNumber === profile.phone);
    setMomoNumberError('');
    setShowEdit(true);
  };

  const handleMomoCheckbox = (): void => {
    const next = !momoSameAsPhone;
    setMomoSameAsPhone(next);
    if (next && profile) {
      setEditData({ ...editData, momoNumber: profile.phone });
    }
  };

  const getTrustColor = (s: number): string => s >= 70 ? colors.success : s >= 40 ? colors.accent : colors.danger;
  // Same thresholds/labels as the trust pill on HomeScreen, kept in sync so the
  // "standing" language reads the same wherever a user sees their trust score.
  const getTrustLabel = (s: number): string => s >= 75 ? 'Excellent' : s >= 50 ? 'Neutral' : 'Low';
  const earnedCount = badges.filter(b => b.earned).length;

  const handleDeleteAccount = async (): Promise<void> => {
    const ok = await confirm(
      'Delete Account',
      'This permanently signs you out and removes your name, email, and MoMo details from Vouch. Your trust score and loan history stay so other members\' records stay accurate, but you will never be able to log back in. This cannot be undone.\n\nIf you have any active loan or unsettled shared expense, this will be blocked until it\'s resolved.',
      'Delete My Account'
    );
    if (!ok) return;
    setDeleting(true);
    try {
      await deleteAccount();
      showAlert('success', 'Account Deleted', 'Your account has been deleted.');
      await signOut();
    } catch (e) {
      showAlert('error', 'Could Not Delete Account', (e as Error).message);
    } finally {
      setDeleting(false);
    }
  };

  const handleBorrowingStatusInfo = (): void => {
    showAlert(
      'success',
      'Borrowing Status Explained',
      '🟢 Active — You can borrow normally.\n\n🟡 Suspended — You have been temporarily banned from borrowing due to a loan default. This lasts 30 days.\n\n🔴 Permanently Banned — You have defaulted multiple times and can no longer borrow on Vouch.'
    );
  };

  if (loading) return <View style={styles.center}><ActivityIndicator size="large" color={colors.accent} /></View>;

  const editFields: [string, keyof EditData][] = [
    ['First Name', 'firstName'],
    ['Last Name', 'lastName'],
    ['Email', 'email'],
    ['MoMo Provider', 'momoProvider'],
  ];

  type IconName = keyof typeof Ionicons.glyphMap;
  const accountDetails: [string, string, IconName][] = [
    ['Email', profile?.email || 'Not set', 'mail-outline'],
    ['MoMo Provider', profile?.momoProvider || 'Not set', 'business-outline'],
    ['MoMo Number', profile?.momoNumber || 'Not set', 'call-outline'],
    ['Member Since', profile?.createdAt ? new Date(profile.createdAt).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' }) : '', 'calendar-outline'],
    ['Borrowing Status', profile?.permanentBan ? 'Permanently Banned' : profile?.borrowingSuspended ? 'Suspended' : 'Active', 'shield-outline'],
  ];

  return (
    <View style={styles.container}>
      <ScrollView refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); markFresh(); loadData(); }} tintColor={colors.accent} />}>

        {/* Header with Help button on the left */}
        <View style={styles.header}>
          <View style={styles.headerLeft}>
            <TouchableOpacity style={styles.helpBtn} onPress={() => navigation.navigate('Help')}>
              <Ionicons name="help-circle-outline" size={20} color={colors.accent} />
            </TouchableOpacity>
            <Text style={styles.title}>Profile</Text>
          </View>
          <TouchableOpacity style={styles.editBtn} onPress={openEdit}>
            <Ionicons name="create-outline" size={15} color={colors.accent} />
            <Text style={styles.editBtnText}>Edit</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.profileCard}>
          <View style={styles.heroTopRow}>
            <View style={styles.heroIdentity}>
              <View style={styles.avatar}>
                <Text style={styles.avatarText}>{profile?.firstName?.[0]}{profile?.lastName?.[0]}</Text>
              </View>
              <View style={styles.identityCol}>
                <Text style={styles.name} numberOfLines={1}>{profile?.firstName} {profile?.lastName}</Text>
                <Text style={styles.phone}>{profile?.phone}</Text>
              </View>
            </View>

            {/* Trust score as a ring gauge rather than a plain number, so the
                hero card reads as a purpose-built dashboard widget instead of
                a generic centered profile-card template. */}
            <View style={styles.ringWrap}>
              <Svg width={72} height={72} viewBox="0 0 72 72">
                <Circle cx={36} cy={36} r={30} stroke="rgba(255,255,255,0.15)" strokeWidth={6} fill="none" />
                <Circle
                  cx={36} cy={36} r={30}
                  stroke={getTrustColor(profile?.trustScore ?? 0)}
                  strokeWidth={6}
                  fill="none"
                  strokeLinecap="round"
                  strokeDasharray={`${2 * Math.PI * 30}`}
                  strokeDashoffset={`${2 * Math.PI * 30 * (1 - Math.min(Math.max(profile?.trustScore ?? 0, 0), 100) / 100)}`}
                  rotation={-90}
                  origin="36, 36"
                />
              </Svg>
              <View style={styles.ringCenter}>
                <Text style={styles.ringScore}>{profile?.trustScore?.toFixed(0)}</Text>
                <Text style={styles.ringScoreSub}>SCORE</Text>
              </View>
            </View>
          </View>

          <View style={styles.heroFooterRow}>
            <View style={styles.trustPill}>
              <View style={[styles.trustPillDot, { backgroundColor: getTrustColor(profile?.trustScore ?? 0) }]} />
              <Text style={[styles.trustPillText, { color: getTrustColor(profile?.trustScore ?? 0) }]}>
                {getTrustLabel(profile?.trustScore ?? 0)} standing
              </Text>
            </View>
            {profile?.createdAt && (
              <Text style={styles.memberSinceText}>
                Since {new Date(profile.createdAt).toLocaleDateString('en-GB', { month: 'short', year: 'numeric' })}
              </Text>
            )}
          </View>
        </View>

        <View style={styles.statsCard}>
          {([
            ['Lent', profile?.totalLoansGiven, 'cash-outline', colors.accent],
            ['Borrowed', profile?.totalLoansReceived, 'wallet-outline', colors.statusBlue],
            ['On Time', profile?.loansRepaidOnTime, 'checkmark-done-outline', colors.success],
            ['Defaults', profile?.defaults, 'close-circle-outline', colors.danger],
          ] as [string, number | undefined, keyof typeof Ionicons.glyphMap, string][]).map(([label, value, icon, color], i, arr) => (
            <React.Fragment key={label}>
              <View style={styles.statItem}>
                <View style={[styles.statIconBox, { backgroundColor: `${color}18` }]}>
                  <Ionicons name={icon} size={16} color={color} />
                </View>
                <Text style={styles.statValue}>{value || 0}</Text>
                <Text style={styles.statLabel}>{label}</Text>
              </View>
              {i < arr.length - 1 && <View style={styles.statDivider} />}
            </React.Fragment>
          ))}
        </View>

        {badges.length > 0 && (
          <View style={styles.badgesCard}>
            <TouchableOpacity style={styles.badgesHeaderRow} onPress={() => setShowBadges(!showBadges)} activeOpacity={0.7}>
              <View style={styles.badgesTitleRow}>
                <Ionicons name="ribbon-outline" size={17} color={colors.accent} />
                <Text style={styles.badgesTitle}>
                  Reputation Badges — {earnedCount}/{badges.length} earned
                </Text>
              </View>
              <Ionicons name={showBadges ? 'chevron-up' : 'chevron-down'} size={18} color={colors.muted} />
            </TouchableOpacity>
            {showBadges && (
              <View style={styles.badgesGrid}>
                {badges.map((badge) => (
                  <View key={badge.id} style={[styles.badgeItem, badge.earned && styles.badgeItemEarned]}>
                    <Ionicons
                      name={getBadgeIconName(badge.id, badge.earned)}
                      size={28}
                      color={badge.earned ? colors.accent : colors.muted}
                      style={styles.badgeIconWrap}
                    />
                    <Text style={[styles.badgeName, badge.earned && styles.badgeNameEarned]}>
                      {badge.name}
                    </Text>
                  </View>
                ))}
              </View>
            )}
          </View>
        )}

        <View style={styles.card}>
          <View style={styles.cardTitleRow}>
            <Ionicons name="person-circle-outline" size={17} color={colors.accent} />
            <Text style={[styles.cardTitle, { marginBottom: 0 }]}>Account Details</Text>
          </View>
          {accountDetails.map(([label, value, icon], i) => (
            <View key={i} style={[styles.detailRow, i === accountDetails.length - 1 && { borderBottomWidth: 0 }]}>
              <View style={styles.detailLabelRow}>
                <View style={[
                  styles.detailIconBox,
                  { backgroundColor: label === 'Borrowing Status' && value !== 'Active' ? colors.dangerBgTint : colors.goldBgTint },
                ]}>
                  <Ionicons name={icon} size={15} color={label === 'Borrowing Status' && value !== 'Active' ? colors.danger : colors.accent} />
                </View>
                <Text style={styles.detailLabel}>{label}</Text>
                {label === 'Borrowing Status' && (
                  <TouchableOpacity onPress={handleBorrowingStatusInfo} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                    <Ionicons name="information-circle-outline" size={16} color={colors.muted} />
                  </TouchableOpacity>
                )}
              </View>
              {/* Value */}
              <Text style={[
                styles.detailValue,
                label === 'Borrowing Status' && value !== 'Active' && { color: colors.danger },
              ]}>
                {value}
              </Text>
            </View>
          ))}
        </View>

        <TouchableOpacity style={styles.insightsHeader} onPress={() => setShowInsights(!showInsights)} activeOpacity={0.7}>
          <Text style={[styles.cardTitle, { marginBottom: 0 }]}>Insights</Text>
          <Ionicons name={showInsights ? 'chevron-up' : 'chevron-down'} size={18} color={colors.muted} />
        </TouchableOpacity>

        {showInsights && (
        <View style={styles.tabRow}>
          {['borrower', 'lender'].map((t) => (
            <TouchableOpacity key={t} style={[styles.tab, activeTab === t && styles.activeTab]} onPress={() => setActiveTab(t)}>
              <Text style={[styles.tabText, activeTab === t && styles.activeTabText]}>
                {t === 'borrower' ? 'Borrower Insights' : 'Lender Insights'}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
        )}

        {showInsights && activeTab === 'borrower' && borrowerInsights && (
          <View style={styles.card}>
            <View style={styles.statGrid}>
              {([
                ['Total Loans Taken', borrowerInsights.totalLoansTaken, 'document-text-outline', colors.accent],
                ['Active Loans', borrowerInsights.activeLoans, 'time-outline', colors.statusBlue],
                ['Total Borrowed', `GHS ${formatMoney(borrowerInsights.totalAmountBorrowed)}`, 'cash-outline', colors.dark],
                ['Interest Paid', `GHS ${formatMoney(borrowerInsights.totalInterestPaid)}`, 'trending-up-outline', colors.danger],
                ['Repayment Rate', `${borrowerInsights.repaymentRate}%`, 'checkmark-done-outline', colors.success],
                ['Avg Loan Size', `GHS ${formatMoney(borrowerInsights.averageLoanSize)}`, 'calculator-outline', colors.dark],
              ] as [string, string | number, keyof typeof Ionicons.glyphMap, string][]).map(([label, value, icon, color], i) => (
                <View key={i} style={styles.statCard}>
                  <View style={[styles.statCardIconBox, { backgroundColor: `${color}18` }]}>
                    <Ionicons name={icon} size={18} color={color} />
                  </View>
                  <Text style={styles.statCardValue}>{value}</Text>
                  <Text style={styles.statCardLabel}>{label}</Text>
                </View>
              ))}
            </View>
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

        {showInsights && activeTab === 'lender' && lenderInsights && (
          <View style={styles.card}>
            <View style={styles.statGrid}>
              {([
                ['Total Loans Given', lenderInsights.totalLoansGiven, 'document-text-outline', colors.accent],
                ['Active Loans', lenderInsights.activeLoans, 'time-outline', colors.statusBlue],
                ['Total Lent', `GHS ${formatMoney(lenderInsights.totalAmountLent)}`, 'cash-outline', colors.dark],
                ['Interest Earned', `GHS ${formatMoney(lenderInsights.totalInterestEarned)}`, 'trending-up-outline', colors.success],
                ['Return Rate', `${lenderInsights.returnRate}%`, 'checkmark-done-outline', colors.success],
                ['Amount At Risk', `GHS ${formatMoney(lenderInsights.totalAmountAtRisk)}`, 'warning-outline', colors.danger],
              ] as [string, string | number, keyof typeof Ionicons.glyphMap, string][]).map(([label, value, icon, color], i) => (
                <View key={i} style={styles.statCard}>
                  <View style={[styles.statCardIconBox, { backgroundColor: `${color}18` }]}>
                    <Ionicons name={icon} size={18} color={color} />
                  </View>
                  <Text style={styles.statCardValue}>{value}</Text>
                  <Text style={styles.statCardLabel}>{label}</Text>
                </View>
              ))}
            </View>
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
          <TouchableOpacity style={styles.adminBtn} onPress={() => navigation.navigate('Admin')}>
            <Ionicons name="shield-checkmark-outline" size={18} color={colors.buttonDarkText} style={{ marginRight: 8 }} />
            <Text style={styles.adminBtnText}>Admin Panel — Open Disputes</Text>
          </TouchableOpacity>
        )}

        <View style={styles.appearanceSection}>
          <Text style={styles.appearanceTitle}>Appearance</Text>
          <View style={styles.themeRow}>
            {(['system', 'light', 'dark'] as const).map((opt) => (
              <TouchableOpacity
                key={opt}
                style={[styles.themeBtn, preference === opt && styles.themeBtnActive]}
                onPress={() => opt === 'system' ? resetToSystem() : setThemeOverride(opt)}
              >
                <Ionicons
                  name={opt === 'system' ? 'phone-portrait-outline' : opt === 'light' ? 'sunny-outline' : 'moon-outline'}
                  size={16}
                  color={preference === opt ? colors.buttonDarkText : colors.muted}
                  style={{ marginBottom: 4 }}
                />
                <Text style={[styles.themeBtnText, preference === opt && styles.themeBtnTextActive]}>
                  {opt.charAt(0).toUpperCase() + opt.slice(1)}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        <TouchableOpacity style={styles.logoutBtn} onPress={signOut}>
          <Ionicons name="log-out-outline" size={16} color={colors.danger} style={{ marginRight: 6 }} />
          <Text style={styles.logoutText}>Log Out</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.deleteAccountBtn, deleting && { opacity: 0.6 }]}
          onPress={handleDeleteAccount}
          disabled={deleting}
        >
          {deleting ? (
            <ActivityIndicator size="small" color={colors.danger} />
          ) : (
            <>
              <Ionicons name="trash-outline" size={14} color={colors.danger} style={{ marginRight: 6 }} />
              <Text style={styles.deleteAccountText}>Delete Account</Text>
            </>
          )}
        </TouchableOpacity>

        <View style={{ height: 40 }} />
      </ScrollView>

      <Modal visible={showEdit} animationType="slide" transparent onRequestClose={() => setShowEdit(false)}>
        <TouchableWithoutFeedback onPress={() => setShowEdit(false)}>
        <View style={styles.modalBg}>
          <TouchableWithoutFeedback onPress={() => {}}>
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

            <TouchableOpacity style={styles.checkboxRow} onPress={handleMomoCheckbox} activeOpacity={0.7}>
              <View style={[styles.checkbox, momoSameAsPhone && styles.checkboxChecked]}>
                {momoSameAsPhone && <Ionicons name="checkmark" size={13} color={colors.surface} />}
              </View>
              <Text style={[styles.checkboxLabel, momoSameAsPhone && styles.checkboxLabelChecked]}>
                My MoMo number is the same as my phone number
              </Text>
            </TouchableOpacity>

            <Text style={styles.label}>MoMo Number</Text>
            <TextInput
              style={[styles.input, momoSameAsPhone && styles.inputDisabled]}
              value={editData.momoNumber}
              onChangeText={(t) => { setEditData({ ...editData, momoNumber: t.replace(/[^0-9]/g, '').slice(0, 10) }); setMomoNumberError(''); }}
              keyboardType="phone-pad"
              editable={!momoSameAsPhone}
              placeholderTextColor={colors.muted}
            />
            {momoNumberError !== '' && <Text style={{ color: colors.errorRed, fontSize: 13, marginTop: 6 }}>{momoNumberError}</Text>}

            <TouchableOpacity style={[styles.primaryBtn, saving && { opacity: 0.6 }]} onPress={handleEdit} disabled={saving}>
              {saving ? <ActivityIndicator color={colors.buttonDarkText} /> : <Text style={styles.btnText}>Save Changes</Text>}
            </TouchableOpacity>
            <TouchableOpacity style={styles.cancelBtn} onPress={() => setShowEdit(false)}>
              <Text style={styles.cancelText}>Cancel</Text>
            </TouchableOpacity>
          </View>
          </TouchableWithoutFeedback>
        </View>
        </TouchableWithoutFeedback>
      </Modal>
    </View>
  );
}
