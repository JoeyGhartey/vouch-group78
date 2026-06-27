import React, { useState, useMemo } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet,
  ActivityIndicator, KeyboardAvoidingView, Platform, ScrollView,
} from 'react-native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { register } from '../services/api';
import { useAppAlert } from '../components/AppAlert';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';
import { RootStackParamList } from '../navigation/AppNavigator';
import { ColorScheme } from '../theme/colors';

type Props = {
  navigation: NativeStackNavigationProp<RootStackParamList, 'Register'>;
};

const createStyles = (c: ColorScheme) => StyleSheet.create({
  container: { flex: 1, backgroundColor: c.bg },
  scroll: { flexGrow: 1, padding: 24, paddingTop: 60 },
  logoSection: { alignItems: 'center', marginBottom: 32 },
  logoBox: {
    width: 64, height: 64, borderRadius: 20,
    backgroundColor: c.dark, justifyContent: 'center', alignItems: 'center', marginBottom: 12,
  },
  logoText: { fontSize: 32, fontWeight: '900', color: c.accent },
  logoName: { fontSize: 24, fontWeight: '900', color: c.dark, letterSpacing: 6 },
  logoSub: { fontSize: 12, color: c.muted, marginTop: 4 },
  form: { backgroundColor: c.surface, borderRadius: 20, padding: 20, borderWidth: 1, borderColor: c.border },
  formTitle: { fontSize: 20, fontWeight: '700', color: c.dark, marginBottom: 4 },
  formSub: { fontSize: 13, color: c.muted, marginBottom: 16 },
  row: { flexDirection: 'row', gap: 10 },
  half: { flex: 1 },
  label: { fontSize: 12, color: c.muted, fontWeight: '600', marginBottom: 6, marginTop: 14 },
  input: { backgroundColor: c.bg, borderRadius: 10, padding: 14, fontSize: 14, color: c.dark, borderWidth: 1, borderColor: c.border },
  providerRow: { flexDirection: 'row', gap: 8, marginTop: 4 },
  providerBtn: { flex: 1, padding: 12, borderRadius: 10, backgroundColor: c.bg, alignItems: 'center', borderWidth: 1.5, borderColor: c.border },
  providerSel: { backgroundColor: c.dark, borderColor: c.dark },
  providerText: { color: c.muted, fontSize: 13, fontWeight: '600' },
  providerTextSel: { color: c.surface },
  btn: { backgroundColor: c.dark, borderRadius: 12, padding: 16, alignItems: 'center', marginTop: 24 },
  btnText: { color: c.surface, fontSize: 16, fontWeight: '700' },
  linkBtn: { alignItems: 'center', marginTop: 20 },
  linkText: { color: c.muted, fontSize: 14 },
  linkBold: { color: c.accent, fontWeight: '700' },
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
  const [loading, setLoading] = useState<boolean>(false);
  const { signIn } = useAuth();
  const { showAlert } = useAppAlert();

  const handleRegister = async (): Promise<void> => {
    if (!firstName || !lastName || !phone || !password) { showAlert('error', 'Error', 'Please fill in all required fields'); return; }
    if (password.length < 6) { showAlert('error', 'Error', 'Password must be at least 6 characters'); return; }
    if (password !== confirmPassword) { showAlert('error', 'Error', 'Passwords do not match'); return; }
    setLoading(true);
    try {
      const response = await register({
        firstName, lastName, phone, email, password,
        momoProvider, momoNumber: momoNumber || phone,
      }) as { token: string; [key: string]: unknown };
      await signIn(response);
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
          <Text style={styles.formTitle}>Create account</Text>
          <Text style={styles.formSub}>Join Vouch and start lending with trust</Text>

          <View style={styles.row}>
            <View style={styles.half}>
              <Text style={styles.label}>First Name *</Text>
              <TextInput style={styles.input} placeholder="First name" placeholderTextColor={colors.muted} value={firstName} onChangeText={setFirstName} />
            </View>
            <View style={styles.half}>
              <Text style={styles.label}>Last Name *</Text>
              <TextInput style={styles.input} placeholder="Last name" placeholderTextColor={colors.muted} value={lastName} onChangeText={setLastName} />
            </View>
          </View>

          <Text style={styles.label}>Phone Number *</Text>
          <TextInput style={styles.input} placeholder="e.g. 0241234567" placeholderTextColor={colors.muted} value={phone} onChangeText={setPhone} keyboardType="phone-pad" />

          <Text style={styles.label}>Email</Text>
          <TextInput style={styles.input} placeholder="your@email.com" placeholderTextColor={colors.muted} value={email} onChangeText={setEmail} keyboardType="email-address" autoCapitalize="none" />

          <Text style={styles.label}>MoMo Provider</Text>
          <View style={styles.providerRow}>
            {providers.map((p) => (
              <TouchableOpacity key={p} style={[styles.providerBtn, momoProvider === p && styles.providerSel]} onPress={() => setMomoProvider(p)}>
                <Text style={[styles.providerText, momoProvider === p && styles.providerTextSel]}>{p}</Text>
              </TouchableOpacity>
            ))}
          </View>

          <Text style={styles.label}>MoMo Number</Text>
          <TextInput style={styles.input} placeholder="Same as phone if left empty" placeholderTextColor={colors.muted} value={momoNumber} onChangeText={setMomoNumber} keyboardType="phone-pad" />

          <Text style={styles.label}>Password *</Text>
          <TextInput style={styles.input} placeholder="At least 6 characters" placeholderTextColor={colors.muted} value={password} onChangeText={setPassword} secureTextEntry />

          <Text style={styles.label}>Confirm Password *</Text>
          <TextInput style={styles.input} placeholder="Confirm your password" placeholderTextColor={colors.muted} value={confirmPassword} onChangeText={setConfirmPassword} secureTextEntry />

          <TouchableOpacity style={[styles.btn, loading && { opacity: 0.6 }]} onPress={handleRegister} disabled={loading}>
            {loading ? <ActivityIndicator color={colors.surface} /> : <Text style={styles.btnText}>Create Account</Text>}
          </TouchableOpacity>

          <TouchableOpacity style={styles.linkBtn} onPress={() => navigation.navigate('Login')}>
            <Text style={styles.linkText}>Already have an account? <Text style={styles.linkBold}>Log In</Text></Text>
          </TouchableOpacity>
        </View>

        <View style={{ height: 40 }} />
      </ScrollView>
    </KeyboardAvoidingView>
  );
}
