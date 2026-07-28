import React, { useState, useCallback, useMemo, useRef } from 'react';
import {
  View, Text, StyleSheet, ScrollView,
  TouchableOpacity, ActivityIndicator, RefreshControl, LayoutAnimation,
  Platform, UIManager, Image,
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { Ionicons } from '@expo/vector-icons';
import Svg from 'react-native-svg';
const { Circle } = require('react-native-svg');
import { getLastAccessedCircleId } from '../utils/recentCircles';
import { useFreshFocus } from '../utils/useFreshFocus';
import {
  getProfile, getMyCircles, getUnreadCount,
  getMyBorrowedLoans, getMyLentLoans, getCircleExpenses, getPersonalTransactions,
} from '../services/api';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';
import { RootStackParamList } from '../navigation/AppNavigator';
import { ColorScheme } from '../theme/colors';
import { formatMoney } from '../utils/formatMoney';
import { fonts } from '../theme/fonts';

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

interface ExpenseSplit {
  id: number;
  userId: number;
  amountOwed: number;
  settled: boolean;
  paymentRequested: boolean;
}

interface SharedExpense {
  expenseId: number;
  description: string;
  totalAmount: number;
  category?: string;
  paidBy: string;
  paidById: number;
  createdAt: string;
  splits: ExpenseSplit[];
}

type CircleExpense = SharedExpense & { circleId: number; circleName: string };

interface PersonalTransaction {
  category: string;
  amount: number;
  type: string;
  transactionDate: string;
}

type LoanActivityItem = Loan & { kind: 'loan'; role: 'borrower' | 'lender' };
type ExpenseActivityItem = CircleExpense & { kind: 'expense'; role: 'paid' | 'owed' };
type ActivityItem = LoanActivityItem | ExpenseActivityItem;

// The hero card is always rendered dark regardless of light/dark theme (like
// the amount cards on LoanDetailScreen/ProfileScreen), so its text/border
// colors are white-on-dark opacities rather than theme-swapped values --
// except for the green/red/gold accents below, which DO need to track the
// theme's chartGreen/chartRed/accent so dark mode doesn't show light-mode hues.
const HERO_BORDER = 'rgba(255,255,255,0.08)';
const HERO_MUTED = 'rgba(255,255,255,0.45)';
const HERO_SUBTLE = 'rgba(255,255,255,0.55)';
const RING_BG = 'rgba(255,255,255,0.15)';

const ACTIVE_STATUSES = ['ACTIVE', 'DUE', 'GRACE_PERIOD'];

const createStyles = (c: ColorScheme) => StyleSheet.create({
  container: { flex: 1, backgroundColor: c.bg },
  loadingContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: c.bg },

  header: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    backgroundColor: c.surface, paddingHorizontal: 20, paddingTop: 56, paddingBottom: 18,
    borderBottomWidth: 1, borderBottomColor: c.border,
  },
  headerLeft: { flexDirection: 'row', alignItems: 'center' },
  headerLogo: { width: 32, height: 35, marginRight: 12 },
  greeting: { fontSize: 15, color: c.muted },                          // was 13
  name: { fontSize: 26, fontWeight: '700', fontFamily: fonts.bold, color: c.dark, letterSpacing: -0.3, marginTop: 2 }, // was 22
  bellBtn: {
    width: 44, height: 44, borderRadius: 12,
    backgroundColor: c.bg, justifyContent: 'center', alignItems: 'center',
    borderWidth: 1, borderColor: c.border,
  },
  badge: {
    position: 'absolute', top: -2, right: -2,
    width: 16, height: 16, backgroundColor: c.danger,
    borderRadius: 8, borderWidth: 2, borderColor: c.surface,
    justifyContent: 'center', alignItems: 'center',
  },
  badgeText: { fontSize: 8, color: c.surface, fontWeight: '800', fontFamily: fonts.extrabold },

  heroCard: {
    backgroundColor: c.heroCardBg, marginHorizontal: 16, marginTop: 16,
    borderRadius: 20, overflow: 'hidden',
  },
  heroLabelRow: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    paddingHorizontal: 20, paddingTop: 18,
  },
  heroLabel: { fontSize: 11, fontWeight: '800', fontFamily: fonts.extrabold, color: c.accent, letterSpacing: 1.2 },
  eyeBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    paddingHorizontal: 20, paddingTop: 10, paddingBottom: 4,
  },
  eyeText: { fontSize: 13, color: HERO_SUBTLE, fontWeight: '500', fontFamily: fonts.medium },    // was 12
  amountsRow: {
    flexDirection: 'row', paddingHorizontal: 20, paddingVertical: 18,  // was 16
  },
  amountItem: { flex: 1 },
  amountLabel: { fontSize: 14, color: HERO_MUTED, fontWeight: '500', fontFamily: fonts.medium, marginBottom: 8 }, // was 12
  amountValue: { fontSize: 26, fontWeight: '800', fontFamily: fonts.extrabold, letterSpacing: -0.5 },               // was 22
  amountSub: { fontSize: 13, color: HERO_MUTED, marginTop: 6 },                        // was 11
  amountDivider: { width: 1, backgroundColor: HERO_BORDER, marginHorizontal: 16 },
  trustSection: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    borderTopWidth: 1, borderTopColor: HERO_BORDER,
    paddingHorizontal: 20, paddingVertical: 18,                         // was 16
  },
  trustTextCol: { flex: 1, marginRight: 16 },
  trustHeading: { fontSize: 12, color: HERO_MUTED, fontWeight: '700', fontFamily: fonts.bold, letterSpacing: 0.8, marginBottom: 6 }, // was 11
  trustPill: { flexDirection: 'row', alignItems: 'center', gap: 5, marginBottom: 10 },
  pillDot: { width: 8, height: 8, borderRadius: 4 },                   // was 7
  pillText: { fontSize: 15, fontWeight: '700', fontFamily: fonts.bold },                        // was 13
  progressBg: { height: 5, backgroundColor: RING_BG, borderRadius: 4, overflow: 'hidden' }, // was 4
  progressFill: { height: '100%', borderRadius: 4 },
  ringWrapper: { width: 72, height: 72, justifyContent: 'center', alignItems: 'center' }, // was 64
  ringText: { position: 'absolute', fontSize: 15, fontWeight: '800', fontFamily: fonts.extrabold, color: '#FFFFFF' }, // was 13
  statsRow: {
    flexDirection: 'row', borderTopWidth: 1, borderTopColor: HERO_BORDER,
  },
  statItem: { flex: 1, paddingVertical: 16, alignItems: 'center' },    // was 14
  statDivider: { borderRightWidth: 1, borderRightColor: HERO_BORDER },
  statVal: { fontSize: 20, fontWeight: '800', fontFamily: fonts.extrabold, color: '#FFFFFF' },      // was 17
  statLbl: { fontSize: 11, color: HERO_MUTED, fontWeight: '600', fontFamily: fonts.semibold, marginTop: 3 }, // was 10
  spendingCard: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    backgroundColor: c.surface, marginHorizontal: 16, marginTop: 10,
    borderRadius: 14, padding: 16, borderWidth: 1, borderColor: c.border,
  },
  spendingLeft: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  spendingIconBox: {
    width: 36, height: 36, borderRadius: 10, backgroundColor: c.bg,
    justifyContent: 'center', alignItems: 'center', borderWidth: 1, borderColor: c.border,
  },
  spendingLabel: { fontSize: 12, color: c.muted, fontWeight: '600', fontFamily: fonts.semibold },
  spendingSub: { fontSize: 11, color: c.muted, marginTop: 1 },
  spendingValue: { fontSize: 17, fontWeight: '800', fontFamily: fonts.extrabold, color: c.dark },

  activityHeader: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    marginHorizontal: 16, marginTop: 24, marginBottom: 10,
    backgroundColor: c.surface, borderRadius: 12, padding: 14,
    borderWidth: 1, borderColor: c.border,
  },
  activityToggle: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  activityBadge: {
    backgroundColor: c.accent, borderRadius: 10, width: 22, height: 22,
    justifyContent: 'center', alignItems: 'center',
  },
  activityBadgeText: { fontSize: 11, fontWeight: '800', fontFamily: fonts.extrabold, color: c.surface }, // was 10

  activityList: { marginHorizontal: 16, gap: 8, marginBottom: 8 },
  activityCard: {
    backgroundColor: c.surface, borderRadius: 14, padding: 14,
    flexDirection: 'row', alignItems: 'center', gap: 12,
    borderWidth: 1, borderColor: c.border,
  },
  activityIconBox: { width: 42, height: 42, borderRadius: 12, justifyContent: 'center', alignItems: 'center' },
  activityInfo: { flex: 1 },
  activityTitle: { fontSize: 15, fontWeight: '600', fontFamily: fonts.semibold, color: c.dark },   // was 14
  activitySub: { fontSize: 12, color: c.muted, marginTop: 2 },         // was 11
  activityRight: { alignItems: 'flex-end', gap: 4 },
  activityAmount: { fontSize: 15, fontWeight: '700', fontFamily: fonts.bold },                  // was 14
  statusPill: { borderRadius: 6, paddingHorizontal: 6, paddingVertical: 2 },
  statusText: { fontSize: 11, fontWeight: '700', fontFamily: fonts.bold },                      // was 10

  sectionRow: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    marginHorizontal: 16, marginTop: 20, marginBottom: 10,
    backgroundColor: c.surface, borderRadius: 12, padding: 14,
    borderWidth: 1, borderColor: c.border,
  },
  sectionLabel: { fontSize: 12, fontWeight: '700', fontFamily: fonts.bold, color: c.muted, letterSpacing: 0.8 }, // was 11
  seeAll: { fontSize: 13, color: c.accent, fontWeight: '700', fontFamily: fonts.bold },         // was 12

  circleList: { marginHorizontal: 16, gap: 8 },
  circleCard: {
    backgroundColor: c.surface, borderRadius: 14, padding: 14,
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    borderWidth: 1, borderColor: c.border,
  },
  circleLeft: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  circleIconBox: {
    width: 42, height: 42, borderRadius: 12,
    backgroundColor: c.bg, justifyContent: 'center', alignItems: 'center',
    borderWidth: 1, borderColor: c.border,
  },
  circleName: { fontSize: 15, fontWeight: '600', fontFamily: fonts.semibold, color: c.dark },       // was 14
  circleMeta: { fontSize: 12, color: c.muted, marginTop: 2 },           // was 11

  emptyCard: {
    backgroundColor: c.surface, marginHorizontal: 16, borderRadius: 14,
    padding: 24, alignItems: 'center', borderWidth: 1, borderColor: c.border,
  },
  emptyText: { fontSize: 15, fontWeight: '600', fontFamily: fonts.semibold, color: c.dark, marginTop: 10, marginBottom: 4 }, // was 14
  emptySubText: { fontSize: 13, color: c.muted, textAlign: 'center' }, // was 12
});

