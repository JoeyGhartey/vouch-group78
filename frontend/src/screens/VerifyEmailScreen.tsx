import React, { useState, useMemo, useEffect } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet,
  ActivityIndicator, KeyboardAvoidingView, Platform, ScrollView, Image,
} from 'react-native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { RouteProp } from '@react-navigation/native';
import { verifyRegistration, resendRegistrationOtp } from '../services/api';
import { useAppAlert } from '../components/AppAlert';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';
import { RootStackParamList } from '../navigation/AppNavigator';
import { ColorScheme } from '../theme/colors';
import { fonts } from '../theme/fonts';

type Props = {
  navigation: NativeStackNavigationProp<RootStackParamList, 'VerifyEmail'>;
  route: RouteProp<RootStackParamList, 'VerifyEmail'>;
};

const HERO_TEXT_MUTED = '#8a8f98';
const RESEND_COOLDOWN_SECONDS = 45;

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
    fontSize: 30, fontWeight: '800', fontFamily: fonts.extrabold, color: '#FFFFFF',
    marginTop: 22, letterSpacing: -0.8, lineHeight: 36, maxWidth: '90%',
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
  formSubBold: { fontWeight: '700', fontFamily: fonts.bold, color: c.dark },
  label: { fontSize: 11, color: c.muted, fontWeight: '700', fontFamily: fonts.bold, marginBottom: 6, marginTop: 18, letterSpacing: 0.6, textTransform: 'uppercase' },
  labelFirst: { marginTop: 4 },
  input: {
    backgroundColor: 'transparent', borderRadius: 0, paddingVertical: 10, paddingHorizontal: 2,
    fontSize: 24, letterSpacing: 8, color: c.dark, borderBottomWidth: 1.5, borderColor: c.border,
    textAlign: 'center',
  },
  btn: {
    backgroundColor: c.buttonDark, borderRadius: 12, padding: 16,
    alignItems: 'center', marginTop: 26,
    shadowColor: c.accent, shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25, shadowRadius: 10, elevation: 4,
  },
  btnText: { color: c.buttonDarkText, fontSize: 16, fontWeight: '700', fontFamily: fonts.bold },
  resendBtn: { alignItems: 'center', marginTop: 18 },
  resendText: { color: c.muted, fontSize: 13 },
  resendTextActive: { color: c.accent, fontWeight: '700', fontFamily: fonts.bold },
  backBtn: { alignItems: 'center', marginTop: 6 },
  backText: { color: c.muted, fontSize: 13 },
});

export default function VerifyEmailScreen({ navigation, route }: Props) {
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const { showAlert } = useAppAlert();
  const { signIn } = useAuth();
  const { phone, email } = route.params;

  const [otp, setOtp] = useState<string>('');
  const [otpError, setOtpError] = useState<string>('');
  const [loading, setLoading] = useState<boolean>(false);
  const [resending, setResending] = useState<boolean>(false);
  const [cooldown, setCooldown] = useState<number>(RESEND_COOLDOWN_SECONDS);

  // Mirrors the backend's resend cooldown so the button visibly disables
  // instead of just letting people hammer it and hit a server error.
  useEffect(() => {
    if (cooldown <= 0) return;
    const timer = setInterval(() => setCooldown((s) => Math.max(0, s - 1)), 1000);
    return () => clearInterval(timer);
  }, [cooldown]);

  const handleVerify = async (): Promise<void> => {
    if (!otp.trim() || otp.trim().length !== 6) {
      setOtpError('Enter the 6-digit code we emailed you'); return;
    }
    setLoading(true);
    try {
      const response = await verifyRegistration(phone, otp.trim()) as { token: string; [key: string]: unknown };
      await signIn(response);
      // AppNavigator swaps to the authenticated stack automatically once
      // `user` is set by signIn -- nothing further to navigate here.
    } catch (error) {
      showAlert('error', 'Verification Failed', (error as Error).message || 'Could not verify code');
    } finally {
      setLoading(false);
    }
  };

  const handleResend = async (): Promise<void> => {
    if (cooldown > 0) return;
    setResending(true);
    try {
      const result = await resendRegistrationOtp(phone) as { message: string };
      showAlert('success', 'Code Sent', result.message);
      setCooldown(RESEND_COOLDOWN_SECONDS);
    } catch (error) {
      showAlert('error', 'Error', (error as Error).message || 'Could not resend code');
    } finally {
      setResending(false);
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
          <Text style={styles.headline}>Verify your email.</Text>
          <Text style={styles.logoSub}>Inner Circle Lending</Text>
        </View>

        {/* Form */}
        <View style={styles.form}>
          <Text style={styles.formTitle}>Enter Your Code</Text>
          <Text style={styles.formSub}>
            We've sent a 6-digit code to <Text style={styles.formSubBold}>{email}</Text>. Your
            account isn't created until you verify it.
          </Text>

          <Text style={[styles.label, styles.labelFirst]}>Verification Code</Text>
          <TextInput
            style={styles.input}
            placeholder="000000"
            placeholderTextColor={colors.muted}
            value={otp}
            onChangeText={(t) => { setOtp(t.replace(/[^0-9]/g, '').slice(0, 6)); setOtpError(''); }}
            keyboardType="number-pad"
            maxLength={6}
          />
          {otpError !== '' && <Text style={{ color: colors.errorRed, fontSize: 13, marginTop: 6 }}>{otpError}</Text>}

          <TouchableOpacity
            style={[styles.btn, loading && { opacity: 0.6 }]}
            onPress={handleVerify}
            disabled={loading}
          >
            {loading ? <ActivityIndicator color={colors.buttonDarkText} /> : <Text style={styles.btnText}>Verify & Create Account</Text>}
          </TouchableOpacity>

          <TouchableOpacity style={styles.resendBtn} onPress={handleResend} disabled={cooldown > 0 || resending}>
            {resending ? (
              <ActivityIndicator size="small" color={colors.muted} />
            ) : (
              <Text style={cooldown > 0 ? styles.resendText : [styles.resendText, styles.resendTextActive]}>
                {cooldown > 0 ? `Resend code in ${cooldown}s` : 'Resend code'}
              </Text>
            )}
          </TouchableOpacity>

          <TouchableOpacity style={styles.backBtn} onPress={() => navigation.navigate('Register')}>
            <Text style={styles.backText}>Wrong email? Go back and edit it</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}
