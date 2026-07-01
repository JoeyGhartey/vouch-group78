import React, { createContext, useContext, useState, useCallback, useRef } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, TouchableWithoutFeedback,
  Animated, Dimensions, Modal,
} from 'react-native';

const DARK = '#0f172a';
const ACCENT = '#C9A84C';
const MUTED = '#6B7280';
const BORDER = '#E5E7EB';
const WHITE = '#ffffff';

interface ConfirmState {
  visible: boolean;
  title: string;
  message: string;
  confirmLabel: string;
}

type ConfirmFn = (title: string, message: string, confirmLabel: string) => Promise<boolean>;

const ConfirmContext = createContext<ConfirmFn>(async () => false);

export const useConfirmModal = (): { confirm: ConfirmFn } => {
  const confirm = useContext(ConfirmContext);
  return { confirm };
};

export const ConfirmModalHost: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [state, setState] = useState<ConfirmState>({ visible: false, title: '', message: '', confirmLabel: 'Confirm' });
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const scaleAnim = useRef(new Animated.Value(0.9)).current;
  const resolveRef = useRef<((value: boolean) => void) | null>(null);

  const animateIn = useCallback(() => {
    fadeAnim.setValue(0);
    scaleAnim.setValue(0.9);
    Animated.parallel([
      Animated.timing(fadeAnim, { toValue: 1, duration: 250, useNativeDriver: true }),
      Animated.spring(scaleAnim, { toValue: 1, useNativeDriver: true, damping: 18, stiffness: 200 }),
    ]).start();
  }, [fadeAnim, scaleAnim]);

  const animateOut = useCallback((result: boolean) => {
    resolveRef.current?.(result);
    resolveRef.current = null;
    Animated.parallel([
      Animated.timing(fadeAnim, { toValue: 0, duration: 200, useNativeDriver: true }),
      Animated.timing(scaleAnim, { toValue: 0.9, duration: 200, useNativeDriver: true }),
    ]).start(() => {
      setState(prev => ({ ...prev, visible: false }));
    });
  }, [fadeAnim, scaleAnim]);

  const confirm: ConfirmFn = useCallback((title, message, confirmLabel) => {
    return new Promise<boolean>((resolve) => {
      resolveRef.current = resolve;
      setState({ visible: true, title, message, confirmLabel });
      animateIn();
    });
  }, [animateIn]);

  return (
    <ConfirmContext.Provider value={confirm}>
      {children}
      <Modal visible={state.visible} transparent animationType="none">
        <TouchableWithoutFeedback onPress={() => animateOut(false)}>
          <Animated.View style={[styles.backdrop, { opacity: fadeAnim }]}>
            <TouchableWithoutFeedback onPress={() => {}}>
              <Animated.View style={[styles.card, { transform: [{ scale: scaleAnim }] }]}>
                <Text style={styles.title}>{state.title}</Text>
                <Text style={styles.message}>{state.message}</Text>
                <View style={styles.buttons}>
                  <TouchableOpacity style={styles.cancelBtn} onPress={() => animateOut(false)}>
                    <Text style={styles.cancelText}>Cancel</Text>
                  </TouchableOpacity>
                  <TouchableOpacity style={styles.confirmBtn} onPress={() => animateOut(true)}>
                    <Text style={styles.confirmText}>{state.confirmLabel}</Text>
                  </TouchableOpacity>
                </View>
              </Animated.View>
            </TouchableWithoutFeedback>
          </Animated.View>
        </TouchableWithoutFeedback>
      </Modal>
    </ConfirmContext.Provider>
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
    width: width - 48,
    maxWidth: 380,
    backgroundColor: WHITE,
    borderRadius: 16,
    padding: 24,
    shadowColor: DARK,
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.15,
    shadowRadius: 24,
    elevation: 12,
  },
  title: {
    fontSize: 18,
    fontWeight: '700',
    color: DARK,
    textAlign: 'center',
    marginBottom: 10,
  },
  message: {
    fontSize: 14,
    color: MUTED,
    lineHeight: 20,
    textAlign: 'center',
    marginBottom: 24,
  },
  buttons: {
    flexDirection: 'row',
    gap: 12,
  },
  cancelBtn: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: BORDER,
    alignItems: 'center',
  },
  cancelText: {
    fontSize: 14,
    fontWeight: '600',
    color: MUTED,
  },
  confirmBtn: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 10,
    backgroundColor: ACCENT,
    alignItems: 'center',
  },
  confirmText: {
    fontSize: 14,
    fontWeight: '700',
    color: WHITE,
  },
});
