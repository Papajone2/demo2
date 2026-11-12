import { Feather } from '@expo/vector-icons';
import React, { useEffect, useRef, useState } from 'react';
import { Animated, BackHandler, Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import { KeyboardAwareScrollViewCompat } from '@/components/KeyboardAwareScrollViewCompat';
import { Btn, F, Field, s as ui, Skeleton, tap, useInsets } from '@/components/ui';
import { IS_WEB_DEMO, useLock } from '@/context/LockContext';
import { useColors } from '@/hooks/useColors';
import type { LockMethod } from '@/lib/kdf';
import { MoneroLogo } from '@/components/MoneroLogo';
import { type SetupPath, WalletSetup } from '@/components/wallet-setup';
import { Onboarding, useAndroidBack } from '@/components/welcome-flow';
import { EraseSheet } from '@/components/erase-sheet';
import { SURFACE } from '@/components/setup-parts';
import { Image } from 'expo-image';
import { CustomizeFlow } from '@/components/account-flows';
import { useWallet } from '@/context/WalletContext';
import { msg, useLanguage } from '@/context/LanguageContext';

/** First-run: once the lock exists, let the user name + pick an icon for the initial wallet (updates it, never duplicates). */
export function FirstRunCustomize({ children }: { children: React.ReactNode }) {
  const { state } = useWallet();
  if (state?.needsCustomization) return <CustomizeFlow key={state.id} mode="initial" wallet={state} defaultName={state.name} onDone={() => {}} />;
  return <>{children}</>;
}

const PIN_LEN = 4;
export const SITE = 'https://monero2014.com';

function useShake() {
  const x = useRef(new Animated.Value(0)).current;
  const shake = () => {
    tap('error');
    Animated.sequence(
      [10, -10, 8, -8, 4, 0].map((v) => Animated.timing(x, { toValue: v, duration: 50, useNativeDriver: Platform.OS !== 'web' })),
    ).start();
  };
  return { x, shake };
}

function PinDots({ len, shakeX, busy, length = PIN_LEN }: { len: number; shakeX: Animated.Value; busy?: boolean; length?: number }) {
  const c = useColors();
  return (
    <Animated.View style={[st.dots, { transform: [{ translateX: shakeX }], opacity: busy ? 0.4 : 1 }]}>
      {Array.from({ length }).map((_, i) => (
        <View key={i} style={[st.dot, { borderColor: c.inkMuted, backgroundColor: i < len ? c.primary : 'transparent', transform: [{ scale: i < len ? 1.1 : 1 }] }]} />
      ))}
    </Animated.View>
  );
}

function Key({ label, icon, onPress, disabled, testID }: { label?: string; icon?: keyof typeof Feather.glyphMap; onPress: () => void; disabled?: boolean; testID?: string }) {
  const c = useColors();
  return (
    <Pressable
      testID={testID}
      disabled={disabled}
      onPress={() => {
        tap();
        onPress();
      }}
      style={({ pressed }) => [st.key, { backgroundColor: pressed ? c.inkSoft : 'transparent', transform: [{ scale: pressed ? 0.92 : 1 }], opacity: disabled ? 0.35 : 1 }]}
    >
      {icon ? <Feather name={icon} size={24} color={c.inkForeground} /> : <Text style={[st.keyText, { color: c.inkForeground }]}>{label}</Text>}
    </Pressable>
  );
}

function PinPad({ value, onChange, disabled, length = PIN_LEN }: { value: string; onChange: (v: string) => void; disabled?: boolean; length?: number }) {
  const press = (d: string) => value.length < length && onChange(value + d);
  const rows = [['1', '2', '3'], ['4', '5', '6'], ['7', '8', '9']];
  return (
    <View style={st.pad}>
      {rows.map((r) => (
        <View key={r[0]} style={st.padRow}>
          {r.map((d) => (
            <Key key={d} label={d} testID={`pin-${d}`} disabled={disabled} onPress={() => press(d)} />
          ))}
        </View>
      ))}
      <View style={st.padRow}>
        <View style={st.key} />
        <Key label="0" testID="pin-0" disabled={disabled} onPress={() => press('0')} />
        <Key icon="delete" testID="pin-back" disabled={disabled || !value} onPress={() => onChange(value.slice(0, -1))} />
      </View>
    </View>
  );
}

const SETUP_BG = require('@/assets/images/welcome-background.png');

function Shell({ children, scroll, firstRun }: { children: React.ReactNode; scroll?: boolean; firstRun?: boolean }) {
  const ins = useInsets();
  const pad = { paddingTop: ins.top + (firstRun ? 4 : 16), paddingBottom: ins.bottom + 20, paddingHorizontal: firstRun ? 22 : 24 };
  const bg = '#0B0B0B';
  const body = scroll ? (
    <KeyboardAwareScrollViewCompat style={{ flex: 1, backgroundColor: 'transparent' }} contentContainerStyle={[pad, { flexGrow: 1 }]} bottomOffset={24}>
      {children}
    </KeyboardAwareScrollViewCompat>
  ) : <View style={[{ flex: 1 }, pad]}>{children}</View>;
  return (
    <View style={{ flex: 1, backgroundColor: bg }}>
      <Image source={SETUP_BG} style={StyleSheet.absoluteFill} contentFit="cover" contentPosition="top" />
      {body}
    </View>
  );
}

function Brand() {
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
      <MoneroLogo size={30} />
    </View>
  );
}

