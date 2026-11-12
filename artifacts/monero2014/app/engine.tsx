import { Feather } from '@expo/vector-icons';
import * as WebBrowser from 'expo-web-browser';
import { Stack } from 'expo-router';
import React from 'react';
import { ScrollView, Text, View } from 'react-native';
import { SITE } from '@/components/LockGate';
import { Btn, Card, F, s as ui, useInsets } from '@/components/ui';
import { msg, useLanguage } from '@/context/LanguageContext';
import { useColors } from '@/hooks/useColors';
import { IS_NATIVE_ANDROID } from '@/lib/native-engine';
import { NodeSettings } from '@/components/node-settings';

const POINTS: { icon: keyof typeof Feather.glyphMap; title: string; body: string }[] = [
  { icon: 'cpu', title: msg('Native engine required'), body: msg('Real Monero wallets need the native wallet2 library to derive keys, scan outputs and sign transactions. Expo Go cannot load it, so this build has no real wallet engine.') },
  { icon: 'globe', title: msg('Mainnet cannot be enabled'), body: msg('There is no switch for mainnet because nothing here could safely send or receive real XMR. Real addresses are rejected in Send.') },
  { icon: 'key', title: msg('16-word Polyseed'), body: msg('Creating or restoring a real wallet uses a 16-word Polyseed phrase. That requires the native engine; this preview does not generate, display or accept seeds. Never enter a real seed here.') },
  { icon: 'layers', title: msg('Sync, honestly'), body: msg('A real wallet scans the chain with your view key. First sync can be slow, a restore height shortens it, and balances are unreliable until caught up. This sandbox does not sync.') },
];

export default function EngineScreen() {
  if (IS_NATIVE_ANDROID) return <NodeSettings />;
  return <PreviewEngineScreen />;
}
function PreviewEngineScreen() {
  const c = useColors();
  const ins = useInsets();
  const { t } = useLanguage();
  return (
    <ScrollView style={{ flex: 1, backgroundColor: c.background }} contentContainerStyle={{ padding: 18, paddingBottom: ins.bottom + 24, gap: 14 }}>
      <Stack.Screen options={{ title: t('Real wallets') }} />
      <Text style={[ui.h2, { color: c.foreground }]}>{t('Real wallets need a native build')}</Text>
      {POINTS.map((p) => (
        <Card key={p.title} style={{ flexDirection: 'row', gap: 14 }}>
          <Feather name={p.icon} size={20} color={c.primary} />
          <View style={{ flex: 1, gap: 4 }}>
            <Text style={{ fontFamily: F.s, fontSize: 15, color: c.foreground }}>{t(p.title)}</Text>
            <Text style={[ui.body, { color: c.mutedForeground, fontSize: 14, lineHeight: 20 }]}>{t(p.body)}</Text>
          </View>
        </Card>
      ))}
      <Btn label={t('Follow progress at monero2014.com')} icon="external-link" variant="ink" onPress={() => WebBrowser.openBrowserAsync(SITE).catch(() => {})} />
    </ScrollView>
  );
}
