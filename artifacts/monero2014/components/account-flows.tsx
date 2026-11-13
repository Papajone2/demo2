import { Feather } from '@expo/vector-icons';
import React, { useEffect, useRef, useState } from 'react';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { KeyboardAwareScrollViewCompat } from '@/components/KeyboardAwareScrollViewCompat';
import { Check, GRow, Group, Notice, SecretPrompt, TopBar } from '@/components/account-ui';
import { Btn, F, tap, useInsets } from '@/components/ui';
import { PillBtn, SetupPage, SURFACE, SURFACE_HI } from '@/components/setup-parts';
import { AvatarPicker, WalletAvatar } from '@/components/wallet-avatar';
import { useLock } from '@/context/LockContext';
import { useWallet } from '@/context/WalletContext';
import { useColors } from '@/hooks/useColors';
import { type AvatarId, MAX_WALLET_NAME_LENGTH, walletNameLength, type WalletState } from '@/lib/wallet-model';
import { useLanguage } from '@/context/LanguageContext';
import { IS_NATIVE_ANDROID, nativeEngine } from '@/lib/native-engine';
import { WalletSetup } from './wallet-setup';
import { ActivationDisclosure } from './activation-disclosure';

function Body({ children }: { children: React.ReactNode }) {
  const c = useColors();
  const ins = useInsets();
  return (
    <KeyboardAwareScrollViewCompat style={{ flex: 1, backgroundColor: c.background }} contentContainerStyle={{ padding: 16, paddingBottom: ins.bottom + 32, gap: 16, flexGrow: 1 }} bottomOffset={24} keyboardShouldPersistTaps="handled">
      {children}
    </KeyboardAwareScrollViewCompat>
  );
}

function Screen({ title, onBack, children }: { title: string; onBack: () => void; children: React.ReactNode }) {
  const c = useColors();
  const { t } = useLanguage();
  return (
    <View style={{ flex: 1, backgroundColor: c.background }}>
      <TopBar title={t(title)} onBack={onBack} />
      <Body>{children}</Body>
    </View>
  );
}

function initials(name: string) {
  return name.trim().split(/\s+/).map((w) => w[0]).join('').slice(0, 2).toUpperCase();
}

/** Accepts edits up to the limit; always allows shortening (e.g. legacy 32-char names). */
function limitName(next: string, prev: string) {
  const n = walletNameLength(next);
  return n <= MAX_WALLET_NAME_LENGTH || n < walletNameLength(prev) ? next : prev;
}

function NameCount({ name }: { name: string }) {
  const c = useColors();
  const n = walletNameLength(name.trim());
  return <Text testID="name-count" style={{ fontFamily: F.m, fontSize: 12, color: n > MAX_WALLET_NAME_LENGTH ? c.destructive : '#6E6E73', textAlign: 'right', fontVariant: ['tabular-nums'] }}>{n}/{MAX_WALLET_NAME_LENGTH}</Text>;
}

const nameOk = (n: string) => n.length > 0 && walletNameLength(n) <= MAX_WALLET_NAME_LENGTH;

/* ---------------- Create / initial customization ---------------- */

