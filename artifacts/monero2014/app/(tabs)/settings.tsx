import { Feather } from '@expo/vector-icons';
import { router } from 'expo-router';
import * as WebBrowser from 'expo-web-browser';
import React, { useState } from 'react';
import { Pressable, StyleSheet, Switch, Text, TextInput, View } from 'react-native';
import { KeyboardAwareScrollViewCompat } from '@/components/KeyboardAwareScrollViewCompat';
import { GRow, Group, Notice, TopBar } from '@/components/account-ui';
import { LanguageList } from '@/components/language-picker';
import { SITE } from '@/components/LockGate';
import { Btn, F, tap, useInsets, WalletGate } from '@/components/ui';
import { WalletAvatar } from '@/components/wallet-avatar';
import { useLanguage } from '@/context/LanguageContext';
import { useLock } from '@/context/LockContext';
import { useWallet } from '@/context/WalletContext';
import { useColors } from '@/hooks/useColors';
import { resetTutorial } from '@/lib/tutorial';
import { centsToString, CURRENCIES, parseRateCents } from '@/lib/money';

type Panel = 'main' | 'prefs' | 'security' | 'tor' | 'language';
const open = (url: string) => WebBrowser.openBrowserAsync(url).catch(() => {});
const leave = () => (router.canGoBack() ? router.back() : router.replace('/'));

function Scroll({ children }: { children: React.ReactNode }) {
  const c = useColors();
  const ins = useInsets();
  return (
    <KeyboardAwareScrollViewCompat style={{ flex: 1, backgroundColor: c.background }} contentContainerStyle={{ padding: 16, paddingBottom: ins.bottom + 28, gap: 16 }} bottomOffset={24} keyboardShouldPersistTaps="handled">
      {children}
    </KeyboardAwareScrollViewCompat>
  );
}

function Caption({ children }: { children: string }) {
  const c = useColors();
  return <Text style={[st.cap, { color: c.mutedForeground }]}>{children}</Text>;
}

function Prefs() {
  const c = useColors();
  const { t } = useLanguage();
  const { state, updatePrefs } = useWallet();
  const [rate, setRate] = useState(state?.rateCents ? centsToString(BigInt(state.rateCents)) : '');
  const [err, setErr] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  if (!state) return null;
  const save = async () => {
    setErr(null);
    let r: string | null = null;
    if (rate.trim()) {
      const p = parseRateCents(rate);
      if (p === null) return setErr(t('Rate must be a number with up to 2 decimals, e.g. 162.40'));
      r = p.toString();
    }
    try { await updatePrefs({ rateCents: r }); tap('success'); setSaved(true); setTimeout(() => setSaved(false), 1600); }
    catch { setErr(t('Could not save to local storage.')); }
  };
  return (
    <Scroll>
      <Caption>{t('Display currency')}</Caption>
      <Group>
        {CURRENCIES.map((x) => {
          const on = x.code === state.currency;
          return (
            <Pressable key={x.code} testID={`cur-${x.code}`} accessibilityRole="radio" accessibilityState={{ selected: on }}
              onPress={() => { tap(); updatePrefs({ currency: x.code }).catch(() => setErr(t('Could not save.'))); }}
              style={({ pressed }) => [st.row, pressed && { backgroundColor: c.secondary }]}>
              <Text style={{ flex: 1, fontFamily: on ? F.s : F.m, fontSize: 16, color: c.foreground }}>{x.code}</Text>
              {on ? <Feather name="check" size={18} color={c.foreground} /> : null}
            </Pressable>
          );
        })}
      </Group>
      <Group>
        <View style={st.row}>
          <Text style={{ fontFamily: F.m, fontSize: 16, color: c.foreground, flex: 1 }}>{t('Hide balances')}</Text>
          <Switch testID="hide-switch" value={state.hideBalance} onValueChange={(v) => updatePrefs({ hideBalance: v }).catch(() => setErr(t('Could not save.')))} trackColor={{ true: c.mutedForeground, false: c.input }} thumbColor={c.foreground} />
        </View>
      </Group>
      <Caption>{t('Test reference rate per XMR')}</Caption>
      <Group>
        <View style={[st.row, { paddingVertical: 4 }]}>
          <TextInput testID="rate-input" value={rate} onChangeText={setRate} keyboardType="decimal-pad" placeholder={t('Leave empty to hide fiat')} placeholderTextColor={c.mutedForeground}
            style={{ flex: 1, fontFamily: F.m, fontSize: 16, color: c.foreground, paddingVertical: 10 }} />
          <Text style={{ fontFamily: F.m, fontSize: 14, color: c.mutedForeground }}>{state.currency}</Text>
        </View>
      </Group>
      <Text style={{ fontFamily: F.r, fontSize: 12.5, lineHeight: 17, color: c.mutedForeground, marginTop: -8 }}>{t('Used by test screens. You choose this number; it is never a live price.')}</Text>
      {err ? <Text style={{ fontFamily: F.m, color: c.destructive }}>{err}</Text> : null}
      <Btn testID="save-settings" variant="soft" label={saved ? t('Saved') : t('Save')} icon={saved ? 'check' : undefined} onPress={save} />
    </Scroll>
  );
}

