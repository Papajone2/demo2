import { Feather } from '@expo/vector-icons';
import * as Clipboard from 'expo-clipboard';
import React, { useEffect, useRef, useState } from 'react';
import { BackHandler, Platform, Pressable, StyleSheet, Text, TextInput, useWindowDimensions, View } from 'react-native';
import { F, tap, useInsets } from '@/components/ui';
import { accent } from '@/components/language-picker';
import { Check, DEMO_TOKENS, Group, PillBtn, Row, sampleTokens, SampleTag, SetupPage, st, SURFACE, SURFACE_HI } from '@/components/setup-parts';
import { msg, useLanguage } from '@/context/LanguageContext';
import { useColors } from '@/hooks/useColors';
import { IS_NATIVE_ANDROID } from '@/lib/native-engine';
import { NativeWalletSetup } from './native-wallet-setup';

type Step = 'choice' | 'warn' | 'phrase' | 'restore';
export type SetupPath = 'create' | 'restore';

/**
 * Front-end-only wallet setup preview. Nothing here is stored, logged or sent;
 * all state lives in this component and is dropped on unmount or path switch.
 */
export function WalletSetup(props: { onBack: () => void; onReady: (p: SetupPath) => void }) {
  if (IS_NATIVE_ANDROID) return <NativeWalletSetup {...props} />;
  return <PreviewWalletSetup {...props} />;
}
function PreviewWalletSetup({ onBack, onReady }: { onBack: () => void; onReady: (p: SetupPath) => void }) {
  const [step, setStep] = useState<Step>('choice');
  const [nonce, setNonce] = useState(0); // remounts steps so ephemeral state is discarded
  const go = (s: Step) => { if (s === 'choice') setNonce((n) => n + 1); setStep(s); };
  const back = () => {
    if (step === 'choice') return onBack();
    go(step === 'phrase' ? 'warn' : 'choice');
  };
  const backRef = useRef(back);
  backRef.current = back;
  useEffect(() => {
    if (Platform.OS !== 'android') return undefined;
    const sub = BackHandler.addEventListener('hardwareBackPress', () => { backRef.current(); return true; });
    return () => sub.remove();
  }, []);

  if (step === 'choice') return <Choice onBack={back} onPick={(p) => go(p === 'create' ? 'warn' : 'restore')} />;
  if (step === 'warn') return <Warn key={nonce} onBack={back} onNext={() => go('phrase')} />;
  if (step === 'phrase') return <Phrase key={nonce} onBack={back} onNext={() => onReady('create')} />;
  return <Restore key={nonce} onBack={back} onDone={() => onReady('restore')} />;
}

function Choice({ onBack, onPick }: { onBack: () => void; onPick: (p: SetupPath) => void }) {
  const c = useColors();
  const ins = useInsets();
  const { t } = useLanguage();
  return (
    <SetupPage testID="setup-choice" step={t('Set up wallet')} onBack={onBack}
      title={accent(t('Your [Monero].\nYour way.'), c.primary)} sub={t('Create a new wallet, or restore one you already have.')}>
      <Pressable testID="setup-create" accessibilityRole="button" accessibilityLabel={t('Create wallet')} onPress={() => { tap('medium'); onPick('create'); }}
        style={({ pressed }) => [cs.create, { backgroundColor: pressed ? '#241A14' : '#1C1612', transform: [{ scale: pressed ? 0.985 : 1 }] }]}>
        <View style={[cs.plus, { backgroundColor: 'rgba(255,101,0,0.14)', borderColor: 'rgba(255,101,0,0.42)' }]}><Feather name="plus" size={22} color={c.primary} /></View>
        <View style={{ flex: 1, gap: 3 }}>
          <Text style={{ fontFamily: F.b, fontSize: 19, color: c.inkForeground }}>{t('Create wallet')}</Text>
          <Text style={{ fontFamily: F.r, fontSize: 14, color: '#9A9AA0' }}>{t('Start fresh with a new wallet.')}</Text>
        </View>
        <Feather name="chevron-right" size={22} color={c.primary} />
      </Pressable>
      <Pressable testID="setup-restore" accessibilityRole="button" accessibilityLabel={t('Restore wallet')} onPress={() => { tap(); onPick('restore'); }}
        style={({ pressed }) => [cs.restore, { opacity: pressed ? 0.6 : 1 }]}>
        <Feather name="rotate-ccw" size={16} color="#9A9AA0" />
        <Text style={{ fontFamily: F.m, fontSize: 15, color: '#C7C7CC' }}>{t('Restore with a recovery phrase')}</Text>
      </Pressable>
      <View style={{ flex: 1, minHeight: 24 }} />
      <Text testID="setup-footer" style={{ fontFamily: F.m, fontSize: 13.5, color: '#6E6E73', textAlign: 'center', marginBottom: Math.max(4, ins.bottom - 4) }}>{t('Made by monero2014.com')}</Text>
    </SetupPage>
  );
}

