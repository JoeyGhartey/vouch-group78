import React from 'react';
import { StatusBar } from 'expo-status-bar';
import { AppAlertHost } from './src/components/AppAlert';
import { AuthProvider } from './src/context/AuthContext';
import AppNavigator from './src/navigation/AppNavigator';

export default function App() {
  return (
    <AppAlertHost>
      <AuthProvider>
        <StatusBar style="light" />
        <AppNavigator />
      </AuthProvider>
    </AppAlertHost>
  );
}
