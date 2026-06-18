



import React, { useState, useCallback } from 'react';
import {
  View, Text, StyleSheet, ScrollView,
  TouchableOpacity, ActivityIndicator, RefreshControl, LayoutAnimation,
  Platform, UIManager,
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { Ionicons } from '@expo/vector-icons';
import Svg from 'react-native-svg';
const { Circle } = require('react-native-svg');
import {
  getProfile, getMyCircles, getUnreadCount,
  getMyBorrowedLoans, getMyLentLoans,
} from '../services/api';
import { useAuth } from '../context/AuthContext';
import { RootStackParamList } from '../navigation/AppNavigator';

if (Platform.OS === 'android' && UIManager.setLayoutAnimationEnabledExperimental) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}

type Props = {
  navigation: NativeStackNavigationProp<RootStackParamList>;
};

interface Profile {
  firstName: string;
  lastName: string;
  trustScore: number;
  totalLoansGiven: number;
  totalLoansReceived: number;
  loansRepaidOnTime: number;
  defaults: number;
}

interface Circle {
  id: number;
  name: string;
  memberCount: number;
  maxLoanAmount: number;
}

interface Loan {
  id: number;
  amount: number;
  status: string;
  borrowerName: string;
  lenderName?: string;
  circleName: string;
  totalRepaymentAmount: number;
  amountRepaid: number;
  overdueInterestAccrued: number;
  createdAt: string;
}

const BG = '#EDEEF2';
const WHITE = '#FFFFFF';
const DARK = '#0f172a';
const CARD = '#0f172a';
const MUTED = '#6B7280';
const BORDER = '#E5E7EB';
const GOLD = '#D4A017'; // trust score ring only
const ACCENT = '#C9A84C';
const RING_BG = '#394856';
const SUCCESS = '#16a34a';
const DANGER = '#dc2626';
const WARNING = '#d97706';
const ACTIVE_STATUSES = ['ACTIVE', 'DUE', 'GRACE_PERIOD'];