function Security({ onTor }: { onTor: () => void }) {
  const lock = useLock();
  const { t } = useLanguage();
  return (
    <Scroll>
      <Group>
        <GRow icon="lock" title={lock.method === 'password' ? t('Unlock with password') : t('Unlock with {n}-digit PIN', { n: lock.pinLength })} sub={t('Locks when the app goes to background.')} />
        <GRow testID="change-secret" icon="refresh-cw" title={t('Change PIN or password')} onPress={lock.startChange} />
        <GRow testID="security-tor" icon="eye-off" title={t('Tor')} value={t('Unavailable')} onPress={onTor} />
      </Group>
      <Notice tone="info" icon="info" title={t('What the lock protects')} body={t('The app lock gates this preview and re-confirms deletes and secret screens. It does not encrypt wallet data, and a forgotten secret cannot be recovered.')} />
      <Group>
        <GRow icon="key" title={t('16-word Polyseed backup')} sub={t('Requires native engine — not generated')} onPress={() => router.push('/engine')} />
        <GRow icon="cpu" title={t('Native Monero engine')} sub={t('Unavailable in this build')} onPress={() => router.push('/engine')} />
      </Group>
    </Scroll>
  );
}

function Tor() {
  const c = useColors();
  const { t } = useLanguage();
  return (
    <Scroll>
      <Group>
        <View style={st.row}>
          <View style={{ flex: 1 }}>
            <Text style={{ fontFamily: F.m, fontSize: 16, color: c.foreground }}>{t('Route through Tor')}</Text>
            <Text style={{ fontFamily: F.r, fontSize: 12.5, color: c.mutedForeground, marginTop: 2 }}>{t('Off · unavailable in this preview')}</Text>
          </View>
          <Switch testID="tor-switch" value={false} disabled accessibilityLabel={t('Tor routing, off. Unavailable: this preview has no native Tor support.')} trackColor={{ true: c.mutedForeground, false: c.input }} thumbColor={c.mutedForeground} />
        </View>
      </Group>
      <Text testID="tor-explainer" style={{ fontFamily: F.r, fontSize: 14, lineHeight: 21, color: c.mutedForeground }}>
        {t('Tor can hide your network address. Onion-only wallet connections may synchronize more slowly. Native Tor routing is not available in this preview; traffic is not routed through Tor.')}
      </Text>
    </Scroll>
  );
}

function Language() {
  return <Scroll><LanguageList /></Scroll>;
}

const TITLES: Record<Panel, string> = { main: 'Settings', prefs: 'Preferences', security: 'Security & Privacy', tor: 'Tor', language: 'Language' };

