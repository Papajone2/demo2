import { Feather } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { router } from 'expo-router';
import React, { useEffect, useRef } from 'react';
import { ActivityIndicator, Animated, Platform, Pressable, StyleSheet, Text, TextInput, TextInputProps, View, ViewStyle } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { REQUIRED_CONFIRMATIONS, Tx, useWallet } from '@/context/WalletContext';
import { useLanguage } from '@/context/LanguageContext';
import { useColors } from '@/hooks/useColors';
import { currencySymbol, fiatCents, formatFiat, formatXmr } from '@/lib/money';
import { IS_NATIVE_ANDROID } from '@/lib/native-engine';

export const F = {
  r: 'Inter_400Regular',
  m: 'Inter_500Medium',
  s: 'Inter_600SemiBold',
  b: 'Inter_700Bold',
};

export function useInsets() {
  const i = useSafeAreaInsets();
  const web = Platform.OS === 'web';
  return { top: web ? 67 : i.top, bottom: web ? 34 : i.bottom };
}

export function tap(kind: 'light' | 'medium' | 'success' | 'error' = 'light') {
  if (Platform.OS === 'web') return;
  if (kind === 'success') Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
  else if (kind === 'error') Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error).catch(() => {});
  else Haptics.impactAsync(kind === 'medium' ? Haptics.ImpactFeedbackStyle.Medium : Haptics.ImpactFeedbackStyle.Light).catch(() => {});
}

export function TestBanner({ compact }: { compact?: boolean }) {
  const c = useColors();
  const { state } = useWallet();
  const { t } = useLanguage();
  return (
    <Pressable
      testID="test-banner"
      onPress={() => router.push(IS_NATIVE_ANDROID ? '/engine' : '/test')}
      style={({ pressed }) => [s.banner, { backgroundColor: c.warnBg, opacity: pressed ? 0.8 : 1 }, compact && { paddingVertical: 6 }]}
    >
      <View style={[s.bannerDot, { backgroundColor: c.warn }]} />
      <Text style={[s.bannerText, { color: c.warn }]}>{IS_NATIVE_ANDROID && state?.network === 'mainnet' ? 'Mainnet · experimental wallet' : t('Test wallet • No real XMR')}</Text>
      {!compact && <Text style={[s.bannerSub, { color: c.warn }]}>{IS_NATIVE_ANDROID ? state?.network === 'mainnet' ? 'REAL XMR' : 'STAGENET' : t('Sandbox')}</Text>}
    </Pressable>
  );
}

type BtnProps = {
  label: string;
  onPress: () => void;
  icon?: keyof typeof Feather.glyphMap;
  variant?: 'primary' | 'ink' | 'ghost' | 'danger' | 'soft';
  disabled?: boolean;
  loading?: boolean;
  style?: ViewStyle;
  testID?: string;
};
export function Btn({ label, onPress, icon, variant = 'primary', disabled, loading, style, testID }: BtnProps) {
  const c = useColors();
  const scale = useRef(new Animated.Value(1)).current;
  const bg = { primary: c.primary, ink: c.ink, ghost: 'transparent', danger: c.destructive, soft: c.secondary }[variant];
  const fg = { primary: c.primaryForeground, ink: c.inkForeground, ghost: c.foreground, danger: c.destructiveForeground, soft: c.secondaryForeground }[variant];
  const to = (v: number) => Animated.spring(scale, { toValue: v, useNativeDriver: Platform.OS !== 'web', speed: 40, bounciness: 6 }).start();
  return (
    <Animated.View style={[{ transform: [{ scale }] }, style]}>
      <Pressable
        testID={testID}
        disabled={disabled || loading}
        onPressIn={() => to(0.96)}
        onPressOut={() => to(1)}
        onPress={() => {
          tap();
          onPress();
        }}
        style={[s.btn, { backgroundColor: bg, opacity: disabled ? 0.45 : 1 }, variant === 'ghost' && { borderWidth: 1, borderColor: c.border }]}
      >
        {loading ? <ActivityIndicator color={fg} /> : icon ? <Feather name={icon} size={18} color={fg} /> : null}
        <Text style={[s.btnText, { color: fg }]}>{label}</Text>
      </Pressable>
    </Animated.View>
  );
}

export function Card({ children, style }: { children: React.ReactNode; style?: ViewStyle }) {
  const c = useColors();
  return <View style={[s.card, { backgroundColor: c.charcoal, borderColor: 'transparent' }, style]}>{children}</View>;
}