function Warn({ onBack, onNext }: { onBack: () => void; onNext: () => void }) {
  const [ack, setAck] = useState(false);
  const { t } = useLanguage();
  return (
    <SetupPage testID="setup-warn" step={t('Create · 1 of 2')} onBack={onBack} title={t('Keep your phrase private')} sub={t('It is the only way back into your wallet.')}
      footer={<>
        <Check testID="setup-warn-ack" checked={ack} onToggle={() => setAck((v) => !v)} label={t('I understand losing it means losing access.')} />
        <PillBtn testID="setup-warn-next" label={t('Continue')} disabled={!ack} onPress={onNext} />
      </>}>
      <Group>
        <Row icon="edit-3" title={t('Write it on paper')} body={t('Keep it offline, somewhere only you can reach.')} />
        <Row icon="eye-off" title={t('Never share it')} body={t('Anyone with it can take your funds.')} />
        <Row icon="lock" title={t('No one can reset it')} body={t('Not monero2014, not support, not anyone.')} last />
      </Group>
    </SetupPage>
  );
}

function Phrase({ onBack, onNext }: { onBack: () => void; onNext: () => void }) {
  const c = useColors();
  const { height, fontScale } = useWindowDimensions();
  const [shown, setShown] = useState(false);
  const [done, setDone] = useState(false);
  const [copied, setCopied] = useState(false);
  const [copyErr, setCopyErr] = useState(false);
  const { t } = useLanguage();
  // Fit the grid, Copy row, acknowledgment and Continue on 375x812 without scrolling.
  const cellH = Math.round(Math.max(28 * Math.min(fontScale, 1.3), Math.min(40, (height - 520) / 8 - 6)));
  const fs = Math.min(14.5, Math.max(12.5, cellH * 0.42));
  const copy = async () => {
    if (!shown) return;
    try { await Clipboard.setStringAsync(DEMO_TOKENS.join(' ')); tap('success'); setCopyErr(false); setCopied(true); setTimeout(() => setCopied(false), 1500); }
    catch { setCopyErr(true); }
  };
  return (
    <SetupPage testID="setup-phrase" compact step={t('Create · 2 of 2')} onBack={onBack} title={t('Recovery phrase')}
      footer={<>
        <Check testID="seed-backed-up" checked={done} disabled={!shown} onToggle={() => setDone((v) => !v)} label={t('I have written down all 16 entries.')} />
        <PillBtn testID="setup-phrase-next" label={t('Continue')} disabled={!shown || !done} onPress={onNext} />
      </>}>
      <SampleTag right={shown ? (
        <Pressable testID="seed-hide" accessibilityRole="button" onPress={() => { tap(); setShown(false); }} hitSlop={10} style={{ flexDirection: 'row', alignItems: 'center', gap: 5 }}>
          <Feather name="eye-off" size={14} color={c.primary} />
          <Text style={{ fontFamily: F.s, fontSize: 13, color: c.primary }}>{t('Hide')}</Text>
        </Pressable>
      ) : null} />
      <View>
        <View style={st.grid} accessibilityLabel={shown ? t('Sample tokens, not a recovery phrase') : t('Hidden sample tokens')}>
          {DEMO_TOKENS.map((t, i) => (
            <View key={t} testID={`seed-cell-${i + 1}`} style={[st.cell, { height: cellH }]}>
              <Text style={[st.num, { color: '#6E6E73' }]}>{i + 1}</Text>
              <Text numberOfLines={1} style={[st.token, { fontSize: fs, color: shown ? c.inkForeground : '#3E3E42' }]}>{shown ? t : '\u2022\u2022\u2022\u2022\u2022\u2022'}</Text>
            </View>
          ))}
        </View>
        {!shown ? (
          <View style={[StyleSheet.absoluteFill, { alignItems: 'center', justifyContent: 'center' }]}>
            <Pressable testID="seed-reveal" accessibilityRole="button" accessibilityLabel={t('Reveal sample tokens')} onPress={() => { tap('medium'); setShown(true); }}
              style={({ pressed }) => [cs.reveal, { backgroundColor: pressed ? '#2A2A2D' : '#232326' }]}>
              <Feather name="eye" size={17} color={c.primary} />
              <Text style={{ fontFamily: F.s, fontSize: 15, color: c.inkForeground }}>{t('Tap to reveal')}</Text>
            </Pressable>
          </View>
        ) : null}
      </View>
      <Pressable testID="seed-copy" accessibilityRole="button" accessibilityLabel={t('Copy sample tokens')} accessibilityState={{ disabled: !shown }} disabled={!shown} onPress={copy} hitSlop={8}
        style={({ pressed }) => [cs.copy, { opacity: !shown ? 0.35 : pressed ? 0.6 : 1 }]}>
        <Feather name={copied ? 'check' : 'copy'} size={14} color={c.inkForeground} />
        <Text style={{ fontFamily: F.s, fontSize: 13.5, color: c.inkForeground }}>{copyErr ? t('Clipboard unavailable on this device.') : copied ? t('Copied') : t('Copy')}</Text>
      </Pressable>
    </SetupPage>
  );
}

