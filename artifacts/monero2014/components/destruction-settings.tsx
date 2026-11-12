import React, { useState } from 'react';
import { Text, View } from 'react-native';
import { Btn, Field } from './ui';
import { Check, SecretPrompt } from './account-ui';
import { useLock } from '@/context/LockContext';
import { useLanguage } from '@/context/LanguageContext';
import { useColors } from '@/hooks/useColors';

export function DestructionSettings() {
  const lock = useLock(), { t } = useLanguage(), c = useColors();
  const [verified, setVerified] = useState(false), [ack, setAck] = useState(false);
  const [secret, setSecret] = useState(''), [confirm, setConfirm] = useState(''), [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  if (!verified) return <SecretPrompt title={t('Confirm it’s you')} cta={t('Continue')} onCancel={() => {}} onSubmit={async s => {
    const result = await lock.authorize(s);
    if (!result.ok) return t(result.message ?? 'Incorrect.');
    setVerified(true); return null;
  }} />;
  return <View style={{ padding: 20, gap: 18 }}>
    <Text style={{ color: c.destructive }}>{t('Entering this special secret on the unlock screen deletes ALL wallets and local keys on this device immediately. This cannot be undone. It does not erase the blockchain or your offline backups. Keep recovery phrases for every wallet before enabling it.')}</Text>
    <Check value={ack} onChange={setAck} label={t('I have offline recovery backups for every wallet and understand deletion is immediate.')} />
    <Field label={t('Destruction PIN or password')} value={secret} onChangeText={setSecret} secureTextEntry keyboardType={lock.method === 'pin' ? 'number-pad' : 'default'} autoCapitalize="none" autoCorrect={false} />
    <Field label={t('Confirm password')} value={confirm} onChangeText={setConfirm} secureTextEntry keyboardType={lock.method === 'pin' ? 'number-pad' : 'default'} autoCapitalize="none" autoCorrect={false} />
    <Btn label={t('Enable destruction secret')} variant="danger" disabled={!ack || !secret || secret !== confirm || busy} loading={busy} onPress={async () => {
      setBusy(true);
      try { await lock.setDestruction(secret); setSecret(''); setConfirm(''); setVerified(false); }
      catch (e) { setError(t(e instanceof Error ? e.message : 'Could not save.')); }
      finally { setBusy(false); }
    }} />
    {lock.destructionEnabled ? <Btn label={t('Disable destruction secret')} variant="soft" onPress={async () => { await lock.setDestruction(''); setVerified(false); }} /> : null}
    {error ? <Text style={{ color: c.destructive }}>{error}</Text> : null}
  </View>;
}
