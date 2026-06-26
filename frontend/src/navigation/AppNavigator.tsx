import React from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';
import { View, Text } from 'react-native';

import LoginScreen from '../screens/LoginScreen';
import RegisterScreen from '../screens/RegisterScreen';
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

export type RootStackParamList = {
  Main: undefined;
  Notifications: undefined;
  CircleDetail: { circleId: number };
  RequestLoan: { circleId: number };
  LoanDetail: { loanId: number };
  AddSharedExpense: { circleId: number; members: { userId: number; firstName: string; lastName: string }[] };
  Admin: undefined;
  Login: undefined;
  Register: undefined;
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
  const { user, loading } = useAuth();
  const { colors } = useTheme();

  if (loading) {
    return (
      <View style={{ flex: 1, backgroundColor: colors.bg, justifyContent: 'center', alignItems: 'center' }}>
        <Text style={{ color: colors.accent, fontSize: 36, fontWeight: 'bold' }}>VOUCH</Text>
      </View>
    );
  }

  return (
    <NavigationContainer>
      <Stack.Navigator screenOptions={{ headerShown: false }}>
        {user ? (
          <>
            <Stack.Screen name="Main" component={MainTabs} />
            <Stack.Screen name="Notifications" component={NotificationsScreen} />
            <Stack.Screen name="CircleDetail" component={CircleDetailScreen} />
            <Stack.Screen name="RequestLoan" component={RequestLoanScreen} />
            <Stack.Screen name="LoanDetail" component={LoanDetailScreen} />
            <Stack.Screen name="AddSharedExpense" component={AddSharedExpenseScreen} />
            <Stack.Screen name="Admin" component={AdminScreen} />
          </>
        ) : (
          <>
            <Stack.Screen name="Login" component={LoginScreen} />
            <Stack.Screen name="Register" component={RegisterScreen} />
          </>
        )}
      </Stack.Navigator>
    </NavigationContainer>
  );
}