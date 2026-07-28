import React, { useState, useMemo } from 'react';
import {
  View, Text, StyleSheet, FlatList, TouchableOpacity,
  ActivityIndicator, RefreshControl,
} from 'react-native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { Ionicons } from '@expo/vector-icons';
import {
  getNotifications, markNotificationRead, markAllNotificationsRead,
  deleteNotification, clearReadNotifications, acceptInvite, rejectInvite,
} from '../services/api';
import { useAppAlert } from '../components/AppAlert';
import { useConfirmModal } from '../components/ConfirmModal';
import { useFreshFocus } from '../utils/useFreshFocus';
import { useTheme } from '../context/ThemeContext';
import { RootStackParamList } from '../navigation/AppNavigator';
import { ColorScheme } from '../theme/colors';
import { fonts } from '../theme/fonts';

type Props = {
  navigation: NativeStackNavigationProp<RootStackParamList>;
};

interface Notification {
  id: number;
  title: string;
  message: string;
  type: string;
  referenceId: number | null;
  read: boolean;
  createdAt: string;
}

const createStyles = (c: ColorScheme) => StyleSheet.create({
  container: { flex: 1, backgroundColor: c.bg },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: c.bg },
  header: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    backgroundColor: c.surface, paddingHorizontal: 20, paddingTop: 56, paddingBottom: 16,
    borderBottomWidth: 1, borderBottomColor: c.border,
  },
  title: { fontSize: 22, fontWeight: '700', fontFamily: fonts.bold, color: c.dark },
  markAllBtn: { backgroundColor: c.bg, borderRadius: 8, paddingHorizontal: 12, paddingVertical: 6, borderWidth: 1, borderColor: c.border },
  markAllText: { color: c.accent, fontSize: 12, fontWeight: '600', fontFamily: fonts.semibold },
  unreadBanner: { backgroundColor: c.warningBgTint, paddingHorizontal: 20, paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: c.warningBorderTint },
  unreadBannerText: { fontSize: 12, color: c.accent, fontWeight: '600', fontFamily: fonts.semibold },
  emptyContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 24 },
  emptyTitle: { fontSize: 17, fontWeight: '700', fontFamily: fonts.bold, color: c.dark, marginTop: 12, marginBottom: 6 },
  emptyText: { fontSize: 13, color: c.muted, textAlign: 'center' },
  notifCard: {
    flexDirection: 'row', alignItems: 'flex-start', gap: 12,
    backgroundColor: c.surface, borderRadius: 14, padding: 14,
    borderWidth: 1, borderColor: c.border,
  },
  unread: { borderLeftWidth: 3, borderLeftColor: c.accent, backgroundColor: c.goldBgTint },
  iconBox: { width: 40, height: 40, borderRadius: 12, justifyContent: 'center', alignItems: 'center' },
  notifContent: { flex: 1 },
  notifTitle: { fontSize: 14, fontWeight: '700', fontFamily: fonts.bold, color: c.dark },
  notifMessage: { fontSize: 13, color: c.muted, marginTop: 3, lineHeight: 18 },
  notifTime: { fontSize: 11, color: c.muted, marginTop: 6 },
  unreadDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: c.accent, marginTop: 4 },
  notifDeleteBtn: { padding: 4, marginTop: 2 },
  acceptBtn: { backgroundColor: c.accent, borderRadius: 8, paddingHorizontal: 14, paddingVertical: 7, alignSelf: 'flex-start' },
  acceptBtnText: { color: c.surface, fontSize: 13, fontWeight: '600', fontFamily: fonts.semibold },
  rejectBtn: { backgroundColor: c.danger, borderRadius: 8, paddingHorizontal: 14, paddingVertical: 7, alignSelf: 'flex-start' },
  rejectBtnText: { color: c.surface, fontSize: 13, fontWeight: '600', fontFamily: fonts.semibold },
});


