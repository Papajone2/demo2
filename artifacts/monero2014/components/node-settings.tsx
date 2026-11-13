import React, { useEffect, useState } from 'react';
import { ScrollView, Switch, Text, View } from 'react-native';
import { Btn, F, Field } from './ui';
import { useColors } from '@/hooks/useColors';
import { useLanguage } from '@/context/LanguageContext';
import { useWallet } from '@/context/WalletContext';
import { IS_NATIVE_ANDROID, nativeEngine } from '@/lib/native-engine';
import { loadNetworkPolicy, setMarketBlocked } from '@/lib/network-policy';
import { COMMUNITY_NODES, ONION_NODES, FEATHER_NODE_SOURCE } from '@/lib/community-nodes';
import * as WebBrowser from 'expo-web-browser';

export function NodeSettings() {
  const c = useColors(), { t, errorMessage } = useLanguage(), { reload, state } = useWallet();
  const [url, setUrl] = useState('');
  const [tor, setTor] = useState(false);
  const [busy, setBusy] = useState(false), [error, setError] = useState('');
  useEffect(() => {
    if (IS_NATIVE_ANDROID) void nativeEngine().snapshot().then(s => { setUrl(s.daemon); setTor(s.tor); }).catch(() => setError(t('Could not read node settings.')));
  }, [t]);
  const save = async () => {
    setBusy(true); setError('');
    try {
      // Abort price requests before native routing changes. Even a failed Tor
      // connection must not allow price traffic onto the direct network.
      if (tor) setMarketBlocked(true);
      await nativeEngine().configureNode(url.trim(), tor);
      await loadNetworkPolicy(); reload();
    } catch (e) {
      await loadNetworkPolicy().catch(() => setMarketBlocked(true));
      setError(errorMessage(e instanceof Error ? e.message : 'Could not connect to node.'));
    } finally { setBusy(false); }
  };
  return <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={{ padding: 20, gap: 18 }}>
    <Text style={{ color: c.mutedForeground, lineHeight: 21 }}>{t('Remote nodes help your wallet scan and broadcast. No public operator is guaranteed trustworthy. Nodes are treated as untrusted by the engine and never receive your recovery phrase or private keys.')}</Text>
    <View style={{ flexDirection: 'row', alignItems: 'center' }}>
      <Text style={{ color: c.foreground, fontFamily: F.s, flex: 1 }}>{t('Route through Tor')}</Text>
      <Switch testID="tor-switch" value={tor} disabled={!IS_NATIVE_ANDROID || busy} onValueChange={value => { setTor(value); setUrl(''); }} />
    </View>
    <Text style={{ color: c.mutedForeground, lineHeight: 21 }}>{t('Tor requires Orbot running its SOCKS proxy on 127.0.0.1:9050 and a v3 onion node. Wallet connections go only through Tor, with no direct fallback. Price requests are disabled to prevent leaks. Syncing is usually slower. This does not route other apps through Tor.')}</Text>
    <Field label={t('Node URL')} value={url} onChangeText={setUrl} autoCapitalize="none" autoCorrect={false} placeholder={tor ? 'http://…onion:18081' : 'https://…'} />
    <Text style={{ color: c.mutedForeground }}>{t('Nodes from Feather’s published list. Inclusion is not a trust guarantee.')}</Text>
    {state?.network !== 'stagenet' ? (tor ? ONION_NODES : COMMUNITY_NODES).map(node => <Btn key={node.url} label={`${node.name} · ${tor ? 'Tor' : 'HTTPS'}`} variant={url === node.url ? 'soft' : 'ghost'} disabled={busy} onPress={() => setUrl(node.url)} />) : !tor ? <Btn label={t('Use default node')} onPress={() => setUrl('https://xmr.nodely.dev:38089')} /> : null}
    <Btn label={t('Source')} variant="ghost" onPress={() => { void WebBrowser.openBrowserAsync(FEATHER_NODE_SOURCE).catch(() => setError(t('Could not open browser.'))); }} />
    <Btn testID="node-save" label={t('Save and connect')} loading={busy} disabled={!IS_NATIVE_ANDROID || !url || busy} onPress={save} />
    {error ? <Text accessibilityRole="alert" style={{ color: c.destructive }}>{error}</Text> : null}
  </ScrollView>;
}
