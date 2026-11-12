import { Feather } from '@expo/vector-icons';
import React, { useEffect, useRef, useState } from 'react';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { Btn, F, tap, useInsets } from '@/components/ui';
import { useLock } from '@/context/LockContext';
import { useLanguage } from '@/context/LanguageContext';
import { useColors } from '@/hooks/useColors';

/** Phantom-style grouped charcoal list container. */
export function Group({ children }: { children: React.ReactNode }) {
  const c = useColors();
  const kids = React.Children.toArray(children).filter(Boolean);
  return (
    <View style={[st.group, { backgroundColor: c.charcoal }]}>
      {kids.map((k, i) => (
        <View key={i}>
          {i > 0 ? <View style={[st.sep, { backgroundColor: c.background }]} /> : null}
          {k}
        </View>
      ))}
    </View>
  );
}

export function GRow({ icon, left, title, value, onPress, external, tone, testID, sub }: {
  icon?: keyof typeof Feather.glyphMap; left?: React.ReactNode; title: string; value?: string; sub?: string;
  onPress?: () => void; external?: boolean; tone?: 'accent' | 'danger'; testID?: string;
}) {
  const c = useColors();
  const col = tone === 'danger' ? c.destructive : tone === 'accent' ? c.primary : c.foreground;
  return (
    <Pressable testID={testID} disabled={!onPress} onPress={() => { tap(); onPress?.(); }} style={({ pressed }) => [st.row, pressed && { backgroundColor: c.secondary }]}>
      {left ?? (icon ? <Feather name={icon} size={17} color={col} /> : null)}
      <View style={{ flex: 1 }}>
        <Text numberOfLines={1} style={{ fontFamily: F.m, fontSize: 16, color: col }}>{title}</Text>
        {sub ? <Text numberOfLines={2} style={{ fontFamily: F.r, fontSize: 12.5, color: c.mutedForeground, marginTop: 2 }}>{sub}</Text> : null}
      </View>
      {value ? <Text numberOfLines={1} style={{ fontFamily: F.r, fontSize: 15, color: c.mutedForeground, maxWidth: '45%' }}>{value}</Text> : null}
      {onPress ? <Feather name={external ? 'external-link' : 'chevron-right'} size={18} color={c.mutedForeground} /> : null}
    </Pressable>
  );
}

export function TopBar({ title, onBack, icon = 'arrow-left', align = 'center', testID = 'topbar-back' }: { title: string; onBack: () => void; icon?: keyof typeof Feather.glyphMap; align?: 'center' | 'left'; testID?: string }) {
  const c = useColors();
  const ins = useInsets();
  const { t } = useLanguage();
  return (
    <View style={[st.bar, { paddingTop: ins.top + 6 }]}>
      {align === 'left' ? (
        <>
          <Text style={{ fontFamily: F.b, fontSize: 24, color: c.foreground, flex: 1 }}>{title}</Text>
          <Pressable testID={testID} accessibilityLabel={t('Close')} hitSlop={10} onPress={onBack} style={st.barBtn}><Feather name={icon} size={22} color={c.foreground} /></Pressable>
        </>
      ) : (
        <>
          <Pressable testID={testID} accessibilityLabel={t('Back')} hitSlop={10} onPress={onBack} style={st.barBtn}><Feather name={icon} size={22} color={c.foreground} /></Pressable>
          <Text numberOfLines={1} style={{ fontFamily: F.s, fontSize: 17, color: c.foreground, flex: 1, textAlign: 'center' }}>{title}</Text>
          <View style={st.barBtn} />
        </>
      )}
    </View>
  );
}

export function Notice({ icon = 'alert-triangle', title, body, tone = 'warn' }: { icon?: keyof typeof Feather.glyphMap; title: string; body: string; tone?: 'warn' | 'danger' | 'info' }) {
  const c = useColors();
  const col = tone === 'danger' ? c.destructive : tone === 'info' ? c.mutedForeground : c.warn;
  return (
    <View style={[st.notice, { backgroundColor: tone === 'danger' ? 'rgba(255,51,85,0.1)' : c.charcoal }]}>
      <Feather name={icon} size={20} color={col} />
      <View style={{ flex: 1, gap: 4 }}>
        <Text style={{ fontFamily: F.s, fontSize: 15.5, color: c.foreground }}>{title}</Text>
        <Text style={{ fontFamily: F.r, fontSize: 14, lineHeight: 20, color: c.mutedForeground }}>{body}</Text>
      </View>
    </View>
  );
}

export function Check({ value, onChange, label, testID }: { value: boolean; onChange: (v: boolean) => void; label: string; testID?: string }) {
  const c = useColors();
  return (
    <Pressable testID={testID} accessibilityRole="checkbox" accessibilityState={{ checked: value }} onPress={() => { tap(); onChange(!value); }} style={st.check}>
      <View style={[st.box, { borderColor: value ? c.primary : c.input, backgroundColor: value ? c.primary : 'transparent' }]}>
        {value ? <Feather name="check" size={14} color={c.primaryForeground} /> : null}
      </View>
      <Text style={{ fontFamily: F.m, fontSize: 14.5, color: c.foreground, flex: 1, lineHeight: 20 }}>{label}</Text>
    </Pressable>
  );
}

/**
 * Re-enter PIN/password. `run(secret)` performs the protected action and
 * returns an error message (string) on failure. Secret state is cleared on unmount.
 */
