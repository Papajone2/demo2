import React, { useEffect, useRef, useState } from 'react';
import { Modal, Pressable, ScrollView, Text, TextInput, View } from 'react-native';
import { router, Stack } from 'expo-router';
import { Feather } from '@expo/vector-icons';
import { CameraView, useCameraPermissions } from 'expo-camera';
import * as Clipboard from 'expo-clipboard';
import { Btn, Card, Field, F, s as ui, useInsets } from './ui';
import { useColors } from '@/hooks/useColors';
import { useWallet } from '@/context/WalletContext';
import { useLock } from '@/context/LockContext';
import { useLanguage } from '@/context/LanguageContext';
import { ATOMIC_PER_XMR, centsToString, currencySymbol, fiatCents, formatFiat, formatXmr, parseXmr } from '@/lib/money';
import { fiatToAtomic, readPaymentQr } from '@/lib/payment-input';
import { nativeEngine, type NativeQuote } from '@/lib/native-engine';

const xmrInput = (atomic: bigint) => formatXmr(atomic, 12, 0).replace(/,/g, '');
export function NativeSend() {
  const c = useColors(), ins = useInsets(), { t } = useLanguage();
  const { available, sync, reload, state } = useWallet(), lock = useLock();
  const [address, setAddress] = useState(''), [amount, setAmount] = useState('');
  const [fiatMode, setFiatMode] = useState(false);
  const [quote, setQuote] = useState<NativeQuote | null>(null);
  const [maxQuote, setMaxQuote] = useState<NativeQuote | null>(null);
  const [busy, setBusy] = useState(false), [error, setError] = useState(''), [uncertain, setUncertain] = useState(false);
  const [camera, setCamera] = useState(false), [permission, requestPermission] = useCameraPermissions();
  const once = useRef(false), scanned = useRef(false);
  const rate = state?.rateCents ? BigInt(state.rateCents) : null, symbol = currencySymbol(state?.currency ?? 'USD');
  const atomic = fiatMode ? fiatToAtomic(amount, rate) : parseXmr(amount);
  const valueText = (value: bigint) => rate ? formatFiat(fiatCents(value, rate), symbol) : '—';
  useEffect(() => () => { void nativeEngine().discard().catch(() => undefined); }, []);
  const changeAmount = (value: string) => { setAmount(value); setMaxQuote(null); setError(''); };
  const changeAddress = (value: string) => { setAddress(value); setMaxQuote(null); setError(''); };
  const prepare = async (max = false) => {
    if (once.current) return;
    once.current = true; setBusy(true); setError('');
    try {
      if (!address.trim()) throw new Error('Enter a recipient address first.');
      if (!sync.complete) throw new Error('Funds are still syncing. Wait until fully synced before sending.');
      if (!max && (atomic === null || atomic <= 0n)) throw new Error('Enter a positive amount.');
      if (!max && atomic! > available) throw new Error('Not enough spendable balance. Allow for the fee, or choose Max.');
      if (!max && maxQuote && maxQuote.address === address.trim()) { setQuote(maxQuote); return; }
      await nativeEngine().discard();
      const prepared = await nativeEngine().prepare(address.trim(), max ? 'MAX' : atomic!.toString());
      if (max) {
        setMaxQuote(prepared);
        setAmount(fiatMode && rate ? centsToString(fiatCents(BigInt(prepared.amount), rate)) : xmrInput(BigInt(prepared.amount)));
      } else setQuote(prepared);
    } catch (e) {
      setError(t(e instanceof Error ? e.message : 'Could not prepare payment.'));
      await nativeEngine().discard().catch(() => undefined);
    } finally { once.current = false; setBusy(false); }
  };
  const commit = async () => {
    if (!quote || once.current || lock.status !== 'unlocked') return;
    once.current = true; setBusy(true); setError('');
    try {
      const txid = await nativeEngine().commit(quote.token);
      setQuote(null); reload(); router.replace({ pathname: '/(tabs)/activity', params: { sent: txid } });
    } catch (e) {
      setError(t(e instanceof Error ? e.message : 'Broadcast outcome unknown. Do not retry.'));
      setUncertain(true);
    } finally { once.current = false; setBusy(false); }
  };
  const cancel = async () => {
    setBusy(true);
    try { await nativeEngine().discard(); setQuote(null); setMaxQuote(null); }
    catch (e) { setError(t(e instanceof Error ? e.message : 'Could not cancel review.')); }
    finally { setBusy(false); }
  };
  const scan = async () => {
    const result = permission?.granted ? permission : await requestPermission();
    if (!result.granted) { setError(t('Camera permission is required to scan. You can paste the address instead.')); return; }
    scanned.current = false; setCamera(true);
  };
  const swap = () => {
    if (!rate) return;
    const exact = maxQuote ? BigInt(maxQuote.amount) : atomic;
    setAmount(exact !== null ? fiatMode ? xmrInput(exact) : centsToString(fiatCents(exact, rate)) : '');
    setFiatMode(!fiatMode);
  };
  return <ScrollView keyboardShouldPersistTaps="handled" style={{ flex: 1, backgroundColor: c.background }} contentContainerStyle={{ padding: 22, paddingBottom: ins.bottom + 28, gap: 22 }}>
    <Stack.Screen options={{ title: quote ? t('Review') : t('Send') }} />
    <Text style={[ui.h2, { color: c.foreground }]}>{quote ? t('Review payment') : t('Send Monero')}</Text>
    {quote ? <>
      <Card style={{ gap: 18 }}>
        <Text style={{ color: c.mutedForeground }}>{t('To')}</Text>
        <Text selectable style={{ color: c.foreground, fontFamily: F.m }}>{quote.address}</Text>
        {[[t('Amount'), BigInt(quote.amount)], [t('Fee'), BigInt(quote.fee)], [t('Total'), BigInt(quote.amount) + BigInt(quote.fee)]].map(([label, value]) => <View key={String(label)} style={{ flexDirection: 'row', justifyContent: 'space-between', gap: 12 }}>
          <Text style={{ color: c.mutedForeground }}>{String(label)}</Text>
          <View style={{ alignItems: 'flex-end' }}><Text style={{ color: c.foreground, fontFamily: F.s }}>{formatXmr(value as bigint, 12)} XMR</Text><Text style={{ color: c.mutedForeground }}>{valueText(value as bigint)}</Text></View>
        </View>)}
      </Card>
      <Text style={{ color: c.mutedForeground }}>{t('Check the address and amount. Confirming sends this payment and cannot be undone.')}</Text>
      <Btn testID="send-confirm" label={t('Confirm')} loading={busy} disabled={busy || uncertain} onPress={commit} />
      <Btn label={t('Cancel')} variant="ghost" disabled={busy} onPress={cancel} />
    </> : <>
      <Card style={{ gap: 12 }}>
        <Field label={t('Recipient address')} value={address} onChangeText={changeAddress} editable={!busy} autoCorrect={false} autoCapitalize="none" mono />
        <View style={{ flexDirection: 'row', gap: 12 }}>
          <Btn label={t('Paste')} icon="clipboard" variant="soft" style={{ flex: 1 }} disabled={busy} onPress={async () => { try { changeAddress((await Clipboard.getStringAsync()).trim()); } catch { setError(t('Clipboard unavailable on this device.')); } }} />
          <Btn testID="scan-payment" label={t('Scan QR')} icon="camera" variant="soft" style={{ flex: 1 }} disabled={busy} onPress={scan} />
        </View>
      </Card>
      <Card style={{ gap: 16 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
          <Text style={{ flex: 1, color: c.mutedForeground }}>{t('Amount')}</Text>
          <Pressable testID="send-max" disabled={busy || !sync.complete || available <= 0n} onPress={() => prepare(true)} style={{ padding: 8 }}><Text style={{ color: c.primary, fontFamily: F.s }}>{t('Max')}</Text></Pressable>
          <Text style={{ color: c.foreground, fontFamily: F.s }}>{fiatMode ? state?.currency : 'XMR'}</Text>
          <Pressable testID="send-currency-swap" accessibilityLabel={t('Switch amount currency')} disabled={!rate || busy} onPress={swap} style={{ padding: 8, opacity: rate ? 1 : 0.4 }}><Feather name="repeat" size={21} color={c.primary} /></Pressable>
        </View>
        <TextInput testID="send-amount" value={amount} onChangeText={changeAmount} editable={!busy} keyboardType="decimal-pad" placeholder="0.00" placeholderTextColor={c.mutedForeground} style={{ fontSize: 36, fontFamily: F.s, color: c.foreground, paddingVertical: 8 }} />
        <Text style={{ color: c.mutedForeground }}>{atomic !== null ? fiatMode ? `${formatXmr(maxQuote ? BigInt(maxQuote.amount) : atomic, 8)} XMR` : valueText(atomic) : '—'}</Text>
        <Text style={{ color: c.mutedForeground }}>{t('Spendable')}: {sync.complete ? `${formatXmr(available, 8)} XMR` : t('Pending')}</Text>
      </Card>
      {!sync.complete ? <Text style={{ color: c.warn }}>{t('Funds are still syncing. Wait until fully synced before sending.')}</Text> : null}
      {state?.broadcastWarning ? <Text selectable style={{ color: c.warn }}>{t('Payment status is uncertain. Do not send again. Check transaction history and the transaction ID first.')}{'\n'}{state.broadcastWarning}</Text> : null}
      <Btn testID="send-review" label={t('Review payment')} loading={busy} disabled={busy || !sync.complete || !!state?.broadcastWarning} onPress={() => prepare()} />
    </>}
    {error ? <Text accessibilityRole="alert" selectable style={{ color: c.destructive }}>{error}</Text> : null}
    {uncertain && quote ? <Text selectable style={{ color: c.mutedForeground }}>{t('Transaction ID')}: {quote.txid}</Text> : null}
    <Modal visible={camera} onRequestClose={() => setCamera(false)} animationType="slide">
      <View style={{ flex: 1, backgroundColor: '#000' }}>
        {camera ? <CameraView style={{ flex: 1 }} facing="back" barcodeScannerSettings={{ barcodeTypes: ['qr'] }} onBarcodeScanned={({ data }) => {
          if (scanned.current) return;
          scanned.current = true; setCamera(false);
          try { const payment = readPaymentQr(data); changeAddress(payment.address); if (payment.amount) { setFiatMode(false); changeAmount(payment.amount); } }
          catch (e) { setError(t(e instanceof Error ? e.message : 'Invalid QR code.')); }
        }} /> : null}
        <View style={{ padding: 24, paddingBottom: ins.bottom + 24 }}><Btn label={t('Cancel')} onPress={() => setCamera(false)} /></View>
      </View>
    </Modal>
  </ScrollView>;
}