export default function HomeScreen({ navigation }: Props) {
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const { user } = useAuth();
  const [profile, setProfile] = useState<Profile | null>(null);
  const [circles, setCircles] = useState<Circle[]>([]);
  const [lastAccessedCircleId, setLastAccessedCircleId] = useState<number | null>(null);
  const [unreadCount, setUnreadCount] = useState<number>(0);
  const [borrowedLoans, setBorrowedLoans] = useState<Loan[]>([]);
  const [lentLoans, setLentLoans] = useState<Loan[]>([]);
  const [expenses, setExpenses] = useState<CircleExpense[]>([]);
  const [personalTransactions, setPersonalTransactions] = useState<PersonalTransaction[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [refreshing, setRefreshing] = useState<boolean>(false);
  const [amountsVisible, setAmountsVisible] = useState<boolean>(false);
  // Default open -- this is the most useful section on the screen and
  // shouldn't be hidden behind a tap every time the app is opened.
  const [activityExpanded, setActivityExpanded] = useState<boolean>(true);
  const [expensesLoading, setExpensesLoading] = useState<boolean>(false);
  // Identifies each loadData() call so a slower, older call (e.g. a
  // background expense fetch from a previous focus) can't clobber a newer
  // one's results if they happen to overlap -- see loadCircleExpenses below.
  const loadIdRef = useRef(0);

  const getTrustColor = (s: number): string => s >= 75 ? colors.success : s >= 50 ? colors.accent : colors.danger;
  const getTrustLabel = (s: number): string => s >= 75 ? 'Excellent' : s >= 50 ? 'Neutral' : 'Low';

  // Shared-expense activity is fetched per-circle (one request per circle)
  // and used only to fill in the expense side of "Recent Activity" -- it's
  // not needed for anything else on the screen, so it runs in the background
  // after the core dashboard has already painted instead of blocking it.
  const loadCircleExpenses = async (circlesList: Circle[], loadId: number): Promise<void> => {
    setExpensesLoading(true);
    try {
      const expenseLists = await Promise.all(
        circlesList.map((c) => getCircleExpenses(c.id).catch(() => []))
      );
      if (loadIdRef.current !== loadId) return;
      const mergedExpenses: CircleExpense[] = expenseLists.flatMap((list, i) =>
        (list as SharedExpense[]).map((e) => ({
          ...e, circleId: circlesList[i].id, circleName: circlesList[i].name,
        }))
      );
      setExpenses(mergedExpenses);
    } catch (error) {
      console.error('Error loading circle expenses:', error);
    } finally {
      if (loadIdRef.current === loadId) setExpensesLoading(false);
    }
  };

  const loadData = async (): Promise<void> => {
    const loadId = ++loadIdRef.current;
    try {
      const [profileData, circlesData, notifData, borrowed, lent, personalTxs] = await Promise.all([
        getProfile(),
        getMyCircles(),
        getUnreadCount(),
        getMyBorrowedLoans(),
        getMyLentLoans(),
        getPersonalTransactions().catch(() => []),
      ]);
      if (loadIdRef.current !== loadId) return;
      setProfile(profileData as Profile);
      const circlesList = circlesData as Circle[];
      setCircles(circlesList);
      setUnreadCount((notifData as { unreadCount: number }).unreadCount || 0);
      setBorrowedLoans(borrowed as Loan[]);
      setLentLoans(lent as Loan[]);
      setPersonalTransactions(personalTxs as PersonalTransaction[]);

      // Core numbers are ready -- paint the screen now rather than waiting
      // on the per-circle expense fetches below (previously a blocking
      // extra round trip chained after this whole batch).
      setLoading(false);
      setRefreshing(false);

      loadCircleExpenses(circlesList, loadId);
    } catch (error) {
      console.error('Error loading data:', error);
      if (loadIdRef.current === loadId) {
        setLoading(false);
        setRefreshing(false);
      }
    }
  };

  const { markFresh } = useFreshFocus(loadData);

  // Cheap local-storage read (not a network call), so it stays outside the
  // staleness check -- always reflects whatever circle was most recently
  // opened, even if the dashboard data itself is still considered fresh.
  useFocusEffect(useCallback(() => {
    getLastAccessedCircleId().then(setLastAccessedCircleId);
  }, []));

  // Most recently opened circle takes priority; falls back to whatever the
  // backend returns first (e.g. a brand-new user who hasn't opened any
  // circle detail screen yet).
  const recentCircle = circles.find((c) => c.id === lastAccessedCircleId) ?? circles[0] ?? null;

  const toggleActivity = () => {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    setActivityExpanded(prev => !prev);
  };

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={colors.accent} />
      </View>
    );
  }

  const score = profile?.trustScore ?? 0;
  const radius = 26;                                                     // was 22 — bigger ring
  const circumference = 2 * Math.PI * radius;
  const strokeDashoffset = circumference - (score / 100) * circumference;

  const totalOwed = borrowedLoans
    .filter(l => ACTIVE_STATUSES.includes(l.status))
    .reduce((sum, l) => sum + (l.totalRepaymentAmount + l.overdueInterestAccrued - l.amountRepaid), 0);

  const totalOwedToYou = lentLoans
    .filter(l => ACTIVE_STATUSES.includes(l.status))
    .reduce((sum, l) => sum + (l.totalRepaymentAmount + l.overdueInterestAccrued - l.amountRepaid), 0);

  const now = new Date();
  const thisMonthSpend = personalTransactions
    .filter(t => {
      if (t.type !== 'EXPENSE') return false;
      const d = new Date(t.transactionDate);
      return d.getFullYear() === now.getFullYear() && d.getMonth() === now.getMonth();
    })
    .reduce((sum, t) => sum + t.amount, 0);

  const myId = user?.id;

  const loanActivity: ActivityItem[] = [
    ...borrowedLoans.map(l => ({ ...l, kind: 'loan' as const, role: 'borrower' as const })),
    ...lentLoans.map(l => ({ ...l, kind: 'loan' as const, role: 'lender' as const })),
  ];

  const expenseActivity: ActivityItem[] = expenses
    .filter(e => myId != null && (e.paidById === myId || e.splits.some(s => s.userId === myId)))
    .map(e => ({ ...e, kind: 'expense' as const, role: e.paidById === myId ? 'paid' as const : 'owed' as const }));

  const recentActivity: ActivityItem[] = [...loanActivity, ...expenseActivity]
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
    .slice(0, 5);

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'ACTIVE': return colors.success;
      case 'DUE': return colors.warning;
      case 'GRACE_PERIOD': return colors.danger;
      case 'REPAID': return colors.success;
      case 'DEFAULTED': return colors.danger;
      case 'REQUESTED': return colors.warning;
      default: return colors.muted;
    }
  };

  const getExpenseStatus = (e: ExpenseActivityItem): { label: string; color: string } => {
    if (e.role === 'paid') {
      const settledCount = e.splits.filter(s => s.settled || s.userId === e.paidById).length;
      const total = e.splits.length;
      return settledCount === total
        ? { label: 'All Settled', color: colors.success }
        : { label: `${settledCount}/${total} Settled`, color: colors.warning };
    }
    const mySplit = e.splits.find(s => s.userId === myId);
    return mySplit?.settled
      ? { label: 'Settled', color: colors.success }
      : { label: 'Pending', color: colors.warning };
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
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); markFresh(); loadData(); }} tintColor={colors.accent} />}
      showsVerticalScrollIndicator={false}
    >
      {/* Header */}
      <View style={styles.header}>
        <View style={styles.headerLeft}>
          <Image source={require('../../assets/logo.png')} style={styles.headerLogo} resizeMode="contain" />
          <View>
            <Text style={styles.greeting}>{getGreeting()}</Text>
            <Text style={styles.name}>{profile?.firstName} {profile?.lastName}</Text>
          </View>
        </View>
        <TouchableOpacity style={styles.bellBtn} onPress={() => navigation.navigate('Notifications')}>
          <Ionicons name="notifications-outline" size={22} color={colors.dark} />
          {unreadCount > 0 && (
            <View style={styles.badge}>
              <Text style={styles.badgeText}>{unreadCount}</Text>
            </View>
          )}
        </TouchableOpacity>
      </View>

      {/* Hero Card */}
      <View style={styles.heroCard}>

        <View style={styles.heroLabelRow}>
          <Ionicons name="people" size={13} color={colors.accent} />
          <Text style={styles.heroLabel}>CIRCLE LENDING</Text>
        </View>

        <TouchableOpacity style={styles.eyeBtn} onPress={() => setAmountsVisible(v => !v)}>
          <Ionicons name={amountsVisible ? 'eye-outline' : 'eye-off-outline'} size={20} color={HERO_SUBTLE} />
          <Text style={styles.eyeText}>{amountsVisible ? 'Hide balances' : 'Show balances'}</Text>
        </TouchableOpacity>

        <View style={styles.amountsRow}>
          <View style={styles.amountItem}>
            <Text style={styles.amountLabel}>You are owed</Text>
            <Text style={[styles.amountValue, { color: colors.chartGreen }]}>
              {amountsVisible ? `GHS ${formatMoney(totalOwedToYou)}` : maskAmount}
            </Text>
            <Text style={styles.amountSub}>
              {lentLoans.filter(l => ACTIVE_STATUSES.includes(l.status)).length} active
            </Text>
          </View>
          <View style={styles.amountDivider} />
          <View style={styles.amountItem}>
            <Text style={styles.amountLabel}>You owe</Text>
            <Text style={[styles.amountValue, { color: totalOwed > 0 ? colors.chartRed : HERO_SUBTLE }]}>
              {amountsVisible ? `GHS ${formatMoney(totalOwed)}` : maskAmount}
            </Text>
            <Text style={styles.amountSub}>
              {borrowedLoans.filter(l => ACTIVE_STATUSES.includes(l.status)).length} active
            </Text>
          </View>
        </View>

        <View style={styles.trustSection}>
          <View style={styles.trustTextCol}>
            <Text style={styles.trustHeading}>TRUST SCORE</Text>
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
            <Svg width={72} height={72} style={{ transform: [{ rotate: '-90deg' }] }}>
              <Circle cx="36" cy="36" r={radius} fill="none" stroke={RING_BG} strokeWidth="6" />
              <Circle
                cx="36" cy="36" r={radius}
                fill="none" stroke={getTrustColor(score)} strokeWidth="6"
                strokeDasharray={circumference}
                strokeDashoffset={strokeDashoffset}
                strokeLinecap="round"
              />
            </Svg>
            <Text style={styles.ringText}>{score.toFixed(0)}</Text>
          </View>
        </View>

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

      {/* Personal Spending — kept visually separate from circle lending above */}
      <TouchableOpacity
        style={styles.spendingCard}
        onPress={() => navigation.navigate('Main', { screen: 'ExpensesTab' })}
        activeOpacity={0.7}
      >
        <View style={styles.spendingLeft}>
          <View style={styles.spendingIconBox}>
            <Ionicons name="wallet-outline" size={18} color={colors.accent} />
          </View>
          <View>
            <Text style={styles.spendingLabel}>PERSONAL SPENDING</Text>
            <Text style={styles.spendingSub}>This month</Text>
          </View>
        </View>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
          <Text style={styles.spendingValue}>
            {amountsVisible ? `GHS ${formatMoney(thisMonthSpend)}` : maskAmount}
          </Text>
          <Ionicons name="chevron-forward" size={16} color={colors.muted} />
        </View>
      </TouchableOpacity>

      {/* Recent Activity */}
      <TouchableOpacity style={styles.activityHeader} onPress={toggleActivity} activeOpacity={0.7}>
        <Text style={styles.sectionLabel}>RECENT ACTIVITY</Text>
        <View style={styles.activityToggle}>
          {/* Shared-expense activity loads in the background after the rest
              of the screen -- this spinner signals the list is still filling
              in rather than letting it silently reshuffle a moment later. */}
          {expensesLoading && <ActivityIndicator size="small" color={colors.muted} />}
          {recentActivity.length > 0 && (
            <View style={styles.activityBadge}>
              <Text style={styles.activityBadgeText}>{recentActivity.length}</Text>
            </View>
          )}
          <Ionicons name={activityExpanded ? 'chevron-up' : 'chevron-down'} size={16} color={colors.muted} />
        </View>
      </TouchableOpacity>

      {activityExpanded && (
        <View style={styles.activityList}>
          {recentActivity.length === 0 ? (
            <View style={styles.emptyCard}>
              <Ionicons name="receipt-outline" size={28} color={colors.muted} />
              <Text style={styles.emptyText}>No activity yet</Text>
            </View>
          ) : (
            recentActivity.map((item, i) => {
              // Loan and expense activity rows render identically (icon box +
              // title/sub + amount/status pill) -- only the values differ, so
              // both kinds get normalized into the same shape here instead of
              // duplicating the whole card JSX twice.
              const isLoan = item.kind === 'loan';
              const key = isLoan ? `loan-${item.role}-${item.id}-${i}` : `expense-${item.expenseId}-${i}`;
              const onPress = isLoan
                ? () => navigation.navigate('LoanDetail', { loanId: item.id })
                : () => navigation.navigate('CircleDetail', { circleId: item.circleId });

              let isPositive: boolean;
              let iconName: keyof typeof Ionicons.glyphMap;
              let title: string;
              let amount: number;
              let statusLabel: string;
              let statusColor: string;

              if (isLoan) {
                isPositive = item.role === 'lender';
                iconName = isPositive ? 'arrow-up-outline' : 'arrow-down-outline';
                title = isPositive ? `Lent to ${item.borrowerName}` : `Borrowed from ${item.lenderName || 'Pending'}`;
                amount = item.amount;
                statusLabel = item.status.replace(/_/g, ' ');
                statusColor = getStatusColor(item.status);
              } else {
                isPositive = item.role === 'paid';
                iconName = isPositive ? 'cash-outline' : 'receipt-outline';
                title = isPositive ? `Paid for ${item.description}` : `You owe for ${item.description}`;
                const mySplit = item.splits.find(s => s.userId === myId);
                amount = isPositive ? item.totalAmount : (mySplit?.amountOwed ?? 0);
                const status = getExpenseStatus(item);
                statusLabel = status.label;
                statusColor = status.color;
              }

              const amountColor = isPositive ? colors.success : colors.danger;

              return (
                <TouchableOpacity key={key} style={styles.activityCard} onPress={onPress}>
                  <View style={[styles.activityIconBox, { backgroundColor: isPositive ? colors.successBgTint : colors.dangerBgTint }]}>
                    <Ionicons name={iconName} size={18} color={amountColor} />
                  </View>
                  <View style={styles.activityInfo}>
                    <Text style={styles.activityTitle} numberOfLines={1}>{title}</Text>
                    <Text style={styles.activitySub}>{item.circleName} · {formatDate(item.createdAt)}</Text>
                  </View>
                  <View style={styles.activityRight}>
                    <Text style={[styles.activityAmount, { color: amountColor }]}>
                      {isPositive ? '+' : '-'}GHS {formatMoney(amount)}
                    </Text>
                    <View style={[styles.statusPill, { backgroundColor: `${statusColor}18` }]}>
                      <Text style={[styles.statusText, { color: statusColor }]}>{statusLabel}</Text>
                    </View>
                  </View>
                </TouchableOpacity>
              );
            })
          )}
        </View>
      )}

      {/* Most Recently Viewed Circle */}
      <View style={styles.sectionRow}>
        <Text style={styles.sectionLabel}>RECENT CIRCLE</Text>
        <TouchableOpacity onPress={() => navigation.navigate('Main', { screen: 'CirclesTab' })}>
          <Text style={styles.seeAll}>See all</Text>
        </TouchableOpacity>
      </View>

      {circles.length === 0 ? (
        <View style={styles.emptyCard}>
          <Ionicons name="people-outline" size={28} color={colors.muted} />
          <Text style={styles.emptyText}>No circles yet</Text>
          <Text style={styles.emptySubText}>Create a circle to start lending</Text>
        </View>
      ) : recentCircle && (
        <View style={styles.circleList}>
          <TouchableOpacity
            key={recentCircle.id}
            style={styles.circleCard}
            onPress={() => navigation.navigate('CircleDetail', { circleId: recentCircle.id })}
          >
            <View style={styles.circleLeft}>
              <View style={styles.circleIconBox}>
                <Ionicons name="people-outline" size={18} color={colors.accent} />
              </View>
              <View>
                <Text style={styles.circleName}>{recentCircle.name}</Text>
                <Text style={styles.circleMeta}>
                  {recentCircle.memberCount} members · GHS {formatMoney(recentCircle.maxLoanAmount)} max
                </Text>
              </View>
            </View>
            <Ionicons name="chevron-forward" size={15} color={colors.muted} />
          </TouchableOpacity>
        </View>
      )}

      <View style={{ height: 40 }} />
    </ScrollView>
  );
}