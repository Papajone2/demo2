import { IS_NATIVE_ANDROID } from '@/lib/native-engine';
import { NativeSend } from '@/components/native-send';
import { Feather } from '@expo/vector-icons';
import * as Clipboard from 'expo-clipboard';
import { router, Stack } from 'expo-router';
import React, { useRef, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { KeyboardAwareScrollViewCompat } from '@/components/KeyboardAwareScrollViewCompat';
import { Btn, Card, F, Field, s as ui, tap, useInsets, WalletGate } from '@/components/ui';
import { useAndroidBack } from '@/components/welcome-flow';
import { useLanguage } from '@/context/LanguageContext';
import { useWallet } from '@/context/WalletContext';
import { useColors } from '@/hooks/useColors';
import { checkTestAddress, currencySymbol, fiatCents, formatFiat, formatXmr, parseXmr, TEST_FEE } from '@/lib/money';

type Stage = 'form' | 'review';

/** After a successful send: close the modal and open History, where the new transfer shows as Pending. */
function openHistory(txId: string) {
  if (router.canDismiss()) router.dismiss();
  router.push({ pathname: '/activity', params: { sent: txId } });
}

function Send() {
  const c = useColors();
  const ins = useInsets();
  const { t } = useLanguage();
  const { state, available, send, sync } = useWallet();
  const [stage, setStage] = useState<Stage>('form');
  const [addr, setAddr] = useState('');
  const [amt, setAmt] = useState('');
  const [note, setNote] = useState('');
  const [errs, setErrs] = useState<{ addr?: string; amt?: string; submit?: string }>({});
  const [busy, setBusy] = useState(false);
  const submitting = useRef(false);
  const done = useRef(false);
  // Android back on the review returns to the (preserved) form instead of closing.
  useAndroidBack(stage === 'review' && !busy ? () => setStage('form') : undefined);
  if (!state) return null;
  const rate = state.rateCents ? BigInt(state.rateCents) : null;
  const sym = currencySymbol(state.currency);
  const parsed = parseXmr(amt);
  const maxSend = available > TEST_FEE ? available - TEST_FEE : BigInt(0);
  const fiat = (v: bigint) => (rate ? formatFiat(fiatCents(v, rate), sym) : null);

  const validate = () => {
    const e: typeof errs = {};
    const a = checkTestAddress(addr);
    if (!a.ok) e.addr = t(a.reason);
    else if (state.addresses.includes(addr.trim())) e.addr = t('That is this wallet’s own test address.');
    if (parsed === null) e.amt = t('Enter an amount like 0.25 (max 12 decimals).');
    else if (parsed <= BigInt(0)) e.amt = t('Amount must be greater than zero.');
    else if (parsed + TEST_FEE > available) e.amt = t('Insufficient unlocked balance. Max {max} after fee.', { max: formatXmr(maxSend, 12) });
    setErrs(e);
    return Object.keys(e).length === 0;
  };

  // The only place the ledger is mutated; guarded against rapid double taps.
  const confirm = async () => {
    if (submitting.current || done.current || parsed === null || !sync.complete) return;
    submitting.current = true;
    setBusy(true);
    try {
      const tx = await send(addr, parsed, note);
      done.current = true;
      tap('success');
      openHistory(tx.id);
    } catch (e) {
      tap('error');
      setErrs({ submit: e instanceof Error ? t(e.message) : t('Transfer failed. Nothing was changed.') });
      submitting.current = false;
      setBusy(false);
    }
  };

  const pad = { paddingHorizontal: 18, paddingTop: 12, paddingBottom: ins.bottom + 24, gap: 14 };
  const header = <Stack.Screen options={{ title: stage === 'review' ? t('Review') : t('Send') }} />;

  if (stage === 'review' && parsed !== null) {
    const total = parsed + TEST_FEE;
    return (
      <View testID="send-review" style={{ flex: 1, backgroundColor: c.background }}>
        {header}
        <ScrollView contentContainerStyle={[pad, { flexGrow: 1 }]}>
          <Text style={[st.kick, { color: c.mutedForeground }]}>{t('You are sending')}</Text>
          <Text testID="review-amount" adjustsFontSizeToFit numberOfLines={1} style={[st.big, { color: c.foreground }]}>{formatXmr(parsed, 12)} XMR</Text>
          {fiat(parsed) ? <Text style={{ fontFamily: F.m, color: c.mutedForeground }}>≈ {fiat(parsed)}</Text> : null}
          <Card style={{ gap: 14 }}>
            <Line testID="review-recipient" k={t('To')} v={addr.trim()} mono />
            <Line testID="review-fee" k={t('Network fee')} v={`${formatXmr(TEST_FEE, 12)} XMR`} sub={fiat(TEST_FEE)} />
            <View style={{ height: 1, backgroundColor: c.background }} />
            <Line testID="review-total" k={t('Total')} v={`${formatXmr(total, 12)} XMR`} sub={fiat(total)} strong />
            {note.trim() ? <Line testID="review-note" k={t('Note')} v={note.trim()} /> : null}
          </Card>
          <Text testID="send-preview-note" style={[ui.hint, { color: c.mutedForeground }]}>{t('Preview: updates this device’s local ledger only. Nothing is signed or broadcast.')}</Text>
          {!sync.complete ? <Text testID="review-sync-wait" style={[ui.hint, { color: c.warn }]}>{t('Syncing ({pct}%, ~{s}s). Fully sync before sending.', { pct: Math.round(sync.progress * 100), s: sync.remainingSeconds })}</Text> : null}
          {errs.submit ? <Text testID="send-error" style={[ui.hint, { color: c.destructive }]}>{errs.submit}</Text> : null}
          <View style={{ flex: 1, minHeight: 12 }} />
          <Btn testID="confirm-send" label={t('Confirm and send')} loading={busy} disabled={busy || !sync.complete} onPress={confirm} />
          <Btn testID="review-edit" label={t('Edit')} variant="ghost" disabled={busy} onPress={() => setStage('form')} />
        </ScrollView>
      </View>
    );
  }

  return (
    <KeyboardAwareScrollViewCompat style={{ flex: 1, backgroundColor: c.background }} contentContainerStyle={pad} bottomOffset={24}>
      {header}
      <Field
        testID="send-address"
        label={t('Recipient test address')}
        value={addr}
        onChangeText={(v) => { setAddr(v); setErrs((e) => ({ ...e, addr: undefined })); }}
        placeholder="TEST-XXXX-XXXX-XXXX-XXXX"
        autoCapitalize="characters"
        autoCorrect={false}
        mono
        error={errs.addr}
        hint={t('Real Monero addresses are not supported in the preview.')}
      />
      <View style={{ flexDirection: 'row', gap: 8 }}>
        <Pressable testID="send-paste" style={[st.mini, { backgroundColor: c.charcoal }]} onPress={async () => { try { const v = await Clipboard.getStringAsync(); setAddr(v.trim()); } catch { setErrs({ addr: t('Clipboard unavailable on this device.') }); } }}>
          <Feather name="clipboard" size={14} color={c.foreground} />
          <Text style={[st.miniT, { color: c.foreground }]}>{t('Paste')}</Text>
        </Pressable>
      </View>
      <Field
        testID="send-amount"
        label={t('Amount (test XMR)')}
        value={amt}
        onChangeText={(v) => { setAmt(v); setErrs((e) => ({ ...e, amt: undefined })); }}
        keyboardType="decimal-pad"
        placeholder="0.00"
        error={errs.amt}
        hint={`${t('Unlocked: {v}', { v: formatXmr(available, 12) })} · ${t('Fee {v}', { v: formatXmr(TEST_FEE, 12) })}${parsed && rate ? ` · ≈ ${formatFiat(fiatCents(parsed, rate), sym)}` : ''}`}
      />
      <Pressable testID="send-max" style={[st.mini, { backgroundColor: c.charcoal, alignSelf: 'flex-start' }]} onPress={() => { tap(); setAmt(formatXmr(maxSend, 12, 0).replace(/,/g, '')); }}>
        <Text style={[st.miniT, { color: c.foreground }]}>{t('Use max')}</Text>
      </Pressable>
      <Field testID="send-note" label={t('Private note (optional)')} value={note} onChangeText={setNote} maxLength={80} placeholder={t('Only stored on this device')} />
      {!sync.complete ? <Text testID="send-sync-wait" style={{ fontFamily: F.m, fontSize: 13.5, color: c.mutedForeground, textAlign: 'center' }}>{t('Syncing ({pct}%, ~{s}s). Fully sync before sending.', { pct: Math.round(sync.progress * 100), s: sync.remainingSeconds })}</Text> : null}
      <Btn testID="review-send" label={t('Review')} onPress={() => { if (validate()) { setErrs({}); setStage('review'); } }} />
    </KeyboardAwareScrollViewCompat>
  );
}

function Line({ k, v, sub, mono, strong, testID }: { k: string; v: string; sub?: string | null; mono?: boolean; strong?: boolean; testID?: string }) {
  const c = useColors();
  return (
    <View testID={testID} style={{ gap: 2 }}>
      <Text style={{ fontFamily: F.m, fontSize: 12, color: c.mutedForeground }}>{k}</Text>
      <Text selectable style={{ fontFamily: mono ? F.m : strong ? F.b : F.s, fontSize: strong ? 16 : 14.5, color: c.foreground, fontVariant: ['tabular-nums'] }}>{v}</Text>
      {sub ? <Text style={{ fontFamily: F.r, fontSize: 12.5, color: c.mutedForeground }}>≈ {sub}</Text> : null}
    </View>
  );
}

export default function SendScreen() {
  if (IS_NATIVE_ANDROID) return <WalletGate><NativeSend /></WalletGate>;
  return (
    <WalletGate>
      <Send />
    </WalletGate>
  );
}

const st = StyleSheet.create({
  mini: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 12, paddingVertical: 8, borderRadius: 999 },
  miniT: { fontFamily: F.s, fontSize: 13 },
  kick: { fontFamily: F.s, fontSize: 13, marginTop: 8 },
  big: { fontFamily: F.b, fontSize: 36, letterSpacing: -1.2, fontVariant: ['tabular-nums'] },
});