const REJECT = msg('Use the sample phrase in this preview. Real recovery needs the native Monero engine.');

function Restore({ onBack, onDone }: { onBack: () => void; onDone: () => void }) {
  const c = useColors();
  const { t } = useLanguage();
  const [count, setCount] = useState<16 | 25>(16);
  const [words, setWords] = useState<string[]>(() => Array(16).fill(''));
  const [height, setHeight] = useState('');
  const [err, setErr] = useState<string | null>(null);
  const [focus, setFocus] = useState(-1);
  const refs = useRef<(React.ElementRef<typeof TextInput> | null)[]>([]);
  const filled = words.filter((w) => w.trim()).length;
  const heightBad = height !== '' && !/^\d+$/.test(height);

  const pickCount = (n: 16 | 25) => { if (n === count) return; tap(); setCount(n); setErr(null); setWords(Array(n).fill('')); };
  const set = (i: number, v: string) => {
    setErr(null);
    const parts = v.trim().split(/\s+/);
    if (parts.length > 1) { // pasted several entries at once
      setWords((a) => a.map((w, j) => (j >= i && j < i + parts.length ? parts[j - i] : w)));
      return;
    }
    setWords((a) => a.map((w, j) => (j === i ? v.replace(/\s/g, '') : w)));
  };
  const submit = () => {
    if (heightBad) { tap('error'); setErr(t('Restore height must be a whole number (0 or more).')); return; }
    const sample = sampleTokens(count);
    if (words.every((w, i) => w.trim().toLowerCase() === sample[i])) { tap('success'); onDone(); return; }
    tap('error');
    setErr(t(REJECT));
  };

  return (
    <SetupPage testID="setup-restore-form" step={t('Restore')} onBack={onBack} title={t('Enter recovery phrase')} sub={t('Type or paste all {n} entries in order.', { n: count })}
      footer={<PillBtn testID="restore-submit" label={t('Continue')} disabled={filled < count || heightBad} onPress={submit} />}>
      <SampleTag text={t('Preview accepts the sample phrase only')} />
      <View style={cs.seg} accessibilityRole="radiogroup">
        {([16, 25] as const).map((n) => {
          const on = n === count;
          return (
            <Pressable key={n} testID={`restore-len-${n}`} accessibilityRole="radio" accessibilityState={{ selected: on }} onPress={() => pickCount(n)}
              style={[cs.segBtn, on && { backgroundColor: SURFACE_HI }]}>
              <Text style={{ fontFamily: F.s, fontSize: 14, color: on ? c.inkForeground : '#8E8E93' }}>{t('{n} words', { n })}</Text>
            </Pressable>
          );
        })}
      </View>
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
        <Text testID="restore-count" style={{ fontFamily: F.s, fontSize: 13, color: c.inkMuted, fontVariant: ['tabular-nums'] }}>{t('{a} of {b}', { a: filled, b: count })}</Text>
        <View style={{ flexDirection: 'row', gap: 4 }}>
          {filled > 0 ? (
            <Pressable testID="restore-clear" accessibilityRole="button" onPress={() => { tap(); setErr(null); setWords(Array(count).fill('')); }} style={{ padding: 8 }}>
              <Text style={{ fontFamily: F.s, fontSize: 14, color: c.inkMuted }}>{t('Clear')}</Text>
            </Pressable>
          ) : null}
          <Pressable testID="restore-sample" accessibilityRole="button" onPress={() => { tap(); setErr(null); setWords(sampleTokens(count)); }} style={{ padding: 8 }}>
            <Text style={{ fontFamily: F.s, fontSize: 14, color: c.primary }}>{t('Use sample phrase')}</Text>
          </Pressable>
        </View>
      </View>
      <View style={st.grid}>
        {words.map((w, i) => (
          <View key={`${count}-${i}`} style={[st.cell, { height: 40, borderWidth: 1.5, borderColor: focus === i ? c.primary : 'transparent' }]}>
            <Text style={[st.num, { color: c.inkMuted }]}>{i + 1}</Text>
            <TextInput
              ref={(r) => { refs.current[i] = r; }}
              testID={`restore-word-${i + 1}`}
              accessibilityLabel={t('Entry {n}', { n: i + 1 })}
              value={w}
              onChangeText={(v) => set(i, v)}
              onFocus={() => setFocus(i)}
              onBlur={() => setFocus(-1)}
              autoCapitalize="none"
              autoCorrect={false}
              autoComplete="off"
              spellCheck={false}
              importantForAutofill="no"
              keyboardType={Platform.OS === 'android' ? 'visible-password' : 'default'}
              returnKeyType={i === count - 1 ? 'done' : 'next'}
              blurOnSubmit={i === count - 1}
              onSubmitEditing={() => (i < count - 1 ? refs.current[i + 1]?.focus() : undefined)}
              style={[st.token, { color: c.inkForeground, paddingVertical: 0 }]}
            />
          </View>
        ))}
      </View>
      <View style={[cs.heightBox, { borderColor: focus === 99 ? c.primary : heightBad ? c.primary : 'transparent' }]}>
        <Text style={{ fontFamily: F.m, fontSize: 12.5, color: '#8E8E93' }}>{t('Restore height (optional)')}</Text>
        <TextInput testID="restore-height" accessibilityLabel={t('Restore height (optional)')} value={height}
          onChangeText={(v) => { setErr(null); setHeight(v.trim()); }} onFocus={() => setFocus(99)} onBlur={() => setFocus(-1)}
          keyboardType="number-pad" placeholder={t('Block number, e.g. 3100000')} placeholderTextColor="#5A5A5E" maxLength={9}
          style={{ fontFamily: F.m, fontSize: 15.5, color: c.inkForeground, paddingVertical: 4 }} />
        <Text style={{ fontFamily: F.r, fontSize: 12, color: heightBad ? c.primary : '#6E6E73' }}>{heightBad ? t('Use digits only.') : t('Speeds up scanning. Leave empty if unsure.')}</Text>
      </View>
      {err ? <Text testID="restore-error" style={[st.err, { color: c.primary }]}>{err}</Text> : null}
    </SetupPage>
  );
}

const cs = StyleSheet.create({
  create: { flexDirection: 'row', alignItems: 'center', gap: 16, paddingVertical: 22, paddingHorizontal: 18, borderRadius: 22 },
  plus: { width: 50, height: 50, borderRadius: 25, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
  restore: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, paddingVertical: 14, alignSelf: 'center', paddingHorizontal: 16 },
  seg: { flexDirection: 'row', backgroundColor: SURFACE, borderRadius: 12, padding: 3 },
  segBtn: { flex: 1, height: 36, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  heightBox: { backgroundColor: SURFACE, borderRadius: 14, paddingHorizontal: 14, paddingVertical: 10, borderWidth: 1.5, gap: 2 },
  copy: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, alignSelf: 'center', paddingVertical: 4, paddingHorizontal: 12 },
  reveal: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 12, paddingHorizontal: 20, borderRadius: 999 },
});