export function SecretPrompt({ title, onSubmit, onCancel, cta }: { title: string; onSubmit: (secret: string) => Promise<string | null>; onCancel: () => void; cta?: string }) {
  const c = useColors();
  const { method, pinLength } = useLock();
  const { t } = useLanguage();
  const [pin, setPin] = useState('');
  const [pw, setPw] = useState('');
  const [msg, setMsg] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const inflight = useRef(false);
  const alive = useRef(true);
  useEffect(() => { alive.current = true; return () => { alive.current = false; }; }, []);

  const go = async (secret: string) => {
    if (inflight.current || !secret) return;
    inflight.current = true;
    setBusy(true);
    setMsg(null);
    let err: string | null;
    try { err = await onSubmit(secret); } catch (e) { err = e instanceof Error ? t(e.message) : t('Could not verify.'); }
    inflight.current = false;
    if (!alive.current) return;
    setBusy(false);
    setPin('');
    setPw('');
    if (err) { tap('error'); setMsg(t(err)); }
  };
  const press = (d: string) => {
    if (busy || pin.length >= pinLength) return;
    const v = pin + d;
    setPin(v);
    setMsg(null);
    if (v.length === pinLength) go(v);
  };

  return (
    <View style={{ gap: 14, alignItems: 'center' }}>
      <View style={[st.lockIc, { backgroundColor: c.emberSoft }]}><Feather name="lock" size={24} color={c.primary} /></View>
      <Text style={{ fontFamily: F.s, fontSize: 19, color: c.foreground, textAlign: 'center' }}>{title}</Text>
      {method === 'password' ? (
        <View style={{ alignSelf: 'stretch', gap: 12 }}>
          <TextInput testID="secret-password" value={pw} onChangeText={setPw} secureTextEntry autoCapitalize="none" autoCorrect={false} placeholder={t('Password')} placeholderTextColor={c.mutedForeground} returnKeyType="go" onSubmitEditing={() => go(pw)} editable={!busy}
            style={[st.input, { backgroundColor: c.charcoal, color: c.foreground, borderColor: c.border }]} />
          <Text style={{ fontFamily: F.m, fontSize: 13, color: c.destructive, minHeight: 18 }}>{busy ? t('Checking…') : msg ?? ' '}</Text>
          <Btn testID="secret-submit" label={cta ?? t('Confirm')} loading={busy} disabled={!pw || busy} onPress={() => go(pw)} />
        </View>
      ) : (
        <>
          <View style={{ flexDirection: 'row', gap: 14 }}>
            {Array.from({ length: pinLength }).map((_, i) => (
              <View key={i} style={[st.dot, { borderColor: c.mutedForeground, backgroundColor: i < pin.length ? c.primary : 'transparent' }]} />
            ))}
          </View>
          <Text style={{ fontFamily: F.m, fontSize: 13, color: c.destructive, minHeight: 18, textAlign: 'center' }}>{busy ? t('Checking…') : msg ?? ' '}</Text>
          <View style={{ gap: 8 }}>
            {[['1', '2', '3'], ['4', '5', '6'], ['7', '8', '9'], ['', '0', '<']].map((r) => (
              <View key={r.join()} style={{ flexDirection: 'row', gap: 18 }}>
                {r.map((d) => d === '' ? <View key="e" style={st.key} /> : (
                  <Pressable key={d} testID={`secret-pin-${d === '<' ? 'back' : d}`} disabled={busy} onPress={() => { tap(); if (d === '<') setPin(pin.slice(0, -1)); else press(d); }}
                    style={({ pressed }) => [st.key, { backgroundColor: pressed ? c.secondary : c.charcoal, opacity: busy ? 0.4 : 1 }]}>
                    {d === '<' ? <Feather name="delete" size={22} color={c.foreground} /> : <Text style={{ fontFamily: F.m, fontSize: 26, color: c.foreground }}>{d}</Text>}
                  </Pressable>
                ))}
              </View>
            ))}
          </View>
        </>
      )}
      <Pressable testID="secret-cancel" onPress={onCancel} style={{ padding: 10 }} disabled={busy}>
        <Text style={{ fontFamily: F.m, color: c.mutedForeground }}>{t('Cancel')}</Text>
      </Pressable>
    </View>
  );
}

const st = StyleSheet.create({
  group: { borderRadius: 20, overflow: 'hidden' },
  sep: { height: 1.5 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 14, paddingHorizontal: 18, minHeight: 54, paddingVertical: 10 },
  bar: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingBottom: 12, gap: 8 },
  barBtn: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
  notice: { flexDirection: 'row', gap: 12, padding: 16, borderRadius: 18 },
  check: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 6 },
  box: { width: 22, height: 22, borderRadius: 7, borderWidth: 2, alignItems: 'center', justifyContent: 'center' },
  lockIc: { width: 56, height: 56, borderRadius: 18, alignItems: 'center', justifyContent: 'center' },
  dot: { width: 14, height: 14, borderRadius: 7, borderWidth: 1.5 },
  key: { width: 70, height: 70, borderRadius: 35, alignItems: 'center', justifyContent: 'center' },
  input: { minHeight: 52, borderRadius: 14, borderWidth: 1, paddingHorizontal: 16, fontFamily: F.m, fontSize: 16 },
});
