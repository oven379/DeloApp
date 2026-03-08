import * as SplashScreen from 'expo-splash-screen';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import React, { useEffect } from 'react';
import { Text, View } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import 'react-native-reanimated';

import { useColorScheme } from '@/hooks/use-color-scheme';

SplashScreen.preventAutoHideAsync?.();

type ErrorBoundaryState = { hasError: boolean; error?: Error };

class RootErrorBoundary extends React.Component<{ children: React.ReactNode }, ErrorBoundaryState> {
  state: ErrorBoundaryState = { hasError: false };

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { hasError: true, error };
  }

  render() {
    if (this.state.hasError) {
      return (
        <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', padding: 24, backgroundColor: '#1a1a1a' }}>
          <Text style={{ color: '#fff', fontSize: 16, marginBottom: 8 }}>Произошла ошибка</Text>
          <Text style={{ color: '#888', fontSize: 12, textAlign: 'center' }}>
            {this.state.error?.message ?? 'Неизвестная ошибка'}
          </Text>
        </View>
      );
    }
    return this.props.children;
  }
}

export default function RootLayout() {
  const colorScheme = useColorScheme();

  useEffect(() => {
    SplashScreen.hideAsync?.().catch(() => {});
  }, []);

  return (
    <GestureHandlerRootView style={{ flex: 1, backgroundColor: '#0b0f14' }}>
      <SafeAreaProvider style={{ flex: 1, backgroundColor: '#0b0f14' }}>
        <RootErrorBoundary>
          <Stack screenOptions={{ headerShown: false }} />
          <StatusBar style={colorScheme === 'dark' ? 'light' : 'dark'} />
        </RootErrorBoundary>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}
