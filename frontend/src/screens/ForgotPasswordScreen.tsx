import React, { useState, useMemo } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet,
  ActivityIndicator, KeyboardAvoidingView, Platform, ScrollView, Image,
} from 'react-native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { forgotPassword, resetPassword } from '../services/api';
import { useAppAlert } from '../components/AppAlert';
import { useTheme } from '../context/ThemeContext';
import { RootStackParamList } from '../navigation/AppNavigator';
import { ColorScheme } from '../theme/colors';
import { fonts } from '../theme/fonts';

type Props = {
  navigation: NativeStackNavigationProp<RootStackParamList, 'ForgotPassword'>;
};

const getPasswordStrength = (pwd: string, c: ColorScheme): { score: number; label: string; color: string } => {
  let score = 0;
  if (pwd.length >= 6) score++;
  if (/[A-Z]/.test(pwd)) score++;
  if (/[0-9]/.test(pwd)) score++;
  if (/[^A-Za-z0-9]/.test(pwd)) score++;

  if (score === 0 || pwd.length === 0) return { score: 0, label: '', color: 'transparent' };
  if (score === 1) return { score: 1, label: 'Weak', color: c.danger };
  if (score === 2) return { score: 2, label: 'Fair', color: c.warning };
  if (score === 3) return { score: 3, label: 'Good', color: c.statusBlue };
  return { score: 4, label: 'Strong', color: c.success };
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
    padding: 22, paddingTop: 20,
    marginHorizontal: 16, marginTop: -20,
    borderWidth: 1, borderColor: c.border,
    shadowColor: '#000', shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.12, shadowRadius: 20, elevation: 8,
  },
  formTitle: { fontSize: 18, fontWeight: '800', fontFamily: fonts.extrabold, color: c.dark, marginBottom: 4 },
  formSub: { fontSize: 13, color: c.muted, marginBottom: 8, lineHeight: 19 },
  label: { fontSize: 11, color: c.muted, fontWeight: '700', fontFamily: fonts.bold, marginBottom: 6, marginTop: 18, letterSpacing: 0.6, textTransform: 'uppercase' },
  labelFirst: { marginTop: 4 },
  input: {
    backgroundColor: 'transparent', borderRadius: 0, paddingVertical: 10, paddingHorizontal: 2,
    fontSize: 16, color: c.dark, borderBottomWidth: 1.5, borderColor: c.border,
  },
  inputError: { borderColor: c.danger },
  errorText: { fontSize: 11, color: c.danger, marginTop: 6, fontWeight: '500', fontFamily: fonts.medium },

  channelRow: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    marginTop: 16, padding: 12, borderRadius: 12,
    backgroundColor: c.goldBgTint, borderWidth: 1, borderColor: c.border,
  },
  channelIconBox: {
    width: 28, height: 28, borderRadius: 8,
    backgroundColor: c.surface, justifyContent: 'center', alignItems: 'center',
  },
  channelText: { fontSize: 12, color: c.dark, flex: 1, lineHeight: 17 },
  channelTextBold: { fontWeight: '700', fontFamily: fonts.bold },

  strengthRow: { flexDirection: 'row', gap: 4, marginTop: 10 },
  strengthBar: { flex: 1, height: 4, borderRadius: 4, backgroundColor: c.border },
  strengthLabel: { fontSize: 11, fontWeight: '600', fontFamily: fonts.semibold, marginTop: 4 },
  rulesBox: { flexDirection: 'row', flexWrap: 'wrap', marginTop: 8, rowGap: 6 },
  ruleRow: { flexDirection: 'row', alignItems: 'center', gap: 6, width: '50%' },
  ruleDot: { width: 6, height: 6, borderRadius: 3 },
  ruleText: { fontSize: 11 },
  matchText: { fontSize: 11, fontWeight: '600', fontFamily: fonts.semibold, marginTop: 6 },

  btn: {
    backgroundColor: c.buttonDark, borderRadius: 12, padding: 16,
    alignItems: 'center', marginTop: 26,
    shadowColor: c.accent, shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25, shadowRadius: 10, elevation: 4,
  },
  btnText: { color: c.buttonDarkText, fontSize: 16, fontWeight: '700', fontFamily: fonts.bold },
  linkBtn: { alignItems: 'center', marginTop: 18 },
  linkText: { color: c.muted, fontSize: 14 },
  linkBold: { color: c.accent, fontWeight: '700', fontFamily: fonts.bold },
  backBtn: { alignItems: 'center', marginTop: 6 },
  backText: { color: c.muted, fontSize: 13 },
});

