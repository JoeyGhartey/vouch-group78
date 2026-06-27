import React from 'react';
import { StatusBar } from 'expo-status-bar';
import * as Notifications from 'expo-notifications';
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
  return (
    <ThemeProvider>
      <AppContent />
    </ThemeProvider>
  );
}
