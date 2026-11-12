import { Feather } from '@expo/vector-icons';
import { getGetMoneroHistoryQueryKey, getGetMoneroStatsQueryKey, type GetMoneroHistoryCurrency, type MoneroHistoryPoint } from '@workspace/api-client-react';
import { useMarketHistory as useGetMoneroHistory, useMarketStats as useGetMoneroStats } from '@/hooks/useMarketData';
import { router } from 'expo-router';
import React, { useEffect, useRef, useState } from 'react';
import { Animated, Dimensions, Platform, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { MoneroLogo, PriceChart } from '@/components/market-chart';
import { F, tap, useInsets } from '@/components/ui';
import { useWallet } from '@/context/WalletContext';
import { msg, useLanguage } from '@/context/LanguageContext';
import { useColors } from '@/hooks/useColors';
import { currencySymbol } from '@/lib/money';

const RANGES = [
  { k: '1h', label: '1H', desc: msg('past hour') },
  { k: '1d', label: '1D', desc: msg('past 24 hours') },
  { k: '1w', label: '1W', desc: msg('past week') },
  { k: '1m', label: '1M', desc: msg('past month') },
  { k: '1y', label: '1Y', desc: msg('past year') },
] as const;
type RangeKey = typeof RANGES[number]['k'];
const MARKET: Record<string, GetMoneroHistoryCurrency> = { USD: 'usd', EUR: 'eur', GBP: 'gbp' };
const RED = '#ff3355';
const GREEN = '#06e151';

function fmt(v: number, sym: string) {
  const a = Math.abs(v);
  const d = a >= 1 ? 2 : 4;
  return `${v < 0 ? '-' : ''}${sym}${a.toLocaleString('en-US', { minimumFractionDigits: d, maximumFractionDigits: d })}`;
}
function stamp(ts: number, r: RangeKey) {
  const d = new Date(ts);
  if (r === '1h' || r === '1d') return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  if (r === '1y') return d.toLocaleDateString([], { month: 'short', day: 'numeric', year: 'numeric' });
  return d.toLocaleString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
}
const close = () => (router.canGoBack() ? router.back() : router.replace('/'));

export default function MarketScreen() {
  const c = useColors();
  const ins = useInsets();
  const { state } = useWallet();
  const { t } = useLanguage();
  const [range, setRange] = useState<RangeKey>('1d');
  const [w, setW] = useState(0);
  const [scrub, setScrub] = useState<MoneroHistoryPoint | null>(null);
  const enter = useRef(new Animated.Value(Platform.OS === 'web' ? Dimensions.get('window').height : 0)).current;
  useEffect(() => {
    if (Platform.OS === 'web') Animated.spring(enter, { toValue: 0, useNativeDriver: false, speed: 14, bounciness: 2 }).start();
  }, [enter]);

  const mc = state ? MARKET[state.currency] : undefined;
  const params = { currency: mc ?? 'usd', range };
  const q = useGetMoneroHistory(params, { query: { queryKey: getGetMoneroHistoryQueryKey(params), staleTime: 60000, refetchInterval: 60000, retry: 1, enabled: !!mc } });
  const sp = { currency: mc ?? 'usd' };
  const stats = useGetMoneroStats(sp, { query: { queryKey: getGetMoneroStatsQueryKey(sp), staleTime: 300000, retry: 1, enabled: !!mc } });
  const m = q.data && !q.isError && !q.isPlaceholderData ? q.data : null;
  const sym = currencySymbol(state?.currency ?? 'USD');
  const up = (m?.changePercent ?? 0) >= 0;
  const tone = up ? GREEN : RED;
  const first = m?.points[0]?.price;
  const shown = scrub ?? null;
  const price = shown ? shown.price : m?.price;
  const chg = shown && first !== undefined ? shown.price - first : m?.changeAbsolute ?? 0;
  const pct = shown && first ? ((shown.price - first) / first) * 100 : m?.changePercent ?? 0;
  const sTone = chg >= 0 ? GREEN : RED;
  const desc = t(RANGES.find((r) => r.k === range)!.desc);

  return (
    <Animated.View style={{ flex: 1, backgroundColor: c.background, transform: [{ translateY: enter }], paddingTop: ins.top + 6 }}>
      <View style={st.bar}>
        <Pressable testID="market-back" accessibilityLabel={t('Back')} hitSlop={10} onPress={close} style={st.barBtn}><Feather name="arrow-left" size={22} color={c.foreground} /></Pressable>
        <View style={{ flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
          <MoneroLogo size={24} />
          <Text style={{ fontFamily: F.s, fontSize: 18, color: c.foreground }}>Monero</Text>
          <Text style={{ fontFamily: F.m, fontSize: 14, color: c.mutedForeground }}>XMR</Text>
        </View>
        <View style={st.barBtn} />
      </View>
      <ScrollView contentContainerStyle={{ paddingBottom: ins.bottom + 24 }} showsVerticalScrollIndicator={false}>

      <View style={{ alignItems: 'center', marginTop: 18, minHeight: 104 }}>
        {!mc ? null : m && price !== undefined ? (
          <>
            <Text testID="market-price" adjustsFontSizeToFit numberOfLines={1} style={[st.price, { color: c.foreground }]}>{fmt(price, sym)}</Text>
            <View style={st.chgRow}>
              <Text testID="market-change" style={[st.chg, { color: sTone }]}>{chg >= 0 ? '+' : ''}{fmt(chg, sym)}</Text>
              <View style={[st.pill, { backgroundColor: sTone }]}>
                <Text style={{ fontFamily: F.b, fontSize: 13, color: c.background }}>{pct >= 0 ? '+' : ''}{pct.toFixed(2)}%</Text>
              </View>
            </View>
            <Text style={{ fontFamily: F.m, fontSize: 12.5, color: c.mutedForeground, marginTop: 6 }}>{shown ? stamp(shown.timestamp, range) : desc}</Text>
          </>
        ) : q.isFetching ? (
          <>
            <View style={[st.skel, { width: 220, height: 50, backgroundColor: c.charcoal }]} />
            <View style={[st.skel, { width: 150, height: 20, marginTop: 12, backgroundColor: c.charcoal }]} />
          </>
        ) : null}
      </View>

      <View style={{ height: CHART_H, justifyContent: 'center', marginTop: 8 }} onLayout={(e) => setW(e.nativeEvent.layout.width)}>
        {!mc ? (
          <Text style={[st.msg, { color: c.mutedForeground }]}>{t('Market data isn’t available for {cur}. Switch to USD, EUR or GBP in Preferences.', { cur: state?.currency ?? '' })}</Text>
        ) : m && m.points.length > 1 ? (
          <PriceChart points={m.points} width={w} height={CHART_H} color={tone} onScrub={setScrub} label={t('Monero price over the {range}: {pct}%. Drag to inspect.', { range: desc, pct: m.changePercent.toFixed(2) })} />
        ) : q.isFetching ? (
          <View testID="market-loading" style={[st.skel, { height: 220, marginHorizontal: 16, backgroundColor: c.charcoal }]} />
        ) : (
          <View testID="market-error" style={{ alignItems: 'center', gap: 12 }}>
            <Feather name="wifi-off" size={24} color={c.mutedForeground} />
            <Text style={[st.msg, { color: c.mutedForeground }]}>{t('Market data unavailable right now.')}</Text>
            <Pressable testID="market-page-retry" onPress={() => { tap(); q.refetch(); }} style={[st.retry, { backgroundColor: c.charcoal }]}>
              <Feather name="refresh-cw" size={14} color={c.primary} />
              <Text style={{ fontFamily: F.s, color: c.foreground }}>{t('Retry')}</Text>
            </Pressable>
          </View>
        )}
      </View>

      <View style={st.ranges}>
        {RANGES.map((r) => {
          const on = r.k === range;
          return (
            <Pressable key={r.k} testID={`range-${r.k}`} accessibilityState={{ selected: on }} accessibilityLabel={t(r.desc)} disabled={!mc}
              onPress={() => { tap(); setScrub(null); setRange(r.k); }} style={[st.rangeBtn, on && { backgroundColor: c.charcoal }]}>
              <Text style={{ fontFamily: F.s, fontSize: 14, color: on ? c.foreground : c.mutedForeground }}>{r.label}</Text>
            </Pressable>
          );
        })}
      </View>
      {m?.stale ? <Text testID="market-delayed" style={{ fontFamily: F.r, fontSize: 11.5, color: c.mutedForeground, textAlign: 'center', marginTop: 14 }}>{t('Delayed market data')}</Text> : null}
      {m ? <Text style={{ fontFamily: F.r, fontSize: 11.5, color: c.mutedForeground, textAlign: 'center', marginTop: 8 }}>Source: {m.source}</Text> : null}
      {mc ? <MarketStats data={stats.data && !stats.isError ? stats.data : null} loading={stats.isLoading} sym={sym} /> : null}
      </ScrollView>
    </Animated.View>
  );
}

const CHART_H = 220;

function compact(v: number, sym: string) {
  const a = Math.abs(v);
  const [n, u] = a >= 1e9 ? [a / 1e9, 'B'] : a >= 1e6 ? [a / 1e6, 'M'] : a >= 1e3 ? [a / 1e3, 'K'] : [a, ''];
  return `${sym}${n.toLocaleString('en-US', { maximumFractionDigits: 2 })}${u}`;
}
function xmr(v: number) {
  return `${Math.round(v).toLocaleString('en-US')} XMR`;
}

/** Real figures only; anything the API cannot provide renders as an em dash. */
function MarketStats({ data, loading, sym }: { data: { createdYear: number; marketCap: number | null; circulatingSupply: number | null; totalSupply: number | null; allTimeHigh: number | null; stale: boolean } | null; loading: boolean; sym: string }) {
  const c = useColors();
  const { t } = useLanguage();
  const dash = '\u2014';
  const rows: [string, string, string?][] = [
    [t('Created'), String(data?.createdYear ?? 2014)],
    [t('Market cap'), data?.marketCap != null ? compact(data.marketCap, sym) : dash],
    [t('Circulating supply'), data?.circulatingSupply != null ? xmr(data.circulatingSupply) : dash],
    [t('Total supply'), data?.totalSupply != null ? xmr(data.totalSupply) : t('No fixed cap'), data?.totalSupply == null ? t('Tail emission keeps new XMR flowing at a small, steady rate.') : undefined],
    [t('All-time high'), data?.allTimeHigh != null ? fmt(data.allTimeHigh, sym) : dash],
  ];
  return (
    <View testID="market-stats" style={[st.stats, { backgroundColor: c.card }]}>
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingTop: 14, paddingBottom: 4 }}>
        <Text style={{ fontFamily: F.s, fontSize: 16, color: c.foreground }}>{t('About Monero')}</Text>
        {data?.stale ? <Text style={{ fontFamily: F.m, fontSize: 12, color: c.mutedForeground }}>{t('Delayed')}</Text> : null}
      </View>
      {rows.map(([k, v, sub], i) => (
        <View key={k} testID={`stat-${i}`} style={[st.statRow, i > 0 && { borderTopWidth: 1, borderTopColor: c.background }]}>
          <View style={{ flex: 1 }}>
            <Text style={{ fontFamily: F.m, fontSize: 14.5, color: c.mutedForeground }}>{k}</Text>
            {sub ? <Text style={{ fontFamily: F.r, fontSize: 12, color: c.mutedForeground, marginTop: 2, opacity: 0.8 }}>{sub}</Text> : null}
          </View>
          {loading && i > 0 && i !== 3 ? <View style={[st.skel, { width: 90, height: 16, backgroundColor: c.charcoal }]} /> : (
            <Text style={{ fontFamily: F.s, fontSize: 15, color: c.foreground, fontVariant: ['tabular-nums'] }}>{v}</Text>
          )}
        </View>
      ))}
    </View>
  );
}

const st = StyleSheet.create({
  stats: { marginHorizontal: 16, marginTop: 22, borderRadius: 20, overflow: 'hidden' },
  statRow: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 16, paddingVertical: 13 },
  bar: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 12, minHeight: 48 },
  barBtn: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
  price: { fontFamily: F.b, fontSize: 50, letterSpacing: -1.6, fontVariant: ['tabular-nums'], paddingHorizontal: 20 },
  chgRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 6 },
  chg: { fontFamily: F.s, fontSize: 17, fontVariant: ['tabular-nums'] },
  pill: { paddingHorizontal: 6, paddingVertical: 2, borderRadius: 6 },
  skel: { borderRadius: 12, opacity: 0.8 },
  msg: { fontFamily: F.m, fontSize: 14, textAlign: 'center', paddingHorizontal: 32 },
  retry: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 14, minHeight: 38, borderRadius: 19 },
  ranges: { flexDirection: 'row', justifyContent: 'space-between', paddingHorizontal: 16, marginTop: 12 },
  rangeBtn: { minWidth: 52, height: 36, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
});
