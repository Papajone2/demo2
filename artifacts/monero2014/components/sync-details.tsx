import React, { useState } from 'react';
import { Modal, Pressable, ScrollView, Text, View } from 'react-native';
import { Btn, F } from './ui';
import { useWallet } from '@/context/WalletContext';
import { useLanguage } from '@/context/LanguageContext';
import { useColors } from '@/hooks/useColors';
import { formatXmr } from '@/lib/money';

export function SyncDetails({ children }: { children: React.ReactNode }) {
  const [open, setOpen] = useState(false);
  const c = useColors();
  const { t } = useLanguage();
  const { sync, available, locked, total, state } = useWallet();
  const hidden = state?.hideBalance;
  return <>
    <Pressable testID="sync-details-open" accessibilityRole="button" accessibilityLabel={t('Synchronization')} onPress={() => setOpen(true)}>{children}</Pressable>
    <Modal visible={open} transparent animationType="slide" onRequestClose={() => setOpen(false)}>
      <View style={{ flex: 1, backgroundColor: '#0009', justifyContent: 'flex-end' }}>
        <ScrollView contentContainerStyle={{ padding: 24, paddingBottom: 40, gap: 18 }} style={{ maxHeight: '85%', backgroundColor: c.background, borderTopLeftRadius: 28, borderTopRightRadius: 28 }}>
          <Text style={{ fontFamily: F.b, fontSize: 24, color: c.foreground }}>{t('Synchronization')}</Text>
          <Text style={{ color: c.foreground }}>{sync.complete ? t('Synced') : t('Syncing')} · {Math.round(sync.progress * 100)}%</Text>
          <View style={{ backgroundColor: c.secondary, height: 8, borderRadius: 4 }}><View style={{ height: 8, borderRadius: 4, width: `${sync.progress * 100}%`, backgroundColor: c.primary }} /></View>
          <Text style={{ color: c.mutedForeground }}>{t('Blocks')}: {sync.height ?? '—'} / {sync.target || '—'}</Text>
          <Text style={{ color: c.mutedForeground }}>{t('Estimated time')}: {sync.complete ? '—' : sync.remainingSeconds > 0 ? t('About {n} minutes', { n: Math.max(1, Math.ceil(sync.remainingSeconds / 60)) }) : t('Calculating…')}</Text>
          {[[t('Spendable'), available], [t('Pending'), locked], [t('Total'), total]].map(([label, amount]) => <View key={String(label)} style={{ flexDirection: 'row', justifyContent: 'space-between' }}><Text style={{ color: c.mutedForeground }}>{String(label)}</Text><Text style={{ color: c.foreground }}>{hidden ? '••••' : !sync.complete ? t('Pending') : `${formatXmr(amount as bigint, 8)} XMR`}</Text></View>)}
          <Text style={{ color: c.mutedForeground, lineHeight: 22 }}>{t('Your wallet scans Monero blocks on this device to find payments using your private view key. The key is not sent to the node. A restore can take longer; balances are shown after scanning finishes. New blocks arrive about every two minutes, but timing varies. Incoming payments usually become spendable after 10 confirmations. Your recovery phrase is never sent to a node.')}</Text>
          <Text style={{ color: c.mutedForeground }}>{t('Sync pauses when the app is in the background and resumes when you return. No background mining or always-running service is used.')}</Text>
          <Btn label={t('Done')} onPress={() => setOpen(false)} />
        </ScrollView>
      </View>
    </Modal>
  </>;
}
