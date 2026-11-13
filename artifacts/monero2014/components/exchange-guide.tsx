import { Feather } from '@expo/vector-icons';
import React, { useState } from 'react';
import { Modal, Pressable, Text, View } from 'react-native';
import { Image } from 'expo-image';
import * as WebBrowser from 'expo-web-browser';
import { Btn, F } from './ui';
import { useColors } from '@/hooks/useColors';
import { useLanguage } from '@/context/LanguageContext';
import { EXCHANGES, EXCHANGE_SOURCE } from '@/lib/community-nodes';

export function ExchangeGuide({ onContinue }: { onContinue?: () => void }) {
  const c = useColors(), { t } = useLanguage();
  const [selected, setSelected] = useState<{ name: string; url: string } | null>(null);
  const [error, setError] = useState('');
  const open = async () => {
    if (!selected) return;
    const url = selected.url;
    setSelected(null);
    try { await WebBrowser.openBrowserAsync(url); }
    catch { setError(t('Could not open browser.')); }
  };
  return <View style={{ gap: 22 }}>
    <View style={{ backgroundColor: c.card, padding: 24, borderRadius: 24, gap: 14 }}>
      <View style={{ width: 48, height: 48, borderRadius: 16, backgroundColor: c.accent, alignItems: 'center', justifyContent: 'center' }}><Feather name="repeat" size={25} color={c.primary} /></View>
      <Text style={{ fontFamily: F.b, color: c.foreground, fontSize: 27 }}>{t('Get Monero')}</Text>
      <Text style={{ color: c.mutedForeground, lineHeight: 23 }}>{t('Choose XMR as the receiving currency, paste your Monero receiving address, and complete the swap on the provider’s website.')}</Text>
    </View>
    <View style={{ gap: 12 }}>
      {EXCHANGES.map((exchange, index) => <Pressable key={exchange.name} testID={`exchange-${exchange.name.toLowerCase()}`} accessibilityRole="button" onPress={() => setSelected(exchange)} style={({ pressed }) => ({ padding: 20, borderRadius: 22, borderWidth: 1, borderColor: '#333333', backgroundColor: pressed ? '#333333' : '#242424', flexDirection: 'row', alignItems: 'center', gap: 16 })}>
        <View style={{ width: 48, height: 48, borderRadius: 15, backgroundColor: '#303030', alignItems: 'center', justifyContent: 'center' }}><Image accessibilityLabel={`${exchange.name} logo`} source={index === 0 ? require('../assets/brands/changenow.png') : require('../assets/brands/simpleswap.png')} contentFit="contain" style={{ width: 36, height: 36 }} /></View>
        <View style={{ flex: 1, gap: 4 }}><Text style={{ fontFamily: F.s, fontSize: 20, color: c.foreground }}>{exchange.name}</Text><Text style={{ color: c.mutedForeground }}>{new URL(exchange.url).hostname}</Text></View>
        <Feather name="arrow-up-right" size={22} color={c.mutedForeground} />
      </Pressable>)}
    </View>
    <Text style={{ color: c.mutedForeground, lineHeight: 22 }}>{t('Check fees, minimum amounts, country availability and verification requirements before sending. Never share your recovery phrase.')}</Text>
    <View style={{ backgroundColor: c.card, padding: 18, borderRadius: 18, gap: 14 }}>
      <Text style={{ color: c.mutedForeground, lineHeight: 22 }}>{t('We are not affiliated with these services. Monero’s website lists them for information, not as an endorsement.')}</Text>
      <Pressable testID="exchange-source" accessibilityRole="link" onPress={() => setSelected({ name: 'getmonero.org', url: EXCHANGE_SOURCE })} style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
        <Feather name="external-link" size={16} color={c.primary} /><Text style={{ color: c.primary, fontFamily: F.s }}>{t('Source')} · getmonero.org</Text>
      </Pressable>
    </View>
    <Text style={{ color: c.mutedForeground, lineHeight: 21 }}>{t('These links open in your browser. Wallet Tor settings do not route your browser through Tor.')}</Text>
    {error ? <Text accessibilityRole="alert" style={{ color: c.destructive }}>{error}</Text> : null}
    {onContinue ? <Btn testID="exchange-tour-continue" variant="ghost" label={t('Continue tour')} onPress={onContinue} /> : null}
    <Modal visible={!!selected} transparent animationType="fade" onRequestClose={() => setSelected(null)}>
      <View style={{ flex: 1, backgroundColor: '#000B', padding: 24, justifyContent: 'center' }}>
        <View style={{ borderRadius: 24, padding: 24, backgroundColor: c.card, gap: 20 }}>
          <Text style={{ color: c.foreground, fontFamily: F.b, fontSize: 22 }}>{t('Open {name}?', { name: selected?.name ?? '' })}</Text>
          <Text style={{ color: c.mutedForeground, lineHeight: 22 }}>{t('These links open in your browser. Wallet Tor settings do not route your browser through Tor.')}</Text>
          <Text style={{ color: c.mutedForeground }}>{selected?.url}</Text>
          <Btn variant="ghost" label={t('Open website')} onPress={() => { void open(); }} />
          <Btn testID="exchange-link-cancel" label={t('Cancel')} variant="ghost" onPress={() => setSelected(null)} />
        </View>
      </View>
    </Modal>
  </View>;
}