export default function HomeScreen({ navigation }: Props) {
  const [profile, setProfile] = useState<Profile | null>(null);
  const [circles, setCircles] = useState<Circle[]>([]);
  const [unreadCount, setUnreadCount] = useState<number>(0);
  const [borrowedLoans, setBorrowedLoans] = useState<Loan[]>([]);
  const [lentLoans, setLentLoans] = useState<Loan[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [refreshing, setRefreshing] = useState<boolean>(false);
  const [amountsVisible, setAmountsVisible] = useState<boolean>(false);
  const [activityExpanded, setActivityExpanded] = useState<boolean>();
  const { signOut } = useAuth();

  const loadData = async (): Promise<void> => {
    try {
      const [profileData, circlesData, notifData, borrowed, lent] = await Promise.all([
        getProfile(),
        getMyCircles(),
        getUnreadCount(),
        getMyBorrowedLoans(),
        getMyLentLoans(),
      ]);
      setProfile(profileData as Profile);
      setCircles(circlesData as Circle[]);
      setUnreadCount((notifData as { unreadCount: number }).unreadCount || 0);
      setBorrowedLoans(borrowed as Loan[]);
      setLentLoans(lent as Loan[]);
    } catch (error) {
      console.error('Error loading data:', error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useFocusEffect(useCallback(() => { loadData(); }, []));

  const toggleActivity = () => {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    setActivityExpanded(prev => !prev);
  };

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={ACCENT} />
      </View>
    );
  }

  const score = profile?.trustScore ?? 0;
  const radius = 22;
  const circumference = 2 * Math.PI * radius;
  const strokeDashoffset = circumference - (score / 100) * circumference;

  const getTrustColor = (s: number) => s >= 75 ? SUCCESS : s >= 50 ? GOLD : DANGER;
  const getTrustLabel = (s: number) => s >= 75 ? 'Excellent' : s >= 50 ? 'Neutral' : 'Low';

  const totalOwed = borrowedLoans
    .filter(l => ACTIVE_STATUSES.includes(l.status))
    .reduce((sum, l) => sum + (l.totalRepaymentAmount + l.overdueInterestAccrued - l.amountRepaid), 0);

  const totalOwedToYou = lentLoans
    .filter(l => ACTIVE_STATUSES.includes(l.status))
    .reduce((sum, l) => sum + (l.totalRepaymentAmount + l.overdueInterestAccrued - l.amountRepaid), 0);

  const recentActivity: (Loan & { role: 'borrower' | 'lender' })[] = [
    ...borrowedLoans.map(l => ({ ...l, role: 'borrower' as const })),
    ...lentLoans.map(l => ({ ...l, role: 'lender' as const })),
  ]
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
    .slice(0, 5);

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'ACTIVE': return SUCCESS;
      case 'DUE': return WARNING;
      case 'GRACE_PERIOD': return DANGER;
      case 'REPAID': return SUCCESS;
      case 'DEFAULTED': return DANGER;
      case 'REQUESTED': return GOLD;
      default: return MUTED;
    }
  };

  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr);
    const now = new Date();
    const diff = Math.floor((now.getTime() - date.getTime()) / (1000 * 60 * 60 * 24));
    if (diff === 0) return 'Today';
    if (diff === 1) return 'Yesterday';
    if (diff < 7) return `${diff}d ago`;
    return date.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });
  };

  const maskAmount = '••••••';
  const getGreeting = (): string => {
  const hour = new Date().getHours();
    if (hour < 12) return 'Good morning';
    if (hour < 17) return 'Good afternoon';
    return 'Good evening';
  };
  return (
    <ScrollView
      style={styles.container}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); loadData(); }} tintColor={ACCENT} />}
      showsVerticalScrollIndicator={false}
    >
      {/* Header */}
      <View style={styles.header}>
        <View>
          <Text style={styles.greeting}>{getGreeting()}</Text>
          <Text style={styles.name}>{profile?.firstName} {profile?.lastName}</Text>
        </View>
        <TouchableOpacity style={styles.bellBtn} onPress={() => navigation.navigate('Notifications')}>
          <Ionicons name="notifications-outline" size={20} color={DARK} />
          {unreadCount > 0 && (
            <View style={styles.badge}>
              <Text style={styles.badgeText}>{unreadCount}</Text>
            </View>
          )}
        </TouchableOpacity>
      </View>

      {/* Dark Financial Card */}
      <View style={styles.heroCard}>

        {/* Eye toggle */}
        <TouchableOpacity
          style={styles.eyeBtn}
          onPress={() => setAmountsVisible(v => !v)}
        >
          <Ionicons
            name={amountsVisible ? 'eye-outline' : 'eye-off-outline'}
            size={18}
            color="#94a3b8"
          />
          <Text style={styles.eyeText}>{amountsVisible ? 'Hide balances' : 'Show balances'}</Text>
        </TouchableOpacity>

        {/* Amounts */}
        <View style={styles.amountsRow}>
          <View style={styles.amountItem}>
            <Text style={styles.amountLabel}>You are owed</Text>
            <Text style={[styles.amountValue, { color: '#4ade80' }]}>
              {amountsVisible ? `GHS ${totalOwedToYou.toFixed(2)}` : maskAmount}
            </Text>
            <Text style={styles.amountSub}>
              {lentLoans.filter(l => ACTIVE_STATUSES.includes(l.status)).length} active
            </Text>
          </View>

          <View style={styles.amountDivider} />

          <View style={styles.amountItem}>
            <Text style={styles.amountLabel}>You owe</Text>
            <Text style={[styles.amountValue, { color: totalOwed > 0 ? '#f87171' : '#94a3b8' }]}>
              {amountsVisible ? `GHS ${totalOwed.toFixed(2)}` : maskAmount}
            </Text>
            <Text style={styles.amountSub}>
              {borrowedLoans.filter(l => ACTIVE_STATUSES.includes(l.status)).length} active
            </Text>
          </View>
        </View>

        {/* Trust Score inside hero card */}
        <View style={styles.trustSection}>
          <View style={styles.trustTextCol}>
            <Text style={styles.trustHeading}>Trust Score</Text>
            <View style={styles.trustPill}>
              <View style={[styles.pillDot, { backgroundColor: getTrustColor(score) }]} />
              <Text style={[styles.pillText, { color: getTrustColor(score) }]}>
                {getTrustLabel(score)} standing
              </Text>
            </View>
            <View style={styles.progressBg}>
              <View style={[styles.progressFill, {
                width: `${score}%` as any,
                backgroundColor: getTrustColor(score),
              }]} />
            </View>
          </View>

          <View style={styles.ringWrapper}>
            <Svg width={64} height={64} style={{ transform: [{ rotate: '-90deg' }] }}>
              <Circle cx="32" cy="32" r={radius} fill="none" stroke={RING_BG} strokeWidth="6" />
              <Circle
                cx="32" cy="32" r={radius}
                fill="none" stroke={getTrustColor(score)} strokeWidth="6"
                strokeDasharray={circumference}
                strokeDashoffset={strokeDashoffset}
                strokeLinecap="round"
              />
            </Svg>
            <Text style={styles.ringText}>{score.toFixed(0)}</Text>
          </View>
        </View>

        {/* Stats row */}
        <View style={styles.statsRow}>
          {[
            { label: 'Lent', value: profile?.totalLoansGiven ?? 0 },
            { label: 'Borrowed', value: profile?.totalLoansReceived ?? 0 },
            { label: 'On Time', value: profile?.loansRepaidOnTime ?? 0 },
            { label: 'Defaults', value: profile?.defaults ?? 0 },
          ].map((s, i) => (
            <View key={i} style={[styles.statItem, i < 3 && styles.statDivider]}>
              <Text style={styles.statVal}>{s.value}</Text>
              <Text style={styles.statLbl}>{s.label}</Text>
            </View>
          ))}
        </View>
      </View>

      {/* Recent Activity — Collapsible */}
      <TouchableOpacity style={styles.activityHeader} onPress={toggleActivity} activeOpacity={0.7}>
        <Text style={styles.sectionLabel}>RECENT ACTIVITY</Text>
        <View style={styles.activityToggle}>
          {recentActivity.length > 0 && (
            <View style={styles.activityBadge}>
              <Text style={styles.activityBadgeText}>{recentActivity.length}</Text>
            </View>
          )}
          <Ionicons
            name={activityExpanded ? 'chevron-up' : 'chevron-down'}
            size={16}
            color={MUTED}
          />
        </View>
      </TouchableOpacity>

      {activityExpanded && (
        <View style={styles.activityList}>
          {recentActivity.length === 0 ? (
            <View style={styles.emptyCard}>
              <Ionicons name="receipt-outline" size={28} color={MUTED} />
              <Text style={styles.emptyText}>No activity yet</Text>
            </View>
          ) : (
            recentActivity.map((loan, i) => (
              <TouchableOpacity
                key={`${loan.role}-${loan.id}-${i}`}
                style={styles.activityCard}
                onPress={() => navigation.navigate('LoanDetail', { loanId: loan.id })}
              >
                <View style={[styles.activityIconBox, {
                  backgroundColor: loan.role === 'lender' ? '#f0fdf4' : '#fef2f2'
                }]}>
                  <Ionicons
                    name={loan.role === 'lender' ? 'arrow-up-outline' : 'arrow-down-outline'}
                    size={18}
                    color={loan.role === 'lender' ? SUCCESS : DANGER}
                  />
                </View>
                <View style={styles.activityInfo}>
                  <Text style={styles.activityTitle} numberOfLines={1}>
                    {loan.role === 'lender'
                      ? `Lent to ${loan.borrowerName}`
                      : `Borrowed from ${loan.lenderName || 'Pending'}`}
                  </Text>
                  <Text style={styles.activitySub}>
                    {loan.circleName} · {formatDate(loan.createdAt)}
                  </Text>
                </View>
                <View style={styles.activityRight}>
                  <Text style={[styles.activityAmount, {
                    color: loan.role === 'lender' ? SUCCESS : DANGER
                  }]}>
                    {loan.role === 'lender' ? '+' : '-'}GHS {loan.amount}
                  </Text>
                  <View style={[styles.statusPill, {
                    backgroundColor: `${getStatusColor(loan.status)}18`
                  }]}>
                    <Text style={[styles.statusText, { color: getStatusColor(loan.status) }]}>
                      {loan.status.replace(/_/g, ' ')}
                    </Text>
                  </View>
                </View>
              </TouchableOpacity>
            ))
          )}
        </View>
      )}

      {/* My Circles */}
      <View style={styles.sectionRow}>
        <Text style={styles.sectionLabel}>MY CIRCLES</Text>
        <TouchableOpacity onPress={() => navigation.navigate('Main')}>
          <Text style={styles.seeAll}>See all</Text>
        </TouchableOpacity>
      </View>

      {circles.length === 0 ? (
        <View style={styles.emptyCard}>
          <Ionicons name="people-outline" size={28} color={MUTED} />
          <Text style={styles.emptyText}>No circles yet</Text>
          <Text style={styles.emptySubText}>Create a circle to start lending</Text>
        </View>
      ) : (
        <View style={styles.circleList}>
          {circles.slice(0, 3).map((circle) => (
            <TouchableOpacity
              key={circle.id}
              style={styles.circleCard}
              onPress={() => navigation.navigate('CircleDetail', { circleId: circle.id })}
            >
              <View style={styles.circleLeft}>
                <View style={styles.circleIconBox}>
                  <Ionicons name="people-outline" size={18} color={ACCENT} />
                </View>
                <View>
                  <Text style={styles.circleName}>{circle.name}</Text>
                  <Text style={styles.circleMeta}>
                    {circle.memberCount} members · GHS {circle.maxLoanAmount?.toLocaleString()} max
                  </Text>
                </View>
              </View>
              <Ionicons name="chevron-forward" size={15} color={MUTED} />
            </TouchableOpacity>
          ))}
        </View>
      )}

      <TouchableOpacity style={styles.logoutBtn} onPress={signOut}>
        <Ionicons name="log-out-outline" size={15} color={DANGER} style={{ marginRight: 6 }} />
        <Text style={styles.logoutText}>Log Out</Text>
      </TouchableOpacity>

      <View style={{ height: 40 }} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: BG },
  loadingContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: BG },

  header: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    backgroundColor: WHITE, paddingHorizontal: 20, paddingTop: 56, paddingBottom: 16,
    borderBottomWidth: 1, borderBottomColor: BORDER,
  },
  greeting: { fontSize: 13, color: MUTED },
  name: { fontSize: 22, fontWeight: '700', color: DARK, letterSpacing: -0.3, marginTop: 2 },
  bellBtn: {
    width: 40, height: 40, borderRadius: 12,
    backgroundColor: BG, justifyContent: 'center', alignItems: 'center',
    borderWidth: 1, borderColor: BORDER,
  },
  badge: {
    position: 'absolute', top: -2, right: -2,
    width: 16, height: 16, backgroundColor: DANGER,
    borderRadius: 8, borderWidth: 2, borderColor: WHITE,
    justifyContent: 'center', alignItems: 'center',
  },
  badgeText: { fontSize: 8, color: WHITE, fontWeight: '800' },

  heroCard: {
    backgroundColor: CARD, marginHorizontal: 16, marginTop: 16,
    borderRadius: 20, overflow: 'hidden',
  },
  eyeBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    paddingHorizontal: 20, paddingTop: 18, paddingBottom: 4,
  },
  eyeText: { fontSize: 12, color: '#94a3b8', fontWeight: '500' },

  amountsRow: {
    flexDirection: 'row', paddingHorizontal: 20, paddingVertical: 16,
  },
  amountItem: { flex: 1 },
  amountLabel: { fontSize: 12, color: '#64748b', fontWeight: '500', marginBottom: 6 },
  amountValue: { fontSize: 22, fontWeight: '800', letterSpacing: -0.5 },
  amountSub: { fontSize: 11, color: '#64748b', marginTop: 4 },
  amountDivider: { width: 1, backgroundColor: '#1e293b', marginHorizontal: 16 },

  trustSection: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    borderTopWidth: 1, borderTopColor: '#1e293b',
    paddingHorizontal: 20, paddingVertical: 16,
  },
  trustTextCol: { flex: 1, marginRight: 16 },
  trustHeading: { fontSize: 11, color: '#64748b', fontWeight: '700', letterSpacing: 0.8, marginBottom: 6 },
  trustPill: { flexDirection: 'row', alignItems: 'center', gap: 5, marginBottom: 10 },
  pillDot: { width: 7, height: 7, borderRadius: 4 },
  pillText: { fontSize: 13, fontWeight: '700' },
  progressBg: { height: 4, backgroundColor: RING_BG, borderRadius: 4, overflow: 'hidden' },
  progressFill: { height: '100%', borderRadius: 4 },
  ringWrapper: { width: 64, height: 64, justifyContent: 'center', alignItems: 'center' },
  ringText: { position: 'absolute', fontSize: 13, fontWeight: '800', color: WHITE },

  statsRow: {
    flexDirection: 'row', borderTopWidth: 1, borderTopColor: '#1e293b',
  },
  statItem: { flex: 1, paddingVertical: 14, alignItems: 'center' },
  statDivider: { borderRightWidth: 1, borderRightColor: '#1e293b' },
  statVal: { fontSize: 17, fontWeight: '800', color: WHITE },
  statLbl: { fontSize: 10, color: '#64748b', fontWeight: '600', marginTop: 2 },

  activityHeader: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    marginHorizontal: 16, marginTop: 24, marginBottom: 10,
    backgroundColor: WHITE, borderRadius: 12, padding: 14,
    borderWidth: 1, borderColor: BORDER,
  },
  activityToggle: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  activityBadge: {
    backgroundColor: ACCENT, borderRadius: 10, width: 20, height: 20,
    justifyContent: 'center', alignItems: 'center',
  },
  activityBadgeText: { fontSize: 10, fontWeight: '800', color: WHITE },

  activityList: { marginHorizontal: 16, gap: 8, marginBottom: 8 },
  activityCard: {
    backgroundColor: WHITE, borderRadius: 14, padding: 14,
    flexDirection: 'row', alignItems: 'center', gap: 12,
    borderWidth: 1, borderColor: BORDER,
  },
  activityIconBox: { width: 40, height: 40, borderRadius: 12, justifyContent: 'center', alignItems: 'center' },
  activityInfo: { flex: 1 },
  activityTitle: { fontSize: 14, fontWeight: '600', color: DARK },
  activitySub: { fontSize: 11, color: MUTED, marginTop: 2 },
  activityRight: { alignItems: 'flex-end', gap: 4 },
  activityAmount: { fontSize: 14, fontWeight: '700' },
  statusPill: { borderRadius: 6, paddingHorizontal: 6, paddingVertical: 2 },
  statusText: { fontSize: 10, fontWeight: '700' },

  sectionRow: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    marginHorizontal: 16, marginTop: 20, marginBottom: 10,
  },
  sectionLabel: { fontSize: 11, fontWeight: '700', color: MUTED, letterSpacing: 0.8 },
  seeAll: { fontSize: 12, color: ACCENT, fontWeight: '700' },

  circleList: { marginHorizontal: 16, gap: 8 },
  circleCard: {
    backgroundColor: WHITE, borderRadius: 14, padding: 14,
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    borderWidth: 1, borderColor: BORDER,
  },
  circleLeft: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  circleIconBox: {
    width: 40, height: 40, borderRadius: 12,
    backgroundColor: BG, justifyContent: 'center', alignItems: 'center',
    borderWidth: 1, borderColor: BORDER,
  },
  circleName: { fontSize: 14, fontWeight: '600', color: DARK },
  circleMeta: { fontSize: 11, color: MUTED, marginTop: 2 },

  emptyCard: {
    backgroundColor: WHITE, marginHorizontal: 16, borderRadius: 14,
    padding: 24, alignItems: 'center', borderWidth: 1, borderColor: BORDER,
  },
  emptyText: { fontSize: 14, fontWeight: '600', color: DARK, marginTop: 10, marginBottom: 4 },
  emptySubText: { fontSize: 12, color: MUTED, textAlign: 'center' },

  logoutBtn: {
    marginHorizontal: 16, marginTop: 20, padding: 14, borderRadius: 12,
    borderWidth: 1, borderColor: BORDER, alignItems: 'center',
    backgroundColor: WHITE, flexDirection: 'row', justifyContent: 'center',
  },
  logoutText: { color: DANGER, fontSize: 14, fontWeight: '700' },
});