export function CustomizeFlow({ mode, wallet, defaultName, onDone, onCancel }: {
  mode: 'create' | 'initial'; wallet?: WalletState | null; defaultName: string; onDone: () => void; onCancel?: () => void;
}) {
  const { reload } = useWallet();
  if (IS_NATIVE_ANDROID && mode === 'create') return <WalletSetup onBack={() => onCancel?.()} onReady={() => { reload(); onDone(); }} />;
  return <CustomizeDetails mode={mode} wallet={wallet} defaultName={defaultName} onDone={onDone} onCancel={onCancel} />;
}
function CustomizeDetails({ mode, wallet, defaultName, onDone, onCancel }: {
  mode: 'create' | 'initial'; wallet?: WalletState | null; defaultName: string; onDone: () => void; onCancel?: () => void;
}) {
  const c = useColors();
  const { t } = useLanguage();
  const { createWallet, updateWalletProfile } = useWallet();
  const [name, setName] = useState(wallet?.name ?? defaultName);
  const [icon, setIcon] = useState<AvatarId>(wallet?.iconId ?? 'monero');
  const [showIcons, setShowIcons] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const once = useRef(false);

  const save = async () => {
    if (once.current) return;
    const n = name.trim();
    if (!nameOk(n)) return setErr(t('Name must be 1–{n} characters.', { n: MAX_WALLET_NAME_LENGTH }));
    once.current = true;
    setBusy(true);
    setErr(null);
    try {
      if (mode === 'initial' && wallet) await updateWalletProfile(wallet.id, { name: n, iconId: icon });
      else await createWallet(n, icon);
      tap('success');
      onDone();
    } catch (e) {
      once.current = false;
      setBusy(false);
      setErr(e instanceof Error ? t(e.message) : t('Could not save to local storage.'));
    }
  };

  return (
    <SetupPage testID="setup-customize" step={mode === 'initial' ? t('Almost done') : t('New wallet')} title={t('Name your wallet')} sub={t('Pick a name and icon. You can change them later.')}
      onBack={mode === 'create' ? onCancel : undefined}
      footer={<PillBtn testID="create-save" label={busy ? t('Saving…') : mode === 'create' ? t('Create wallet') : t('Continue')} disabled={busy} onPress={save} />}>
      <View style={{ alignItems: 'center', gap: 8, marginTop: 4 }}>
        <Pressable testID="create-avatar" accessibilityRole="button" accessibilityLabel={t('Choose an icon')} onPress={() => { tap(); setShowIcons(v => !v); }} style={({ pressed }) => ({ transform: [{ scale: pressed ? 0.96 : 1 }] })}>
          <WalletAvatar id={icon} size={76} fallback={initials(name)} />
          <View style={[st.badge, { backgroundColor: SURFACE_HI, borderColor: '#0B0B0B' }]}><Feather name="edit-2" size={13} color={c.primary} /></View>
        </Pressable>
        <Text style={{ fontFamily: F.s, fontSize: 18, color: c.inkForeground }}>{name.trim() || defaultName}</Text>
      </View>
      <View style={[st.inputWrap, { backgroundColor: SURFACE }]}>
        <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
          <Text style={{ fontFamily: F.m, fontSize: 13, color: '#8E8E93' }}>{t('Account name')}</Text>
          <NameCount name={name} />
        </View>
        <TextInput testID="create-name" value={name} onChangeText={(v) => { setErr(null); setName((p) => limitName(v, p)); }} placeholder={defaultName} placeholderTextColor="#6E6E73" style={[st.input, { color: c.inkForeground }]} />
      </View>
      <ActivationDisclosure />
      <Pressable testID="create-icon-toggle" accessibilityRole="button" accessibilityState={{ expanded: showIcons }} onPress={() => { tap(); setShowIcons(v => !v); }} style={({ pressed }) => [{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: 16, borderRadius: 18, backgroundColor: pressed ? SURFACE_HI : SURFACE }]}>
        <Text style={{ fontFamily: F.s, fontSize: 15.5, color: c.inkForeground }}>{t('Choose an icon')}</Text>
        <Feather name={showIcons ? 'chevron-up' : 'chevron-down'} size={20} color="#8E8E93" />
      </Pressable>
      {showIcons ? <AvatarPicker value={icon} onChange={setIcon} /> : null}
      {err ? <Text style={{ fontFamily: F.m, color: c.primary }}>{err}</Text> : null}
    </SetupPage>
  );
}

/* ---------------- Secret reveal (recovery / view key) ---------------- */

