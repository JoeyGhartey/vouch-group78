import React, { useState } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet,
  Alert, ActivityIndicator, KeyboardAvoidingView, Platform, ScrollView,
} from 'react-native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { login } from '../services/api';
import { useAuth } from '../context/AuthContext';
import { RootStackParamList } from '../navigation/AppNavigator';

type Props = {
  navigation: NativeStackNavigationProp<RootStackParamList, 'Login'>;
};

const BG = '#F8F9FA';
const WHITE = '#FFFFFF';
const DARK = '#0f172a';
const MUTED = '#6B7280';
const BORDER = '#E5E7EB';
const ACCENT = '#C9A84C';

export default function LoginScreen({ navigation }: Props) {
  const [phone, setPhone] = useState<string>('');
  const [password, setPassword] = useState<string>('');
  const [loading, setLoading] = useState<boolean>(false);
  const { signIn } = useAuth();

  const handleLogin = async (): Promise<void> => {
    if (!phone || !password) { Alert.alert('Error', 'Please enter your phone number and password'); return; }
    setLoading(true);
    try {
      const response = await login({ phone, password }) as { token: string; [key: string]: unknown };
      await signIn(response);
    } catch (error) {
      Alert.alert('Login Failed', (error as Error).message || 'Invalid phone number or password');
    } finally {
      setLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView style={styles.container} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>

        {/* Logo */}
        <View style={styles.logoSection}>
          <View style={styles.logoBox}>
            <Text style={styles.logoText}>V</Text>
          </View>
          <Text style={styles.logoName}>VOUCH</Text>
          <Text style={styles.logoSub}>Inner Circle Lending</Text>
        </View>

        {/* Form */}
        <View style={styles.form}>
          <Text style={styles.formTitle}>Welcome back</Text>
          <Text style={styles.formSub}>Log in to your account</Text>

          <Text style={styles.label}>Phone Number</Text>
          <TextInput
            style={styles.input}
            placeholder="e.g. 0241234567"
            placeholderTextColor={MUTED}
            value={phone}
            onChangeText={setPhone}
            keyboardType="phone-pad"
            autoCapitalize="none"
          />

          <Text style={styles.label}>Password</Text>
          <TextInput
            style={styles.input}
            placeholder="Enter your password"
            placeholderTextColor={MUTED}
            value={password}
            onChangeText={setPassword}
            secureTextEntry
          />

          <TouchableOpacity
            style={[styles.btn, loading && { opacity: 0.6 }]}
            onPress={handleLogin}
            disabled={loading}
          >
            {loading ? <ActivityIndicator color={WHITE} /> : <Text style={styles.btnText}>Log In</Text>}
          </TouchableOpacity>

          <TouchableOpacity style={styles.linkBtn} onPress={() => navigation.navigate('Register')}>
            <Text style={styles.linkText}>
              Don't have an account? <Text style={styles.linkBold}>Sign Up</Text>
            </Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: BG },
  scroll: { flexGrow: 1, justifyContent: 'center', padding: 24 },
  logoSection: { alignItems: 'center', marginBottom: 48 },
  logoBox: {
    width: 72, height: 72, borderRadius: 22,
    backgroundColor: DARK, justifyContent: 'center', alignItems: 'center',
    marginBottom: 16, shadowColor: DARK, shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15, shadowRadius: 12, elevation: 6,
  },
  logoText: { fontSize: 36, fontWeight: '900', color: ACCENT },
  logoName: { fontSize: 28, fontWeight: '900', color: DARK, letterSpacing: 6 },
  logoSub: { fontSize: 13, color: MUTED, marginTop: 6 },
  form: {
    backgroundColor: WHITE, borderRadius: 20, padding: 24,
    borderWidth: 1, borderColor: BORDER,
    shadowColor: DARK, shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06, shadowRadius: 8, elevation: 3,
  },
  formTitle: { fontSize: 20, fontWeight: '700', color: DARK, marginBottom: 4 },
  formSub: { fontSize: 13, color: MUTED, marginBottom: 24 },
  label: { fontSize: 12, color: MUTED, fontWeight: '600', marginBottom: 6, marginTop: 16 },
  input: {
    backgroundColor: BG, borderRadius: 12, padding: 14,
    fontSize: 15, color: DARK, borderWidth: 1, borderColor: BORDER,
  },
  btn: {
    backgroundColor: DARK, borderRadius: 12, padding: 16,
    alignItems: 'center', marginTop: 24,
  },
  btnText: { color: WHITE, fontSize: 16, fontWeight: '700' },
  linkBtn: { alignItems: 'center', marginTop: 20 },
  linkText: { color: MUTED, fontSize: 14 },
  linkBold: { color: ACCENT, fontWeight: '700' },
});