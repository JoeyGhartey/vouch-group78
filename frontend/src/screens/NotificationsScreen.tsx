import React, { useState, useCallback } from 'react';
import {
  View, Text, StyleSheet, FlatList, TouchableOpacity,
  ActivityIndicator, RefreshControl,
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { getNotifications, markNotificationRead, markAllNotificationsRead } from '../services/api';

interface Notification {
  id: number;
  title: string;
  message: string;
  type: string;
  read: boolean;
  createdAt: string;
}

export default function NotificationsScreen() {
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [refreshing, setRefreshing] = useState<boolean>(false);

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

  const getIcon = (type: string): string => {
    const icons: Record<string, string> = {
      LOAN_REQUESTED: '📩', LOAN_FUNDED: '💰', LOAN_AGREEMENT_READY: '📝',
      LOAN_AGREEMENT_SIGNED: '✅', LOAN_DISBURSED: '💸', LOAN_REPAID: '🎉',
      LOAN_OVERDUE: '⚠️', LOAN_GRACE_PERIOD: '⏰', LOAN_DEFAULTED: '🚨',
      CIRCLE_INVITE: '👥', CIRCLE_MEMBER_APPROVED: '✅', CIRCLE_MEMBER_REMOVED: '❌',
      SHARED_EXPENSE_CREATED: '🧾', DISPUTE_OPENED: '⚖️', DISPUTE_RESOLVED: '✅',
      SPENDING_LIMIT_WARNING: '⚠️',
    };
    return icons[type] || '📌';
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
    return date.toLocaleDateString();
  };

  if (loading) return <View style={styles.loadingContainer}><ActivityIndicator size="large" color="#e94560" /></View>;

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Notifications</Text>
        {notifications.some((n) => !n.read) && (
          <TouchableOpacity onPress={handleMarkAllRead}>
            <Text style={styles.markAll}>Mark all read</Text>
          </TouchableOpacity>
        )}
      </View>

      {notifications.length === 0 ? (
        <View style={styles.emptyContainer}>
          <Text style={styles.emptyIcon}>🔔</Text>
          <Text style={styles.emptyText}>No notifications yet</Text>
        </View>
      ) : (
        <FlatList
          data={notifications}
          keyExtractor={(item) => item.id.toString()}
          renderItem={({ item }) => (
            <TouchableOpacity
              style={[styles.notifCard, !item.read && styles.unread]}
              onPress={() => !item.read && handleMarkRead(item.id)}
            >
              <Text style={styles.notifIcon}>{getIcon(item.type)}</Text>
              <View style={styles.notifContent}>
                <Text style={styles.notifTitle}>{item.title}</Text>
                <Text style={styles.notifMessage}>{item.message}</Text>
                <Text style={styles.notifTime}>{formatDate(item.createdAt)}</Text>
              </View>
              {!item.read && <View style={styles.unreadDot} />}
            </TouchableOpacity>
          )}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); loadNotifications(); }} tintColor="#e94560" />}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#1a1a2e' },
  loadingContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#1a1a2e' },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 24, paddingTop: 60 },
  title: { color: '#fff', fontSize: 24, fontWeight: 'bold' },
  markAll: { color: '#e94560', fontSize: 14 },
  notifCard: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#16213e', marginHorizontal: 24, marginBottom: 8, borderRadius: 12, padding: 16 },
  unread: { backgroundColor: '#1a2744', borderLeftWidth: 3, borderLeftColor: '#e94560' },
  notifIcon: { fontSize: 24, marginRight: 12 },
  notifContent: { flex: 1 },
  notifTitle: { color: '#fff', fontSize: 15, fontWeight: '600' },
  notifMessage: { color: '#a0a0b0', fontSize: 13, marginTop: 4 },
  notifTime: { color: '#666', fontSize: 12, marginTop: 6 },
  unreadDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: '#e94560', marginLeft: 8 },
  emptyContainer: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  emptyIcon: { fontSize: 48, marginBottom: 16 },
  emptyText: { color: '#a0a0b0', fontSize: 16 },
});