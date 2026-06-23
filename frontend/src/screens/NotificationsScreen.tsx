import React, { useState, useCallback } from 'react';
import {
  View, Text, StyleSheet, FlatList, TouchableOpacity,
  ActivityIndicator, RefreshControl,
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { getNotifications, markNotificationRead, markAllNotificationsRead, acceptInvite } from '../services/api';
import { useAppAlert } from '../components/AppAlert';

interface Notification {
  id: number;
  title: string;
  message: string;
  type: string;
  referenceId: number | null;
  read: boolean;
  createdAt: string;
}

const BG = '#F8F9FA';
const WHITE = '#FFFFFF';
const DARK = '#0f172a';
const MUTED = '#6B7280';
const BORDER = '#E5E7EB';
const ACCENT = '#C9A84C';
const DANGER = '#dc2626';
const SUCCESS = '#16a34a';

export default function NotificationsScreen() {
  const { showAlert } = useAppAlert();
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [refreshing, setRefreshing] = useState<boolean>(false);
  const [acceptingId, setAcceptingId] = useState<number | null>(null);
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

  useFocusEffect(useCallback(() => { loadNotifications(); }, []));

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
    } catch (error) {
      console.error('Error marking all:', error);
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

  const getIconName = (type: string): keyof typeof Ionicons.glyphMap => {
    const icons: Record<string, keyof typeof Ionicons.glyphMap> = {
      LOAN_REQUESTED: 'document-text-outline',
      LOAN_FUNDED: 'cash-outline',
      LOAN_AGREEMENT_READY: 'create-outline',
      LOAN_AGREEMENT_SIGNED: 'checkmark-circle-outline',
      LOAN_DISBURSED: 'arrow-up-circle-outline',
      LOAN_REPAID: 'checkmark-done-outline',
      LOAN_OVERDUE: 'warning-outline',
      LOAN_GRACE_PERIOD: 'time-outline',
      LOAN_DEFAULTED: 'alert-circle-outline',
      CIRCLE_INVITE: 'people-outline',
      CIRCLE_MEMBER_APPROVED: 'person-add-outline',
      CIRCLE_MEMBER_REMOVED: 'person-remove-outline',
      SHARED_EXPENSE_CREATED: 'receipt-outline',
      DISPUTE_OPENED: 'scale-outline',
      DISPUTE_RESOLVED: 'shield-checkmark-outline',
      SPENDING_LIMIT_WARNING: 'warning-outline',
    };
    return icons[type] || 'notifications-outline';
  };

  const getIconColor = (type: string): string => {
    if (['LOAN_DEFAULTED', 'LOAN_OVERDUE', 'DISPUTE_OPENED', 'CIRCLE_MEMBER_REMOVED'].includes(type)) return DANGER;
    if (['LOAN_REPAID', 'LOAN_AGREEMENT_SIGNED', 'CIRCLE_MEMBER_APPROVED', 'DISPUTE_RESOLVED'].includes(type)) return SUCCESS;
    if (['LOAN_DISBURSED', 'LOAN_FUNDED'].includes(type)) return ACCENT;
    return MUTED;
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

  if (loading) return <View style={styles.center}><ActivityIndicator size="large" color={ACCENT} /></View>;

  const unreadCount = notifications.filter(n => !n.read).length;

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Notifications</Text>
        {unreadCount > 0 && (
          <TouchableOpacity onPress={handleMarkAllRead} style={styles.markAllBtn}>
            <Text style={styles.markAllText}>Mark all read</Text>
          </TouchableOpacity>
        )}
      </View>

      {unreadCount > 0 && (
        <View style={styles.unreadBanner}>
          <Text style={styles.unreadBannerText}>{unreadCount} unread</Text>
        </View>
      )}

      {notifications.length === 0 ? (
        <View style={styles.emptyContainer}>
          <Ionicons name="notifications-outline" size={48} color={MUTED} />
          <Text style={styles.emptyTitle}>No notifications yet</Text>
          <Text style={styles.emptyText}>You'll see loan updates and circle activity here</Text>
        </View>
      ) : (
        <FlatList
          data={notifications}
          keyExtractor={(item) => item.id.toString()}
          contentContainerStyle={{ padding: 16, gap: 8 }}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); loadNotifications(); }} tintColor={ACCENT} />}
          renderItem={({ item }) => (
            <TouchableOpacity
              style={[styles.notifCard, !item.read && styles.unread]}
              onPress={() => !item.read && handleMarkRead(item.id)}
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
                    <TouchableOpacity
                      style={[styles.acceptBtn, acceptingId === item.id && { opacity: 0.6 }]}
                      onPress={() => handleAcceptInvite(item.id, item.referenceId!)}
                      disabled={acceptingId === item.id}
                    >
                      {acceptingId === item.id
                        ? <ActivityIndicator size="small" color={WHITE} />
                        : <Text style={styles.acceptBtnText}>Accept Invite</Text>}
                    </TouchableOpacity>
                    {acceptError[item.id] && (
                      <Text style={{ color: '#ef4444', fontSize: 12, marginTop: 4 }}>{acceptError[item.id]}</Text>
                    )}
                  </View>
                )}
                <Text style={styles.notifTime}>{formatDate(item.createdAt)}</Text>
              </View>
              {!item.read && <View style={styles.unreadDot} />}
            </TouchableOpacity>
          )}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: BG },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: BG },
  header: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    backgroundColor: WHITE, paddingHorizontal: 20, paddingTop: 56, paddingBottom: 16,
    borderBottomWidth: 1, borderBottomColor: BORDER,
  },
  title: { fontSize: 22, fontWeight: '700', color: DARK },
  markAllBtn: { backgroundColor: BG, borderRadius: 8, paddingHorizontal: 12, paddingVertical: 6, borderWidth: 1, borderColor: BORDER },
  markAllText: { color: ACCENT, fontSize: 12, fontWeight: '600' },
  unreadBanner: { backgroundColor: '#FDF6E3', paddingHorizontal: 20, paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: '#F0E6C0' },
  unreadBannerText: { fontSize: 12, color: ACCENT, fontWeight: '600' },
  emptyContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 24 },
  emptyTitle: { fontSize: 17, fontWeight: '700', color: DARK, marginTop: 12, marginBottom: 6 },
  emptyText: { fontSize: 13, color: MUTED, textAlign: 'center' },
  notifCard: {
    flexDirection: 'row', alignItems: 'flex-start', gap: 12,
    backgroundColor: WHITE, borderRadius: 14, padding: 14,
    borderWidth: 1, borderColor: BORDER,
  },
  unread: { borderLeftWidth: 3, borderLeftColor: ACCENT, backgroundColor: '#FFFDF5' },
  iconBox: { width: 40, height: 40, borderRadius: 12, justifyContent: 'center', alignItems: 'center' },
  notifContent: { flex: 1 },
  notifTitle: { fontSize: 14, fontWeight: '700', color: DARK },
  notifMessage: { fontSize: 13, color: MUTED, marginTop: 3, lineHeight: 18 },
  notifTime: { fontSize: 11, color: MUTED, marginTop: 6 },
  unreadDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: ACCENT, marginTop: 4 },
  acceptBtn: { backgroundColor: ACCENT, borderRadius: 8, paddingHorizontal: 14, paddingVertical: 7, alignSelf: 'flex-start' },
  acceptBtnText: { color: WHITE, fontSize: 13, fontWeight: '600' },
});