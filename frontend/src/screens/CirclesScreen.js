import React, { useState, useCallback } from 'react';
import {
  View, Text, StyleSheet, FlatList, TouchableOpacity,
  ActivityIndicator, RefreshControl, TextInput, Modal, Alert, ScrollView,
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { getMyCircles, createCircle } from '../services/api';

export default function CirclesScreen({ navigation }) {
  const [circles, setCircles] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [showCreate, setShowCreate] = useState(false);
  const [newCircle, setNewCircle] = useState({
    name: '', description: '', maxLoanAmount: '5000',
    groupFundingThreshold: '3000', minTrustScore: '0',
  });
  const [creating, setCreating] = useState(false);

  const loadCircles = async () => {
    try {
      const data = await getMyCircles();
      setCircles(data);
    } catch (error) {
      console.error('Error loading circles:', error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useFocusEffect(useCallback(() => { loadCircles(); }, []));

  const handleCreate = async () => {
    if (!newCircle.name.trim()) {
      Alert.alert('Error', 'Circle name is required');
      return;
    }
    setCreating(true);
    try {
      await createCircle({
        name: newCircle.name,
        description: newCircle.description,
        maxLoanAmount: parseFloat(newCircle.maxLoanAmount) || 5000,
        groupFundingThreshold: parseFloat(newCircle.groupFundingThreshold) || 3000,
        minTrustScore: parseFloat(newCircle.minTrustScore) || 0,
      });
      setShowCreate(false);
      setNewCircle({ name: '', description: '', maxLoanAmount: '5000', groupFundingThreshold: '3000', minTrustScore: '0' });
      loadCircles();
    } catch (error) {
      Alert.alert('Error', error.message);
    } finally {
      setCreating(false);
    }
  };

  if (loading) {
    return <View style={styles.center}><ActivityIndicator size="large" color="#e94560" /></View>;
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>My Circles</Text>
        <TouchableOpacity style={styles.addButton} onPress={() => setShowCreate(true)}>
          <Text style={styles.addButtonText}>+ Create</Text>
        </TouchableOpacity>
      </View>

      {circles.length === 0 ? (
        <View style={styles.center}>
          <Text style={styles.emptyIcon}>👥</Text>
          <Text style={styles.emptyText}>No circles yet</Text>
          <Text style={styles.emptySubtext}>Create one to start lending with friends</Text>
        </View>
      ) : (
        <FlatList
          data={circles}
          keyExtractor={(item) => item.id.toString()}
          renderItem={({ item }) => (
            <TouchableOpacity
              style={styles.circleCard}
              onPress={() => navigation.navigate('CircleDetail', { circleId: item.id })}
            >
              <View style={styles.circleCardHeader}>
                <Text style={styles.circleName}>{item.name}</Text>
                <Text style={styles.memberCount}>{item.memberCount} members</Text>
              </View>
              {item.description ? (
                <Text style={styles.circleDesc}>{item.description}</Text>
              ) : null}
              <View style={styles.circleStats}>
                <View style={styles.circleStat}>
                  <Text style={styles.circleStatValue}>GHS {item.maxLoanAmount}</Text>
                  <Text style={styles.circleStatLabel}>Max Loan</Text>
                </View>
                <View style={styles.circleStat}>
                  <Text style={styles.circleStatValue}>{item.minTrustScore}</Text>
                  <Text style={styles.circleStatLabel}>Min Score</Text>
                </View>
                <View style={styles.circleStat}>
                  <Text style={styles.circleStatValue}>GHS {item.groupFundingThreshold}</Text>
                  <Text style={styles.circleStatLabel}>Group Threshold</Text>
                </View>
              </View>
            </TouchableOpacity>
          )}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); loadCircles(); }} tintColor="#e94560" />}
        />
      )}

      {/* Create Circle Modal */}
      <Modal visible={showCreate} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <ScrollView>
              <Text style={styles.modalTitle}>Create a Circle</Text>

              <Text style={styles.label}>Circle Name *</Text>
              <TextInput
                style={styles.input}
                placeholder="e.g. The Boys"
                placeholderTextColor="#555"
                value={newCircle.name}
                onChangeText={(t) => setNewCircle({ ...newCircle, name: t })}
              />

              <Text style={styles.label}>Description</Text>
              <TextInput
                style={[styles.input, { height: 80 }]}
                placeholder="What's this circle about?"
                placeholderTextColor="#555"
                value={newCircle.description}
                onChangeText={(t) => setNewCircle({ ...newCircle, description: t })}
                multiline
              />

              <Text style={styles.label}>Max Loan Amount (GHS)</Text>
              <TextInput
                style={styles.input}
                placeholder="5000"
                placeholderTextColor="#555"
                value={newCircle.maxLoanAmount}
                onChangeText={(t) => setNewCircle({ ...newCircle, maxLoanAmount: t })}
                keyboardType="numeric"
              />

              <Text style={styles.label}>Group Funding Threshold (GHS)</Text>
              <TextInput
                style={styles.input}
                placeholder="3000"
                placeholderTextColor="#555"
                value={newCircle.groupFundingThreshold}
                onChangeText={(t) => setNewCircle({ ...newCircle, groupFundingThreshold: t })}
                keyboardType="numeric"
              />

              <Text style={styles.label}>Minimum Trust Score</Text>
              <TextInput
                style={styles.input}
                placeholder="0"
                placeholderTextColor="#555"
                value={newCircle.minTrustScore}
                onChangeText={(t) => setNewCircle({ ...newCircle, minTrustScore: t })}
                keyboardType="numeric"
              />

              <TouchableOpacity
                style={[styles.createBtn, creating && { opacity: 0.6 }]}
                onPress={handleCreate}
                disabled={creating}
              >
                {creating ? <ActivityIndicator color="#fff" /> : <Text style={styles.createBtnText}>Create Circle</Text>}
              </TouchableOpacity>

              <TouchableOpacity style={styles.cancelBtn} onPress={() => setShowCreate(false)}>
                <Text style={styles.cancelBtnText}>Cancel</Text>
              </TouchableOpacity>
            </ScrollView>
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
  addButton: { backgroundColor: '#e94560', borderRadius: 8, paddingHorizontal: 16, paddingVertical: 8 },
  addButtonText: { color: '#fff', fontWeight: '600' },
  emptyIcon: { fontSize: 48, marginBottom: 16 },
  emptyText: { color: '#fff', fontSize: 18, fontWeight: '600' },
  emptySubtext: { color: '#a0a0b0', fontSize: 14, marginTop: 8 },
  circleCard: { backgroundColor: '#16213e', marginHorizontal: 24, marginBottom: 12, borderRadius: 16, padding: 20 },
  circleCardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  circleName: { color: '#fff', fontSize: 18, fontWeight: 'bold' },
  memberCount: { color: '#e94560', fontSize: 14 },
  circleDesc: { color: '#a0a0b0', fontSize: 14, marginTop: 8 },
  circleStats: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 16, paddingTop: 16, borderTopWidth: 1, borderTopColor: '#2a2a4a' },
  circleStat: { alignItems: 'center' },
  circleStatValue: { color: '#fff', fontSize: 14, fontWeight: '600' },
  circleStatLabel: { color: '#a0a0b0', fontSize: 11, marginTop: 4 },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.7)', justifyContent: 'center', padding: 24 },
  modalContent: { backgroundColor: '#16213e', borderRadius: 16, padding: 24, maxHeight: '80%' },
  modalTitle: { color: '#fff', fontSize: 22, fontWeight: 'bold', marginBottom: 20, textAlign: 'center' },
  label: { color: '#a0a0b0', fontSize: 14, marginBottom: 6, marginTop: 12 },
  input: { backgroundColor: '#1a1a2e', borderRadius: 12, padding: 14, fontSize: 16, color: '#fff', borderWidth: 1, borderColor: '#2a2a4a' },
  createBtn: { backgroundColor: '#e94560', borderRadius: 12, padding: 16, alignItems: 'center', marginTop: 24 },
  createBtnText: { color: '#fff', fontSize: 16, fontWeight: 'bold' },
  cancelBtn: { padding: 16, alignItems: 'center', marginTop: 8 },
  cancelBtnText: { color: '#a0a0b0', fontSize: 16 },
});
