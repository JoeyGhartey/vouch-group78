import React from 'react';
import { View } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import * as Notifications from 'expo-notifications';
import {
  useFonts,
  Manrope_400Regular,
  Manrope_500Medium,
  Manrope_600SemiBold,
  Manrope_700Bold,
  Manrope_800ExtraBold,
} from '@expo-google-fonts/manrope';
import { ThemeProvider, useTheme } from './src/context/ThemeContext';
import { AppAlertHost } from './src/components/AppAlert';
import { ConfirmModalHost } from './src/components/ConfirmModal';
import { AuthProvider } from './src/context/AuthContext';
import AppNavigator from './src/navigation/AppNavigator';

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
    shouldShowBanner: true,
    shouldShowList: true,
  }),
});

function AppContent() {
  const { theme } = useTheme();
  return (
    <AppAlertHost>
      <ConfirmModalHost>
        <AuthProvider>
          <StatusBar style={theme === 'dark' ? 'light' : 'dark'} />
          <AppNavigator />
        </AuthProvider>
      </ConfirmModalHost>
    </AppAlertHost>
  );
}

export default function App() {
  const [fontsLoaded] = useFonts({
    Manrope_400Regular,
    Manrope_500Medium,
    Manrope_600SemiBold,
    Manrope_700Bold,
    Manrope_800ExtraBold,
  });

  if (!fontsLoaded) {
    return <View style={{ flex: 1, backgroundColor: '#ffffff' }} />;
  }

  return (
    <ThemeProvider>
      <AppContent />
    </ThemeProvider>
  );
}