/** First run: slides -> create/restore preview -> app lock. Ephemeral setup state is dropped whenever we leave a stage. */
function FirstRun() {
  const [stage, setStage] = useState<'slides' | 'setup' | 'lock'>('slides');
  const [path, setPath] = useState<SetupPath>('create');
  const [slide, setSlide] = useState(0);
  if (stage === 'slides') return <Onboarding showLanguage start={slide} onDone={() => setStage('setup')} />;
  if (stage === 'setup') return <WalletSetup onBack={() => { setSlide(2); setStage('slides'); }} onReady={(p) => { setPath(p); setStage('lock'); }} />;
  return <SecretSetup path={path} onBack={() => setStage('setup')} />;
}

function SecretSetup({ onCancel, onBack, path }: { onCancel?: () => void; onBack?: () => void; path?: SetupPath }) {
  const c = useColors();
  const { setup } = useLock();
  const { t } = useLanguage();
  const [method, setMethod] = useState<LockMethod>('pin');
  const [first, setFirst] = useState<string | null>(null);
  const [pin, setPin] = useState('');
  const [pw, setPw] = useState('');
  const [pw2, setPw2] = useState('');
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const { x, shake } = useShake();

  const finish = async (m: LockMethod, secret: string) => {
    setBusy(true);
    try {
      await setup(m, secret);
      tap('success');
    } catch {
      setErr(t('Could not save to secure storage. Nothing was stored; try again.'));
      setBusy(false);
    }
  };

  const onPin = (v: string) => {
    setErr(null);
    setPin(v);
    if (v.length !== PIN_LEN) return;
    if (!first) {
      setTimeout(() => {
        setFirst(v);
        setPin('');
      }, 150);
    } else if (v === first) {
      finish('pin', v);
    } else {
      setErr(t('PINs did not match. Start again.'));
      shake();
      setTimeout(() => {
        setFirst(null);
        setPin('');
      }, 300);
    }
  };

  const submitPw = () => {
    if (pw.length < 8) return setErr(t('Use at least 8 characters.'));
    if (pw !== pw2) return setErr(t('Passwords do not match.'));
    finish('password', pw);
  };

  const switchTo = (m: LockMethod) => {
    setMethod(m);
    setFirst(null);
    setPin('');
    setPw('');
    setPw2('');
    setErr(null);
  };

  useAndroidBack(onBack && !busy ? onBack : undefined);

  return (
    <Shell scroll={method === 'password'} firstRun={!!onBack}>
      {onBack ? (
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
          <Pressable testID="setup-back" accessibilityRole="button" accessibilityLabel={t('Back')} disabled={busy} onPress={() => { tap(); onBack(); }} hitSlop={10} style={({ pressed }) => ({ width: 40, height: 40, marginLeft: -8, alignItems: 'center', justifyContent: 'center', opacity: pressed ? 0.5 : 1 })}>
            <Feather name="chevron-left" size={26} color={c.inkForeground} />
          </Pressable>
          <Text testID="setup-progress" style={[st.kicker, { color: c.inkMuted }]}>{path === 'restore' ? t('RESTORE · FINAL STEP') : t('CREATE · FINAL STEP')}</Text>
          <View style={{ width: 40 }} />
        </View>
      ) : <Brand />}
      <View style={{ flex: 1, justifyContent: 'center', gap: 8, paddingVertical: 24 }}>
        <Text style={[st.kicker, { color: c.primary, textAlign: 'center' }]}>{t('APP LOCK')}</Text>
        <Text style={[ui.h2, { color: c.inkForeground, textAlign: 'center' }]}>
          {method === 'pin' ? (first ? t('Confirm your PIN') : t('Choose a 4-digit PIN')) : t('Choose a password')}
        </Text>
        {method === 'pin' ? (
          <>
            <PinDots len={pin.length} shakeX={x} busy={busy} />
            <Text style={[st.err, { color: c.primary }]}>{busy ? t('Saving…') : err ?? ' '}</Text>
            <PinPad value={pin} onChange={onPin} disabled={busy} />
          </>
        ) : (
          <View style={{ gap: 14 }}>
            <Field label={t('Password')} value={pw} onChangeText={setPw} secureTextEntry autoCapitalize="none" autoCorrect={false} testID="pw-new" style={onBack ? { backgroundColor: SURFACE, borderColor: 'transparent', color: c.inkForeground } : { backgroundColor: c.card, borderColor: c.border, color: c.foreground }} />
            <Field label={t('Confirm password')} value={pw2} onChangeText={setPw2} secureTextEntry autoCapitalize="none" autoCorrect={false} testID="pw-confirm" returnKeyType="done" onSubmitEditing={submitPw} style={onBack ? { backgroundColor: SURFACE, borderColor: 'transparent', color: c.inkForeground } : { backgroundColor: c.card, borderColor: c.border, color: c.foreground }} />
            {err ? <Text style={[ui.hint, { color: c.primary }]}>{err}</Text> : null}
            <Btn testID="pw-save" label={busy ? t('Saving…') : t('Save password')} loading={busy} onPress={submitPw} />
          </View>
        )}
      </View>
      <Pressable testID="switch-method" onPress={() => switchTo(method === 'pin' ? 'password' : 'pin')} style={{ alignSelf: 'center', padding: 10 }}>
        <Text style={{ fontFamily: F.s, color: c.inkForeground }}>{method === 'pin' ? t('Use a password instead') : t('Use a 4-digit PIN instead')}</Text>
      </Pressable>
      {onCancel && (
        <Pressable onPress={onCancel} style={{ alignSelf: 'center', padding: 8 }}>
          <Text style={{ fontFamily: F.m, color: c.inkMuted }}>{t('Cancel and keep current lock')}</Text>
        </Pressable>
      )}
    </Shell>
  );
}