export default function ForgotPasswordScreen({ navigation }: Props) {
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const { showAlert } = useAppAlert();

  const [step, setStep] = useState<'identify' | 'reset'>('identify');
  const [identifier, setIdentifier] = useState<string>('');
  const [identifierError, setIdentifierError] = useState<string>('');
  const [otp, setOtp] = useState<string>('');
  const [newPassword, setNewPassword] = useState<string>('');
  const [confirmPassword, setConfirmPassword] = useState<string>('');
  const [loading, setLoading] = useState<boolean>(false);

  const isEmail = identifier.includes('@');

  const strength = getPasswordStrength(newPassword, colors);
  const rules = [
    { label: 'At least 6 characters', met: newPassword.length >= 6 },
    { label: 'One uppercase letter (A-Z)', met: /[A-Z]/.test(newPassword) },
    { label: 'One number (0-9)', met: /[0-9]/.test(newPassword) },
    { label: 'One special character (!@#$...)', met: /[^A-Za-z0-9]/.test(newPassword) },
  ];

  const handleIdentify = async (): Promise<void> => {
    setIdentifierError('');
    if (!identifier.trim()) {
      setIdentifierError('Please enter your phone number or email');
      return;
    }
    setLoading(true);
    try {
      const result = await forgotPassword(identifier.trim()) as { message: string };
      showAlert('success', isEmail ? 'Check Your Email' : 'Check Your Notifications', result.message);
      setStep('reset');
    } catch (error) {
      setIdentifierError((error as Error).message || 'Something went wrong');
    } finally {
      setLoading(false);
    }
  };

  const handleReset = async (): Promise<void> => {
    if (!otp.trim()) {
      showAlert('error', 'Error', 'Enter the 6-digit code we sent you'); return;
    }
    if (!newPassword) {
      showAlert('error', 'Error', 'Please enter a new password'); return;
    }
    if (!rules.every(r => r.met)) {
      showAlert('error', 'Weak Password', 'Password does not meet the requirements below'); return;
    }
    if (newPassword !== confirmPassword) {
      showAlert('error', 'Error', 'Passwords do not match'); return;
    }
    setLoading(true);
    try {
      const result = await resetPassword(identifier.trim(), otp.trim(), newPassword) as { message: string };
      showAlert('success', 'Password Reset', result.message);
      navigation.navigate('Login');
    } catch (error) {
      showAlert('error', 'Error', (error as Error).message || 'Could not reset password');
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
          <Text style={styles.headline}>
            {step === 'identify' ? "Let's get you back in." : 'Set a new password.'}
          </Text>
          <Text style={styles.logoSub}>Inner Circle Lending</Text>
        </View>

        {/* Form */}
        <View style={styles.form}>
          {step === 'identify' ? (
            <>
              <Text style={styles.formTitle}>Forgot Password?</Text>
              <Text style={styles.formSub}>
                Enter the phone number or email on your account. Use your phone number to get a code by
                push notification, or your email to get a code by email.
              </Text>

              <Text style={[styles.label, styles.labelFirst]}>Phone or Email</Text>
              <TextInput
                style={[styles.input, identifierError ? styles.inputError : null]}
                placeholder="e.g. 0241234567 or you@example.com"
                placeholderTextColor={colors.muted}
                value={identifier}
                onChangeText={(t) => { setIdentifier(t); setIdentifierError(''); }}
                autoCapitalize="none"
                autoCorrect={false}
              />
              {identifierError ? <Text style={styles.errorText}>{identifierError}</Text> : null}

              <TouchableOpacity
                style={[styles.btn, loading && { opacity: 0.6 }]}
                onPress={handleIdentify}
                disabled={loading}
              >
                {loading ? <ActivityIndicator color={colors.buttonDarkText} /> : <Text style={styles.btnText}>Continue</Text>}
              </TouchableOpacity>
            </>
          ) : (
            <>
              <Text style={styles.formTitle}>Enter Your Code</Text>
              <Text style={styles.formSub}>
                Enter the 6-digit code and choose a new password. Didn't get it? Check your {isEmail ? 'spam folder' : 'notification settings'} or go back and try again.
              </Text>

              <Text style={[styles.label, styles.labelFirst]}>Verification Code</Text>
              <TextInput
                style={styles.input}
                placeholder="6-digit code"
                placeholderTextColor={colors.muted}
                value={otp}
                onChangeText={setOtp}
                keyboardType="number-pad"
                maxLength={6}
              />

              <Text style={styles.label}>New Password</Text>
              <TextInput
                style={styles.input}
                placeholder="At least 6 characters"
                placeholderTextColor={colors.muted}
                value={newPassword}
                onChangeText={setNewPassword}
                secureTextEntry
              />

              {newPassword.length > 0 && (
                <>
                  <View style={styles.strengthRow}>
                    {[1, 2, 3, 4].map((i) => (
                      <View
                        key={i}
                        style={[
                          styles.strengthBar,
                          { backgroundColor: i <= strength.score ? strength.color : colors.border },
                        ]}
                      />
                    ))}
                  </View>
                  <Text style={[styles.strengthLabel, { color: strength.color }]}>
                    {strength.label}
                  </Text>

                  <View style={styles.rulesBox}>
                    {rules.map((rule, i) => (
                      <View key={i} style={styles.ruleRow}>
                        <View style={[styles.ruleDot, { backgroundColor: rule.met ? colors.success : colors.muted }]} />
                        <Text style={[styles.ruleText, { color: rule.met ? colors.success : colors.muted }]}>
                          {rule.label}
                        </Text>
                      </View>
                    ))}
                  </View>
                </>
              )}

              <Text style={styles.label}>Confirm Password</Text>
              <TextInput
                style={styles.input}
                placeholder="Re-enter new password"
                placeholderTextColor={colors.muted}
                value={confirmPassword}
                onChangeText={setConfirmPassword}
                secureTextEntry
              />
              {confirmPassword.length > 0 && (
                <Text style={[styles.matchText, { color: confirmPassword === newPassword ? colors.success : colors.danger }]}>
                  {confirmPassword === newPassword ? 'Passwords match' : "Passwords don't match"}
                </Text>
              )}

              <TouchableOpacity
                style={[styles.btn, loading && { opacity: 0.6 }]}
                onPress={handleReset}
                disabled={loading}
              >
                {loading ? <ActivityIndicator color={colors.buttonDarkText} /> : <Text style={styles.btnText}>Reset Password</Text>}
              </TouchableOpacity>

              <TouchableOpacity style={styles.backBtn} onPress={() => setStep('identify')}>
                <Text style={styles.backText}>Wrong phone or email? Go back</Text>
              </TouchableOpacity>
            </>
          )}

          <TouchableOpacity style={styles.linkBtn} onPress={() => navigation.navigate('Login')}>
            <Text style={styles.linkText}>
              Remember your password? <Text style={styles.linkBold}>Log In</Text>
            </Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}
