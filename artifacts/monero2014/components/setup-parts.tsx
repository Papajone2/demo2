import { Feather } from '@expo/vector-icons';
import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { KeyboardAwareScrollViewCompat } from '@/components/KeyboardAwareScrollViewCompat';
import { F, tap, useInsets } from '@/components/ui';
import { useLanguage } from '@/context/LanguageContext';
import { useColors } from '@/hooks/useColors';

/** Demo tokens only. Deliberately not words, so they can never be mistaken for a real recovery phrase. */
export const sampleTokens = (n: number) => Array.from({ length: n }, (_, i) => `preview-${String(i + 1).padStart(2, '0')}`);
export const DEMO_TOKENS = sampleTokens(16);
export const SURFACE = '#18181A';
export const SURFACE_HI = '#202023';

/** Page frame shared by every post-slide setup step: plain dark surface, back chevron, kicker, title, pinned footer. */
export function SetupPage({ testID, step, onBack, title, sub, children, footer, compact }: {
  testID: string; step: string; onBack?: () => void; title: React.ReactNode; sub?: string;
  children: React.ReactNode; footer?: React.ReactNode; compact?: boolean;
}) {
  const c = useColors();
  const ins = useInsets();
  const { t } = useLanguage();
  return (
    <View testID={testID} style={{ flex: 1, backgroundColor: '#0B0B0B' }}>
      <KeyboardAwareScrollViewCompat style={{ flex: 1 }} contentContainerStyle={{ flexGrow: 1, paddingTop: ins.top + 4, paddingBottom: 16, paddingHorizontal: 22 }} bottomOffset={110}>
        {onBack ? (
          <Pressable testID="setup-back" accessibilityRole="button" accessibilityLabel={t('Back')} onPress={() => { tap(); onBack(); }} hitSlop={12}
            style={({ pressed }) => [st.back, { opacity: pressed ? 0.5 : 1 }]}>
            <Feather name="chevron-left" size={26} color={c.inkForeground} />
          </Pressable>
        ) : <View style={{ height: 40 }} />}
        <Text testID="setup-progress" style={[st.step, { color: '#8E8E93', marginTop: compact ? 2 : 22 }]}>{step}</Text>
        <Text accessibilityRole="header" style={[compact ? st.titleSm : st.title, { color: c.inkForeground }]}>{title}</Text>
        {sub ? <Text style={[st.sub, { color: '#9A9AA0' }]}>{sub}</Text> : null}
        <View style={{ gap: compact ? 10 : 12, marginTop: compact ? 12 : 24, flexGrow: 1 }}>{children}</View>
      </KeyboardAwareScrollViewCompat>
      {footer ? <View style={{ paddingHorizontal: 22, paddingTop: 8, paddingBottom: ins.bottom + 14, gap: 8, backgroundColor: '#0B0B0B' }}>{footer}</View> : null}
    </View>
  );
}

/** Text is always centred: no conditional icon that would shift the label. */
export function PillBtn({ label, onPress, disabled, testID }: { label: string; onPress: () => void; disabled?: boolean; testID: string }) {
  const c = useColors();
  return (
    <Pressable testID={testID} accessibilityRole="button" accessibilityLabel={label} accessibilityState={{ disabled }} disabled={disabled} onPress={() => { tap(); onPress(); }}
      style={({ pressed }) => [st.pill, { backgroundColor: disabled ? '#2A2220' : c.primary, transform: [{ scale: pressed ? 0.98 : 1 }] }]}>
      <Text style={{ fontFamily: F.s, fontSize: 17, color: disabled ? '#7A6A62' : '#FFFFFF', textAlign: 'center' }}>{label}</Text>
    </Pressable>
  );
}

/** Flat tonal list surface (no outlines). */
export function Group({ children }: { children: React.ReactNode }) {
  return <View style={st.group}>{children}</View>;
}

