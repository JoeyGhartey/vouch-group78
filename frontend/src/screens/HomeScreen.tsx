import React, { useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  RefreshControl,
  Dimensions,
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { getProfile, getMyCircles, getUnreadCount } from '../services/api';
import { useAuth } from '../context/AuthContext';
import { RootStackParamList } from '../navigation/AppNavigator';

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

const BLUE = '#1d4ed8';
const DARK = '#0f172a';
const CARD_BG = '#0f172a';
const SURFACE = '#fff';
const BG = '#f0f4f8';
const MUTED = '#94a3b8';
const BORDER = '#e2e8f0';

export default function HomeScreen({ navigation }: Props) {
  const [profile, setProfile] = useState<Profile | null>(null);
  const [circles, setCircles] = useState<Circle[]>([]);
  const [unreadCount, setUnreadCount] = useState<number>(0);
  const [loading, setLoading] = useState<boolean>(true);
  const [refreshing, setRefreshing] = useState<boolean>(false);
  const { signOut } = useAuth();

  const loadData = async (): Promise<void> => {
    try {
      const [profileData, circlesData, notifData] = await Promise.all([
        getProfile(),
        getMyCircles(),
        getUnreadCount(),
      ]);
      setProfile(profileData as Profile);
      setCircles(circlesData as Circle[]);
      setUnreadCount((notifData as { unreadCount: number }).unreadCount || 0);
    } catch (error) {
      console.error('Error loading data:', error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useFocusEffect(useCallback(() => { loadData(); }, []));

  const onRefresh = (): void => {
    setRefreshing(true);
    loadData();
  };

  const getTrustLabel = (score: number): { label: string; color: string } => {
    if (score >= 75) return { label: 'Excellent standing', color: '#22c55e' };
    if (score >= 50) return { label: 'Neutral standing', color: '#f59e0b' };
    return { label: 'Low standing', color: '#ef4444' };
  };

  const circleIconColor = (index: number): { bg: string; icon: string } => {
    const colors = [
      { bg: '#eff6ff', icon: BLUE },
      { bg: '#f0fdf4', icon: '#15803d' },
      { bg: '#faf5ff', icon: '#7c3aed' },
      { bg: '#fff7ed', icon: '#c2410c' },
    ];
    return colors[index % colors.length];
  };

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={BLUE} />
      </View>
    );
  }

  const score = profile?.trustScore ?? 0;
  const trustInfo = getTrustLabel(score);
  const circumference = 2 * Math.PI * 27;
  const strokeDashoffset = circumference - (score / 100) * circumference;

  return (
    <ScrollView
      style={styles.container}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={BLUE} />}
      showsVerticalScrollIndicator={false}
    >
      {/* Header */}
      <View style={styles.header}>
        <View>
          <Text style={styles.greeting}>Welcome back</Text>
          <Text style={styles.name}>{profile?.firstName} {profile?.lastName}</Text>
        </View>
        <TouchableOpacity
          style={styles.bellWrapper}
          onPress={() => navigation.navigate('Notifications')}
        >
          <Text style={styles.bellIcon}>🔔</Text>
          {unreadCount > 0 && (
            <View style={styles.badge}>
              <Text style={styles.badgeText}>{unreadCount}</Text>
            </View>
          )}
        </TouchableOpacity>
      </View>

      {/* Trust Score Card */}
      <View style={styles.scoreCard}>
        <View style={styles.scoreCardTop}>
          <View style={styles.scoreLeft}>
            <Text style={styles.scoreLabelText}>TRUST SCORE</Text>
            <View style={styles.scoreValueRow}>
              <Text style={styles.scoreNumber}>{score.toFixed(0)}</Text>
              <Text style={styles.scoreMax}>/100</Text>
            </View>
            <View style={styles.standingPill}>
              <View style={[styles.standingDot, { backgroundColor: trustInfo.color }]} />
              <Text style={styles.standingText}>{trustInfo.label}</Text>
            </View>
          </View>

          {/* Circular progress */}
          <View style={styles.circleProgress}>
            <svg viewBox="0 0 64 64" width="64" height="64" style={{ transform: 'rotate(-90deg)' } as any}>
              <circle cx="32" cy="32" r="27" fill="none" stroke="#1e293b" strokeWidth="7" />
              <circle
                cx="32" cy="32" r="27" fill="none"
                stroke="#3b82f6" strokeWidth="7"
                strokeDasharray={`${circumference}`}
                strokeDashoffset={`${strokeDashoffset}`}
                strokeLinecap="round"
              />
            </svg>
            <Text style={styles.circleText}>{score.toFixed(0)}%</Text>
          </View>
        </View>

        {/* Progress bar */}
        <View style={styles.progressBarBg}>
          <View style={[styles.progressBarFill, { width: `${score}%` as any }]} />
        </View>

        {/* Stats */}
        <View style={styles.statsRow}>
          {[
            { label: 'LENT', value: profile?.totalLoansGiven ?? 0, color: '#fff' },
            { label: 'BORROWED', value: profile?.totalLoansReceived ?? 0, color: '#fff' },
            { label: 'ON TIME', value: profile?.loansRepaidOnTime ?? 0, color: '#22c55e' },
            { label: 'DEFAULTS', value: profile?.defaults ?? 0, color: '#f87171' },
          ].map((stat, i) => (
            <View key={i} style={[styles.statItem, i < 3 && styles.statBorder]}>
              <Text style={[styles.statValue, { color: stat.color }]}>{stat.value}</Text>
              <Text style={styles.statLabel}>{stat.label}</Text>
            </View>
          ))}
        </View>
      </View>

      {/* Quick Actions */}
      <Text style={styles.sectionLabel}>QUICK ACTIONS</Text>
      <View style={styles.actionsRow}>
        {[
          { label: 'Circles', icon: '👥', bg: '#eff6ff', onPress: () => navigation.navigate('Main') },
          { label: 'My Loans', icon: '💳', bg: '#f0fdf4', onPress: () => navigation.navigate('Main') },
          { label: 'Expenses', icon: '📊', bg: '#faf5ff', onPress: () => navigation.navigate('Main') },
        ].map((action, i) => (
          <TouchableOpacity key={i} style={styles.actionCard} onPress={action.onPress}>
            <View style={[styles.actionIconBox, { backgroundColor: action.bg }]}>
              <Text style={styles.actionIcon}>{action.icon}</Text>
            </View>
            <Text style={styles.actionLabel}>{action.label}</Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* My Circles */}
      <View style={styles.sectionHeader}>
        <Text style={styles.sectionLabel}>MY CIRCLES</Text>
        <TouchableOpacity onPress={() => navigation.navigate('Main')}>
          <Text style={styles.seeAll}>See all →</Text>
        </TouchableOpacity>
      </View>

      {circles.length === 0 ? (
        <View style={styles.emptyCard}>
          <Text style={styles.emptyIcon}>👥</Text>
          <Text style={styles.emptyTitle}>No circles yet</Text>
          <Text style={styles.emptySubtext}>Create a circle to start lending with friends</Text>
          <TouchableOpacity style={styles.emptyBtn} onPress={() => navigation.navigate('Main')}>
            <Text style={styles.emptyBtnText}>Create Circle</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <View style={styles.circleList}>
          {circles.slice(0, 4).map((circle, i) => {
            const colors = circleIconColor(i);
            return (
              <TouchableOpacity
                key={circle.id}
                style={styles.circleCard}
                onPress={() => navigation.navigate('CircleDetail', { circleId: circle.id })}
              >
                <View style={styles.circleCardLeft}>
                  <View style={[styles.circleIconBox, { backgroundColor: colors.bg }]}>
                    <Text style={styles.circleIcon}>👥</Text>
                  </View>
                  <View>
                    <Text style={styles.circleName}>{circle.name}</Text>
                    <Text style={styles.circleMeta}>{circle.memberCount} members · GHS {circle.maxLoanAmount?.toLocaleString()} max</Text>
                  </View>
                </View>
                <View style={styles.chevronBox}>
                  <Text style={styles.chevron}>›</Text>
                </View>
              </TouchableOpacity>
            );
          })}
        </View>
      )}

      {/* Log out */}
      <TouchableOpacity style={styles.logoutBtn} onPress={signOut}>
        <Text style={styles.logoutText}>Log Out</Text>
      </TouchableOpacity>

      <View style={{ height: 40 }} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: BG },
  loadingContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: BG },

  // Header
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', backgroundColor: SURFACE, paddingHorizontal: 24, paddingTop: 60, paddingBottom: 20 },
  greeting: { fontSize: 13, color: MUTED, fontWeight: '400' },
  name: { fontSize: 24, fontWeight: '700', color: DARK, letterSpacing: -0.5, marginTop: 3 },
  bellWrapper: { width: 42, height: 42, borderRadius: 14, backgroundColor: '#eff6ff', justifyContent: 'center', alignItems: 'center' },
  bellIcon: { fontSize: 20 },
  badge: { position: 'absolute', top: -3, right: -3, width: 17, height: 17, backgroundColor: '#ef4444', borderRadius: 9, borderWidth: 2, borderColor: SURFACE, justifyContent: 'center', alignItems: 'center' },
  badgeText: { fontSize: 9, color: '#fff', fontWeight: '800' },

  // Score card
  scoreCard: { margin: 16, borderRadius: 22, backgroundColor: CARD_BG, overflow: 'hidden' },
  scoreCardTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', padding: 22, paddingBottom: 0 },
  scoreLeft: { flex: 1 },
  scoreLabelText: { fontSize: 11, color: '#64748b', fontWeight: '600', letterSpacing: 1 },
  scoreValueRow: { flexDirection: 'row', alignItems: 'baseline', gap: 6, marginTop: 6 },
  scoreNumber: { fontSize: 52, fontWeight: '800', color: '#fff', letterSpacing: -2, lineHeight: 56 },
  scoreMax: { fontSize: 20, color: '#475569', fontWeight: '500' },
  standingPill: { flexDirection: 'row', alignItems: 'center', gap: 5, backgroundColor: '#1e293b', borderRadius: 8, paddingHorizontal: 10, paddingVertical: 4, marginTop: 8, alignSelf: 'flex-start' },
  standingDot: { width: 7, height: 7, borderRadius: 4 },
  standingText: { fontSize: 11, color: '#94a3b8', fontWeight: '500' },
  circleProgress: { width: 64, height: 64, justifyContent: 'center', alignItems: 'center' },
  circleText: { position: 'absolute', fontSize: 13, fontWeight: '700', color: '#fff' },
  progressBarBg: { marginHorizontal: 22, marginTop: 16, height: 5, backgroundColor: '#1e293b', borderRadius: 4, overflow: 'hidden' },
  progressBarFill: { height: '100%', backgroundColor: '#3b82f6', borderRadius: 4 },
  statsRow: { flexDirection: 'row', borderTopWidth: 1, borderTopColor: '#1e293b', marginTop: 16 },
  statItem: { flex: 1, paddingVertical: 14, alignItems: 'center' },
  statBorder: { borderRightWidth: 1, borderRightColor: '#1e293b' },
  statValue: { fontSize: 20, fontWeight: '700' },
  statLabel: { fontSize: 10, color: '#64748b', fontWeight: '600', letterSpacing: 0.5, marginTop: 3 },

  // Actions
  sectionLabel: { fontSize: 12, fontWeight: '700', color: '#64748b', letterSpacing: 0.8, marginHorizontal: 16, marginBottom: 12, marginTop: 4 },
  actionsRow: { flexDirection: 'row', justifyContent: 'space-between', marginHorizontal: 16, marginBottom: 16, gap: 10 },
  actionCard: { flex: 1, backgroundColor: SURFACE, borderRadius: 16, padding: 14, alignItems: 'center', borderWidth: 1, borderColor: BORDER },
  actionIconBox: { width: 40, height: 40, borderRadius: 12, justifyContent: 'center', alignItems: 'center', marginBottom: 8 },
  actionIcon: { fontSize: 20 },
  actionLabel: { fontSize: 12, fontWeight: '600', color: DARK },

  // Circles
  sectionHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginHorizontal: 16, marginBottom: 12 },
  seeAll: { fontSize: 13, color: BLUE, fontWeight: '600' },
  circleList: { marginHorizontal: 16, gap: 10 },
  circleCard: { backgroundColor: SURFACE, borderRadius: 16, padding: 14, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', borderWidth: 1, borderColor: BORDER },
  circleCardLeft: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  circleIconBox: { width: 42, height: 42, borderRadius: 13, justifyContent: 'center', alignItems: 'center' },
  circleIcon: { fontSize: 18 },
  circleName: { fontSize: 14, fontWeight: '600', color: DARK },
  circleMeta: { fontSize: 12, color: MUTED, marginTop: 3 },
  chevronBox: { width: 30, height: 30, backgroundColor: '#f8fafc', borderRadius: 9, borderWidth: 1, borderColor: BORDER, justifyContent: 'center', alignItems: 'center' },
  chevron: { fontSize: 18, color: MUTED, marginTop: -2 },

  // Empty
  emptyCard: { backgroundColor: SURFACE, marginHorizontal: 16, borderRadius: 16, padding: 28, alignItems: 'center', borderWidth: 1, borderColor: BORDER },
  emptyIcon: { fontSize: 40, marginBottom: 12 },
  emptyTitle: { fontSize: 16, fontWeight: '700', color: DARK, marginBottom: 6 },
  emptySubtext: { fontSize: 13, color: MUTED, textAlign: 'center', marginBottom: 16 },
  emptyBtn: { backgroundColor: BLUE, borderRadius: 10, paddingHorizontal: 20, paddingVertical: 10 },
  emptyBtnText: { color: '#fff', fontWeight: '700', fontSize: 14 },

  // Logout
  logoutBtn: { marginHorizontal: 16, marginTop: 20, padding: 16, borderRadius: 14, borderWidth: 1, borderColor: BORDER, alignItems: 'center', backgroundColor: SURFACE },
  logoutText: { color: '#ef4444', fontSize: 15, fontWeight: '600' },
});