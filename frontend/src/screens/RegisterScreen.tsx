import React, { useState, useMemo } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet,
  ActivityIndicator, KeyboardAvoidingView, Platform, ScrollView, Image,
} from 'react-native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { Ionicons } from '@expo/vector-icons';
import { register } from '../services/api';
import { useAppAlert } from '../components/AppAlert';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';
import { RootStackParamList } from '../navigation/AppNavigator';
import { ColorScheme } from '../theme/colors';
import { fonts } from '../theme/fonts';

type Props = {
  navigation: NativeStackNavigationProp<RootStackParamList, 'Register'>;
};

// MoMo provider brand colors — fixed, not themed
const PROVIDER_STYLES: Record<string, { bg: string; text: string }> = {
  MTN:        { bg: '#FFC300', text: '#1a1a1a' },
  Telecel:    { bg: '#CC0000', text: '#FFFFFF' },
  AirtelTigo: { bg: '#005DAA', text: '#FFFFFF' },
};

// Password strength checker
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
  row: { flexDirection: 'row', gap: 16 },
  half: { flex: 1 },
  sectionHeader: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    marginTop: 30, marginBottom: 10,
    paddingBottom: 10, borderBottomWidth: 1, borderBottomColor: c.border,
  },
  sectionHeaderFirst: { marginTop: 4 },
  sectionIconBox: {
    width: 24, height: 24, borderRadius: 7,
    backgroundColor: c.goldBgTint, justifyContent: 'center', alignItems: 'center',
  },
  sectionHeaderText: { fontSize: 12, fontWeight: '800', fontFamily: fonts.extrabold, color: c.accentDark, letterSpacing: 1.2, textTransform: 'uppercase' },
  label: { fontSize: 11, color: c.muted, fontWeight: '700', fontFamily: fonts.bold, marginBottom: 6, marginTop: 18, letterSpacing: 0.6, textTransform: 'uppercase' },
  labelFirst: { marginTop: 0 },
  input: {
    backgroundColor: 'transparent', borderRadius: 0, paddingVertical: 10, paddingHorizontal: 2,
    fontSize: 16, color: c.dark, borderBottomWidth: 1.5, borderColor: c.border,
  },
  inputDisabled: { color: c.muted, opacity: 0.6 },

  providerRow: { flexDirection: 'row', gap: 8, marginTop: 4 },
  providerBtn: {
    flex: 1, padding: 13, borderRadius: 10,
    alignItems: 'center', borderWidth: 0, opacity: 0.75,
  },
  providerSelected: {
    opacity: 1,
    shadowColor: c.dark,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 4,
    elevation: 3,
  },
  providerText: { fontSize: 13, fontWeight: '700', fontFamily: fonts.bold },

  // Checkbox
  checkboxRow: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    marginTop: 16, padding: 12, borderRadius: 12,
    backgroundColor: c.goldBgTint, borderWidth: 1, borderColor: c.border,
  },
  checkbox: {
    width: 20, height: 20, borderRadius: 5,
    borderWidth: 2, borderColor: c.border,
    justifyContent: 'center', alignItems: 'center',
  },
  checkboxChecked: { backgroundColor: c.accent, borderColor: c.accent },
  checkboxLabel: { fontSize: 13, color: c.muted, flex: 1 },
  checkboxLabelChecked: { color: c.dark, fontWeight: '600', fontFamily: fonts.semibold },

  // Password strength
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
    alignItems: 'center', marginTop: 28,
    shadowColor: c.accent, shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25, shadowRadius: 10, elevation: 4,
  },
  btnText: { color: c.buttonDarkText, fontSize: 16, fontWeight: '700', fontFamily: fonts.bold },
  linkBtn: { alignItems: 'center', marginTop: 18 },
  linkText: { color: c.muted, fontSize: 14 },
  linkBold: { color: c.accent, fontWeight: '700', fontFamily: fonts.bold },
});

