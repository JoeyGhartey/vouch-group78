import React, { useState, useMemo } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet,
  ActivityIndicator, KeyboardAvoidingView, Platform, ScrollView,
} from 'react-native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { forgotPassword, resetPassword } from '../services/api';
import { useAppAlert } from '../components/AppAlert';
import { useTheme } from '../context/ThemeContext';
import { RootStackParamList } from '../navigation/AppNavigator';
import { ColorScheme } from '../theme/colors';

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

const createStyles = (c: ColorScheme) => StyleSheet.create({
  container: { flex: 1, backgroundColor: c.bg },
  scroll: { flexGrow: 1, justifyContent: 'center', padding: 24 },
  logoSection: { alignItems: 'center', marginBottom: 48 },
  logoBox: {
    width: 72, height: 72, borderRadius: 22,
    backgroundColor: c.buttonDark, justifyContent: 'center', alignItems: 'center',
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
  label: { fontSize: 12, color: c.muted, fontWeight: '600', marginBottom: 6, marginTop: 16 },
  input: {
    backgroundColor: c.bg, borderRadius: 12, padding: 14,
    fontSize: 15, color: c.dark, borderWidth: 1, borderColor: c.border,
  },
  inputError: { borderColor: c.danger },
  errorText: { fontSize: 11, color: c.danger, marginTop: 4, fontWeight: '500' },
  strengthRow: { flexDirection: 'row', gap: 4, marginTop: 8 },
  strengthBar: { flex: 1, height: 4, borderRadius: 4, backgroundColor: c.border },
  strengthLabel: { fontSize: 11, fontWeight: '600', marginTop: 4 },
  rulesBox: { marginTop: 8, gap: 3 },
  ruleRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  ruleDot: { width: 6, height: 6, borderRadius: 3 },
  ruleText: { fontSize: 11 },
  btn: {
    backgroundColor: c.buttonDark, borderRadius: 12, padding: 16,
    alignItems: 'center', marginTop: 24,
  },
  btnText: { color: c.buttonDarkText, fontSize: 16, fontWeight: '700' },
  linkBtn: { alignItems: 'center', marginTop: 20 },
  linkText: { color: c.muted, fontSize: 14 },
  linkBold: { color: c.accent, fontWeight: '700' },
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
      showAlert('success', 'Check Your Details', result.message);
      setStep('reset');
    } catch (error) {
      console.log('Forgot password error:', error);
      showAlert('error', 'Error', (error as Error).message || 'Something went wrong');
    } finally {
      setLoading(false);
    }
  };

  const handleReset = async (): Promise<void> => {
    if (!otp.trim()) {
      showAlert('error', 'Error', 'Enter the 6-digit code sent to your device'); return;
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

        <View style={styles.logoSection}>
          <View style={styles.logoBox}>
            <Text style={styles.logoText}>V</Text>
          </View>
          <Text style={styles.logoName}>VOUCH</Text>
          <Text style={styles.logoSub}>Inner Circle Lending</Text>
        </View>

        <View style={styles.form}>
          {step === 'identify' ? (
            <>
              <Text style={styles.formTitle}>Forgot Password?</Text>
              <Text style={styles.formSub}>Enter your phone number or email and we&apos;ll help you reset your password.</Text>

              <Text style={styles.label}>Phone or Email</Text>
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
              <Text style={styles.formTitle}>Set New Password</Text>
              <Text style={styles.formSub}>Enter the code sent to your device, then choose a new password.</Text>

              <Text style={styles.label}>Verification Code</Text>
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

              <TouchableOpacity
                style={[styles.btn, loading && { opacity: 0.6 }]}
                onPress={handleReset}
                disabled={loading}
              >
                {loading ? <ActivityIndicator color={colors.buttonDarkText} /> : <Text style={styles.btnText}>Reset Password</Text>}
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
