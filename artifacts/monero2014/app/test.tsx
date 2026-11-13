import React from 'react';
import { Redirect, Stack } from 'expo-router';
import { Text, View } from 'react-native';
import { IS_NATIVE_ANDROID } from '@/lib/native-engine';
import { useLanguage } from '@/context/LanguageContext';
import { useColors } from '@/hooks/useColors';
import { F } from '@/components/ui';

/** Browser-only notice. No balance mutation controls are exposed in the app. */
export default function PreviewNotice() {
  const { t } = useLanguage(), c = useColors();
  if (IS_NATIVE_ANDROID) return <Redirect href="/" />;
  return <View style={{ flex: 1, padding: 24, justifyContent: 'center', backgroundColor: c.background }}>
    <Stack.Screen options={{ title: t('Preview only · no real XMR') }} />
    <Text style={{ color: c.mutedForeground, fontFamily: F.r, fontSize: 18 }}>{t('Preview only · no real XMR')}</Text>
  </View>;
}
