import React, { useState, useMemo } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet,
  ActivityIndicator, KeyboardAvoidingView, Platform, ScrollView,
} from 'react-native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { login } from '../services/api';
import { useAppAlert } from '../components/AppAlert';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';
import { RootStackParamList } from '../navigation/AppNavigator';
import { ColorScheme } from '../theme/colors';

type Props = {
  navigation: NativeStackNavigationProp<RootStackParamList, 'Login'>;
};

type LoginMethod = 'phone' | 'email';

const createStyles = (c: ColorScheme) => StyleSheet.create({
  container: { flex: 1, backgroundColor: c.bg },
  scroll: { flexGrow: 1, justifyContent: 'center', padding: 24 },
  logoSection: { alignItems: 'center', marginBottom: 48 },
  logoBox: {
    width: 72, height: 72, borderRadius: 22,
    backgroundColor: c.dark, justifyContent: 'center', alignItems: 'center',
    marginBottom: 16, shadowColor: c.dark, shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15, shadowRadius: 12, elevation: 6,
  },
  logoText: { fontSize: 36, fontWeight: '900', color: c.accent },
  logoName: { fontSize: 28, fontWeight: '900', color: c.dark, letterSpacing: 6 },
  logoSub: { fontSize: 13, color: c.muted, marginTop: 6 },
  form: {
    backgroundColor: c.surface, borderRadius: 20, padding: 24,
    borderWidth: 1, borderColor: c.border,
    shadowColor: c.dark, shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06, shadowRadius: 8, elevation: 3,
  },
  formTitle: { fontSize: 20, fontWeight: '700', color: c.dark, marginBottom: 4 },
  formSub: { fontSize: 13, color: c.muted, marginBottom: 20 },
  // Toggle
  toggle: {
    flexDirection: 'row',
    backgroundColor: c.bg,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: c.border,
    padding: 3,
    marginBottom: 4,
  },
  toggleBtn: {
    flex: 1,
    paddingVertical: 9,
    alignItems: 'center',
    borderRadius: 8,
  },
  toggleBtnActive: {
    backgroundColor: c.surface,
    borderWidth: 1,
    borderColor: c.border,
    shadowColor: c.dark,
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.06,
    shadowRadius: 2,
    elevation: 1,
  },
  toggleText: { fontSize: 13, fontWeight: '600', color: c.muted },
  toggleTextActive: { color: c.dark },
  label: { fontSize: 12, color: c.muted, fontWeight: '600', marginBottom: 6, marginTop: 16 },
  input: {
    backgroundColor: c.bg, borderRadius: 12, padding: 14,
    fontSize: 15, color: c.dark, borderWidth: 1, borderColor: c.border,
  },
  btn: {
    backgroundColor: c.dark, borderRadius: 12, padding: 16,
    alignItems: 'center', marginTop: 24,
  },
  btnText: { color: c.surface, fontSize: 16, fontWeight: '700' },
  linkBtn: { alignItems: 'center', marginTop: 20 },
  linkText: { color: c.muted, fontSize: 14 },
  linkBold: { color: c.accent, fontWeight: '700' },
});

export default function LoginScreen({ navigation }: Props) {
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);

  const [loginMethod, setLoginMethod] = useState<LoginMethod>('phone');
  const [phone, setPhone] = useState<string>('');
  const [email, setEmail] = useState<string>('');
  const [password, setPassword] = useState<string>('');
  const [loading, setLoading] = useState<boolean>(false);
  const { signIn } = useAuth();
  const { showAlert } = useAppAlert();

  const handleLogin = async (): Promise<void> => {
    const identifier = loginMethod === 'phone' ? phone : email;

    if (!identifier || !password) {
      showAlert('error', 'Error', `Please enter your ${loginMethod === 'phone' ? 'phone number' : 'email address'} and password`);
      return;
    }

    if (loginMethod === 'email' && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      showAlert('error', 'Error', 'Please enter a valid email address');
      return;
    }

    setLoading(true);
    try {
      const response = await login({ loginMethod, identifier, password }) as { token: string; [key: string]: unknown };
      await signIn(response);
    } catch (error) {
      showAlert('error', 'Login Failed', (error as Error).message || 'Invalid credentials');
    } finally {
      setLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView style={styles.container} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">

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

          {/* Toggle */}
          <View style={styles.toggle}>
            <TouchableOpacity
              style={[styles.toggleBtn, loginMethod === 'phone' && styles.toggleBtnActive]}
              onPress={() => setLoginMethod('phone')}
            >
              <Text style={[styles.toggleText, loginMethod === 'phone' && styles.toggleTextActive]}>
                Phone number
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.toggleBtn, loginMethod === 'email' && styles.toggleBtnActive]}
              onPress={() => setLoginMethod('email')}
            >
              <Text style={[styles.toggleText, loginMethod === 'email' && styles.toggleTextActive]}>
                Email address
              </Text>
            </TouchableOpacity>
          </View>

          {/* Phone input */}
          {loginMethod === 'phone' && (
            <>
              <Text style={styles.label}>Phone Number</Text>
              <TextInput
                style={styles.input}
                placeholder="e.g. 0241234567"
                placeholderTextColor={colors.muted}
                value={phone}
                onChangeText={setPhone}
                keyboardType="phone-pad"
                autoCapitalize="none"
              />
            </>
          )}

          {/* Email input */}
          {loginMethod === 'email' && (
            <>
              <Text style={styles.label}>Email Address</Text>
              <TextInput
                style={styles.input}
                placeholder="e.g. you@example.com"
                placeholderTextColor={colors.muted}
                value={email}
                onChangeText={setEmail}
                keyboardType="email-address"
                autoCapitalize="none"
                autoCorrect={false}
              />
            </>
          )}

          <Text style={styles.label}>Password</Text>
          <TextInput
            style={styles.input}
            placeholder="Enter your password"
            placeholderTextColor={colors.muted}
            value={password}
            onChangeText={setPassword}
            secureTextEntry
          />

          <TouchableOpacity
            style={[styles.btn, loading && { opacity: 0.6 }]}
            onPress={handleLogin}
            disabled={loading}
          >
            {loading ? <ActivityIndicator color={colors.surface} /> : <Text style={styles.btnText}>Log In</Text>}
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