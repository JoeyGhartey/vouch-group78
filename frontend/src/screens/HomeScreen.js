import React, { useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  RefreshControl,
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { getProfile, getMyCircles, getUnreadCount } from '../services/api';
import { useAuth } from '../context/AuthContext';

export default function HomeScreen({ navigation }) {
  const [profile, setProfile] = useState(null);
  const [circles, setCircles] = useState([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const { signOut } = useAuth();

  const loadData = async () => {
    try {
      const [profileData, circlesData, notifData] = await Promise.all([
        getProfile(),
        getMyCircles(),
        getUnreadCount(),
      ]);
      setProfile(profileData);
      setCircles(circlesData);
      setUnreadCount(notifData.unreadCount || 0);
    } catch (error) {
      console.error('Error loading data:', error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useFocusEffect(
    useCallback(() => {
      loadData();
    }, [])
  );

  const onRefresh = () => {
    setRefreshing(true);
    loadData();
  };

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#e94560" />
      </View>
    );
  }

  const getTrustScoreColor = (score) => {
    if (score >= 70) return '#4CAF50';
    if (score >= 40) return '#FFC107';
    return '#e94560';
  };

  return (
    <ScrollView
      style={styles.container}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#e94560" />}
    >
      {/* Header */}
      <View style={styles.header}>
        <View>
          <Text style={styles.greeting}>Welcome back,</Text>
          <Text style={styles.name}>{profile?.firstName} {profile?.lastName}</Text>
        </View>
        <TouchableOpacity
          style={styles.notifButton}
          onPress={() => navigation.navigate('Notifications')}
        >
          <Text style={styles.notifIcon}>🔔</Text>
          {unreadCount > 0 && (
            <View style={styles.badge}>
              <Text style={styles.badgeText}>{unreadCount}</Text>
            </View>
          )}
        </TouchableOpacity>
      </View>

      {/* Trust Score Card */}
      <View style={styles.scoreCard}>
        <Text style={styles.scoreLabel}>Trust Score</Text>
        <Text style={[styles.scoreValue, { color: getTrustScoreColor(profile?.trustScore) }]}>
          {profile?.trustScore?.toFixed(1)}
        </Text>
        <Text style={styles.scoreMax}>/ 100</Text>
        <View style={styles.scoreBar}>
          <View
            style={[
              styles.scoreBarFill,
              {
                width: `${profile?.trustScore || 0}%`,
                backgroundColor: getTrustScoreColor(profile?.trustScore),
              },
            ]}
          />
        </View>
        <View style={styles.statsRow}>
          <View style={styles.stat}>
            <Text style={styles.statValue}>{profile?.totalLoansGiven || 0}</Text>
            <Text style={styles.statLabel}>Lent</Text>
          </View>
          <View style={styles.stat}>
            <Text style={styles.statValue}>{profile?.totalLoansReceived || 0}</Text>
            <Text style={styles.statLabel}>Borrowed</Text>
          </View>
          <View style={styles.stat}>
            <Text style={styles.statValue}>{profile?.loansRepaidOnTime || 0}</Text>
            <Text style={styles.statLabel}>On Time</Text>
          </View>
          <View style={styles.stat}>
            <Text style={styles.statValue}>{profile?.defaults || 0}</Text>
            <Text style={styles.statLabel}>Defaults</Text>
          </View>
        </View>
      </View>

      {/* Quick Actions */}
      <Text style={styles.sectionTitle}>Quick Actions</Text>
      <View style={styles.actionsRow}>
        <TouchableOpacity
          style={styles.actionButton}
          onPress={() => navigation.navigate('CirclesTab')}
        >
          <Text style={styles.actionIcon}>👥</Text>
          <Text style={styles.actionText}>My Circles</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={styles.actionButton}
          onPress={() => navigation.navigate('LoansTab')}
        >
          <Text style={styles.actionIcon}>💰</Text>
          <Text style={styles.actionText}>My Loans</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={styles.actionButton}
          onPress={() => navigation.navigate('ExpensesTab')}
        >
          <Text style={styles.actionIcon}>📊</Text>
          <Text style={styles.actionText}>Expenses</Text>
        </TouchableOpacity>
      </View>

      {/* My Circles */}
      <View style={styles.sectionHeader}>
        <Text style={styles.sectionTitle}>My Circles</Text>
        <TouchableOpacity onPress={() => navigation.navigate('CirclesTab')}>
          <Text style={styles.seeAll}>See All</Text>
        </TouchableOpacity>
      </View>

      {circles.length === 0 ? (
        <View style={styles.emptyCard}>
          <Text style={styles.emptyText}>You're not in any circles yet</Text>
          <TouchableOpacity
            style={styles.createButton}
            onPress={() => navigation.navigate('CirclesTab')}
          >
            <Text style={styles.createButtonText}>Create a Circle</Text>
          </TouchableOpacity>
        </View>
      ) : (
        circles.slice(0, 3).map((circle) => (
          <TouchableOpacity
            key={circle.id}
            style={styles.circleCard}
            onPress={() => navigation.navigate('CirclesTab', { circleId: circle.id })}
          >
            <View style={styles.circleInfo}>
              <Text style={styles.circleName}>{circle.name}</Text>
              <Text style={styles.circleMembers}>{circle.memberCount} members</Text>
            </View>
            <Text style={styles.circleArrow}>→</Text>
          </TouchableOpacity>
        ))
      )}

      {/* Logout */}
      <TouchableOpacity style={styles.logoutButton} onPress={signOut}>
        <Text style={styles.logoutText}>Log Out</Text>
      </TouchableOpacity>

      <View style={{ height: 40 }} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#1a1a2e',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#1a1a2e',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 24,
    paddingTop: 60,
  },
  greeting: {
    color: '#a0a0b0',
    fontSize: 16,
  },
  name: {
    color: '#fff',
    fontSize: 24,
    fontWeight: 'bold',
  },
  notifButton: {
    position: 'relative',
    padding: 8,
  },
  notifIcon: {
    fontSize: 24,
  },
  badge: {
    position: 'absolute',
    top: 2,
    right: 2,
    backgroundColor: '#e94560',
    borderRadius: 10,
    minWidth: 20,
    height: 20,
    justifyContent: 'center',
    alignItems: 'center',
  },
  badgeText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: 'bold',
  },
  scoreCard: {
    backgroundColor: '#16213e',
    marginHorizontal: 24,
    borderRadius: 16,
    padding: 24,
    alignItems: 'center',
  },
  scoreLabel: {
    color: '#a0a0b0',
    fontSize: 14,
  },
  scoreValue: {
    fontSize: 48,
    fontWeight: 'bold',
    marginTop: 4,
  },
  scoreMax: {
    color: '#a0a0b0',
    fontSize: 16,
    marginTop: -4,
  },
  scoreBar: {
    width: '100%',
    height: 6,
    backgroundColor: '#2a2a4a',
    borderRadius: 3,
    marginTop: 16,
    overflow: 'hidden',
  },
  scoreBarFill: {
    height: '100%',
    borderRadius: 3,
  },
  statsRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    width: '100%',
    marginTop: 20,
  },
  stat: {
    alignItems: 'center',
  },
  statValue: {
    color: '#fff',
    fontSize: 20,
    fontWeight: 'bold',
  },
  statLabel: {
    color: '#a0a0b0',
    fontSize: 12,
    marginTop: 4,
  },
  sectionTitle: {
    color: '#fff',
    fontSize: 18,
    fontWeight: 'bold',
    marginLeft: 24,
    marginTop: 28,
    marginBottom: 12,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingRight: 24,
  },
  seeAll: {
    color: '#e94560',
    fontSize: 14,
  },
  actionsRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    marginHorizontal: 24,
  },
  actionButton: {
    backgroundColor: '#16213e',
    borderRadius: 16,
    padding: 20,
    alignItems: 'center',
    width: '30%',
  },
  actionIcon: {
    fontSize: 28,
    marginBottom: 8,
  },
  actionText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '600',
  },
  circleCard: {
    backgroundColor: '#16213e',
    marginHorizontal: 24,
    marginBottom: 8,
    borderRadius: 12,
    padding: 16,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  circleInfo: {},
  circleName: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  circleMembers: {
    color: '#a0a0b0',
    fontSize: 13,
    marginTop: 4,
  },
  circleArrow: {
    color: '#e94560',
    fontSize: 20,
  },
  emptyCard: {
    backgroundColor: '#16213e',
    marginHorizontal: 24,
    borderRadius: 12,
    padding: 24,
    alignItems: 'center',
  },
  emptyText: {
    color: '#a0a0b0',
    fontSize: 14,
    marginBottom: 16,
  },
  createButton: {
    backgroundColor: '#e94560',
    borderRadius: 8,
    paddingHorizontal: 20,
    paddingVertical: 10,
  },
  createButtonText: {
    color: '#fff',
    fontWeight: '600',
  },
  logoutButton: {
    marginHorizontal: 24,
    marginTop: 28,
    padding: 16,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#e94560',
    alignItems: 'center',
  },
  logoutText: {
    color: '#e94560',
    fontSize: 16,
    fontWeight: '600',
  },
});
