import { IS_NATIVE_ANDROID } from '@/lib/native-engine';
import { Feather } from '@expo/vector-icons';
import * as Clipboard from 'expo-clipboard';
import { Stack } from 'expo-router';
import React, { useEffect, useRef, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Group } from '@/components/account-ui';
import { QrCode } from '@/components/qr-code';
import { Btn, F, tap, useInsets, WalletGate } from '@/components/ui';
import { useWallet } from '@/context/WalletContext';
import { useLanguage } from '@/context/LanguageContext';
import { useColors } from '@/hooks/useColors';

function Receive() {
  const c = useColors();
  const ins = useInsets();
  const { state, newReceiveAddress } = useWallet();
  const { t } = useLanguage();
  const [viewing, setViewing] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const inflight = useRef(false);
  const alive = useRef(true);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const scroll = useRef<React.ComponentRef<typeof ScrollView>>(null);
  useEffect(() => {
    alive.current = true;
    return () => { alive.current = false; if (timer.current) clearTimeout(timer.current); };
  }, []);
  if (!state) return null;

  const shown = viewing && state.addresses.includes(viewing) ? viewing : state.receiveAddress;
  const isCurrent = shown === state.receiveAddress;
  const list = [...state.addresses].reverse();

  const copy = async () => {
    try {
      await Clipboard.setStringAsync(shown);
      tap('success');
      setCopied(true);
      if (timer.current) clearTimeout(timer.current);
      timer.current = setTimeout(() => alive.current && setCopied(false), 1500);
    } catch {
      setMsg(t('Clipboard unavailable on this device.'));
    }
  };
  const fresh = async () => {
    if (inflight.current) return;
    inflight.current = true;
    setBusy(true);
    setMsg(null);
    try {
      await newReceiveAddress();
      tap('success');
      if (alive.current) { setViewing(null); setCopied(false); }
    } catch {
      if (alive.current) setMsg(t('Could not save a new address. Your existing addresses are unchanged.'));
    } finally {
      inflight.current = false;
      if (alive.current) setBusy(false);
    }
  };

  return (
    <ScrollView ref={scroll} style={{ flex: 1, backgroundColor: c.background }} contentContainerStyle={{ padding: 18, paddingBottom: ins.bottom + 28, gap: 16 }}>
      <Stack.Screen options={{ title: t('Receive') }} />
      <View style={[st.card, { backgroundColor: c.charcoal }]}>
        <Text style={{ fontFamily: F.s, fontSize: 13, color: isCurrent ? c.primary : c.mutedForeground }}>{isCurrent ? t('Current address') : t('Saved address')}</Text>
        <Text selectable testID="receive-address" style={[st.addr, { color: c.foreground }]}>{shown}</Text>
        <QrCode testID="receive-qr" value={shown} size={208} />
        <Text testID="receive-disclosure" style={{ fontFamily: F.r, fontSize: 12.5, color: c.mutedForeground }}>{IS_NATIVE_ANDROID ? 'Native STAGENET address · test coins only' : t('Preview address · not for real deposits')}</Text>
      </View>
      <View style={{ flexDirection: 'row', gap: 10 }}>
        <Btn testID="copy-address" label={copied ? t('Copied') : t('Copy')} icon={copied ? 'check' : 'copy'} variant="soft" onPress={copy} style={{ flex: 1 }} />
        <Btn testID="new-address" label={t('New address')} icon="plus" loading={busy} disabled={busy} onPress={fresh} style={{ flex: 1 }} />
      </View>
      {msg ? <Text style={{ fontFamily: F.m, fontSize: 13, color: c.destructive }}>{msg}</Text> : null}
      <Text style={{ fontFamily: F.s, fontSize: 15, color: c.foreground, marginTop: 6 }}>{t('Saved addresses · {n}', { n: state.addresses.length })}</Text>
      <Group>
        {list.map((a) => {
          const on = a === shown;
          return (
            <Pressable key={a} testID={`saved-address-${a}`} onPress={() => { tap(); setViewing(a); setCopied(false); scroll.current?.scrollTo({ y: 0, animated: true }); }} style={({ pressed }) => [st.row, pressed && { backgroundColor: c.secondary }]}>
              <Feather name={on ? 'check-circle' : 'hash'} size={16} color={on ? c.primary : c.mutedForeground} />
              <Text numberOfLines={1} style={{ flex: 1, fontFamily: F.m, fontSize: 14, color: c.foreground }}>{a}</Text>
              {a === state.receiveAddress ? <Text style={{ fontFamily: F.s, fontSize: 12, color: c.primary }}>{t('Current')}</Text> : null}
            </Pressable>
          );
        })}
      </Group>
    </ScrollView>
  );
}

export default function ReceiveScreen() {
  return (
    <WalletGate>
      <Receive />
    </WalletGate>
  );
}

const st = StyleSheet.create({
  card: { borderRadius: 24, padding: 22, alignItems: 'center', gap: 16 },
  addr: { fontFamily: F.s, fontSize: 17, textAlign: 'center', letterSpacing: 0.6 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 18, minHeight: 52 },
});