function SecretReveal({ kind, onBack, walletId }: { kind: 'recovery' | 'viewkey'; onBack: () => void; walletId: string }) {
  const c = useColors();
  const { authorize } = useLock();
  const { t } = useLanguage();
  const [ack, setAck] = useState(false);
  const [step, setStep] = useState<'warn' | 'auth' | 'result'>('warn');
  const [revealed, setRevealed] = useState('');
  const [copyStatus, setCopyStatus] = useState('');
  const rec = kind === 'recovery';
  const title = rec ? 'Show Recovery Phrase' : 'Show View Key';

  if (step === 'auth') {
    return (
      <Screen title={title} onBack={onBack}>
        <SecretPrompt title={t('Confirm it’s you')} cta={t('Continue')} onCancel={onBack}
          onSubmit={async (secret) => {
            const r = await authorize(secret); if (!r.ok) return t(r.message ?? 'Incorrect.');
            try { if (IS_NATIVE_ANDROID) setRevealed(await nativeEngine().secret(walletId, rec)); }
            catch { return 'Could not read the native wallet secret. Nothing was exported.'; }
            setStep('result'); return null;
          }} />
      </Screen>
    );
  }
  if (step === 'result') {
    if (IS_NATIVE_ANDROID) return <Screen title={title} onBack={() => { setRevealed(''); onBack(); }}>
      <Text style={[st.h, { color: c.foreground }]}>{rec ? t('Your recovery phrase') : t('Your private view key')}</Text>
      {rec ? <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 10 }}>{revealed.split(/\s+/).map((word, i) => <View key={i} style={{ width: '47%', backgroundColor: c.charcoal, borderRadius: 12, padding: 12 }}><Text style={{ color: c.foreground, fontFamily: F.m }}>{i + 1}. {word}</Text></View>)}</View> : <Text style={{ color: c.foreground, fontFamily: F.m }}>{revealed}</Text>}
      <Notice tone="danger" title={t('Keep your recovery phrase secret')} body={t('Clipboard contents may be visible to other apps. Prefer an offline backup. Copied words are cleared after one minute if unchanged.')} />
      {rec ? <Btn label={t('Copy')} icon="copy" variant="soft" onPress={async () => {
        try { await nativeEngine().copyPrivateText(revealed); setCopyStatus(t('Copied')); }
        catch { setCopyStatus(t('Clipboard unavailable on this device.')); }
      }} /> : null}
      {copyStatus ? <Text style={{ color: c.mutedForeground }}>{copyStatus}</Text> : null}
      <Btn testID="secret-done" label={t('Done')} onPress={() => { setRevealed(''); onBack(); }} />
    </Screen>;
    return (
      <Screen title={title} onBack={onBack}>
        <View style={[st.hero, { backgroundColor: c.charcoal }]}><Feather name="cpu" size={28} color={c.warn} /></View>
        <Text style={[st.h, { color: c.foreground }]}>{t('Native engine unavailable')}</Text>
        <Notice icon="slash" title={rec ? t('No recovery phrase exists in this build') : t('No private view key exists in this build')} body={rec ? t('This Android preview stores test identifiers only. Without the native Monero engine there is no real recovery phrase to show, and none will be invented.') : t('This Android preview stores test identifiers only. Without the native Monero engine there is no real private view key to show, and none will be invented.')} />
        <View style={{ flex: 1 }} />
        <Btn testID="secret-done" label={t('Done')} onPress={onBack} />
      </Screen>
    );
  }
  return (
    <Screen title={title} onBack={onBack}>
      <View style={[st.hero, { backgroundColor: 'rgba(255,51,85,0.12)' }]}><Feather name="eye-off" size={28} color={c.destructive} /></View>
      <Text style={[st.h, { color: c.foreground }]}>{rec ? t('Keep your recovery phrase secret') : t('Keep your private view key secret')}</Text>
      <Notice tone="danger" title={rec ? t('Anyone with it controls your wallet') : t('A view key exposes private payment details')} body={rec ? t('Never share it, screenshot it, or type it into a website. monero2014 will never ask for it.') : t('A private view key reveals incoming payments and amounts. It does not authorize spending. Only share it with someone you fully trust.')} />
      <Check testID="secret-ack" value={ack} onChange={setAck} label={rec ? t('I understand that sharing my recovery phrase can expose my funds or privacy.') : t('I understand that sharing my private view key can expose my funds or privacy.')} />
      <View style={{ flex: 1 }} />
      <Btn testID="secret-continue" label={t('Continue')} disabled={!ack} onPress={() => setStep('auth')} />
    </Screen>
  );
}

/* ---------------- Delete ---------------- */

