import React, { useState, useMemo } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity, Linking,
} from 'react-native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../context/ThemeContext';
import { RootStackParamList } from '../navigation/AppNavigator';
import { ColorScheme } from '../theme/colors';

type Props = {
  navigation: NativeStackNavigationProp<RootStackParamList>;
};

const faqs = [
  {
    category: 'Getting Started',
    icon: 'rocket',
    items: [
      {
        q: 'What is Vouch?',
        a: 'Vouch is an inner circle lending app that lets you borrow and lend money within trusted groups called circles. It uses a trust score system to encourage responsible lending.',
      },
      {
        q: 'How do I create an account?',
        a: 'Download the app, tap "Sign Up", fill in your name, phone number, email and MoMo details, then create a strong password. You will be logged in immediately.',
      },
      {
        q: 'How do I join a circle?',
        a: 'You cannot join a circle on your own — a circle admin must invite you using your registered phone number. Once invited, you will receive a notification to accept.',
      },
    ],
  },
  {
    category: 'Loans',
    icon: 'cash',
    items: [
      {
        q: 'How do I request a loan?',
        a: 'Open a circle, go to the Loans tab, tap "Request a Loan", enter the amount, reason and repayment period, then submit. Circle members will see your request and can choose to fund it.',
      },
      {
        q: 'How do I fund someone\'s loan?',
        a: 'Go to a circle\'s Loans tab, find a loan with "REQUESTED" status, tap it and choose to fund it. You set the interest rate and both parties must sign a digital agreement before the loan is disbursed.',
      },
      {
        q: 'What happens if I don\'t repay on time?',
        a: 'Your loan enters a 7-day grace period where daily overdue interest is added. If you still don\'t repay, the lender can mark it as defaulted which will significantly drop your trust score.',
      },
      {
        q: 'What is the grace period?',
        a: 'The grace period is a 7-day window after your due date where you can still repay without being marked as defaulted. Overdue interest accumulates daily during this period.',
      },
      {
        q: 'Can I repay a loan partially?',
        a: 'Yes! You can make partial repayments at any time. The app will track how much you have paid and how much is remaining.',
      },
    ],
  },
  {
    category: 'MoMo & Payments',
    icon: 'phone-portrait',
    items: [
      {
        q: 'Which MoMo providers are supported?',
        a: 'Vouch supports MTN Mobile Money, Telecel Cash and AirtelTigo Money.',
      },
      {
        q: 'How do I update my MoMo number?',
        a: 'Go to your Profile, tap "Edit" in the top right corner, update your MoMo provider and number, then save.',
      },
      {
        q: 'When will I receive my loan money?',
        a: 'After both parties sign the loan agreement, the lender triggers disbursement and the money is sent to your registered MoMo number.',
      },
    ],
  },
  {
    category: 'Trust Score & Badges',
    icon: 'star',
    items: [
      {
        q: 'How is my trust score calculated?',
        a: 'Your trust score starts at 50. It increases when you repay loans on time and decreases when you default or repay late. Consistent good behaviour leads to a higher score.',
      },
      {
        q: 'How do I earn reputation badges?',
        a: 'Badges are earned automatically based on your activity. Repay your first loan on time to earn Rising Star, repay 3+ loans for Trusted Borrower, lend to 5+ people for Reliable Lender, and more.',
      },
      {
        q: 'What happens if my trust score drops too low?',
        a: 'If your trust score drops below 20, you will be unable to request new loans until you repay existing ones and your score recovers. Repeated defaults can lead to temporary or permanent bans.',
      },
    ],
  },
  {
    category: 'Account',
    icon: 'person',
    items: [
      {
        q: 'How do I update my profile?',
        a: 'Go to the Profile tab and tap "Edit" in the top right corner. You can update your name, email, and MoMo details.',
      },
      {
        q: 'How do I change my password?',
        a: 'Currently password changes are done from the Profile settings. Make sure your new password is at least 6 characters and contains uppercase letters, numbers and special characters.',
      },
      {
        q: 'How do I leave a circle?',
        a: 'Open the circle, go to the Members tab, scroll down and tap "Leave Circle". Note that you cannot leave a circle if you have active loans in it.',
      },
    ],
  },
];

