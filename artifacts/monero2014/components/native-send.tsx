import React, { useEffect, useRef, useState } from 'react';
import { ScrollView, Text } from 'react-native';
import { router } from 'expo-router';
import { Btn, Card, Field, s as ui } from './ui';
import { useColors } from '@/hooks/useColors';
import { useWallet } from '@/context/WalletContext';
import { useLock } from '@/context/LockContext';
import { formatXmr, parseXmr } from '@/lib/money';
import { nativeEngine, type NativeQuote } from '@/lib/native-engine';

export function NativeSend() {
  const c = useColors();
  const { available, sync, reload } = useWallet();
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
      if (atomic === null || atomic <= 0n) throw new Error('Enter a positive XMR amount with at most 12 decimals.');
      setQuote(await nativeEngine().prepare(address.trim(), atomic.toString()));
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
    <ScrollView style={{ flex: 1, backgroundColor: c.background }} contentContainerStyle={{ padding: 20, gap: 18 }}>
      <Text style={[ui.h2, { color: c.foreground }]}>Send · STAGENET</Text>
      <Text style={[ui.body, { color: c.mutedForeground }]}>Unlocked: {formatXmr(available, 12)} XMR. Test coins only.</Text>
      {quote ? <>
        <Card style={{ gap: 12 }}>
          <Text selectable style={{ color: c.foreground }}>To: {quote.address}</Text>
          <Text style={{ color: c.foreground }}>Amount: {formatXmr(BigInt(quote.amount), 12)} XMR</Text>
          <Text style={{ color: c.foreground }}>Engine fee: {formatXmr(BigInt(quote.fee), 12)} XMR</Text>
          <Text style={{ color: c.foreground }}>Total: {formatXmr(BigInt(quote.amount) + BigInt(quote.fee), 12)} XMR</Text>
          <Text selectable style={{ color: c.mutedForeground }}>Transaction: {quote.txid}</Text>
        </Card>
        <Text style={[ui.body, { color: c.mutedForeground }]}>The native engine prepared this exact transaction locally. Confirm once to broadcast it to stagenet.</Text>
        <Field label="App PIN or password" value={secret} onChangeText={setSecret} secureTextEntry autoCorrect={false} autoCapitalize="none" />
        <Btn label="Confirm and broadcast" loading={busy} disabled={busy || uncertain || !secret} onPress={commit} />
        <Btn label="Discard review" variant="ghost" disabled={busy} onPress={async () => {
          await nativeEngine().discard(); setQuote(null); setSecret(''); reload();
        }} />
      </> : <>
        <Field label="Recipient stagenet address" value={address} onChangeText={setAddress} autoCorrect={false} autoCapitalize="none" mono />
        <Field label="Amount (stagenet XMR)" value={amount} onChangeText={setAmount} keyboardType="decimal-pad" />
        {!sync.complete ? <Text style={{ color: c.warn }}>Waiting for real blockchain scanning. Configure your stagenet node under Real wallets.</Text> : null}
        <Btn label="Prepare and review" loading={busy} disabled={busy || !sync.complete} onPress={prepare} />
      </>}
      {error ? <Text accessibilityRole="alert" selectable style={{ color: c.destructive }}>{error}</Text> : null}
    </ScrollView>
  );
}
