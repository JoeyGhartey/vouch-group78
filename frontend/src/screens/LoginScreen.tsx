import React, { useState, useMemo } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet,
  ActivityIndicator, KeyboardAvoidingView, Platform, ScrollView, Image,
} from 'react-native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { login } from '../services/api';
import { useAppAlert } from '../components/AppAlert';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';
import { RootStackParamList } from '../navigation/AppNavigator';
import { ColorScheme } from '../theme/colors';
import { fonts } from '../theme/fonts';

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

const HERO_TEXT_MUTED = '#8a8f98';

const createStyles = (c: ColorScheme) => StyleSheet.create({
  container: { flex: 1, backgroundColor: c.bg },
  scroll: { flexGrow: 1, paddingBottom: 32 },
  heroSection: {
    backgroundColor: '#000000',
    paddingTop: 68, paddingBottom: 40, paddingHorizontal: 28,
    borderBottomRightRadius: 64,
  },
  logoRow: { flexDirection: 'row', alignItems: 'center' },
  logoImage: { width: 44, height: 48, marginRight: 10 },
  logoName: { fontSize: 15, fontWeight: '800', fontFamily: fonts.extrabold, color: c.accent, letterSpacing: 4 },
  headline: {
    fontSize: 34, fontWeight: '800', fontFamily: fonts.extrabold, color: '#FFFFFF',
    marginTop: 22, letterSpacing: -0.8, lineHeight: 38, maxWidth: '85%',
  },
  logoSub: { fontSize: 13, color: HERO_TEXT_MUTED, marginTop: 8 },
  form: {
    backgroundColor: c.surface, borderTopLeftRadius: 4, borderTopRightRadius: 28,
    borderBottomLeftRadius: 28, borderBottomRightRadius: 28,
    padding: 22, paddingTop: 8,
    marginHorizontal: 16, marginTop: -20,
    borderWidth: 1, borderColor: c.border,
    shadowColor: '#000', shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.12, shadowRadius: 20, elevation: 8,
  },
  toggle: {
    flexDirection: 'row', gap: 20,
    borderBottomWidth: 1, borderBottomColor: c.border,
    marginBottom: 4,
  },
  toggleBtn: { paddingVertical: 14, borderBottomWidth: 2, borderBottomColor: 'transparent' },
  toggleBtnActive: { borderBottomColor: c.accent },
  toggleText: { fontSize: 13, fontWeight: '600', fontFamily: fonts.semibold, color: c.muted, letterSpacing: 0.3 },
  toggleTextActive: { color: c.dark, fontWeight: '800', fontFamily: fonts.extrabold },
  label: { fontSize: 11, color: c.muted, fontWeight: '700', fontFamily: fonts.bold, marginBottom: 6, marginTop: 18, letterSpacing: 0.6, textTransform: 'uppercase' },
  input: {
    backgroundColor: 'transparent', borderRadius: 0, paddingVertical: 10, paddingHorizontal: 2,
    fontSize: 16, color: c.dark, borderBottomWidth: 1.5, borderColor: c.border, fontFamily: fonts.regular,
  },
  inputError: {
    borderColor: c.danger,
  },
  errorText: {
    fontSize: 11, color: c.danger, marginTop: 4, fontWeight: '500', fontFamily: fonts.medium,
  },
  btn: {
    backgroundColor: c.buttonDark, borderRadius: 12, padding: 16,
    alignItems: 'center', marginTop: 28,
    shadowColor: c.accent, shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25, shadowRadius: 10, elevation: 4,
  },
  btnText: { color: c.buttonDarkText, fontSize: 16, fontWeight: '700', fontFamily: fonts.bold },
  linkBtn: { alignItems: 'center', marginTop: 18 },
  linkText: { color: c.muted, fontSize: 14 },
  linkBold: { color: c.accent, fontWeight: '700', fontFamily: fonts.bold },
  forgotBtn: { alignItems: 'flex-end', marginTop: 10 },
  forgotText: { fontSize: 12, color: c.accent, fontWeight: '600', fontFamily: fonts.semibold },
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

        {/* Hero */}
        <View style={styles.heroSection}>
          <View style={styles.logoRow}>
            <Image source={require('../../assets/logo.png')} style={styles.logoImage} resizeMode="contain" />
            <Text style={styles.logoName}>VOUCH</Text>
          </View>
          <Text style={styles.headline}>Good to have you back.</Text>
          <Text style={styles.logoSub}>Inner Circle Lending</Text>
        </View>

        {/* Form */}
        <View style={styles.form}>
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
                onChangeText={(t) => { setPhone(t.replace(/[^0-9]/g, '').slice(0, 10)); setIdentifierError(''); }}
                keyboardType="phone-pad"
                autoCapitalize="none"
                maxLength={10}
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

          <TouchableOpacity style={styles.forgotBtn} onPress={() => navigation.navigate('ForgotPassword')}>
            <Text style={styles.forgotText}>Forgot Password?</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.btn, loading && { opacity: 0.6 }]}
            onPress={handleLogin}
            disabled={loading}
          >
            {loading ? <ActivityIndicator color={colors.buttonDarkText} /> : <Text style={styles.btnText}>Log In</Text>}
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