function Unlock({ title, onCancel }: { title: string; onCancel?: () => void }) {
  const c = useColors();
  const { method, pinLength, unlock, throttle, eraseEverything } = useLock();
  const { t } = useLanguage();
  const [pin, setPin] = useState('');
  const [pw, setPw] = useState('');
  const [msg, setMsg] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [now, setNow] = useState(Date.now());
  const { x, shake } = useShake();
  const waiting = throttle.until > now;

  useEffect(() => {
    if (!waiting) return;
    const t = setInterval(() => setNow(Date.now()), 500);
    return () => clearInterval(t);
  }, [waiting]);

  const attempt = async (secret: string) => {
    setBusy(true);
    const r = await unlock(secret);
    setBusy(false);
    setNow(Date.now());
    if (r.ok) tap('success');
    else {
      setMsg(t(r.message ?? 'Incorrect.'));
      shake();
      setPin('');
    }
  };

  const onPin = (v: string) => {
    setMsg(null);
    setPin(v);
    if (v.length === pinLength) attempt(v);
  };

  const [sheet, setSheet] = useState(false);

  const secs = Math.ceil((throttle.until - now) / 1000);
  const status = waiting ? t('Too many attempts. Try again in {n}s.', { n: secs }) : busy ? t('Checking…') : msg ?? ' ';
  return (
    <Shell scroll={method === 'password'}>
      <View style={{ flex: 1, justifyContent: 'center', gap: 8, paddingVertical: 24 }}>
        <Text accessibilityRole="header" style={[ui.h2, { color: c.inkForeground, textAlign: 'center', fontSize: 26 }]}>{t(title)}</Text>
        {method === 'pin' ? (
          <>
            <PinDots len={pin.length} shakeX={x} busy={busy} length={pinLength} />
            <Text style={[st.err, { color: c.primary }]}>{status}</Text>
            <PinPad value={pin} onChange={onPin} disabled={busy || waiting} length={pinLength} />
          </>
        ) : (
          <Animated.View style={{ gap: 14, transform: [{ translateX: x }] }}>
            <Field label={t('Password')} value={pw} onChangeText={setPw} secureTextEntry autoCapitalize="none" autoCorrect={false} testID="pw-unlock" returnKeyType="go" onSubmitEditing={() => pw && attempt(pw)} style={{ backgroundColor: SURFACE, borderColor: 'transparent', color: c.inkForeground }} />
            <Text style={[ui.hint, { color: c.primary }]}>{status}</Text>
            <Btn testID="pw-unlock-btn" label={t('Unlock')} loading={busy} disabled={!pw || waiting} onPress={() => attempt(pw)} />
          </Animated.View>
        )}
      </View>
      {onCancel ? (
        <Pressable onPress={onCancel} style={{ alignSelf: 'center', padding: 10 }}>
          <Text style={{ fontFamily: F.m, color: c.inkMuted }}>{t('Cancel')}</Text>
        </Pressable>
      ) : (
        <Pressable testID="forgot-secret" onPress={() => { tap(); setSheet(true); }} style={{ alignSelf: 'center', padding: 10 }}>
          <Text style={{ fontFamily: F.m, color: c.inkMuted }}>{method === 'pin' ? t('Forgot PIN?') : t('Forgot password?')}</Text>
        </Pressable>
      )}
      {!onCancel ? <EraseSheet visible={sheet} label={method === 'pin' ? 'PIN' : 'password'} onCancel={() => setSheet(false)} onErase={eraseEverything} /> : null}
    </Shell>
  );
}

