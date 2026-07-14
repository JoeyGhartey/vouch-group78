import React, { useMemo, useRef, useState } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  Dimensions, NativeSyntheticEvent, NativeScrollEvent,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useTheme } from '../context/ThemeContext';
import { ColorScheme } from '../theme/colors';
import { RootStackParamList } from '../navigation/AppNavigator';
import { markOnboardingSeen } from '../utils/onboardingStorage';

type Props = {
  navigation: NativeStackNavigationProp<RootStackParamList, 'Onboarding'>;
};

const { width } = Dimensions.get('window');

type Slide = {
  icon: keyof typeof Ionicons.glyphMap;
  title: string;
  body: string;
};

const SLIDES: Slide[] = [
  {
    icon: 'people',
    title: 'Lend & borrow within your circle',
    body: 'No banks, no bureaucracy. Vouch connects you with people you trust for fair, transparent peer-to-peer loans.',
  },
  {
    icon: 'shield-checkmark',
    title: 'Build trust, unlock better rates',
    body: 'Every on-time repayment grows your trust score. A higher score means lower interest rates and bigger loans over time.',
  },
  {
    icon: 'wallet',
    title: 'Track your own money, too',
    body: 'Log income and expenses, set spending limits, and see clear charts of where your money goes — no circle required.',
  },
  {
    icon: 'pie-chart',
    title: 'Split expenses with your circle',
    body: 'Share group costs, settle up with friends, and keep everyone’s contributions transparent and fair.',
  },
];

const createStyles = (c: ColorScheme) => StyleSheet.create({
  container: { flex: 1, backgroundColor: c.bg },
  skipBtn: { position: 'absolute', top: 56, right: 20, zIndex: 10, padding: 8 },
  skipText: { color: c.muted, fontSize: 14, fontWeight: '600' },
  slide: { width, flex: 1, alignItems: 'center', justifyContent: 'center', padding: 32 },
  iconCircle: {
    width: 120, height: 120, borderRadius: 60,
    backgroundColor: c.surface, borderWidth: 1, borderColor: c.border,
    justifyContent: 'center', alignItems: 'center', marginBottom: 40,
    shadowColor: c.dark, shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.08, shadowRadius: 12, elevation: 4,
  },
  title: { fontSize: 24, fontWeight: '800', color: c.dark, textAlign: 'center', marginBottom: 16 },
  body: { fontSize: 15, color: c.muted, textAlign: 'center', lineHeight: 22, paddingHorizontal: 8 },
  footer: { paddingHorizontal: 24, paddingBottom: 40, paddingTop: 8 },
  dots: { flexDirection: 'row', justifyContent: 'center', marginBottom: 24 },
  dot: { width: 8, height: 8, borderRadius: 4, backgroundColor: c.border, marginHorizontal: 4 },
  dotActive: { backgroundColor: c.accent, width: 20 },
  nextBtn: {
    backgroundColor: c.buttonDark, borderRadius: 12, padding: 16, alignItems: 'center',
  },
  nextText: { color: c.buttonDarkText, fontSize: 16, fontWeight: '700' },
});

export default function OnboardingScreen({ navigation }: Props) {
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const scrollRef = useRef<ScrollView>(null);
  const [index, setIndex] = useState(0);

  const finish = async (): Promise<void> => {
    await markOnboardingSeen();
    navigation.replace('Login');
  };

  const handleNext = (): void => {
    if (index === SLIDES.length - 1) {
      finish();
      return;
    }
    const nextIndex = index + 1;
    scrollRef.current?.scrollTo({ x: nextIndex * width, animated: true });
    setIndex(nextIndex);
  };

  const handleScrollEnd = (e: NativeSyntheticEvent<NativeScrollEvent>): void => {
    const newIndex = Math.round(e.nativeEvent.contentOffset.x / width);
    setIndex(newIndex);
  };

  return (
    <View style={styles.container}>
      <TouchableOpacity style={styles.skipBtn} onPress={finish}>
        <Text style={styles.skipText}>Skip</Text>
      </TouchableOpacity>

      <ScrollView
        ref={scrollRef}
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        onMomentumScrollEnd={handleScrollEnd}
      >
        {SLIDES.map((slide) => (
          <View key={slide.title} style={styles.slide}>
            <View style={styles.iconCircle}>
              <Ionicons name={slide.icon} size={52} color={colors.accent} />
            </View>
            <Text style={styles.title}>{slide.title}</Text>
            <Text style={styles.body}>{slide.body}</Text>
          </View>
        ))}
      </ScrollView>

      <View style={styles.footer}>
        <View style={styles.dots}>
          {SLIDES.map((slide, i) => (
            <View key={slide.title} style={[styles.dot, i === index && styles.dotActive]} />
          ))}
        </View>
        <TouchableOpacity style={styles.nextBtn} onPress={handleNext}>
          <Text style={styles.nextText}>{index === SLIDES.length - 1 ? 'Get Started' : 'Next'}</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}