export function Row({ icon, title, body, last }: { icon: keyof typeof Feather.glyphMap; title: string; body?: string; last?: boolean }) {
  const c = useColors();
  return (
    <View style={[st.row, !last && { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: '#2A2A2D' }]}>
      <View style={[st.rowIcon, { backgroundColor: 'rgba(255,101,0,0.12)' }]}>
        <Feather name={icon} size={18} color={c.primary} />
      </View>
      <View style={{ flex: 1, gap: 2 }}>
        <Text style={{ fontFamily: F.s, fontSize: 15.5, color: c.inkForeground }}>{title}</Text>
        {body ? <Text style={{ fontFamily: F.r, fontSize: 13.5, lineHeight: 19, color: '#9A9AA0' }}>{body}</Text> : null}
      </View>
    </View>
  );
}

export function Check({ checked, onToggle, label, testID, disabled }: { checked: boolean; onToggle: () => void; label: string; testID: string; disabled?: boolean }) {
  const c = useColors();
  return (
    <Pressable testID={testID} accessibilityRole="checkbox" accessibilityState={{ checked, disabled }} accessibilityLabel={label} disabled={disabled} onPress={() => { tap(); onToggle(); }}
      style={({ pressed }) => [st.check, { opacity: disabled ? 0.4 : pressed ? 0.75 : 1 }]}>
      <View style={[st.box, { borderColor: checked ? c.primary : '#56565B', backgroundColor: checked ? c.primary : 'transparent' }]}>
        {checked ? <Feather name="check" size={15} color="#FFFFFF" /> : null}
      </View>
      <Text style={{ flex: 1, fontFamily: F.m, fontSize: 14.5, lineHeight: 20, color: c.inkForeground }}>{label}</Text>
    </Pressable>
  );
}

/** The one quiet sample disclosure, shown directly by the placeholder grid. */
export function SampleTag({ text, right }: { text?: string; right?: React.ReactNode }) {
  const { t } = useLanguage();
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
      <View testID="seed-preview-label" style={{ flexDirection: 'row', alignItems: 'center', gap: 6, flexShrink: 1 }}>
        <Feather name="info" size={13} color="#8E8E93" />
        <Text style={{ fontFamily: F.m, fontSize: 12.5, color: '#8E8E93', flexShrink: 1 }}>{text ?? t('Sample — not a recovery phrase')}</Text>
      </View>
      {right}
    </View>
  );
}

export const st = StyleSheet.create({
  back: { width: 40, height: 40, marginLeft: -8, alignItems: 'center', justifyContent: 'center' },
  step: { fontFamily: F.s, fontSize: 12, letterSpacing: 1.8, textTransform: 'uppercase' },
  title: { fontFamily: F.b, fontSize: 34, letterSpacing: -1, lineHeight: 39, marginTop: 10 },
  titleSm: { fontFamily: F.b, fontSize: 26, letterSpacing: -0.7, lineHeight: 31, marginTop: 4 },
  sub: { fontFamily: F.r, fontSize: 15, lineHeight: 21, marginTop: 8 },
  pill: { height: 54, borderRadius: 27, alignItems: 'center', justifyContent: 'center' },
  group: { backgroundColor: SURFACE, borderRadius: 18, overflow: 'hidden' },
  row: { flexDirection: 'row', alignItems: 'center', gap: 14, paddingVertical: 14, paddingHorizontal: 16 },
  rowIcon: { width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center' },
  check: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 6 },
  box: { width: 22, height: 22, borderRadius: 6, borderWidth: 1.5, alignItems: 'center', justifyContent: 'center' },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, justifyContent: 'space-between' },
  cell: { width: '48.8%', flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 12, borderRadius: 11, backgroundColor: SURFACE },
  num: { fontFamily: F.s, fontSize: 12, width: 18, fontVariant: ['tabular-nums'] },
  token: { fontFamily: F.m, fontSize: 14.5, flex: 1 },
  err: { fontFamily: F.m, fontSize: 13.5, lineHeight: 19 },
});