export function LockGate({ children }: { children: React.ReactNode }) {
  const c = useColors();
  const lock = useLock();
  const { t } = useLanguage();

  if (lock.status === 'unlocked') return <>{children}</>;
  if (lock.status === 'loading')
    return (
      <Shell>
        <Brand />
        <View style={{ flex: 1, justifyContent: 'center', gap: 14, alignItems: 'center' }}>
          <Skeleton h={64} w={64} r={32} />
          <Skeleton h={18} w="50%" />
        </View>
      </Shell>
    );
  if (lock.status === 'error')
    return (
      <Shell>
        <Brand />
        <View style={{ flex: 1, justifyContent: 'center', gap: 14 }}>
          <Feather name="alert-octagon" size={30} color={c.primary} />
          <Text style={[ui.h2, { color: c.inkForeground }]}>{t('Open your wallet safely')}</Text>
          <Text style={[ui.body, { color: c.inkMuted }]}>
            {IS_WEB_DEMO ? t('Your browser is blocking storage in this preview. Open the page in a normal tab, or start a separate temporary test session below.') : t('Secure storage could not be read. Your wallet stays locked; try again when secure storage is available.')}
          </Text>
          <Btn label={t('Try again')} icon="refresh-cw" onPress={lock.retryLoad} />
          {IS_WEB_DEMO && <Btn testID="temporary-test-session" label={t('Start temporary test session')} variant="soft" onPress={lock.startTemporarySession} />}
        </View>
      </Shell>
    );
  if (lock.status === 'needsSetup') return <FirstRun />;
  if (lock.status === 'changeVerify') return <Unlock title={msg('Enter current secret')} onCancel={lock.cancelChange} />;
  if (lock.status === 'changeSet') return <SecretSetup onCancel={lock.cancelChange} />;
  return <Unlock title={msg('Unlock Monero Wallet')} />;
}

const st = StyleSheet.create({
  dots: { flexDirection: 'row', gap: 16, justifyContent: 'center', marginTop: 16 },
  dot: { width: 14, height: 14, borderRadius: 7, borderWidth: 1.5 },
  err: { fontFamily: F.m, fontSize: 13, textAlign: 'center', minHeight: 20, marginVertical: 8 },
  pad: { gap: 10, alignSelf: 'center', marginTop: 8 },
  padRow: { flexDirection: 'row', gap: 22 },
  key: { width: 74, height: 74, borderRadius: 37, alignItems: 'center', justifyContent: 'center' },
  keyText: { fontFamily: F.m, fontSize: 28 },
  mark: { width: 30, height: 30, borderRadius: 9, alignItems: 'center', justifyContent: 'center' },
  tag: { paddingHorizontal: 8, paddingVertical: 4, borderRadius: 6 },
  bigIcon: { width: 60, height: 60, borderRadius: 20, alignItems: 'center', justifyContent: 'center' },
  kicker: { fontFamily: F.b, fontSize: 12, letterSpacing: 1.6 },
});