export function SectionLabel({ children }: { children: string }) {
  const c = useColors();
  return <Text style={[s.section, { color: c.mutedForeground }]}>{children.toUpperCase()}</Text>;
}

export function Field(props: TextInputProps & { label: string; error?: string | null; hint?: string; mono?: boolean }) {
  const c = useColors();
  const { label, error, hint, mono, style, ...rest } = props;
  return (
    <View style={{ gap: 6 }}>
      <Text style={[s.fieldLabel, { color: c.mutedForeground }]}>{label}</Text>
      <TextInput
        placeholderTextColor={c.mutedForeground}
        {...rest}
        style={[
          s.input,
          { backgroundColor: c.charcoal, borderColor: error ? c.destructive : 'transparent', color: c.foreground, fontFamily: mono ? Platform.select({ ios: 'Menlo', default: 'monospace' }) : F.m },
          style,
        ]}
      />
      {error ? <Text style={[s.hint, { color: c.destructive }]}>{error}</Text> : hint ? <Text style={[s.hint, { color: c.mutedForeground }]}>{hint}</Text> : null}
    </View>
  );
}

export function Skeleton({ h, w = '100%', r = 12 }: { h: number; w?: number | `${number}%`; r?: number }) {
  const c = useColors();
  const o = useRef(new Animated.Value(0.5)).current;
  useEffect(() => {
    const a = Animated.loop(
      Animated.sequence([
        Animated.timing(o, { toValue: 1, duration: 700, useNativeDriver: Platform.OS !== 'web' }),
        Animated.timing(o, { toValue: 0.5, duration: 700, useNativeDriver: Platform.OS !== 'web' }),
      ]),
    );
    a.start();
    return () => a.stop();
  }, [o]);
  return <Animated.View style={{ height: h, width: w, borderRadius: r, backgroundColor: c.muted, opacity: o }} />;
}

/** Renders loading skeleton or error+retry for wallet-backed screens; returns null when ready. */
export function WalletGate({ children }: { children: React.ReactNode }) {
  const c = useColors();
  const { loading, error, reload, resetSandbox, state, wallets } = useWallet();
  const { t } = useLanguage();
  const ins = useInsets();
  if (loading)
    return (
      <View style={{ flex: 1, backgroundColor: c.background, padding: 20, paddingTop: ins.top + 20, gap: 14 }}>
        <Skeleton h={28} w="40%" />
        <Skeleton h={180} r={24} />
        <Skeleton h={56} />
        <Skeleton h={56} />
      </View>
    );
  if (!error && wallets.length === 0)
    return (
      <View style={{ flex: 1, backgroundColor: c.background, padding: 24, paddingTop: ins.top + 24, justifyContent: 'center', gap: 14 }}>
        <View style={{ width: 64, height: 64, borderRadius: 22, backgroundColor: c.emberSoft, alignItems: 'center', justifyContent: 'center' }}>
          <Feather name="plus" size={28} color={c.primary} />
        </View>
        <Text style={[s.h2, { color: c.foreground }]}>{t('No wallet on this device')}</Text>
        <Text style={[s.body, { color: c.mutedForeground }]}>{t('Every local test account was deleted. Create a new one to keep testing.')}</Text>
        <Btn testID="empty-create-wallet" label={t('Create wallet')} icon="plus" onPress={() => router.push('/accounts')} />
      </View>
    );
  if (error || !state)
    return (
      <View style={{ flex: 1, backgroundColor: c.background, padding: 24, justifyContent: 'center', gap: 14 }}>
        <Feather name="alert-octagon" size={32} color={c.destructive} />
        <Text style={[s.h2, { color: c.foreground }]}>{t('Local storage problem')}</Text>
        <Text style={[s.body, { color: c.mutedForeground }]}>{t(error ?? 'Wallet data is unavailable.')}</Text>
        <Btn label={t('Try again')} icon="refresh-cw" onPress={reload} />
        <Btn label={t('Reset sandbox data')} variant="ghost" onPress={() => resetSandbox().catch(() => {})} />
      </View>
    );
  return <>{children}</>;
}

