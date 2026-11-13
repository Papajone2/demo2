import { router, useLocalSearchParams } from 'expo-router';
import { Feather } from '@expo/vector-icons';
import React, { useMemo, useState } from 'react';
import { FlatList, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { EmptyState, F, s as ui, tap, TestBanner, TxRow, useInsets, WalletGate } from '@/components/ui';
import { msg } from '@/context/LanguageContext';
import { REQUIRED_CONFIRMATIONS, useWallet } from '@/context/WalletContext';
import { useLanguage } from '@/context/LanguageContext';
import { useColors } from '@/hooks/useColors';

type Filter = 'all' | 'in' | 'out' | 'pending';
const FILTERS: { k: Filter; label: string }[] = [
  { k: 'all', label: msg('All') },
  { k: 'in', label: msg('Received') },
  { k: 'out', label: msg('Sent') },
  { k: 'pending', label: msg('Pending') },
];

function Activity() {
  const c = useColors();
  const ins = useInsets();
  const { state } = useWallet();
  const { t } = useLanguage();
  const { sent } = useLocalSearchParams<{ sent?: string }>();
  const sentTx = sent ? state?.txs.find((x) => x.id === sent) : undefined;
  const [q, setQ] = useState('');
  const [f, setF] = useState<Filter>('all');
  const txs = state?.txs;
  const list = useMemo(() => {
    const needle = q.trim().toLowerCase();
    return [...(txs ?? [])].sort((a, b) => b.createdAt - a.createdAt).filter((t) => {
      if (f === 'in' && t.kind !== 'in') return false;
      if (f === 'out' && t.kind !== 'out') return false;
      if (f === 'pending' && t.confirmations >= REQUIRED_CONFIRMATIONS) return false;
      if (!needle) return true;
      return t.note.toLowerCase().includes(needle) || t.address.toLowerCase().includes(needle) || t.id.toLowerCase().includes(needle);
    });
  }, [txs, q, f]);

  return (
    <View style={{ flex: 1, backgroundColor: c.background }}>
      <View style={{ paddingTop: ins.top + 8, paddingHorizontal: 18, gap: 12, paddingBottom: 8 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}><Pressable testID="back" accessibilityLabel={t('Back')} hitSlop={8} onPress={() => (router.canGoBack() ? router.back() : router.replace('/'))} style={{ width: 40, height: 40, borderRadius: 14, alignItems: 'center', justifyContent: 'center', backgroundColor: c.secondary }}><Feather name="chevron-left" size={22} color={c.foreground} /></Pressable><Text style={[ui.h1, { color: c.foreground }]}>{t('History')}</Text></View>
        <TestBanner compact />
        <View style={[st.search, { backgroundColor: c.card, borderColor: c.border }]}>
          <Feather name="search" size={17} color={c.mutedForeground} />
          <TextInput testID="search" value={q} onChangeText={setQ} placeholder={t('Search note, address or ID')} placeholderTextColor={c.mutedForeground} style={[st.searchInput, { color: c.foreground }]} autoCapitalize="none" />
          {q ? (
            <Pressable onPress={() => setQ('')} hitSlop={8}>
              <Feather name="x" size={17} color={c.mutedForeground} />
            </Pressable>
          ) : null}
        </View>
        <View style={{ flexDirection: 'row', gap: 8 }}>
          {FILTERS.map((x) => {
            const on = x.k === f;
            return (
              <Pressable key={x.k} testID={`filter-${x.k}`} onPress={() => { tap(); setF(x.k); }} style={[st.chip, { backgroundColor: on ? c.ink : c.secondary }]}>
                <Text style={{ fontFamily: F.s, fontSize: 13, color: on ? c.inkForeground : c.secondaryForeground }}>{t(x.label)}</Text>
              </Pressable>
            );
          })}
        </View>
        {sentTx ? (
          <View testID="send-success-note" style={[st.sent, { backgroundColor: c.charcoal }]}>
            <Feather name="clock" size={15} color={c.foreground} />
            <Text style={{ flex: 1, fontFamily: F.m, fontSize: 13.5, color: c.foreground }}>{t('Sent. Waiting for confirmations.')}</Text>
          </View>
        ) : null}
      </View>
      <FlatList
        data={list}
        keyExtractor={(t) => t.id}
        renderItem={({ item }) => item.id === sent && item.confirmations < REQUIRED_CONFIRMATIONS ? <View testID="history-pending-tx"><TxRow tx={item} /></View> : <TxRow tx={item} />}
        contentContainerStyle={{ paddingHorizontal: 12, paddingBottom: ins.bottom + 40 }}
        keyboardShouldPersistTaps="handled"
        ListEmptyComponent={<EmptyState icon="search" title={q || f !== 'all' ? t('Nothing matches') : t('No transactions')} body={q || f !== 'all' ? t('Try a different search or filter.') : t('Incoming and outgoing transfers will appear here.')} />}
      />
    </View>
  );
}

export default function ActivityScreen() {
  return (
    <WalletGate>
      <Activity />
    </WalletGate>
  );
}

const st = StyleSheet.create({
  search: { flexDirection: 'row', alignItems: 'center', gap: 10, borderWidth: 1, borderRadius: 14, paddingHorizontal: 14, height: 48 },
  searchInput: { flex: 1, fontFamily: F.m, fontSize: 15 },
  sent: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 14, paddingVertical: 10, borderRadius: 14 },
  chip: { paddingHorizontal: 14, paddingVertical: 8, borderRadius: 999 },
});
