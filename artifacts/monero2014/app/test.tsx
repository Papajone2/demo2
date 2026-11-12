import { Redirect, router, Stack } from 'expo-router';
import { IS_NATIVE_ANDROID } from '@/lib/native-engine';
import React, { useState } from 'react';
import { Platform, Text, View } from 'react-native';
import { KeyboardAwareScrollViewCompat } from '@/components/KeyboardAwareScrollViewCompat';
import { Btn, Card, F, Field, s as ui, SectionLabel, tap, TestBanner, useInsets, WalletGate } from '@/components/ui';
import { IS_WEB_DEMO, useLock } from '@/context/LockContext';
import { REQUIRED_CONFIRMATIONS, useWallet } from '@/context/WalletContext';
import { useLanguage } from '@/context/LanguageContext';
import { useColors } from '@/hooks/useColors';
import { confirmAction } from '@/lib/confirm';
import { formatXmr, parseXmr } from '@/lib/money';

function TestHub() {
  const c = useColors();
  const ins = useInsets();
  const w = useWallet();
  const lock = useLock();
  const { t } = useLanguage();
  const [amt, setAmt] = useState('2.5');
  const [log, setLog] = useState<string[]>([]);
  const [busy, setBusy] = useState<string | null>(null);
  if (!w.state) return null;
  const parsed = parseXmr(amt);
  const amtErr = parsed === null || parsed <= BigInt(0) ? t('Enter a positive amount (max 12 decimals).') : null;
  const pendingCount = w.state.txs.filter((x) => x.confirmations < REQUIRED_CONFIRMATIONS).length;

  const run = async (key: string, label: string, fn: () => Promise<void>) => {
    setBusy(key);
    try {
      await fn();
      tap('success');
      setLog((l) => [`${new Date().toLocaleTimeString()}  ${label}`, ...l].slice(0, 8));
    } catch (e) {
      tap('error');
      setLog((l) => [`${new Date().toLocaleTimeString()}  FAILED: ${e instanceof Error ? t(e.message) : t('Error')}`, ...l].slice(0, 8));
    } finally {
      setBusy(null);
    }
  };

  const diag: [string, string][] = [
    [t('Platform'), Platform.OS],
    [t('Transactions'), String(w.state.txs.length)],
    [t('Pending'), String(pendingCount)],
    [t('Unlocked'), formatXmr(w.available, 12)],
    [t('Locked'), formatXmr(w.locked, 12)],
    [t('Ledger bytes'), String(JSON.stringify(w.state).length)],
    [t('Lock store'), IS_WEB_DEMO ? t('browser local storage (demo)') : 'expo-secure-store'],
    [t('Lock method'), lock.method === 'pin' ? 'PIN' : lock.method === 'password' ? t('Password') : t('none')],
    [t('Failed unlocks'), String(lock.throttle.failures)],
    [t('Native engine'), t('Unavailable')],
  ];

  return (
    <KeyboardAwareScrollViewCompat style={{ flex: 1, backgroundColor: c.background }} contentContainerStyle={{ padding: 18, paddingBottom: ins.bottom + 24, gap: 12 }} bottomOffset={24}>
      <Stack.Screen options={{ title: t('Testing hub') }} />
      <TestBanner compact />
      <Text style={[ui.body, { color: c.mutedForeground }]}>{t('Everything here changes only the local sandbox ledger. Test units have no value.')}</Text>

      <SectionLabel>{t('Funds')}</SectionLabel>
      <Card style={{ gap: 10 }}>
        <Field testID="test-amount" label={t('Amount (test XMR)')} value={amt} onChangeText={setAmt} keyboardType="decimal-pad" error={amtErr} />
        <Btn testID="add-funds" label={t('Add confirmed test funds')} icon="plus" loading={busy === 'add'} disabled={!!amtErr || !!busy} onPress={() => run('add', t('Added {v} confirmed', { v: amt }), () => w.addFunds(parsed!, false))} />
        <Btn testID="sim-incoming" label={t('Simulate pending incoming')} icon="download" variant="ink" loading={busy === 'inc'} disabled={!!amtErr || !!busy} onPress={() => run('inc', t('Pending incoming {v}', { v: amt }), () => w.addFunds(parsed!, true))} />
      </Card>

      <SectionLabel>{t('Blocks · {n} pending', { n: pendingCount })}</SectionLabel>
      <Card style={{ gap: 10 }}>
        <Btn testID="advance-1" label={t('Advance 1 block')} icon="chevrons-right" variant="soft" disabled={!pendingCount || !!busy} onPress={() => run('b1', t('Advanced 1 block'), () => w.advanceBlocks(1))} />
        <Btn testID="confirm-all" label={t('Confirm all pending ({n} blocks)', { n: REQUIRED_CONFIRMATIONS })} icon="check-circle" variant="soft" disabled={!pendingCount || !!busy} onPress={() => run('b10', t('Confirmed all pending'), () => w.advanceBlocks(REQUIRED_CONFIRMATIONS))} />
        <Btn label={t('Send a test transfer')} icon="arrow-up-right" variant="ghost" onPress={() => router.push('/send')} />
      </Card>

      <SectionLabel>{t('Danger zone')}</SectionLabel>
      <Card style={{ gap: 10 }}>
        <Btn
          testID="reset-sandbox"
          label={t('Reset sandbox ledger')}
          icon="trash-2"
          variant="danger"
          disabled={!!busy}
          onPress={() => confirmAction(t('Reset sandbox?'), t('All test transactions and preferences are replaced with the demo starting state. Your app lock is kept.'), t('Reset'), () => run('reset', t('Sandbox reset'), w.resetSandbox))}
        />
      </Card>

      <SectionLabel>{t('Diagnostics')}</SectionLabel>
      <Card style={{ gap: 6 }}>
        {diag.map(([k, v]) => (
          <View key={k} style={{ flexDirection: 'row', justifyContent: 'space-between', gap: 10 }}>
            <Text style={{ fontFamily: F.m, fontSize: 13, color: c.mutedForeground }}>{k}</Text>
            <Text style={{ fontFamily: F.s, fontSize: 13, color: c.foreground, flexShrink: 1, textAlign: 'right' }}>{v}</Text>
          </View>
        ))}
      </Card>
      {log.length ? (
        <Card style={{ gap: 4, backgroundColor: c.ink, borderColor: c.ink }}>
          {log.map((l, i) => (
            <Text key={`${l}-${i}`} style={{ fontFamily: Platform.select({ ios: 'Menlo', default: 'monospace' }), fontSize: 12, color: l.includes('FAILED') ? c.primary : c.inkForeground }}>
              {l}
            </Text>
          ))}
        </Card>
      ) : null}
    </KeyboardAwareScrollViewCompat>
  );
}

export default function TestScreen() {
  if (IS_NATIVE_ANDROID) return <Redirect href="/" />;
  return (
    <WalletGate>
      <TestHub />
    </WalletGate>
  );
}
