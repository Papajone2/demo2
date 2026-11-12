import { Feather } from '@expo/vector-icons';
import * as Clipboard from 'expo-clipboard';
import { router, Stack, useLocalSearchParams } from 'expo-router';
import React, { useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { Btn, Card, EmptyState, F, s as ui, tap, useInsets, WalletGate } from '@/components/ui';
import { REQUIRED_CONFIRMATIONS, useWallet } from '@/context/WalletContext';
import { useLanguage } from '@/context/LanguageContext';
import { useColors } from '@/hooks/useColors';
import { currencySymbol, fiatCents, formatFiat, formatXmr } from '@/lib/money';
import { IS_NATIVE_ANDROID } from '@/lib/native-engine';

function Detail() {
  const c = useColors();
  const ins = useInsets();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { state } = useWallet();
  const { t } = useLanguage();
  const [copied, setCopied] = useState(false);
  const tx = state?.txs.find((t) => t.id === id);
  if (!state || !tx)
    return (
      <View style={{ flex: 1, backgroundColor: c.background, justifyContent: 'center', padding: 24 }}>
        <Stack.Screen options={{ title: t('Transaction') }} />
        <EmptyState icon="help-circle" title={t('Transaction not found')} body={IS_NATIVE_ANDROID ? t('Try a different search or filter.') : t('It may have been removed by a sandbox reset.')} />
        <Btn label={t('Back')} onPress={() => router.back()} />
      </View>
    );
  const isIn = tx.kind === 'in';
  const pending = tx.confirmations < REQUIRED_CONFIRMATIONS;
  const amt = BigInt(tx.amount);
  const rate = state.rateCents ? BigInt(state.rateCents) : null;
  const rows: [string, string][] = [
    [t('Status'), pending ? t('Pending · {a}/{b} confirmations', { a: tx.confirmations, b: REQUIRED_CONFIRMATIONS }) : t('Confirmed · {n}+ blocks', { n: tx.confirmations })],
    [t('Date'), new Date(tx.createdAt).toLocaleString()],
    ...(!isIn && tx.address ? [[t('To'), tx.address] as [string, string]] : []),
    [t('Amount'), `${formatXmr(amt, 12)} XMR`],
    ...(!isIn ? ([[t('Network fee'), `${formatXmr(BigInt(tx.fee), 12)} XMR`]] as [string, string][]) : []),
    ...(rate ? ([[t('Equivalent'), formatFiat(fiatCents(amt, rate), currencySymbol(state.currency))]] as [string, string][]) : []),
    [t('Note'), tx.note || '—'],
    [t('Transaction ID'), tx.id],
    ...(pending ? [[t('Estimated time'), t('About {n} minutes', { n: Math.max(2, (REQUIRED_CONFIRMATIONS - tx.confirmations) * 2) })]] as [string, string][] : []),
  ];
  return (
    <ScrollView style={{ flex: 1, backgroundColor: c.background }} contentContainerStyle={{ padding: 18, paddingBottom: ins.bottom + 24, gap: 14 }}>
      <Stack.Screen options={{ title: t('Transaction') }} />
      <View style={{ alignItems: 'center', gap: 8, paddingVertical: 12 }}>
        <View style={[st.icon, { backgroundColor: isIn ? c.successSoft : c.accent }]}>
          <Feather name={isIn ? 'arrow-down-left' : 'arrow-up-right'} size={26} color={isIn ? c.success : c.accentForeground} />
        </View>
        <Text style={[st.amt, { color: isIn ? c.success : c.foreground }]}>
          {isIn ? '+' : '−'}
          {formatXmr(amt + (isIn ? BigInt(0) : BigInt(tx.fee)), 12)}
        </Text>
        <Text style={{ fontFamily: F.m, color: c.mutedForeground }}>{isIn ? t('Received XMR') : t('Sent XMR')}</Text>
      </View>
      <Card style={{ gap: 12 }}>
        {rows.map(([k, v]) => (
          <View key={k} testID={k === t('Status') && pending ? 'tx-status-pending' : undefined} style={{ gap: 2 }}>
            <Text style={{ fontFamily: F.m, fontSize: 12, color: c.mutedForeground }}>{k}</Text>
            <Text selectable style={{ fontFamily: F.s, fontSize: 14.5, color: c.foreground }}>{v}</Text>
          </View>
        ))}
      </Card>
      <Btn
        label={copied ? t('Copied') : t('Copy transaction ID')}
        icon={copied ? 'check' : 'copy'}
        variant="soft"
        onPress={async () => {
          try {
            await Clipboard.setStringAsync(tx.id);
            tap('success');
            setCopied(true);
            setTimeout(() => setCopied(false), 1500);
          } catch {
            setCopied(false);
          }
        }}
      />
      {!IS_NATIVE_ANDROID ? <Text style={[ui.hint, { color: c.mutedForeground, textAlign: 'center' }]}>{t('Sandbox record only. There is no on-chain transaction to look up.')}</Text> : pending ? <Text style={[ui.hint, { color: c.mutedForeground }]}>{t('Confirmation times are estimates, not guarantees. Funds are still syncing; wait until fully synced before sending.')}</Text> : null}
    </ScrollView>
  );
}

export default function TxScreen() {
  return (
    <WalletGate>
      <Detail />
    </WalletGate>
  );
}

const st = StyleSheet.create({
  icon: { width: 60, height: 60, borderRadius: 30, alignItems: 'center', justifyContent: 'center' },
  amt: { fontFamily: F.b, fontSize: 34, letterSpacing: -1, fontVariant: ['tabular-nums'] },
});