export default function NotificationsScreen({ navigation }: Props) {
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const { showAlert } = useAppAlert();
  const { confirm } = useConfirmModal();
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [refreshing, setRefreshing] = useState<boolean>(false);
  const [acceptingId, setAcceptingId] = useState<number | null>(null);
  const [rejectingId, setRejectingId] = useState<number | null>(null);
  const [acceptError, setAcceptError] = useState<Record<number, string>>({});

  const loadNotifications = async (): Promise<void> => {
    try {
      const data = await getNotifications();
      setNotifications(data as Notification[]);
    } catch (error) {
      console.error('Error loading notifications:', error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const { markFresh } = useFreshFocus(loadNotifications);

  const handleMarkRead = async (id: number): Promise<void> => {
    try {
      await markNotificationRead(id);
      setNotifications(notifications.map((n) => n.id === id ? { ...n, read: true } : n));
    } catch (error) {
      console.error('Error marking notification:', error);
    }
  };

  const handleMarkAllRead = async (): Promise<void> => {
    try {
      await markAllNotificationsRead();
      setNotifications(notifications.map((n) => ({ ...n, read: true })));
      markFresh();
    } catch (error) {
      console.error('Error marking all:', error);
    }
  };

  const handleDelete = async (id: number): Promise<void> => {
    try {
      await deleteNotification(id);
      setNotifications(prev => prev.filter(n => n.id !== id));
      markFresh();
    } catch (error) {
      showAlert('error', 'Error', (error as Error).message);
    }
  };

  const handleClearRead = async (): Promise<void> => {
    try {
      await clearReadNotifications();
      setNotifications(prev => prev.filter(n => !n.read));
      markFresh();
    } catch (error) {
      showAlert('error', 'Error', (error as Error).message);
    }
  };

  const handleAcceptInvite = async (notifId: number, circleId: number): Promise<void> => {
    setAcceptingId(notifId);
    setAcceptError(prev => { const next = { ...prev }; delete next[notifId]; return next; });
    try {
      const result = await acceptInvite(circleId) as { message: string };
      showAlert('success', 'Circle Joined', result.message);
      markNotificationRead(notifId).catch(() => {});
      setNotifications(prev => prev.filter(n => n.id !== notifId));
    } catch (error) {
      setAcceptError(prev => ({ ...prev, [notifId]: (error as Error).message }));
    } finally {
      setAcceptingId(null);
    }
  };

  const handleRejectInvite = async (notifId: number, circleId: number): Promise<void> => {
    const ok = await confirm('Reject Invite', 'Are you sure you want to reject this circle invitation?', 'Reject');
    if (!ok) return;
    setRejectingId(notifId);
    setAcceptError(prev => { const next = { ...prev }; delete next[notifId]; return next; });
    try {
      await rejectInvite(circleId);
      markNotificationRead(notifId).catch(() => {});
      setNotifications(prev => prev.filter(n => n.id !== notifId));
    } catch (error) {
      setAcceptError(prev => ({ ...prev, [notifId]: (error as Error).message }));
    } finally {
      setRejectingId(null);
    }
  };

  const getIconName = (type: string): keyof typeof Ionicons.glyphMap => {
    const icons: Record<string, keyof typeof Ionicons.glyphMap> = {
      LOAN_REQUESTED: 'document-text-outline', LOAN_FUNDED: 'cash-outline',
      LOAN_AGREEMENT_READY: 'create-outline', LOAN_AGREEMENT_SIGNED: 'checkmark-circle-outline',
      LOAN_DISBURSED: 'arrow-up-circle-outline', LOAN_REPAID: 'checkmark-done-outline',
      LOAN_OVERDUE: 'warning-outline', LOAN_GRACE_PERIOD: 'time-outline',
      LOAN_DEFAULTED: 'alert-circle-outline', CIRCLE_INVITE: 'people-outline',
      CIRCLE_INVITE_REJECTED: 'close-circle-outline',
      CIRCLE_MEMBER_APPROVED: 'person-add-outline', CIRCLE_MEMBER_REMOVED: 'person-remove-outline',
      SHARED_EXPENSE_CREATED: 'receipt-outline', DISPUTE_OPENED: 'scale-outline',
      DISPUTE_RESOLVED: 'shield-checkmark-outline', SPENDING_LIMIT_WARNING: 'warning-outline',
    };
    return icons[type] || 'notifications-outline';
  };

  const getIconColor = (type: string): string => {
    if (['LOAN_DEFAULTED', 'LOAN_OVERDUE', 'DISPUTE_OPENED', 'CIRCLE_MEMBER_REMOVED', 'CIRCLE_INVITE_REJECTED'].includes(type)) return colors.danger;
    if (['LOAN_REPAID', 'LOAN_AGREEMENT_SIGNED', 'CIRCLE_MEMBER_APPROVED', 'DISPUTE_RESOLVED'].includes(type)) return colors.success;
    if (['LOAN_DISBURSED', 'LOAN_FUNDED'].includes(type)) return colors.accent;
    return colors.muted;
  };

  const formatDate = (dateString: string): string => {
    const date = new Date(dateString);
    const now = new Date();
    const diff = now.getTime() - date.getTime();
    const minutes = Math.floor(diff / 60000);
    const hours = Math.floor(diff / 3600000);
    const days = Math.floor(diff / 86400000);
    if (minutes < 1) return 'Just now';
    if (minutes < 60) return `${minutes}m ago`;
    if (hours < 24) return `${hours}h ago`;
    if (days < 7) return `${days}d ago`;
    return date.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });
  };

  if (loading) return <View style={styles.center}><ActivityIndicator size="large" color={colors.accent} /></View>;

  const unreadCount = notifications.filter(n => !n.read).length;

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Notifications</Text>
        <View style={{ flexDirection: 'row', gap: 8 }}>
          {notifications.some(n => n.read) && (
            <TouchableOpacity onPress={handleClearRead} style={styles.markAllBtn}>
              <Text style={styles.markAllText}>Clear Read</Text>
            </TouchableOpacity>
          )}
          {unreadCount > 0 && (
            <TouchableOpacity onPress={handleMarkAllRead} style={styles.markAllBtn}>
              <Text style={styles.markAllText}>Mark all read</Text>
            </TouchableOpacity>
          )}
        </View>
      </View>

      {unreadCount > 0 && (
        <View style={styles.unreadBanner}>
          <Text style={styles.unreadBannerText}>{unreadCount} unread</Text>
        </View>
      )}

      {notifications.length === 0 ? (
        <View style={styles.emptyContainer}>
          <Ionicons name="notifications-outline" size={48} color={colors.muted} />
          <Text style={styles.emptyTitle}>No notifications yet</Text>
          <Text style={styles.emptyText}>You'll see loan updates and circle activity here</Text>
        </View>
      ) : (
        <FlatList
          data={notifications}
          keyExtractor={(item) => item.id.toString()}
          contentContainerStyle={{ padding: 16, gap: 8 }}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); markFresh(); loadNotifications(); }} tintColor={colors.accent} />}
          renderItem={({ item }) => (
            <TouchableOpacity
              style={[styles.notifCard, !item.read && styles.unread]}
              onPress={() => {
                if (!item.read) handleMarkRead(item.id);
                if (item.referenceId) {
                  if (item.type.startsWith('CIRCLE_')) {
                    try {
                      navigation.navigate('CircleDetail', { circleId: item.referenceId });
                    } catch {
                      showAlert('error', 'Circle Not Found', 'This circle no longer exists or you are no longer a member.');
                    }
                  } else if (item.type.startsWith('LOAN_')) {
                    navigation.navigate('LoanDetail', { loanId: item.referenceId });
                  }
                }
              }}
              activeOpacity={0.7}
            >
              <View style={[styles.iconBox, { backgroundColor: `${getIconColor(item.type)}15` }]}>
                <Ionicons name={getIconName(item.type)} size={20} color={getIconColor(item.type)} />
              </View>
              <View style={styles.notifContent}>
                <Text style={styles.notifTitle}>{item.title}</Text>
                <Text style={styles.notifMessage}>{item.message}</Text>
                {item.type === 'CIRCLE_INVITE' && item.referenceId != null && (
                  <View style={{ marginTop: 8 }}>
                    <View style={{ flexDirection: 'row', gap: 8 }}>
                      <TouchableOpacity
                        style={[styles.acceptBtn, acceptingId === item.id && { opacity: 0.6 }]}
                        onPress={() => handleAcceptInvite(item.id, item.referenceId!)}
                        disabled={acceptingId === item.id || rejectingId === item.id}
                      >
                        {acceptingId === item.id
                          ? <ActivityIndicator size="small" color={colors.surface} />
                          : <Text style={styles.acceptBtnText}>Accept Invite</Text>}
                      </TouchableOpacity>
                      <TouchableOpacity
                        style={[styles.rejectBtn, rejectingId === item.id && { opacity: 0.6 }]}
                        onPress={() => handleRejectInvite(item.id, item.referenceId!)}
                        disabled={acceptingId === item.id || rejectingId === item.id}
                      >
                        {rejectingId === item.id
                          ? <ActivityIndicator size="small" color={colors.surface} />
                          : <Text style={styles.rejectBtnText}>Reject</Text>}
                      </TouchableOpacity>
                    </View>
                    {acceptError[item.id] && (
                      <Text style={{ color: colors.errorRed, fontSize: 12, marginTop: 4 }}>{acceptError[item.id]}</Text>
                    )}
                  </View>
                )}
                <Text style={styles.notifTime}>{formatDate(item.createdAt)}</Text>
              </View>
              {!item.read && <View style={styles.unreadDot} />}
              <TouchableOpacity
                style={styles.notifDeleteBtn}
                onPress={() => handleDelete(item.id)}
                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              >
                <Ionicons name="trash-outline" size={18} color={colors.muted} />
              </TouchableOpacity>
            </TouchableOpacity>
          )}
        />
      )}
    </View>
  );
}