export default function RegisterScreen({ navigation }: Props) {
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const [firstName, setFirstName] = useState<string>('');
  const [lastName, setLastName] = useState<string>('');
  const [phone, setPhone] = useState<string>('');
  const [email, setEmail] = useState<string>('');
  const [password, setPassword] = useState<string>('');
  const [confirmPassword, setConfirmPassword] = useState<string>('');
  const [momoProvider, setMomoProvider] = useState<string>('MTN');
  const [momoNumber, setMomoNumber] = useState<string>('');
  const [momoSameAsPhone, setMomoSameAsPhone] = useState<boolean>(false);
  const [loading, setLoading] = useState<boolean>(false);
  const { signIn } = useAuth();
  const { showAlert } = useAppAlert();

  const strength = getPasswordStrength(password, colors);

  const rules = [
    { label: 'At least 6 characters', met: password.length >= 6 },
    { label: 'One uppercase letter (A-Z)', met: /[A-Z]/.test(password) },
    { label: 'One number (0-9)', met: /[0-9]/.test(password) },
    { label: 'One special character (!@#$...)', met: /[^A-Za-z0-9]/.test(password) },
  ];

  // Handle checkbox toggle
  const handleMomoCheckbox = (): void => {
    const newValue = !momoSameAsPhone;
    setMomoSameAsPhone(newValue);
    if (newValue) {
      setMomoNumber(phone); // autofill with phone number
    } else {
      setMomoNumber('');    // clear when unchecked
    }
  };

  // Keep MoMo number in sync if phone changes while checkbox is checked
  const handlePhoneChange = (value: string): void => {
    const digitsOnly = value.replace(/[^0-9]/g, '').slice(0, 10);
    setPhone(digitsOnly);
    if (momoSameAsPhone) {
      setMomoNumber(digitsOnly);
    }
  };

  const handleMomoNumberChange = (value: string): void => {
    setMomoNumber(value.replace(/[^0-9]/g, '').slice(0, 10));
  };

  const handleRegister = async (): Promise<void> => {
    if (!firstName || !lastName || !phone || !password) {
      showAlert('error', 'Error', 'Please fill in all required fields'); return;
    }
    if (phone.length !== 10) {
      showAlert('error', 'Invalid Phone Number', 'Phone number must be exactly 10 digits'); return;
    }
    if (!momoSameAsPhone && momoNumber && momoNumber.length !== 10) {
      showAlert('error', 'Invalid MoMo Number', 'MoMo number must be exactly 10 digits, or left empty to use your phone number'); return;
    }
    if (password.length < 6) {
      showAlert('error', 'Weak Password', 'Password must be at least 6 characters'); return;
    }
    if (!/[A-Z]/.test(password)) {
      showAlert('error', 'Weak Password', 'Password must contain at least one uppercase letter'); return;
    }
    if (!/[0-9]/.test(password)) {
      showAlert('error', 'Weak Password', 'Password must contain at least one number'); return;
    }
    if (!/[^A-Za-z0-9]/.test(password)) {
      showAlert('error', 'Weak Password', 'Password must contain at least one special character e.g. !@#$'); return;
    }
    if (password !== confirmPassword) {
      showAlert('error', 'Error', 'Passwords do not match'); return;
    }
    setLoading(true);
    try {
      const response = await register({
        firstName, lastName, phone, email, password,
        momoProvider, momoNumber: momoNumber || phone,
      }) as { token: string; [key: string]: unknown };
      await signIn(response, true);
    } catch (error) {
      showAlert('error', 'Registration Failed', (error as Error).message || 'Could not create account');
    } finally {
      setLoading(false);
    }
  };

  const providers: string[] = ['MTN', 'Telecel', 'AirtelTigo'];

  return (
    <KeyboardAvoidingView style={styles.container} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">

        {/* Hero */}
        <View style={styles.heroSection}>
          <View style={styles.logoRow}>
            <Image source={require('../../assets/logo.png')} style={styles.logoImage} resizeMode="contain" />
            <Text style={styles.logoName}>VOUCH</Text>
          </View>
          <Text style={styles.headline}>Borrow and lend on trust.</Text>
          <Text style={styles.logoSub}>Inner Circle Lending</Text>
        </View>

        {/* Form */}
        <View style={styles.form}>
          <View style={[styles.sectionHeader, styles.sectionHeaderFirst]}>
            <View style={styles.sectionIconBox}>
              <Ionicons name="person-outline" size={13} color={colors.accentDark} />
            </View>
            <Text style={styles.sectionHeaderText}>Personal Details</Text>
          </View>

          <View style={styles.row}>
            <View style={styles.half}>
              <Text style={[styles.label, styles.labelFirst]}>First Name *</Text>
              <TextInput style={styles.input} placeholder="First name" placeholderTextColor={colors.muted} value={firstName} onChangeText={setFirstName} />
            </View>
            <View style={styles.half}>
              <Text style={[styles.label, styles.labelFirst]}>Last Name *</Text>
              <TextInput style={styles.input} placeholder="Last name" placeholderTextColor={colors.muted} value={lastName} onChangeText={setLastName} />
            </View>
          </View>

          <Text style={styles.label}>Phone Number *</Text>
          <TextInput
            style={styles.input}
            placeholder="e.g. 0241234567"
            placeholderTextColor={colors.muted}
            value={phone}
            onChangeText={handlePhoneChange}
            keyboardType="phone-pad"
            maxLength={10}
          />

          <Text style={styles.label}>Email</Text>
          <TextInput style={styles.input} placeholder="your@email.com" placeholderTextColor={colors.muted} value={email} onChangeText={setEmail} keyboardType="email-address" autoCapitalize="none" />

          <View style={styles.sectionHeader}>
            <View style={styles.sectionIconBox}>
              <Ionicons name="wallet-outline" size={13} color={colors.accentDark} />
            </View>
            <Text style={styles.sectionHeaderText}>Mobile Money</Text>
          </View>

          <Text style={[styles.label, styles.labelFirst]}>MoMo Provider</Text>
          <View style={styles.providerRow}>
            {providers.map((p) => {
              const providerColors = PROVIDER_STYLES[p];
              const isSelected = momoProvider === p;
              return (
                <TouchableOpacity
                  key={p}
                  style={[
                    styles.providerBtn,
                    { backgroundColor: providerColors.bg },
                    isSelected && styles.providerSelected,
                  ]}
                  onPress={() => setMomoProvider(p)}
                >
                  <Text style={[styles.providerText, { color: providerColors.text }]}>{p}</Text>
                </TouchableOpacity>
              );
            })}
          </View>

          {/* Checkbox */}
          <TouchableOpacity style={styles.checkboxRow} onPress={handleMomoCheckbox} activeOpacity={0.7}>
            <View style={[styles.checkbox, momoSameAsPhone && styles.checkboxChecked]}>
              {momoSameAsPhone && <Ionicons name="checkmark" size={13} color={colors.surface} />}
            </View>
            <Text style={[styles.checkboxLabel, momoSameAsPhone && styles.checkboxLabelChecked]}>
              My MoMo number is the same as my phone number
            </Text>
          </TouchableOpacity>

          <Text style={[styles.label, styles.labelFirst]}>MoMo Number</Text>
          <TextInput
            style={[styles.input, momoSameAsPhone && styles.inputDisabled]}
            placeholder="Same as phone if left empty"
            placeholderTextColor={colors.muted}
            value={momoNumber}
            onChangeText={handleMomoNumberChange}
            keyboardType="phone-pad"
            editable={!momoSameAsPhone}
            maxLength={10}
          />

          <View style={styles.sectionHeader}>
            <View style={styles.sectionIconBox}>
              <Ionicons name="lock-closed-outline" size={13} color={colors.accentDark} />
            </View>
            <Text style={styles.sectionHeaderText}>Security</Text>
          </View>

          <Text style={[styles.label, styles.labelFirst]}>Password *</Text>
          <TextInput
            style={styles.input}
            placeholder="At least 6 characters"
            placeholderTextColor={colors.muted}
            value={password}
            onChangeText={setPassword}
            secureTextEntry
          />

          {/* Strength bars */}
          {password.length > 0 && (
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

              {/* Rules checklist */}
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

          <Text style={styles.label}>Confirm Password *</Text>
          <TextInput
            style={styles.input}
            placeholder="Confirm your password"
            placeholderTextColor={colors.muted}
            value={confirmPassword}
            onChangeText={setConfirmPassword}
            secureTextEntry
          />
          {confirmPassword.length > 0 && (
            <Text style={[styles.matchText, { color: confirmPassword === password ? colors.success : colors.danger }]}>
              {confirmPassword === password ? 'Passwords match' : "Passwords don't match"}
            </Text>
          )}

          <TouchableOpacity style={[styles.btn, loading && { opacity: 0.6 }]} onPress={handleRegister} disabled={loading}>
            {loading ? <ActivityIndicator color={colors.buttonDarkText} /> : <Text style={styles.btnText}>Create Account</Text>}
          </TouchableOpacity>

          <TouchableOpacity style={styles.linkBtn} onPress={() => navigation.navigate('Login')}>
            <Text style={styles.linkText}>Already have an account? <Text style={styles.linkBold}>Log In</Text></Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}
