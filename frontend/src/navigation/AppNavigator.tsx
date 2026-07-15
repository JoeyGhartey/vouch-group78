import React from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';
import { View, Text, Image } from 'react-native';

import OnboardingScreen from '../screens/OnboardingScreen';
import LoginScreen from '../screens/LoginScreen';
import RegisterScreen from '../screens/RegisterScreen';
import ForgotPasswordScreen from '../screens/ForgotPasswordScreen';
import HomeScreen from '../screens/HomeScreen';
import NotificationsScreen from '../screens/NotificationsScreen';
import CirclesScreen from '../screens/CirclesScreen';
import CircleDetailScreen from '../screens/CircleDetailScreen';
import LoansScreen from '../screens/LoansScreen';
import RequestLoanScreen from '../screens/RequestLoanScreen';
import LoanDetailScreen from '../screens/LoanDetailScreen';
import ExpensesScreen from '../screens/ExpensesScreen';
import AddSharedExpenseScreen from '../screens/AddSharedExpenseScreen';
import ProfileScreen from '../screens/ProfileScreen';
import AdminScreen from '../screens/AdminScreen';
import HelpScreen from '../screens/HelpScreen';

export type RootStackParamList = {
  Main: { screen?: keyof TabParamList } | undefined;
  Notifications: undefined;
  CircleDetail: { circleId: number };
  RequestLoan: { circleId: number };
  LoanDetail: { loanId: number };
  AddSharedExpense: { circleId: number; members: { userId: number; firstName: string; lastName: string }[] };
  Admin: undefined;
  Help: undefined;
  Onboarding: undefined;
  Login: undefined;
  Register: undefined;
  ForgotPassword: undefined;
};

export type TabParamList = {
  HomeTab: undefined;
  CirclesTab: undefined;
  LoansTab: undefined;
  ExpensesTab: undefined;
  ProfileTab: undefined;
};

const Stack = createNativeStackNavigator<RootStackParamList>();
const Tab = createBottomTabNavigator<TabParamList>();

function MainTabs() {
  const { colors } = useTheme();
  return (
    <Tab.Navigator
      screenOptions={{
        headerShown: false,
        tabBarStyle: {
          backgroundColor: colors.surface,
          borderTopColor: colors.border,
          borderTopWidth: 1,
          paddingBottom: 8,
          paddingTop: 8,
          height: 64,
        },
        tabBarActiveTintColor: colors.accent,
        tabBarInactiveTintColor: colors.slate400,
        tabBarLabelStyle: { fontSize: 11, fontWeight: '600' },
      }}
    >
      <Tab.Screen name="HomeTab" component={HomeScreen} options={{ tabBarLabel: 'Home', tabBarIcon: ({ color, focused }) => <Ionicons name={focused ? 'home' : 'home-outline'} size={22} color={color} /> }} />
      <Tab.Screen name="CirclesTab" component={CirclesScreen} options={{ tabBarLabel: 'Circles', tabBarIcon: ({ color, focused }) => <Ionicons name={focused ? 'people' : 'people-outline'} size={22} color={color} /> }} />
      <Tab.Screen name="LoansTab" component={LoansScreen} options={{ tabBarLabel: 'Loans', tabBarIcon: ({ color, focused }) => <Ionicons name={focused ? 'card' : 'card-outline'} size={22} color={color} /> }} />
      <Tab.Screen name="ExpensesTab" component={ExpensesScreen} options={{ tabBarLabel: 'Expenses', tabBarIcon: ({ color, focused }) => <Ionicons name={focused ? 'pie-chart' : 'pie-chart-outline'} size={22} color={color} /> }} />
      <Tab.Screen name="ProfileTab" component={ProfileScreen} options={{ tabBarLabel: 'Profile', tabBarIcon: ({ color, focused }) => <Ionicons name={focused ? 'person' : 'person-outline'} size={22} color={color} /> }} />
    </Tab.Navigator>
  );
}

export default function AppNavigator() {
  const { user, loading, justRegistered } = useAuth();
  const { colors } = useTheme();

  if (loading) {
    return (
      <View style={{ flex: 1, backgroundColor: '#ffffff', justifyContent: 'center', alignItems: 'center' }}>
        <Image
          source={require('../../assets/logo.png')}
          style={{ width: 88, height: 96, marginBottom: 14 }}
          resizeMode="contain"
        />
        <Text style={{ color: colors.accent, fontSize: 15, fontWeight: '800', letterSpacing: 4 }}>VOUCH</Text>
      </View>
    );
  }

  // Onboarding shows for every fresh signup, regardless of whether this
  // device has seen it before (it's not a "first time on this phone" flag,
  // it's a "you just created an account" flag).
  const showOnboardingNow = justRegistered;

  return (
    <NavigationContainer>
      <Stack.Navigator
        screenOptions={{ headerShown: false }}
        initialRouteName={user ? (showOnboardingNow ? 'Onboarding' : 'Main') : 'Login'}
      >
        {user ? (
          <>
            <Stack.Screen name="Onboarding" component={OnboardingScreen} />
            <Stack.Screen name="Main" component={MainTabs} />
            <Stack.Screen name="Notifications" component={NotificationsScreen} />
            <Stack.Screen name="CircleDetail" component={CircleDetailScreen} />
            <Stack.Screen name="RequestLoan" component={RequestLoanScreen} />
            <Stack.Screen name="LoanDetail" component={LoanDetailScreen} />
            <Stack.Screen name="AddSharedExpense" component={AddSharedExpenseScreen} />
            <Stack.Screen name="Admin" component={AdminScreen} />
            <Stack.Screen name="Help" component={HelpScreen} />
          </>
        ) : (
          <>
            <Stack.Screen name="Login" component={LoginScreen} />
            <Stack.Screen name="Register" component={RegisterScreen} />
            <Stack.Screen name="ForgotPassword" component={ForgotPasswordScreen} />
          </>
        )}
      </Stack.Navigator>
    </NavigationContainer>
  );
}
