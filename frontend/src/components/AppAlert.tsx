import React, { createContext, useContext, useState, useCallback, useRef, useEffect } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, TouchableWithoutFeedback,
  Animated, Dimensions, Modal,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';

const DARK = '#0f172a';
const SUCCESS_GREEN = '#22c55e';
const ERROR_RED = '#ef4444';
const WHITE = '#ffffff';

const AUTO_DISMISS_MS = 3000;

type AlertType = 'success' | 'error';

interface AlertState {
  visible: boolean;
  type: AlertType;
  title: string;
  message: string;
}

type ShowAlert = (type: AlertType, title: string, message: string) => void;

const AlertContext = createContext<ShowAlert>(() => {});

export const useAppAlert = (): { showAlert: ShowAlert } => {
  const showAlert = useContext(AlertContext);
  return { showAlert };
};

export const AppAlertHost: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [alert, setAlert] = useState<AlertState>({ visible: false, type: 'success', title: '', message: '' });
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const scaleAnim = useRef(new Animated.Value(0.9)).current;
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const dismiss = useCallback(() => {
    Animated.parallel([
      Animated.timing(fadeAnim, { toValue: 0, duration: 200, useNativeDriver: true }),
      Animated.timing(scaleAnim, { toValue: 0.9, duration: 200, useNativeDriver: true }),
    ]).start(() => setAlert(prev => ({ ...prev, visible: false })));
  }, [fadeAnim, scaleAnim]);

  const showAlert: ShowAlert = useCallback((type, title, message) => {
    if (timerRef.current) clearTimeout(timerRef.current);

    setAlert({ visible: true, type, title, message });
    fadeAnim.setValue(0);
    scaleAnim.setValue(0.9);

    Animated.parallel([
      Animated.timing(fadeAnim, { toValue: 1, duration: 250, useNativeDriver: true }),
      Animated.spring(scaleAnim, { toValue: 1, useNativeDriver: true, damping: 18, stiffness: 200 }),
    ]).start();

    if (type === 'success') {
      timerRef.current = setTimeout(dismiss, AUTO_DISMISS_MS);
    }
  }, [fadeAnim, scaleAnim, dismiss]);

  useEffect(() => {
    return () => { if (timerRef.current) clearTimeout(timerRef.current); };
  }, []);

  const accentColor = alert.type === 'error' ? ERROR_RED : SUCCESS_GREEN;
  const iconName = alert.type === 'error' ? 'close-circle' : 'checkmark-circle';

  return (
    <AlertContext.Provider value={showAlert}>
      {children}
      <Modal visible={alert.visible} transparent animationType="none">
        <TouchableWithoutFeedback onPress={alert.type === 'error' ? dismiss : undefined}>
          <Animated.View style={[styles.backdrop, { opacity: fadeAnim }]}>
            <Animated.View style={[styles.card, { borderLeftColor: accentColor, transform: [{ scale: scaleAnim }] }]}>
              <View style={styles.header}>
                <Ionicons name={iconName} size={24} color={accentColor} />
                <Text style={styles.title}>{alert.title}</Text>
                <TouchableOpacity onPress={dismiss} hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}>
                  <Ionicons name="close" size={20} color="#94a3b8" />
                </TouchableOpacity>
              </View>
              <Text style={styles.message}>{alert.message}</Text>
              {alert.type === 'error' && (
                <TouchableOpacity style={[styles.dismissBtn, { backgroundColor: accentColor }]} onPress={dismiss}>
                  <Text style={styles.dismissText}>Dismiss</Text>
                </TouchableOpacity>
              )}
            </Animated.View>
          </Animated.View>
        </TouchableWithoutFeedback>
      </Modal>
    </AlertContext.Provider>
  );
};

const { width } = Dimensions.get('window');

const styles = StyleSheet.create({
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(15, 23, 42, 0.4)',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 9999,
  },
  card: {
    width: width - 32,
    maxWidth: 420,
    backgroundColor: WHITE,
    borderRadius: 14,
    padding: 20,
    borderLeftWidth: 4,
    shadowColor: DARK,
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.15,
    shadowRadius: 24,
    elevation: 12,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginBottom: 8,
  },
  title: {
    flex: 1,
    fontSize: 16,
    fontWeight: '700',
    color: DARK,
  },
  message: {
    fontSize: 14,
    color: '#475569',
    lineHeight: 20,
    marginLeft: 34,
  },
  dismissBtn: {
    alignSelf: 'flex-end',
    marginTop: 16,
    paddingHorizontal: 20,
    paddingVertical: 8,
    borderRadius: 8,
  },
  dismissText: {
    color: WHITE,
    fontSize: 13,
    fontWeight: '600',
  },
});
