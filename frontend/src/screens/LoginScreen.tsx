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

// Maps backend error messages to friendly user-facing messages
const getFriendlyError = (message: string, loginMethod: LoginMethod): string => {
  const msg = message.toLowerCase();
  if (msg.includes('no account found') || msg.includes('user not found')) {
    return loginMethod === 'email'
      ? 'No account found with this email address. Please check or sign up.'
      : 'No account found with this phone number. Please check or sign up.';
  }
  if (msg.includes('invalid password') || msg.includes('bad credentials') || msg.includes('unauthorized')) {
    return 'Incorrect password. Please try again.';
  }
  if (msg.includes('banned') || msg.includes('permanent ban')) {
    return 'Your account has been suspended. Please contact support.';
  }
  if (msg.includes('network') || msg.includes('failed to fetch') || msg.includes('connection')) {
    return 'Connection error. Please check your internet and try again.';
  }
  return message || 'Something went wrong. Please try again.';
};

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
  inputError: {
    borderColor: '#dc2626',
  },
  errorText: {
    fontSize: 11, color: '#dc2626', marginTop: 4, fontWeight: '500',
  },
  btn: {
    backgroundColor: c.dark, borderRadius: 12, padding: 16,
    alignItems: 'center', marginTop: 24,
  },
  btnText: { color: c.surface, fontSize: 16, fontWeight: '700' },
  linkBtn: { alignItems: 'center', marginTop: 20 },
  linkText: { color: c.muted, fontSize: 14 },
  linkBold: { color: c.accent, fontWeight: '700' },
  forgotBtn: { alignItems: 'flex-end', marginTop: 6 },
  forgotText: { fontSize: 12, color: c.accent, fontWeight: '600' },
});

export default function LoginScreen({ navigation }: Props) {
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);

  const [loginMethod, setLoginMethod] = useState<LoginMethod>('phone');
  const [phone, setPhone] = useState<string>('');
  const [email, setEmail] = useState<string>('');
  const [password, setPassword] = useState<string>('');
  const [passwordError, setPasswordError] = useState<string>('');
  const [identifierError, setIdentifierError] = useState<string>('');
  const [loading, setLoading] = useState<boolean>(false);
  const { signIn } = useAuth();
  const { showAlert } = useAppAlert();

  const handleLogin = async (): Promise<void> => {
    // Reset errors
    setPasswordError('');
    setIdentifierError('');

    const identifier = loginMethod === 'phone' ? phone : email;

    if (!identifier) {
      setIdentifierError(loginMethod === 'phone' ? 'Please enter your phone number' : 'Please enter your email address');
      return;
    }

    if (loginMethod === 'email' && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      setIdentifierError('Please enter a valid email address');
      return;
    }

    if (!password) {
      setPasswordError('Please enter your password');
      return;
    }

    setLoading(true);
    try {
      const response = await login({ loginMethod, identifier, password }) as { token: string; [key: string]: unknown };
      await signIn(response);
    } catch (error) {
      const raw = (error as Error).message || '';
      const friendly = getFriendlyError(raw, loginMethod);

      // Show inline error under password field for wrong password
      if (raw.toLowerCase().includes('invalid password') || raw.toLowerCase().includes('bad credentials') || raw.toLowerCase().includes('unauthorized')) {
        setPasswordError('Incorrect password. Please try again.');
      } else if (raw.toLowerCase().includes('no account') || raw.toLowerCase().includes('user not found')) {
        setIdentifierError(friendly);
      } else {
        showAlert('error', 'Login Failed', friendly);
      }
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
              onPress={() => { setLoginMethod('phone'); setIdentifierError(''); }}
            >
              <Text style={[styles.toggleText, loginMethod === 'phone' && styles.toggleTextActive]}>
                Phone number
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.toggleBtn, loginMethod === 'email' && styles.toggleBtnActive]}
              onPress={() => { setLoginMethod('email'); setIdentifierError(''); }}
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
                style={[styles.input, identifierError ? styles.inputError : null]}
                placeholder="e.g. 0241234567"
                placeholderTextColor={colors.muted}
                value={phone}
                onChangeText={(t) => { setPhone(t); setIdentifierError(''); }}
                keyboardType="phone-pad"
                autoCapitalize="none"
              />
              {identifierError ? <Text style={styles.errorText}>{identifierError}</Text> : null}
            </>
          )}

          {/* Email input */}
          {loginMethod === 'email' && (
            <>
              <Text style={styles.label}>Email Address</Text>
              <TextInput
                style={[styles.input, identifierError ? styles.inputError : null]}
                placeholder="e.g. you@example.com"
                placeholderTextColor={colors.muted}
                value={email}
                onChangeText={(t) => { setEmail(t); setIdentifierError(''); }}
                keyboardType="email-address"
                autoCapitalize="none"
                autoCorrect={false}
              />
              {identifierError ? <Text style={styles.errorText}>{identifierError}</Text> : null}
            </>
          )}

          <Text style={styles.label}>Password</Text>
          <TextInput
            style={[styles.input, passwordError ? styles.inputError : null]}
            placeholder="Enter your password"
            placeholderTextColor={colors.muted}
            value={password}
            onChangeText={(t) => { setPassword(t); setPasswordError(''); }}
            secureTextEntry
          />
          {passwordError ? <Text style={styles.errorText}>{passwordError}</Text> : null}

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