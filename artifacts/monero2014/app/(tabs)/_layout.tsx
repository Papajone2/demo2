import React from 'react';
import { Stack } from 'expo-router';
import { useColors } from '@/hooks/useColors';

/** Headerless stack: home is the hub; Activity and Settings carry their own back controls. */
export default function HomeStackLayout() {
  const c = useColors();
  return (
    <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: c.background }, animation: 'slide_from_right' }}>
      <Stack.Screen name="index" />
      <Stack.Screen name="activity" />
      <Stack.Screen name="settings" />
    </Stack>
  );
}
