import React, { useMemo, useState } from 'react';
import { PanResponder, View } from 'react-native';
import Svg, { Circle, Defs, Line, LinearGradient, Path, Stop } from 'react-native-svg';
import type { MoneroHistoryPoint } from '@workspace/api-client-react';
import { useColors } from '@/hooks/useColors';

/** Simple flat Monero mark for compact surfaces. */
export function MoneroLogo({ size = 44 }: { size?: number }) {
  const c = useColors();
  return (
    <Svg width={size} height={size} viewBox="-1 -1 26 26" accessibilityLabel="Monero">
      <Circle cx="12" cy="12" r="12" fill={c.primaryForeground} />
      <Path fill={c.primary} d="M12 0C5.365 0 0 5.373 0 12.015c0 1.335.228 2.607.618 3.81h3.577V5.729L12 13.545l7.805-7.815v10.095h3.577c.389-1.203.618-2.475.618-3.81C24 5.375 18.635 0 12 0z" />
      <Path fill="#4C4C4C" d="m10.212 15.307-3.417-3.421v6.351H1.758C3.87 21.689 7.678 24 12 24s8.162-2.311 10.245-5.764h-5.04v-6.351l-3.386 3.421-1.788 1.79-1.814-1.79h-.005z" />
    </Svg>
  );
}

/** Observed prices plotted by timestamp (not index), straight segments, no smoothing. */
export function MarketChart({ points, width, height = 64, label }: { points: MoneroHistoryPoint[]; width: number; height?: number; label: string }) {
  const c = useColors();
  if (width <= 0 || points.length < 2) return <View style={{ height }} />;
  const t0 = points[0].timestamp;
  const t1 = points[points.length - 1].timestamp;
  const span = Math.max(1, t1 - t0);
  let lo = Infinity;
  let hi = -Infinity;
  for (const p of points) { lo = Math.min(lo, p.price); hi = Math.max(hi, p.price); }
  const range = hi - lo || 1;
  const pad = 4;
  const xy = points.map((p) => [((p.timestamp - t0) / span) * width, pad + (1 - (p.price - lo) / range) * (height - pad * 2)]);
  const line = xy.map(([x, y], i) => `${i ? 'L' : 'M'}${x.toFixed(1)},${y.toFixed(1)}`).join(' ');
  const area = `${line} L${width},${height} L0,${height} Z`;
  return (
    <View accessible accessibilityRole="image" accessibilityLabel={label}>
      <Svg width={width} height={height}>
        <Defs>
          <LinearGradient id="mfill" x1="0" y1="0" x2="0" y2="1">
            <Stop offset="0" stopColor={c.primary} stopOpacity={0.4} />
            <Stop offset="1" stopColor={c.primary} stopOpacity={0} />
          </LinearGradient>
        </Defs>
        <Path d={area} fill="url(#mfill)" />
        <Path d={line} stroke={c.primary} strokeWidth={2} fill="none" strokeLinejoin="round" strokeLinecap="round" />
      </Svg>
    </View>
  );
}

/** Full-width interactive price line. Touch/drag to scrub; reports the point under the finger. */
export function PriceChart({ points, width, height = 260, color, onScrub, label }: {
  points: MoneroHistoryPoint[]; width: number; height?: number; color: string; label: string;
  onScrub: (p: MoneroHistoryPoint | null) => void;
}) {
  const c = useColors();
  const [idx, setIdx] = useState<number | null>(null);
  const geo = useMemo(() => {
    if (width <= 0 || points.length < 2) return null;
    const t0 = points[0].timestamp;
    const span = Math.max(1, points[points.length - 1].timestamp - t0);
    let lo = Infinity, hi = -Infinity;
    for (const p of points) { lo = Math.min(lo, p.price); hi = Math.max(hi, p.price); }
    const r = hi - lo || 1;
    const pad = 12;
    const xy = points.map((p) => [pad + ((p.timestamp - t0) / span) * Math.max(1, width - pad * 2), pad + (1 - (p.price - lo) / r) * (height - pad * 2)] as const);
    return { xy, d: xy.map(([x, y], i) => `${i ? 'L' : 'M'}${x.toFixed(1)},${y.toFixed(1)}`).join(' ') };
  }, [points, width, height]);
  const ref = React.useRef({ geo, onScrub, points });
  ref.current = { geo, onScrub, points };
  const pan = useMemo(() => {
    const pick = (x: number) => {
      const g = ref.current.geo;
      if (!g) return;
      let best = 0;
      for (let i = 1; i < g.xy.length; i++) if (Math.abs(g.xy[i][0] - x) < Math.abs(g.xy[best][0] - x)) best = i;
      setIdx(best);
      ref.current.onScrub(ref.current.points[best]);
    };
    const end = () => { setIdx(null); ref.current.onScrub(null); };
    return PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: (_, g) => Math.abs(g.dx) > Math.abs(g.dy),
      onPanResponderGrant: (e) => pick(e.nativeEvent.locationX),
      onPanResponderMove: (e) => pick(e.nativeEvent.locationX),
      onPanResponderRelease: end,
      onPanResponderTerminate: end,
    });
  }, []);
  if (!geo) return <View style={{ height }} />;
  const last = geo.xy[geo.xy.length - 1];
  const sel = idx !== null ? geo.xy[idx] : null;
  return (
    <View testID="market-chart" accessible accessibilityRole="adjustable" accessibilityLabel={label} {...pan.panHandlers}>
      <Svg width={width} height={height} pointerEvents="none">
        <Path d={geo.d} stroke={color} strokeWidth={2.4} fill="none" strokeLinejoin="round" strokeLinecap="round" opacity={sel ? 0.55 : 1} />
        {sel ? (
          <>
            <Line x1={sel[0]} x2={sel[0]} y1={0} y2={height} stroke={c.mutedForeground} strokeWidth={1} strokeDasharray="3 4" />
            <Circle cx={sel[0]} cy={sel[1]} r={6} fill={color} stroke={c.background} strokeWidth={2} />
          </>
        ) : (
          <>
            <Circle cx={last[0]} cy={last[1]} r={9} fill={color} opacity={0.25} />
            <Circle cx={last[0]} cy={last[1]} r={4.5} fill={color} />
          </>
        )}
      </Svg>
    </View>
  );
}
