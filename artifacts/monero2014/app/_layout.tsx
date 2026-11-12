import React, { useEffect } from 'react';
import { ActivityIndicator, View } from 'react-native';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { setBaseUrl } from '@workspace/api-client-react';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { KeyboardProvider } from 'react-native-keyboard-controller';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { ErrorBoundary } from '@/components/ErrorBoundary';
import { FirstRunCustomize, LockGate } from '@/components/LockGate';
import { LanguageProvider, useLanguage } from '@/context/LanguageContext';
import { LockProvider } from '@/context/LockContext';
import { WalletProvider } from '@/context/WalletContext';
import { StatusBar } from 'expo-status-bar';
import colors from '@/constants/colors';
import {
  Inter_400Regular,
  Inter_500Medium,
  Inter_600SemiBold,
  Inter_700Bold,
  useFonts,
} from '@expo-google-fonts/inter';
import { Stack } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';

// Prevent the splash screen from auto-hiding before asset loading is complete.
SplashScreen.preventAutoHideAsync();

if (process.env.EXPO_PUBLIC_DOMAIN) {
  setBaseUrl(`https://${process.env.EXPO_PUBLIC_DOMAIN}`);
}

const queryClient = new QueryClient();

function RootLayoutNav() {
  const { t } = useLanguage();
  return (
    <Stack
      screenOptions={{
        headerBackTitle: 'Back',
        headerShadowVisible: false,
        headerStyle: { backgroundColor: colors.light.background },
        headerTintColor: colors.light.foreground,
        headerTitleStyle: { fontFamily: 'Inter_600SemiBold' },
        contentStyle: { backgroundColor: colors.light.background },
      }}
    >
      <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
      <Stack.Screen name="accounts" options={{ headerShown: false, animation: 'none' }} />
      <Stack.Screen name="market" options={{ headerShown: false, presentation: 'fullScreenModal', animation: 'slide_from_bottom' }} />
      <Stack.Screen name="send" options={{ title: t('Send'), presentation: 'modal' }} />
      <Stack.Screen name="receive" options={{ title: t('Receive'), presentation: 'modal' }} />
      <Stack.Screen name="test" options={{ title: t('Testing hub') }} />
      <Stack.Screen name="tx/[id]" options={{ title: t('Transaction') }} />
      <Stack.Screen name="engine" options={{ title: t('Nodes & Tor') }} />
    </Stack>
  );
}

export default function RootLayout() {
  const [fontsLoaded, fontError] = useFonts({
    Inter_400Regular,
    Inter_500Medium,
    Inter_600SemiBold,
    Inter_700Bold,
  });

  useEffect(() => {
    if (fontsLoaded || fontError) {
      SplashScreen.hideAsync();
    }
  }, [fontsLoaded, fontError]);

  if (!fontsLoaded && !fontError) {
    return (
      <View style={{ flex: 1, backgroundColor: colors.light.ink, alignItems: 'center', justifyContent: 'center' }}>
        <ActivityIndicator color={colors.light.primary} accessibilityLabel="Loading wallet" />
      </View>
    );
  }

  return (
    <SafeAreaProvider>
      <ErrorBoundary>
        <QueryClientProvider client={queryClient}>
          <GestureHandlerRootView style={{ flex: 1 }}>
            <KeyboardProvider>
              <LanguageProvider>
              <LockProvider>
                <StatusBar style="light" />
                <LockGate>
                  <WalletProvider>
                    <FirstRunCustomize>
                      <RootLayoutNav />
                    </FirstRunCustomize>
                  </WalletProvider>
                </LockGate>
              </LockProvider>
              </LanguageProvider>
            </KeyboardProvider>
          </GestureHandlerRootView>
        </QueryClientProvider>
      </ErrorBoundary>
    </SafeAreaProvider>
  );
}