export function TxRow({ tx, onPress }: { tx: Tx; onPress?: () => void }) {
  const c = useColors();
  const { state } = useWallet();
  const { t } = useLanguage();
  const pending = tx.confirmations < REQUIRED_CONFIRMATIONS;
  const isIn = tx.kind === 'in';
  const amt = BigInt(tx.amount) + (isIn ? BigInt(0) : BigInt(tx.fee));
  const rate = state?.rateCents ? BigInt(state.rateCents) : null;
  const hide = state?.hideBalance;
  return (
    <Pressable
      testID={`tx-${tx.id}`}
      onPress={() => {
        tap();
        if (onPress) onPress();
        else router.push({ pathname: '/tx/[id]', params: { id: tx.id } });
      }}
      style={({ pressed }) => [s.txRow, { backgroundColor: c.card, opacity: pressed ? 0.75 : 1 }]}
    >
      <View style={[s.txIcon, { backgroundColor: c.accent }]}>
        <Feather name={isIn ? 'arrow-down' : 'arrow-up'} size={19} color={c.primary} />
      </View>
      <View style={{ flex: 1, gap: 2 }}>
        <Text numberOfLines={1} style={[s.txTitle, { color: c.foreground }]}>
          {isIn ? t('Received XMR') : t('Sent XMR')}
        </Text>
        <Text style={[s.txSub, { color: c.mutedForeground }]}>
          {pending ? t('Pending {a}/{b}', { a: tx.confirmations, b: REQUIRED_CONFIRMATIONS }) : t('Confirmed')} · {new Date(tx.createdAt).toLocaleDateString()}
        </Text>
      </View>
      <View style={{ alignItems: 'flex-end', gap: 2 }}>
        <Text style={[s.txAmt, { color: isIn ? c.success : c.loss }]}>
          {hide ? '••••' : `${isIn ? '+' : '-'}${formatXmr(amt, 4)}`}
        </Text>
        {rate && !hide ? (
          <Text style={[s.txSub, { color: c.mutedForeground }]}>{formatFiat(fiatCents(amt, rate), currencySymbol(state!.currency))}</Text>
        ) : null}
      </View>
    </Pressable>
  );
}

export function EmptyState({ icon, title, body }: { icon: keyof typeof Feather.glyphMap; title: string; body: string }) {
  const c = useColors();
  return (
    <View style={{ alignItems: 'center', padding: 32, gap: 10 }}>
      <View style={[s.txIcon, { width: 56, height: 56, borderRadius: 28, backgroundColor: c.muted }]}>
        <Feather name={icon} size={24} color={c.mutedForeground} />
      </View>
      <Text style={[s.txTitle, { color: c.foreground }]}>{title}</Text>
      <Text style={[s.body, { color: c.mutedForeground, textAlign: 'center' }]}>{body}</Text>
    </View>
  );
}

export const s = StyleSheet.create({
  banner: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 14, paddingVertical: 9, borderRadius: 999, alignSelf: 'stretch' },
  bannerDot: { width: 7, height: 7, borderRadius: 4 },
  bannerText: { fontFamily: F.b, fontSize: 13, letterSpacing: 0.2, flex: 1 },
  bannerSub: { fontFamily: F.s, fontSize: 11, letterSpacing: 1, textTransform: 'uppercase' },
  btn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, height: 54, borderRadius: 16, paddingHorizontal: 18 },
  btnText: { fontFamily: F.s, fontSize: 16 },
  card: { borderRadius: 20, borderWidth: 1, padding: 16 },
  section: { fontFamily: F.s, fontSize: 11, letterSpacing: 1.4, marginTop: 8 },
  fieldLabel: { fontFamily: F.s, fontSize: 12, letterSpacing: 0.4 },
  input: { borderWidth: 1, borderRadius: 14, paddingHorizontal: 14, paddingVertical: 14, fontSize: 16 },
  hint: { fontFamily: F.r, fontSize: 12.5, lineHeight: 17 },
  h1: { fontFamily: F.b, fontSize: 30, letterSpacing: -0.8 },
  h2: { fontFamily: F.b, fontSize: 22, letterSpacing: -0.4 },
  body: { fontFamily: F.r, fontSize: 15, lineHeight: 22 },
  txRow: { flexDirection: 'row', alignItems: 'center', gap: 14, paddingVertical: 14, paddingHorizontal: 14, borderRadius: 20, marginBottom: 8, minHeight: 68 },
  txIcon: { width: 46, height: 46, borderRadius: 23, alignItems: 'center', justifyContent: 'center' },
  txTitle: { fontFamily: F.s, fontSize: 15 },
  txSub: { fontFamily: F.r, fontSize: 12.5 },
  txAmt: { fontFamily: F.s, fontSize: 15, fontVariant: ['tabular-nums'] },
});
