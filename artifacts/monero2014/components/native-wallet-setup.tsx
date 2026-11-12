import React, { useRef, useState } from 'react';
import { ScrollView, Text, TextInput, View } from 'react-native';
import { Btn, F, Field, s as ui } from './ui';
import { nativeEngine } from '@/lib/native-engine';
import { useColors } from '@/hooks/useColors';
import type { SetupPath } from './wallet-setup';

/** Real phrase is ephemeral React state, never AsyncStorage, clipboard, logs or API. */
export function NativeWalletSetup({ onBack, onReady }: { onBack: () => void; onReady: (path: SetupPath) => void }) {
  const c = useColors();
  const [step, setStep] = useState<'choice' | 'restore' | 'backup'>('choice');
  const [seed, setSeed] = useState('');
  const [name, setName] = useState('Wallet 1');
  const [height, setHeight] = useState('0');
  const [backup, setBackup] = useState<string[]>([]);
  const [ack, setAck] = useState(false);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const once = useRef(false);
  const submit = async (restore: boolean) => {
    if (once.current) return;
    once.current = true; setBusy(true); setError('');
    try {
      const result = await nativeEngine().create(name.trim(), restore ? seed : '', height);
      setSeed('');
      if (restore) { onReady('restore'); return; }
      setBackup(result.seed.split(' ')); setStep('backup');
    } catch (e) { setError(e instanceof Error ? e.message : 'Native wallet creation failed.'); }
    finally { setBusy(false); once.current = false; }
  };
  return (
    <ScrollView style={{ flex: 1, backgroundColor: c.background }} contentContainerStyle={{ padding: 24, paddingTop: 60, gap: 18 }}>
      <Text style={[ui.h2, { color: c.foreground }]}>Native Monero · STAGENET</Text>
      <Text style={[ui.body, { color: c.mutedForeground }]}>Experimental wallet. Stagenet coins have no monetary value. Do not enter a funded mainnet phrase.</Text>
      {step !== 'backup' ? <>
        <Field label="Wallet name" value={name} onChangeText={setName} maxLength={16} />
        {step === 'restore' ? <>
          <TextInput testID="native-restore-seed" value={seed} onChangeText={setSeed} multiline secureTextEntry autoCorrect={false}
            autoCapitalize="none" importantForAutofill="no" placeholder="16-word Polyseed or 25-word Monero phrase"
            placeholderTextColor={c.mutedForeground} style={{ color: c.foreground, borderWidth: 1, borderColor: c.border, padding: 16, minHeight: 110 }} />
          <Field label="Restore height (0 scans all blocks)" value={height} onChangeText={setHeight} keyboardType="number-pad" />
          <Btn label="Restore native wallet" loading={busy} disabled={busy || !seed.trim()} onPress={() => submit(true)} />
        </> : <>
          <Text style={[ui.body, { color: c.foreground }]}>Create a fresh 16-word Polyseed on this device. Write it on paper before continuing. Wallet files are encrypted using a random password protected by Android Keystore.</Text>
          <Btn testID="native-create" label="Create native wallet" loading={busy} disabled={busy} onPress={() => submit(false)} />
          <Btn label="Restore recovery phrase" variant="soft" disabled={busy} onPress={() => setStep('restore')} />
        </>}
        <Btn label="Back" variant="ghost" disabled={busy} onPress={onBack} />
      </> : <>
        <Text style={[ui.h2, { color: c.foreground }]}>Write down all 16 words</Text>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 12 }}>
          {backup.map((word, i) => <Text key={i} style={{ width: '45%', color: c.foreground, fontFamily: F.m, padding: 10 }}>{i + 1}. {word}</Text>)}
        </View>
        <Text style={[ui.body, { color: c.mutedForeground }]}>Never share this phrase. No screenshots or clipboard export. Your app PIN is not a recovery backup.</Text>
        <Btn label={ack ? '✓ Written down offline' : 'I wrote down every word'} variant="soft" onPress={() => setAck(!ack)} />
        <Btn testID="native-backup-done" label="Continue" disabled={!ack} onPress={() => { setBackup([]); onReady('create'); }} />
      </>}
      {error ? <Text accessibilityRole="alert" style={{ color: c.destructive }}>{error}</Text> : null}
    </ScrollView>
  );
}