function Settings() {
  const c = useColors();
  const ins = useInsets();
  const { t, languageName } = useLanguage();
  const { state } = useWallet();
  const lock = useLock();
  const [panel, setPanel] = useState<Panel>('main');
  const [q, setQ] = useState('');
  const [tourError, setTourError] = useState<string | null>(null);
  if (!state) return null;

  if (panel !== 'main') {
    return (
      <View style={{ flex: 1, backgroundColor: c.background }}>
        <TopBar title={t(TITLES[panel])} onBack={() => setPanel('main')} />
        {panel === 'prefs' ? <Prefs /> : panel === 'security' ? <Security onTor={() => setPanel('tor')} /> : panel === 'language' ? <Language /> : <Tor />}
      </View>
    );
  }

  type R = { key: string; icon: keyof typeof Feather.glyphMap; title: string; value?: string; external?: boolean; go: () => void };
  const groups: { key: string; label?: string; rows: R[] }[] = [
    { key: 'general', label: t('General'), rows: [
      { key: 'language', icon: 'globe', title: t('Language'), value: languageName, go: () => setPanel('language') },
      { key: 'prefs', icon: 'sliders', title: t('Preferences'), value: state.currency, go: () => setPanel('prefs') },
    ] },
    { key: 'wallet', rows: [
      { key: 'security', icon: 'shield', title: t('Security & Privacy'), go: () => setPanel('security') },
      { key: 'tor', icon: 'eye-off', title: t('Tor'), value: t('Unavailable'), go: () => setPanel('tor') },
    ] },
    { key: 'help', rows: [
      { key: 'tutorial', icon: 'play-circle', title: t('Replay wallet tour'), go: async () => {
        setTourError(null);
        try { await resetTutorial(state.id); router.replace('/'); }
        catch { setTourError(t('Could not restart the tour. Please try again.')); }
      } },
      { key: 'help', icon: 'help-circle', title: t('Help & Support'), external: true, go: () => open(SITE) },
      { key: 'about', icon: 'info', title: t('About monero2014'), external: true, go: () => open(`${SITE}/about`) },
    ] },
  ];
  const needle = q.trim().toLowerCase();
  const shown = groups.map((g) => ({ ...g, rows: g.rows.filter((r) => !needle || r.title.toLowerCase().includes(needle)) })).filter((g) => g.rows.length);
  const showProfile = !needle || state.name.toLowerCase().includes(needle);

  return (
    <View style={{ flex: 1, backgroundColor: c.background }}>
      <TopBar title={t('Settings')} icon="x" testID="back" onBack={leave} />
      <View style={st.searchWrap}>
        <View style={[st.search, { backgroundColor: c.charcoal, borderColor: 'transparent' }]}>
          <Feather name="search" size={18} color={c.mutedForeground} />
          <TextInput testID="settings-search" value={q} onChangeText={setQ} placeholder={t('Search...')} placeholderTextColor={c.mutedForeground} style={{ flex: 1, fontFamily: F.r, fontSize: 16, color: c.foreground, paddingVertical: 10 }} />
          {q ? <Pressable onPress={() => setQ('')} hitSlop={8}><Feather name="x-circle" size={17} color={c.mutedForeground} /></Pressable> : null}
        </View>
      </View>
      <KeyboardAwareScrollViewCompat style={{ flex: 1 }} contentContainerStyle={{ padding: 16, gap: 16 }} bottomOffset={24} keyboardShouldPersistTaps="handled">
        {tourError ? <Text accessibilityRole="alert" style={{ fontFamily: F.m, color: c.destructive }}>{tourError}</Text> : null}
        {showProfile ? (
          <Group>
            <GRow testID="settings-profile" left={<WalletAvatar id={state.iconId} size={40} />} title={state.name} onPress={() => router.push('/accounts')} />
          </Group>
        ) : null}
        {shown.map((g) => (
          <View key={g.key} style={{ gap: 8 }}>
            {g.label ? <Text style={[st.cap, { color: c.mutedForeground, paddingHorizontal: 4 }]}>{g.label}</Text> : null}
            <Group>
              {g.rows.map((r) => <GRow key={r.key} testID={`settings-${r.key}`} icon={r.icon} title={r.title} value={r.value} external={r.external} onPress={r.go} />)}
            </Group>
          </View>
        ))}
        {!shown.length && !showProfile ? <Text style={{ fontFamily: F.m, color: c.mutedForeground, textAlign: 'center', marginTop: 32 }}>{t('No settings match “{q}”', { q })}</Text> : null}
      </KeyboardAwareScrollViewCompat>
      <View style={{ padding: 16, paddingBottom: ins.bottom + 14 }}>
        <Pressable testID="lock-wallet" onPress={() => { tap(); lock.lock(); }} style={({ pressed }) => [st.lockBtn, { backgroundColor: pressed ? c.secondary : c.charcoal }]}>
          <Text style={{ fontFamily: F.b, fontSize: 16, color: c.foreground }}>{t('Lock Wallet')}</Text>
        </Pressable>
      </View>
    </View>
  );
}

export default function SettingsScreen() {
  return (
    <WalletGate>
      <Settings />
    </WalletGate>
  );
}

const st = StyleSheet.create({
  cap: { fontFamily: F.s, fontSize: 13 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 14, paddingHorizontal: 18, minHeight: 54 },
  searchWrap: { paddingHorizontal: 16, paddingTop: 4, paddingBottom: 4 },
  search: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 14, borderRadius: 14, borderWidth: 1 },
  lockBtn: { minHeight: 52, borderRadius: 18, alignItems: 'center', justifyContent: 'center' },
});
