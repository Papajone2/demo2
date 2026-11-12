import { IS_NATIVE_ANDROID } from '@/lib/native-engine';
import { Feather } from '@expo/vector-icons';
import { getGetMoneroHistoryQueryKey, type GetMoneroHistoryCurrency } from '@workspace/api-client-react';
import { useMarketHistory as useGetMoneroHistory } from '@/hooks/useMarketData';
import { Image } from 'expo-image';
import { router, useFocusEffect } from 'expo-router';
import React, { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { Animated, type LayoutRectangle, Platform, Pressable, StyleSheet, Text, useWindowDimensions, View } from 'react-native';
import { MarketChart, MoneroLogo } from '@/components/market-chart';
import { WalletAvatar } from '@/components/wallet-avatar';
import { TOUR, TourError, TourOverlay, type TourTarget } from '@/components/wallet-tour';
import { isTutorialDone, markTutorialDone } from '@/lib/tutorial';
import { EmptyState, F, tap, TxRow, useInsets, WalletGate } from '@/components/ui';
import { REQUIRED_CONFIRMATIONS, useWallet } from '@/context/WalletContext';
import { useLanguage } from '@/context/LanguageContext';
import { useColors } from '@/hooks/useColors';
import { ATOMIC_PER_XMR, currencySymbol, formatXmr } from '@/lib/money';

const BG = require('@/assets/images/monero-background.png');
const DIM = 'rgba(0,0,0,0.55)';
const HIDDEN = '••••';
const MARKET: Record<string, GetMoneroHistoryCurrency> = { USD: 'usd', EUR: 'eur', GBP: 'gbp' };

function money(v: number, sym: string) {
  const sign = v < 0 ? '-' : '';
  return `${sign}${sym}${Math.abs(v).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}
function signed(v: number, sym: string) {
  return v >= 0 ? `+${money(v, sym)}` : money(v, sym);
}

function Overview() {
  const c = useColors();
  const ins = useInsets();
  const { state, available, locked, updatePrefs, sync } = useWallet();
  const { t } = useLanguage();
  const { height: winH } = useWindowDimensions();
  const [chartW, setChartW] = useState(0);
  // Content-space layouts cached via onLayout so the tour never waits on async native measurement.
  type L = { actions?: LayoutRectangle; send?: LayoutRectangle; receive?: LayoutRectangle; sync?: LayoutRectangle };
  const [lay, setLay] = useState<L>({});
  const [rootH, setRootH] = useState(0);
  const [cardH, setCardH] = useState(200);
  const setL = (k: keyof L) => (e: { nativeEvent: { layout: LayoutRectangle } }) => {
    const v = e.nativeEvent.layout;
    setLay((o) => { const p = o[k]; return p && p.x === v.x && p.y === v.y && p.width === v.width && p.height === v.height ? o : { ...o, [k]: v }; });
  };
  const scrollRef = useRef<React.ComponentRef<typeof Animated.ScrollView>>(null);
  const [tour, setTour] = useState<'idle' | 'show' | 'error'>('idle');
  const [step, setStep] = useState(0);
  const [tourBusy, setTourBusy] = useState(false);
  const [tourErr, setTourErr] = useState<string | null>(null);
  const wid = state?.id;
  const ready = !!state && !state.needsCustomization;
  const [check, setCheck] = useState(0);
  useFocusEffect(useCallback(() => {
    if (!wid || !ready) return undefined;
    let live = true;
    isTutorialDone(wid).then((d) => { if (live) { setStep(0); setTour(d ? 'idle' : 'show'); } }).catch(() => { if (live) setTour('error'); });
    return () => { live = false; setTour('idle'); setStep(0); setTourErr(null); };
  }, [wid, ready, check]));
  const target: TourTarget | null = tour === 'show' ? TOUR[step].target : null;
  // Target rect in content coords, then the scroll offset that keeps it above the bottom-anchored card.
  const content = (() => {
    if (!target) return null;
    const A = lay.actions;
    const n = target === 'sync' ? lay.sync : lay[target];
    if (!n || (target !== 'sync' && !A)) return null;
    const ox = target === 'sync' ? 0 : A!.x, oy = target === 'sync' ? 0 : A!.y;
    return { x: n.x + ox, y: n.y + oy, w: n.width, h: n.height, r: target === 'sync' ? 20 : 29 };
  })();
  let offset = 0;
  if (content && rootH) {
    const cardTop = rootH - ins.bottom - 14 - cardH;
    const need = content.y + content.h - (cardTop - 16);
    offset = Math.max(0, need);
    if (content.y - offset < ins.top + 8) offset = Math.max(0, content.y - ins.top - 8);
  }
  useLayoutEffect(() => {
    if (tour === 'show' && content) scrollRef.current?.scrollTo({ y: offset, animated: false });
  }, [tour, offset, !!content]); // eslint-disable-line react-hooks/exhaustive-deps
  const finishTour = async () => {
    if (!wid || tourBusy) return;
    setTourBusy(true);
    setTourErr(null);
    try { await markTutorialDone(wid); setTour('idle'); setStep(0); scrollRef.current?.scrollTo({ y: 0, animated: true }); }
    catch { setTourErr(t('Could not save. Try again.')); }
    setTourBusy(false);
  };
  const rise = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    Animated.spring(rise, { toValue: 1, useNativeDriver: Platform.OS !== 'web', speed: 10, bounciness: 4 }).start();
  }, [rise]);

  const mc = state ? MARKET[state.currency] : undefined;
  const params = { currency: mc ?? 'usd' };
  const market = useGetMoneroHistory(params, {
    query: { queryKey: getGetMoneroHistoryQueryKey(params), staleTime: 60000, refetchInterval: 60000, retry: 1, enabled: !!mc },
  });

  if (!state) return null;
  const sym = currencySymbol(state.currency);
  const hide = state.hideBalance;
  const recent = state.txs.slice(0, 3);
  const qty = Number(available) / Number(ATOMIC_PER_XMR);
  const m = mc && market.data && !market.isError ? market.data : null;
  const fiat = qty === 0 ? money(0, sym) : m ? money(qty * m.price, sym) : null;
  const valueChange = m ? qty * m.changeAbsolute : 0;
  const up = (m?.changePercent ?? 0) >= 0;
  const tone = up ? c.success : c.loss;
  const pct = m ? `${up ? '+' : ''}${m.changePercent.toFixed(2)}%` : '';
  const loading = !!mc && market.isLoading;
  const unavailable = !mc || market.isError || (!market.isLoading && !market.data);
  const updated = m ? new Date(m.updatedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '';
  const toggleHide = () => { tap(); updatePrefs({ hideBalance: !hide }).catch(() => {}); };
  const ty = rise.interpolate({ inputRange: [0, 1], outputRange: [18, 0] });

  const touring = tour === 'show';
  const actionsUp = target === 'send' || target === 'receive';
  // Local dim for the non-active action inside the raised row (same 50% gray as the scroll-content dim).
  const localDim = <View pointerEvents="none" style={[StyleSheet.absoluteFill, { backgroundColor: DIM, borderRadius: 29 }]} />;
  const sendBtn = () => (
          <Pressable testID="go-send" disabled={touring} onPress={() => { tap(); router.push('/send'); }} style={({ pressed }) => [st.action, { backgroundColor: c.primary, transform: [{ scale: pressed ? 0.97 : 1 }] }]}>
            <Feather name="arrow-up-right" size={19} color={c.primaryForeground} />
            <Text style={[st.actionTxt, { color: c.primaryForeground, fontSize: 21 }]}>{t('Send')}</Text>
          </Pressable>
  );
  const receiveBtn = () => (
          <Pressable testID="go-receive" disabled={touring} onPress={() => { tap(); router.push('/receive'); }} style={({ pressed }) => [st.action, { backgroundColor: c.charcoal, transform: [{ scale: pressed ? 0.97 : 1 }] }]}>
            <Feather name="arrow-down-left" size={19} color={c.foreground} />
            <Text style={[st.actionTxt, { color: c.foreground }]}>{t('Receive')}</Text>
          </Pressable>
  );
  const syncBody = () => (
    <>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
            <Feather name={sync.complete ? 'check-circle' : 'refresh-cw'} size={16} color={sync.complete ? c.success : c.primary} />
            <Text style={{ fontFamily: F.s, fontSize: 16, color: c.foreground, flex: 1 }}>{sync.complete ? t('Synced') : t('Syncing')}</Text>
            <Text testID="sync-status" style={[st.num, { fontSize: 13, color: c.mutedForeground }]}>{sync.complete ? '100%' : IS_NATIVE_ANDROID ? `${Math.round(sync.progress * 100)}%` : `${Math.round(sync.progress * 100)}% \u00b7 ~${sync.remainingSeconds}s`}</Text>
            <View style={[st.tag, { backgroundColor: c.secondary }]}><Text style={{ fontFamily: F.s, fontSize: 11, color: c.mutedForeground }}>{IS_NATIVE_ANDROID ? state.network === 'mainnet' ? 'Mainnet' : 'Stagenet' : t('Preview')}</Text></View>
          </View>
          <View style={[st.track, { backgroundColor: c.secondary }]} accessibilityRole="progressbar" accessibilityValue={{ min: 0, max: 100, now: Math.round(sync.progress * 100) }}>
            <View style={{ width: `${Math.min(100, sync.progress * 100)}%`, height: '100%', borderRadius: 3, backgroundColor: sync.complete ? c.success : c.primary }} />
          </View>
          {!sync.complete ? <Text style={{ fontFamily: F.r, fontSize: 12.5, color: c.mutedForeground }}>{t('Fully sync before sending.')}</Text> : null}
          <View style={st.balGrid}>
            <View style={[st.balCell, { backgroundColor: c.charcoal }]}>
              <Text style={st.balK}>{t('Spendable')}</Text>
              <Text testID="sync-spendable" numberOfLines={1} style={[st.num, { fontSize: 15, color: c.foreground }]}>{hide ? HIDDEN : `${formatXmr(available, 4, 4)} XMR`}</Text>
              {!hide && m ? <Text style={[st.num, { fontSize: 12, color: c.mutedForeground }]}>{money(qty * m.price, sym)}</Text> : null}
            </View>
            <View style={[st.balCell, { backgroundColor: c.charcoal }]}>
              <Text style={st.balK}>{t('Pending')}</Text>
              <Text testID="sync-pending" numberOfLines={1} style={[st.num, { fontSize: 15, color: locked > BigInt(0) ? c.warn : c.foreground }]}>{hide ? HIDDEN : `${formatXmr(locked, 4, 4)} XMR`}</Text>
              <Text style={{ fontFamily: F.r, fontSize: 11.5, color: c.mutedForeground }}>{t('Spendable after {n} confirmations', { n: REQUIRED_CONFIRMATIONS })}</Text>
            </View>
          </View>
    </>
  );

  return (
    <View onLayout={(e) => setRootH(e.nativeEvent.layout.height)} style={{ flex: 1, backgroundColor: '#000000' }}>
      <Animated.ScrollView
        ref={scrollRef}
        style={{ flex: 1 }}
        scrollEnabled={tour !== 'show'}
        contentContainerStyle={{ minHeight: rootH || winH, paddingTop: ins.top + 6, paddingBottom: ins.bottom + (tour === 'show' ? cardH + 60 : 32), paddingHorizontal: 20 }}>
        {/* Wallpaper is part of the scrolling content, so it moves up together with it. */}
        <View pointerEvents="none" style={{ position: 'absolute', top: 0, left: 0, right: 0, height: winH }}>
          <Image source={BG} style={StyleSheet.absoluteFill} contentFit="cover" />
        </View>
        <View style={st.top}>
          <Pressable testID="home-avatar" accessibilityLabel={t('Accounts')} onPress={() => { tap(); router.push('/accounts'); }} hitSlop={6}>
            <WalletAvatar id={state.iconId} size={44} framed />
          </Pressable>
          <Pressable testID="wallet-menu" accessibilityLabel={t('Switch account')} onPress={() => { tap(); router.push('/accounts'); }} style={st.walletBtn} hitSlop={8}>
            <Text numberOfLines={1} style={{ fontFamily: F.s, fontSize: 17, color: c.foreground, flexShrink: 1 }}>{state.name === 'Test wallet' ? t('Monero Wallet') : state.name}</Text>
            <Feather name="chevron-down" size={17} color={c.mutedForeground} />
          </Pressable>
          <Pressable testID="go-settings" accessibilityLabel={t('Settings')} onPress={() => { tap(); router.push('/settings'); }} hitSlop={8} style={st.iconBtn}>
            <Feather name="settings" size={23} color={c.foreground} />
          </Pressable>
        </View>

        <Animated.View style={{ opacity: rise, transform: [{ translateY: ty }], alignItems: 'center', marginTop: 48 }}>
          <Pressable testID="toggle-hide" accessibilityLabel={hide ? t('Show balance') : t('Hide balance')} onPress={toggleHide} style={[{ alignItems: 'center', minHeight: 90, borderRadius: 20, paddingHorizontal: 12, paddingVertical: 4, borderWidth: 2, borderColor: 'transparent' }]}>
            {loading && !hide ? (
              <View style={[st.skel, { width: 230, height: 54, backgroundColor: c.charcoal }]} />
            ) : (
              <Text testID="fiat-total" adjustsFontSizeToFit numberOfLines={1} style={[st.fiat, st.shadow, { color: c.foreground }]}>
                {hide ? `${sym}${HIDDEN}` : fiat ?? `${sym}—`}
              </Text>
            )}
            {hide ? (
              <Text style={[st.gainTxt, st.shadow, { color: c.mutedForeground, marginTop: 10 }]}>{HIDDEN}</Text>
            ) : m ? (
              <View style={st.gainRow}>
                <Feather name={up ? 'trending-up' : 'trending-down'} size={16} color={tone} />
                <Text style={[st.gainTxt, st.shadow, { color: tone }]}>{signed(valueChange, sym)}</Text>
                <View style={[st.pct, { backgroundColor: up ? c.successSoft : 'rgba(255,51,85,0.14)' }]}>
                  <Text style={[st.shadow, { fontFamily: F.s, fontSize: 15, color: tone }]}>{pct}</Text>
                </View>
              </View>
            ) : loading ? (
              <View style={[st.skel, { width: 160, height: 22, marginTop: 12, backgroundColor: c.charcoal }]} />
            ) : null}
          </Pressable>
        </Animated.View>

        <View style={[st.actions, actionsUp && st.raised]} onLayout={setL('actions')}>
          <View onLayout={setL('send')} style={st.actionWrap}>
          {sendBtn()}
          {target === 'receive' ? localDim : null}
          </View>
          <View onLayout={setL('receive')} style={st.actionWrap}>
          {receiveBtn()}
          {target === 'send' ? localDim : null}
          </View>
        </View>

        <Pressable testID="open-market" accessibilityLabel={t('Monero price details')} onPress={() => { tap(); router.push('/market'); }} style={({ pressed }) => [st.card, { backgroundColor: c.card, opacity: pressed ? 0.85 : 1 }]}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 16 }}>
            <MoneroLogo size={38} />
            <View style={{ flex: 1 }}>
              <Text style={{ fontFamily: F.s, fontSize: 17, color: c.foreground }}>Monero</Text>
              <Text style={{ fontFamily: F.r, fontSize: 13.5, color: c.mutedForeground }}>XMR</Text>
            </View>
            <View style={{ alignItems: 'flex-end' }}>
              <Text style={[st.num, { fontSize: 17, color: c.foreground }]}>{hide ? HIDDEN : formatXmr(available, 4, 4)}</Text>
              <Text style={[st.num, { fontSize: 13.5, color: c.mutedForeground }]}>{hide ? HIDDEN : fiat ?? '—'}</Text>
            </View>
          </View>
          <View style={st.profit}>
            <Text style={{ fontFamily: F.r, fontSize: 13.5, color: c.mutedForeground, flex: 1 }}>
              {t('24h change')}{m?.stale ? ` · ${t('Delayed')}` : ''}
            </Text>
            {m && !hide ? (
              <>
                <Feather name={up ? 'trending-up' : 'trending-down'} size={13} color={tone} />
                <Text style={[st.num, { fontSize: 14, color: tone }]}>{signed(m.changeAbsolute, sym)}</Text>
                <Text style={[st.num, { fontSize: 14, color: tone, marginLeft: 8 }]}>{pct}</Text>
              </>
            ) : hide ? (
              <Text style={[st.num, { fontSize: 14, color: c.mutedForeground }]}>{HIDDEN}</Text>
            ) : null}
          </View>
          <View onLayout={(e) => setChartW(e.nativeEvent.layout.width)} style={{ marginTop: 6, minHeight: 64, justifyContent: 'center' }}>
            {m ? (
              <MarketChart
                points={m.points}
                width={chartW}
                label={t('Monero price over the last 24 hours: {pct}, updated {time}', { pct, time: updated })}
              />
            ) : loading ? (
              <View style={[st.skel, { height: 52, marginHorizontal: 16, backgroundColor: c.charcoal }]} />
            ) : unavailable ? (
              <View style={st.unavail}>
                <Text style={{ fontFamily: F.m, fontSize: 13, color: c.mutedForeground, flex: 1 }}>
                  {mc ? t('Market data unavailable') : t('Market data unavailable for {cur}', { cur: state.currency })}
                </Text>
                {mc ? (
                  <Pressable testID="market-retry" onPress={() => { tap(); market.refetch(); }} hitSlop={10} style={[st.retry, { backgroundColor: c.charcoal }]}>
                    <Feather name="refresh-cw" size={13} color={c.primary} />
                    <Text style={{ fontFamily: F.s, fontSize: 13, color: c.foreground }}>{t('Retry')}</Text>
                  </Pressable>
                ) : null}
              </View>
            ) : null}
          </View>
        </Pressable>
        {m ? (
          <Text style={{ fontFamily: F.r, fontSize: 11, color: c.mutedForeground, marginTop: 8, textAlign: 'right' }}>
            {t('Updated {time}', { time: updated })}{m.stale ? ` · ${t('Delayed')}` : ''}
          </Text>
        ) : null}

        <View style={st.recentHead}>
          <Text style={{ fontFamily: F.s, fontSize: 19, color: c.foreground }}>{t('Recent Activity')}</Text>
          <Pressable testID="see-all" onPress={() => router.push('/activity')} hitSlop={10} style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
            <Text style={{ fontFamily: F.s, color: c.foreground, fontSize: 15 }}>{t('See all')}</Text>
            <Feather name="arrow-right" size={15} color={c.foreground} />
          </Pressable>
        </View>
        <View style={{ marginTop: 12 }}>
          {recent.length ? recent.map((t) => <TxRow key={t.id} tx={t} />) : (
            <View style={{ backgroundColor: c.card, borderRadius: 20 }}>
              <EmptyState icon="inbox" title={t('No activity yet')} body={t('Incoming and outgoing transfers will appear here.')} />
            </View>
          )}
        </View>

        <View onLayout={setL('sync')} testID="sync-section" style={[st.syncCard, { backgroundColor: c.card }, target === 'sync' && st.raised]}>
          {syncBody()}
        </View>
        {/* Scroll-content dim: absolute sibling above every normal sibling; only the raised original target sits above it. */}
        {touring ? <View testID="tour-dim" onStartShouldSetResponder={() => true} style={[StyleSheet.absoluteFill, { backgroundColor: DIM, zIndex: 10 }]} /> : null}
      </Animated.ScrollView>
      {tour === 'show' ? (
        <TourOverlay step={step} onCardHeight={(h) => setCardH((o) => (Math.abs(o - h) < 0.5 ? o : h))} busy={tourBusy} error={tourErr} onBack={() => setStep((n) => Math.max(0, n - 1))} onSkip={finishTour}
          onNext={() => (step === TOUR.length - 1 ? finishTour() : setStep(step + 1))} />
      ) : tour === 'error' ? (
        <TourError onRetry={() => { setTour('idle'); setCheck((n) => n + 1); }} onDismiss={() => setTour('idle')} />
      ) : null}

    </View>
  );
}

export default function WalletScreen() {
  return (
    <WalletGate>
      <Overview />
    </WalletGate>
  );
}

const st = StyleSheet.create({
  top: { flexDirection: 'row', alignItems: 'center', minHeight: 48 },
  walletBtn: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, minHeight: 44, paddingHorizontal: 8 },
  iconBtn: { width: 44, height: 44, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  fiat: { fontFamily: F.b, fontSize: 54, letterSpacing: -1.8, fontVariant: ['tabular-nums'] },
  skel: { borderRadius: 12, opacity: 0.8 },
  gainRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 10 },
  gainTxt: { fontFamily: F.b, fontSize: 19, fontVariant: ['tabular-nums'] },
  pct: { marginLeft: 8, paddingHorizontal: 10, paddingVertical: 4, borderRadius: 8 },
  actions: { flexDirection: 'row', gap: 12, marginTop: 36 },
  action: { height: 58, borderRadius: 29, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10 },
  actionTxt: { fontFamily: F.b, fontSize: 19 },
  card: { borderRadius: 20, paddingTop: 14, marginTop: 22, overflow: 'hidden' },
  num: { fontFamily: F.s, fontVariant: ['tabular-nums'] },
  profit: { flexDirection: 'row', alignItems: 'center', gap: 5, marginTop: 14, paddingHorizontal: 16 },
  unavail: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 16, paddingBottom: 14 },
  retry: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 12, minHeight: 36, borderRadius: 18 },
  shadow: { textShadowColor: 'rgba(0,0,0,0.85)', textShadowOffset: { width: 0, height: 2 }, textShadowRadius: 16 },
  syncCard: { borderRadius: 20, padding: 16, gap: 10, marginTop: 24 },
  track: { height: 6, borderRadius: 3, overflow: 'hidden' },
  balGrid: { flexDirection: 'row', gap: 8 },
  balCell: { flex: 1, borderRadius: 14, padding: 12, gap: 3 },
  actionWrap: { flexGrow: 1, flexShrink: 1, flexBasis: 0, minWidth: 0 },
  tag: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 8 },
  balRow: { flexDirection: 'row', alignItems: 'center', borderTopWidth: 1.5, paddingTop: 10 },
  balK: { fontFamily: F.m, fontSize: 13, color: '#A9A9AE' },
  raised: { zIndex: 20 },
  recentHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 28 },
});
