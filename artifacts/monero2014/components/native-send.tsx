import React, { useEffect, useRef, useState } from 'react';
import { ScrollView, Text } from 'react-native';
import { router, Stack } from 'expo-router';
import * as Clipboard from 'expo-clipboard';
import { Btn, Card, Field, s as ui, useInsets } from './ui';
import { useColors } from '@/hooks/useColors';
import { useWallet } from '@/context/WalletContext';
import { useLock } from '@/context/LockContext';
import { formatXmr, parseXmr } from '@/lib/money';
import { nativeEngine, type NativeQuote } from '@/lib/native-engine';

export function NativeSend() {
  const c = useColors();
  const ins = useInsets();
  const { available, sync, reload, state } = useWallet();
  const network = state?.network ?? 'stagenet';
  const { authorize } = useLock();
  const [address, setAddress] = useState('');
  const [amount, setAmount] = useState('');
  const [secret, setSecret] = useState('');
  const [quote, setQuote] = useState<NativeQuote | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [uncertain, setUncertain] = useState(false);
  const once = useRef(false);
  useEffect(() => () => { void nativeEngine().discard().catch(() => undefined); }, []);
  const prepare = async () => {
    if (once.current) return;
    once.current = true; setBusy(true); setError('');
    try {
      const atomic = parseXmr(amount);
      if (amount !== 'MAX' && (atomic === null || atomic <= 0n)) throw new Error('Enter a positive XMR amount with at most 12 decimals.');
      setQuote(await nativeEngine().prepare(address.trim(), amount === 'MAX' ? 'MAX' : atomic!.toString()));
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Preparation failed.');
      await nativeEngine().discard().catch(() => undefined);
      reload();
    } finally { once.current = false; setBusy(false); }
  };
  const commit = async () => {
    if (!quote || once.current) return;
    once.current = true; setBusy(true); setError('');
    let attempted = false;
    try {
      const auth = await authorize(secret);
      setSecret('');
      if (!auth.ok) throw new Error(auth.message ?? 'Unlock failed.');
      attempted = true;
      await nativeEngine().commit(quote.token);
      setQuote(null); reload(); router.replace('/(tabs)/activity');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Broadcast outcome unknown. Do not retry.');
      if (attempted) setUncertain(true);
    } finally { once.current = false; setBusy(false); }
  };
  return (
    <ScrollView keyboardShouldPersistTaps="handled" style={{ flex: 1, backgroundColor: c.background }} contentContainerStyle={{ padding: 20, paddingBottom: ins.bottom + 28, gap: 18 }}>
      <Stack.Screen options={{ title: quote ? 'Review' : 'Send' }} />
      <Text style={[ui.h2, { color: c.foreground }]}>Send · {network.toUpperCase()}</Text>
      <Text style={[ui.body, { color: c.mutedForeground }]}>Unlocked: {formatXmr(available, 12)} XMR. {network === 'mainnet' ? 'Real XMR. Verify every detail; transfers cannot be reversed.' : 'Test coins only.'}</Text>
      {quote ? <>
        <Card style={{ gap: 12 }}>
          <Text selectable style={{ color: c.foreground }}>To: {quote.address}</Text>
          <Text style={{ color: c.foreground }}>Amount: {formatXmr(BigInt(quote.amount), 12)} XMR</Text>
          <Text style={{ color: c.foreground }}>Engine fee: {formatXmr(BigInt(quote.fee), 12)} XMR</Text>
          <Text style={{ color: c.foreground }}>Total: {formatXmr(BigInt(quote.amount) + BigInt(quote.fee), 12)} XMR</Text>
          <Text selectable style={{ color: c.mutedForeground }}>Transaction: {quote.txid}</Text>
        </Card>
        <Text style={[ui.body, { color: c.mutedForeground }]}>The native engine prepared this exact transaction locally. Confirm once to broadcast it to {network}.</Text>
        <Field label="App PIN or password" value={secret} onChangeText={setSecret} secureTextEntry autoCorrect={false} autoCapitalize="none" />
        <Btn label="Confirm and broadcast" loading={busy} disabled={busy || uncertain || !secret} onPress={commit} />
        <Btn label="Discard review" variant="ghost" disabled={busy} onPress={async () => {
          await nativeEngine().discard(); setQuote(null); setSecret(''); reload();
        }} />
      </> : <>
        <Field label={`Recipient ${network} address`} value={address} onChangeText={setAddress} autoCorrect={false} autoCapitalize="none" mono />
        <Btn label="Paste address" variant="soft" disabled={busy} onPress={async () => {
          try { setAddress((await Clipboard.getStringAsync()).trim()); setError(''); }
          catch { setError('Clipboard unavailable on this device.'); }
        }} />
        <Field label={`Amount (${network === 'mainnet' ? 'XMR' : 'stagenet XMR'})`} value={amount} onChangeText={setAmount} keyboardType="decimal-pad" />
        <Btn label="Max · engine calculates the fee" variant="ghost" disabled={busy || !sync.complete || available <= 0n} onPress={() => setAmount('MAX')} />
        {!sync.complete ? <Text style={{ color: c.warn }}>Waiting for blockchain scanning. Configure your {network} node under Real wallets.</Text> : null}
        <Btn label="Prepare and review" loading={busy} disabled={busy || !sync.complete} onPress={prepare} />
      </>}
      {error ? <Text accessibilityRole="alert" selectable style={{ color: c.destructive }}>{error}</Text> : null}
    </ScrollView>
  );
}