function DeleteFlow({ wallet, onBack, onDeleted }: { wallet: WalletState; onBack: () => void; onDeleted: () => void }) {
  const c = useColors();
  const { deleteWallet } = useWallet();
  const { t } = useLanguage();
  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [ack, setAck] = useState(false);
  const abort = useRef<AbortController | null>(null);
  useEffect(() => { abort.current = new AbortController(); return () => { abort.current?.abort(); }; }, []);

  if (step === 3) {
    return (
      <Screen title="Delete Account" onBack={onBack}>
        <SecretPrompt title={t('Enter your PIN or password to delete {name}', { name: wallet.name })} cta={t('Delete account')} onCancel={onBack}
          onSubmit={async (secret) => {
            try { await deleteWallet(wallet.id, secret, abort.current?.signal); } catch (e) { return e instanceof Error ? t(e.message) : t('Account was not deleted.'); }
            tap('success');
            onDeleted();
            return null;
          }} />
      </Screen>
    );
  }
  return (
    <Screen title="Delete Account" onBack={onBack}>
      <View style={{ alignItems: 'center', marginTop: 8 }}><WalletAvatar id={wallet.iconId} size={72} /></View>
      {step === 1 ? (
        <>
          <Text style={[st.h, { color: c.foreground }]}>{t('Delete {name}?', { name: wallet.name })}</Text>
          <Text style={[st.p, { color: c.mutedForeground }]}>{t('This removes “{name}” from this device. Other accounts stay untouched.', { name: wallet.name })}</Text>
          <Check testID="delete-ack" value={ack} onChange={setAck} label={t('I have my recovery phrase, or I accept losing access to this wallet.')} />
          <View style={{ flex: 1 }} />
          <Btn testID="delete-sure" label={t('Continue')} variant="danger" disabled={!ack} onPress={() => setStep(2)} />
          <Btn testID="delete-cancel" label={t('Cancel')} variant="soft" onPress={onBack} />
        </>
      ) : (
        <>
          <Text style={[st.h, { color: c.foreground }]}>{t('This cannot be undone')}</Text>
          <Notice tone="danger" title={t('Without a recovery phrase, access to all Monero in this wallet will be lost.')} body={t('Deleting only removes the wallet from this device; it does not destroy coins on the network. Anyone without the recovery phrase can never open them again.')} />
          <View style={{ flex: 1 }} />
          <Btn testID="delete-confirm" label={t('Delete permanently')} variant="danger" onPress={() => setStep(3)} />
          <Btn testID="delete-decline" label={t('Keep wallet')} variant="soft" onPress={onBack} />
        </>
      )}
    </Screen>
  );
}

/* ---------------- Edit account ---------------- */

type View_ = 'main' | 'name' | 'avatar' | 'addresses' | 'recovery' | 'viewkey' | 'delete';

