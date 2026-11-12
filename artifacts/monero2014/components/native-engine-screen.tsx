import React, { useState } from 'react';
import { ScrollView, Text } from 'react-native';
import { Btn, Field, s as ui } from './ui';
import { WalletSetup } from './wallet-setup';
import { nativeEngine } from '@/lib/native-engine';
import { useWallet } from '@/context/WalletContext';
import { useColors } from '@/hooks/useColors';

export function NativeEngineScreen() {
  const c = useColors();
  const { reload, state, sync } = useWallet();
  const [url, setUrl] = useState('');
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);
  const [setup, setSetup] = useState(false);
  const network = state?.network ?? 'stagenet';
  if (setup) return <WalletSetup onBack={() => { setSetup(false); reload(); }} onReady={() => { setSetup(false); reload(); }} />;
  return (
    <ScrollView style={{ flex: 1, backgroundColor: c.background }} contentContainerStyle={{ padding: 20, gap: 18 }}>
      <Text style={[ui.h2, { color: c.foreground }]}>Native Monero engine · {network.toUpperCase()}</Text>
      <Text style={[ui.body, { color: c.mutedForeground }]}>monero_c v0.18.4.6-RC2, running on this device. Encrypted files, Polyseed, subaddresses, scanning and local signing. Experimental and unaudited. {network === 'mainnet' ? 'Real funds are at risk on mainnet; use only an amount you can afford to lose.' : 'Test coins only on stagenet.'}</Text>
      <Text selectable style={{ color: c.foreground }}>Account: {state?.name ?? 'None'}{'\n'}Scanning: {Math.round(sync.progress * 100)}%{sync.complete ? ' · caught up' : ''}</Text>
      <Field label={`HTTPS ${network} daemon`} value={url} onChangeText={setUrl} placeholder={network === 'mainnet' ? 'https://xmr.nodely.dev:18089' : 'https://xmr.nodely.dev:38089'} autoCorrect={false} autoCapitalize="none" />
      <Text style={[ui.hint, { color: c.mutedForeground }]}>Use a node you trust. Remote nodes see your IP and queries, but never receive your recovery phrase or spend key.</Text>
      <Btn label="Connect and scan" loading={busy} disabled={busy || !state} onPress={async () => {
        setBusy(true);
        try { await nativeEngine().connect(url.trim() || (network === 'mainnet' ? 'https://xmr.nodely.dev:18089' : 'https://xmr.nodely.dev:38089')); setMessage('Connected. Scanning on-device.'); }
        catch (e) { setMessage(e instanceof Error ? e.message : 'Connection failed.'); }
        finally { setBusy(false); }
      }} />
      <Btn label="Add or restore wallet" variant="soft" onPress={() => setSetup(true)} />
      {message ? <Text selectable style={{ color: c.foreground }}>{message}</Text> : null}
    </ScrollView>
  );
}