const createStyles = (c: ColorScheme) => StyleSheet.create({
  container: { flex: 1, backgroundColor: c.bg },
  header: {
    flexDirection: 'row', alignItems: 'center',
    padding: 20, paddingTop: 56, backgroundColor: c.surface,
    borderBottomWidth: 1, borderBottomColor: c.border, gap: 12,
  },
  backBtn: { padding: 4 },
  headerTitle: { flex: 1, fontSize: 20, fontWeight: '700', color: c.dark },
  heroCard: {
    backgroundColor: c.surface, marginHorizontal: 16, marginTop: 16,
    borderRadius: 16, padding: 20, marginBottom: 12,
    borderWidth: 1, borderColor: c.border, alignItems: 'center',
  },
  heroIconWrap: { marginBottom: 8 },
  heroTitle: { fontSize: 18, fontWeight: '700', color: c.dark, marginBottom: 4 },
  heroSub: { fontSize: 13, color: c.muted, textAlign: 'center' },
  categoryCard: {
    backgroundColor: c.surface, marginHorizontal: 16, borderRadius: 14,
    marginBottom: 12, borderWidth: 1, borderColor: c.border, overflow: 'hidden',
  },
  categoryHeader: { flexDirection: 'row', alignItems: 'center', gap: 10, padding: 14, borderBottomWidth: 1, borderBottomColor: c.border },
  categoryTitle: { fontSize: 14, fontWeight: '700', color: c.dark },
  faqItem: { borderBottomWidth: 1, borderBottomColor: c.border },
  faqQuestion: {
    flexDirection: 'row', justifyContent: 'space-between',
    alignItems: 'center', padding: 14,
  },
  faqQ: { fontSize: 13, fontWeight: '600', color: c.dark, flex: 1, paddingRight: 8 },
  faqAnswer: { paddingHorizontal: 14, paddingBottom: 14 },
  faqA: { fontSize: 13, color: c.muted, lineHeight: 20 },
  contactCard: {
    backgroundColor: c.surface, marginHorizontal: 16, borderRadius: 14,
    padding: 16, marginBottom: 12, borderWidth: 1, borderColor: c.border,
  },
  contactTitle: { fontSize: 15, fontWeight: '700', color: c.dark, marginBottom: 14 },
  contactTitleRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 14 },
  contactBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    padding: 14, borderRadius: 12, backgroundColor: c.bg,
    borderWidth: 1, borderColor: c.border, marginBottom: 10,
  },
  contactIconBox: {
    width: 40, height: 40, borderRadius: 10,
    backgroundColor: c.buttonDark, justifyContent: 'center', alignItems: 'center',
  },
  contactLabel: { fontSize: 11, color: c.muted, fontWeight: '600' },
  contactValue: { fontSize: 13, color: c.dark, fontWeight: '600', marginTop: 1 },
  responseNote: {
    fontSize: 11, color: c.muted, textAlign: 'center',
    marginTop: 4, fontStyle: 'italic' as const,
  },
});

export default function HelpScreen({ navigation }: Props) {
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const [openItem, setOpenItem] = useState<string | null>(null);

  const toggle = (key: string) => setOpenItem(openItem === key ? null : key);

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity style={styles.backBtn} onPress={() => navigation.goBack()}>
          <Ionicons name="arrow-back" size={24} color={colors.dark} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Help & FAQ</Text>
      </View>

      <ScrollView showsVerticalScrollIndicator={false}>

        {/* Hero */}
        <View style={styles.heroCard}>
          <Ionicons name="people-circle" size={36} color={colors.accent} style={styles.heroIconWrap} />
          <Text style={styles.heroTitle}>How can we help you?</Text>
          <Text style={styles.heroSub}>Find answers to common questions below or contact us directly</Text>
        </View>

        {/* FAQ Categories */}
        {faqs.map((category) => (
          <View key={category.category} style={styles.categoryCard}>
            <View style={styles.categoryHeader}>
              <Ionicons
                name={(category.items.some((_, i) => openItem === `${category.category}-${i}`)
                  ? category.icon
                  : `${category.icon}-outline`) as keyof typeof Ionicons.glyphMap}
                size={18}
                color={category.items.some((_, i) => openItem === `${category.category}-${i}`) ? colors.accent : colors.muted}
              />
              <Text style={styles.categoryTitle}>{category.category}</Text>
            </View>
            {category.items.map((item, i) => {
              const key = `${category.category}-${i}`;
              const isOpen = openItem === key;
              return (
                <View key={key} style={styles.faqItem}>
                  <TouchableOpacity style={styles.faqQuestion} onPress={() => toggle(key)}>
                    <Text style={styles.faqQ}>{item.q}</Text>
                    <Ionicons
                      name={isOpen ? 'chevron-up' : 'chevron-down'}
                      size={16}
                      color={colors.muted}
                    />
                  </TouchableOpacity>
                  {isOpen && (
                    <View style={styles.faqAnswer}>
                      <Text style={styles.faqA}>{item.a}</Text>
                    </View>
                  )}
                </View>
              );
            })}
          </View>
        ))}

        {/* Contact Us */}
        <View style={styles.contactCard}>
          <View style={styles.contactTitleRow}>
            <Ionicons name="chatbubbles" size={18} color={colors.accent} />
            <Text style={[styles.contactTitle, { marginBottom: 0 }]}>Contact Us</Text>
          </View>

          <TouchableOpacity
            style={styles.contactBtn}
            onPress={() => Linking.openURL('mailto:vouchG78@gmail.com')}
          >
            <View style={styles.contactIconBox}>
              <Ionicons name="mail-outline" size={20} color={colors.buttonDarkText} />
            </View>
            <View>
              <Text style={styles.contactLabel}>EMAIL</Text>
              <Text style={styles.contactValue}>vouchG78@gmail.com</Text>
            </View>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.contactBtn}
            onPress={() => Linking.openURL('https://wa.me/233597216034')}
          >
            <View style={styles.contactIconBox}>
              <Ionicons name="logo-whatsapp" size={20} color={colors.buttonDarkText} />
            </View>
            <View>
              <Text style={styles.contactLabel}>WHATSAPP</Text>
              <Text style={styles.contactValue}>+233 59 721 6034</Text>
            </View>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.contactBtn}
            onPress={() => Linking.openURL('https://wa.me/233532871429')}
          >
            <View style={styles.contactIconBox}>
              <Ionicons name="logo-whatsapp" size={20} color={colors.buttonDarkText} />
            </View>
            <View>
              <Text style={styles.contactLabel}>WHATSAPP</Text>
              <Text style={styles.contactValue}>+233 53 287 1429</Text>
            </View>
          </TouchableOpacity>

          <Text style={styles.responseNote}>We typically respond within 24 hours</Text>
        </View>

        <View style={{ height: 40 }} />
      </ScrollView>
    </View>
  );
}