export function EditAccount({ wallet, onBack, onDeleted }: { wallet: WalletState; onBack: () => void; onDeleted: () => void }) {
  const c = useColors();
  const { updateWalletProfile } = useWallet();
  const { t } = useLanguage();
  const [view, setView] = useState<View_>('main');
  const [name, setName] = useState(wallet.name);
  const [icon, setIcon] = useState<AvatarId>(wallet.iconId);
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const main = () => { setErr(null); setView('main'); };

  const save = async (change: { name?: string; iconId?: AvatarId }) => {
    if (busy) return;
    if (change.name !== undefined) {
      const n = change.name.trim();
      if (!nameOk(n)) return setErr(t('Name must be 1–{n} characters.', { n: MAX_WALLET_NAME_LENGTH }));
      change = { name: n };
    }
    setBusy(true);
    try { await updateWalletProfile(wallet.id, change); tap('success'); main(); }
    catch (e) { setErr(e instanceof Error ? t(e.message) : t('Could not save.')); }
    setBusy(false);
  };

  if (view === 'recovery' || view === 'viewkey') return <SecretReveal kind={view === 'recovery' ? 'recovery' : 'viewkey'} walletId={wallet.id} onBack={main} />;
  if (view === 'delete') return <DeleteFlow wallet={wallet} onBack={main} onDeleted={onDeleted} />;
  if (view === 'name') {
    return (
      <Screen title="Account Name" onBack={main}>
        <View style={[st.inputWrap, { backgroundColor: c.charcoal }]}>
          <NameCount name={name} />
          <TextInput testID="edit-name-input" autoFocus value={name} onChangeText={(v) => { setErr(null); setName((p) => limitName(v, p)); }} style={[st.input, { color: c.foreground }]} returnKeyType="done" onSubmitEditing={() => save({ name })} />
        </View>
        <ActivationDisclosure />
        {err ? <Text style={{ fontFamily: F.m, color: c.destructive }}>{err}</Text> : null}
        <Btn testID="edit-name-save" label={t('Save')} loading={busy} onPress={() => save({ name })} />
      </Screen>
    );
  }
  if (view === 'avatar') {
    return (
      <Screen title="Account Icon" onBack={main}>
        <View style={{ alignItems: 'center' }}><WalletAvatar id={icon} size={96} /></View>
        <AvatarPicker value={icon} onChange={setIcon} />
        {err ? <Text style={{ fontFamily: F.m, color: c.destructive }}>{err}</Text> : null}
        <Btn testID="edit-avatar-save" label={t('Save icon')} loading={busy} onPress={() => save({ iconId: icon })} />
      </Screen>
    );
  }
  if (view === 'addresses') {
    return (
      <Screen title="Account Addresses" onBack={main}>
        {!IS_NATIVE_ANDROID ? <Notice tone="info" icon="info" title={t('Test identifiers')} body={t('These are local test identifiers for the simulated ledger, not real Monero addresses. Never send real XMR to them.')} /> : null}
        <Group>
          {wallet.addresses.map((a, i) => (
            <View key={a} style={st.addr}>
              <Text style={{ fontFamily: F.s, fontSize: 13, color: a === wallet.receiveAddress ? c.primary : c.mutedForeground }}>
                {a === wallet.receiveAddress ? t('Current receive') : t('Address {n}', { n: i + 1 })}
              </Text>
              <Text selectable style={{ fontFamily: F.r, fontSize: 13, color: c.foreground, marginTop: 4 }}>{a}</Text>
            </View>
          ))}
        </Group>
      </Screen>
    );
  }
  return (
    <Screen title="Edit Account" onBack={onBack}>
      <Pressable testID="edit-avatar" accessibilityLabel={t('Change icon')} onPress={() => { setIcon(wallet.iconId); setView('avatar'); }} style={{ alignSelf: 'center', marginVertical: 8 }}>
        <WalletAvatar id={wallet.iconId} size={84} fallback={initials(wallet.name)} />
        <View style={[st.badge, { backgroundColor: c.charcoal, borderColor: c.background }]}><Feather name="edit-2" size={13} color={c.foreground} /></View>
      </Pressable>
      <Group>
        <GRow testID="edit-name" title={t('Account Name')} value={wallet.name} onPress={() => { setName(wallet.name); setView('name'); }} />
        <GRow testID="edit-addresses" title={t('Account Addresses')} value={String(wallet.addresses.length)} onPress={() => setView('addresses')} />
      </Group>
      <Group>
        <GRow testID="show-recovery" title={t('Show Recovery Phrase')} onPress={() => setView('recovery')} />
        <GRow testID="show-viewkey" title={t('Show View Key')} onPress={() => setView('viewkey')} />
      </Group>
      <Group>
        <GRow testID="delete-account" title={t('Delete Account')} tone="danger" onPress={() => setView('delete')} />
      </Group>
    </Screen>
  );
}

const st = StyleSheet.create({
  hero: { width: 72, height: 72, borderRadius: 24, alignItems: 'center', justifyContent: 'center', alignSelf: 'center', marginTop: 12 },
  h: { fontFamily: F.b, fontSize: 24, textAlign: 'center', letterSpacing: -0.4 },
  p: { fontFamily: F.r, fontSize: 15, lineHeight: 22, textAlign: 'center' },
  inputWrap: { borderRadius: 18, paddingHorizontal: 18, paddingVertical: 12, gap: 2 },
  input: { fontFamily: F.m, fontSize: 17, minHeight: 36, paddingVertical: 4 },
  badge: { position: 'absolute', right: -2, bottom: -2, width: 32, height: 32, borderRadius: 16, borderWidth: 3, alignItems: 'center', justifyContent: 'center' },
  addr: { paddingHorizontal: 18, paddingVertical: 14 },
});
