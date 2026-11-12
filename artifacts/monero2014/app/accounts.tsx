import { Feather, MaterialCommunityIcons } from '@expo/vector-icons';
import { router } from 'expo-router';
import React, { useEffect, useRef, useState } from 'react';
import { Animated, Dimensions, Platform, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { CustomizeFlow, EditAccount } from '@/components/account-flows';
import { SecretPrompt, TopBar } from '@/components/account-ui';
import { Onboarding } from '@/components/welcome-flow';
import { WalletSetup } from '@/components/wallet-setup';
import { Btn, F, tap, useInsets } from '@/components/ui';
import { WalletAvatar } from '@/components/wallet-avatar';
import { useWallet } from '@/context/WalletContext';
import { useLanguage } from '@/context/LanguageContext';
import { useColors } from '@/hooks/useColors';

const close = () => (router.canGoBack() ? router.back() : router.replace('/'));

export default function AccountsScreen() {
  const c = useColors();
  const ins = useInsets();
  const { wallets, selectedId, selectWallet, nextWalletNumber } = useWallet();
  const { t } = useLanguage();
  const [mode, setMode] = useState<{ k: 'list' } | { k: 'edit'; id: string } | { k: 'create' }>({ k: 'list' });
  const [err, setErr] = useState<string | null>(null);
  const busy = useRef(false);
  const drop = useRef(new Animated.Value(-Dimensions.get('window').height)).current;
  useEffect(() => {
    Animated.spring(drop, { toValue: 0, useNativeDriver: Platform.OS !== 'web', speed: 14, bounciness: 3 }).start();
  }, [drop]);

  const [auth, setAuth] = useState<{ id: string; then: '/' | '/receive' } | null>(null);
  const abort = useRef<AbortController | null>(null);
  useEffect(() => () => abort.current?.abort(), []);

  const go = (then: '/' | '/receive') => { if (then === '/') close(); else router.replace('/receive'); };
  const pick = (id: string, then: '/' | '/receive') => {
    if (busy.current) return;
    setErr(null);
    tap();
    if (id === selectedId) return go(then); // same wallet: nothing changes, no prompt
    abort.current?.abort();
    abort.current = new AbortController();
    setAuth({ id, then });
  };
  const cancelAuth = () => { abort.current?.abort(); abort.current = null; setAuth(null); };

  let inner: React.ReactNode = null;
  if (auth) {
    const target = wallets.find((x) => x.id === auth.id);
    inner = (
      <View style={{ flex: 1 }}>
        <TopBar title={t('Switch account')} onBack={cancelAuth} testID="switch-cancel-top" />
        <View style={{ flex: 1, justifyContent: 'center', padding: 20, paddingBottom: ins.bottom + 20 }}>
          <SecretPrompt title={t('Enter your PIN or password to open {name}', { name: target?.name ?? '' })} cta={t('Switch')} onCancel={cancelAuth}
            onSubmit={async (secret) => {
              busy.current = true;
              try { await selectWallet(auth.id, secret, abort.current?.signal); }
              catch (e) { return e instanceof Error ? t(e.message) : t('Could not switch account.'); }
              finally { busy.current = false; }
              tap('success');
              const then = auth.then;
              setAuth(null);
              go(then);
              return null;
            }} />
        </View>
      </View>
    );
  }
  if (mode.k === 'create') {
    inner = <NewWalletFlow defaultName={`Wallet ${nextWalletNumber}`} onCancel={() => setMode({ k: 'list' })} onDone={() => router.replace('/')} />;
  }
  if (mode.k === 'edit') {
    const w = wallets.find((x) => x.id === mode.id);
    if (w) inner = <EditAccount key={w.id} wallet={w} onBack={() => setMode({ k: 'list' })} onDeleted={() => (wallets.length <= 1 ? router.replace('/') : setMode({ k: 'list' }))} />;
  }

  return (
    <Animated.View style={{ flex: 1, backgroundColor: c.background, transform: [{ translateY: drop }] }}>
      {inner ?? (<View style={{ flex: 1 }}>
      <TopBar title={t('Accounts')} align="left" icon="x" testID="accounts-close" onBack={close} />
      <ScrollView contentContainerStyle={{ padding: 16, gap: 10, paddingBottom: 24 }}>
        {wallets.length === 0 ? (
          <View style={{ alignItems: 'center', paddingVertical: 48, gap: 10 }}>
            <Feather name="folder-plus" size={30} color={c.mutedForeground} />
            <Text style={{ fontFamily: F.s, fontSize: 17, color: c.foreground }}>{t('No accounts on this device')}</Text>
          </View>
        ) : wallets.map((w) => {
          const on = w.id === selectedId;
          return (
            <Pressable key={w.id} testID={`account-${w.id}`} onPress={() => pick(w.id, '/')}
              style={({ pressed }) => [st.row, { backgroundColor: pressed ? c.secondary : c.charcoal, borderColor: on ? c.primary : 'transparent' }]}>
              <WalletAvatar id={w.iconId} size={42} />
              <View style={{ flex: 1 }}>
                <Text numberOfLines={1} style={{ fontFamily: F.s, fontSize: 16.5, color: c.foreground }}>{w.name}</Text>
                <Text style={{ fontFamily: F.r, fontSize: 12.5, color: c.mutedForeground, marginTop: 2 }}>{on ? `${t('Active')} · ` : ''}{t('Test addresses: {n}', { n: w.addresses.length })}</Text>
              </View>
              <Pressable testID={`account-qr-${w.id}`} accessibilityLabel={t('Receive to {name}', { name: w.name })} hitSlop={6} onPress={e => { e.stopPropagation(); void pick(w.id, '/receive'); }} style={st.ic}>
                <MaterialCommunityIcons name="qrcode" size={22} color={c.foreground} />
              </Pressable>
              <Pressable testID={`account-more-${w.id}`} accessibilityLabel={t('Edit {name}', { name: w.name })} hitSlop={6} onPress={e => { e.stopPropagation(); tap(); setMode({ k: 'edit', id: w.id }); }} style={st.ic}>
                <Feather name="more-vertical" size={19} color={c.foreground} />
              </Pressable>
            </Pressable>
          );
        })}
        {err ? <Text style={{ fontFamily: F.m, color: c.destructive }}>{err}</Text> : null}
      </ScrollView>
      <View style={{ paddingHorizontal: 16, paddingTop: 10, paddingBottom: ins.bottom + 14 }}>
        <Btn testID="create-wallet" variant="soft" label={t('Create wallet')} icon="plus" onPress={() => setMode({ k: 'create' })} />
      </View>
      </View>)}
    </Animated.View>
  );
}

/** Create from Accounts: intro slides -> create/restore setup -> name + icon. Same app lock; nothing saved until final Save. */
function NewWalletFlow({ defaultName, onCancel, onDone }: { defaultName: string; onCancel: () => void; onDone: () => void }) {
  const [stage, setStage] = useState<'slides' | 'setup' | 'name'>('slides');
  const [slide, setSlide] = useState(0);
  if (stage === 'slides') return <Onboarding start={slide} onExit={onCancel} onDone={() => setStage('setup')} />;
  if (stage === 'setup') return <WalletSetup onBack={() => { setSlide(2); setStage('slides'); }} onReady={() => setStage('name')} />;
  return <CustomizeFlow mode="create" defaultName={defaultName} onCancel={() => setStage('setup')} onDone={onDone} />;
}

const st = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingLeft: 14, paddingRight: 6, minHeight: 70, borderRadius: 20, borderWidth: 1.5 },
  ic: { width: 40, height: 44, alignItems: 'center', justifyContent: 'center' },
});
