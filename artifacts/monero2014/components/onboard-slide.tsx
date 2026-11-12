import { Image } from 'expo-image';
import React, { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { F, tap, useInsets } from '@/components/ui';
import { useLanguage } from '@/context/LanguageContext';
import { useColors } from '@/hooks/useColors';

const BG = require('@/assets/images/welcome-background.png');

/**
 * Shared onboarding slide. Every slide uses identical geometry computed only from
 * the screen box: the headline+body group is vertically centred, then dots,
 * Continue pill and footer sit below. Only the copy changes.
 */
export function OnboardSlide({ testID, title, body, active, onDot, onNext, topRight }: {
  testID: string; title: React.ReactNode; body: string; active: number;
  onDot: (i: number) => void; onNext: () => void; topRight?: React.ReactNode;
}) {
  const c = useColors();
  const ins = useInsets();
  const { t } = useLanguage();
  const [box, setBox] = useState({ w: 0, h: 0 });
  const { w, h } = box;

  const fs = Math.min(w * 0.1, h * 0.046);
  const lh = fs * 1.13;
  const bfs = Math.min(w * 0.045, 21);
  const blh = bfs * 1.45;
  const btnH = Math.max(52, Math.min(h * 0.071, 76));
  const footY = Math.min(h * 0.92, h - ins.bottom - 22);
  const btnY = Math.min(h * 0.8, footY - btnH - 26);
  const dotsY = Math.min(h * 0.737, btnY - 34);
  const groupH = lh * 2 + 16 + blh * 3;
  const headY = Math.min((h - groupH) / 2, dotsY - 24 - groupH);
  const bodyY = headY + lh * 2 + 16;

  return (
    <View testID={testID} style={{ flex: 1, backgroundColor: '#0B0B0B' }} onLayout={(e) => setBox({ w: e.nativeEvent.layout.width, h: e.nativeEvent.layout.height })}>
      <Image source={BG} style={StyleSheet.absoluteFill} contentFit="cover" contentPosition="top" />
      {w > 0 ? (
        <>
          <View style={{ position: 'absolute', top: headY, left: 16, right: 16, height: lh * 2, justifyContent: 'flex-end' }}>
            <Text accessibilityRole="header" adjustsFontSizeToFit numberOfLines={2} style={[st.head, { fontSize: fs, lineHeight: lh }]}>{title}</Text>
          </View>
          <View style={{ position: 'absolute', top: bodyY, left: 22, right: 22, height: blh * 3 }}>
            <Text adjustsFontSizeToFit numberOfLines={3} style={[st.body, { fontSize: bfs, lineHeight: blh }]}>{body}</Text>
          </View>

          <View style={[st.dots, { top: dotsY - 6 }]}>
            {[0, 1, 2].map((i) => (
              <Pressable key={i} testID={`onboard-dot-${i + 1}`} accessibilityRole="button" accessibilityLabel={t('Go to page {n} of 3', { n: i + 1 })} accessibilityState={{ selected: i === active }} disabled={i === active} onPress={() => { tap(); onDot(i); }} hitSlop={6} style={st.dotHit}>
                <View style={[st.dot, { backgroundColor: i === active ? c.primary : '#3A3A3C' }]} />
              </Pressable>
            ))}
          </View>

          <Pressable testID="onboard-next" accessibilityRole="button" accessibilityLabel={t('Continue')} onPress={() => { tap(); onNext(); }}
            style={({ pressed }) => [st.btn, { top: btnY, left: w * 0.07, width: w * 0.86, height: btnH, borderRadius: btnH / 2, backgroundColor: c.primary, shadowColor: c.primary, transform: [{ scale: pressed ? 0.98 : 1 }] }]}>
            <Text style={{ fontFamily: F.s, fontSize: Math.min(w * 0.051, 24), color: '#FFFFFF' }}>{t('Continue')}</Text>
          </Pressable>

          <View style={[st.foot, { top: footY - 10, left: w * 0.07, width: w * 0.86 }]}>
            <View style={st.rule} />
            <Text testID="onboard-footer" style={{ fontFamily: F.m, fontSize: Math.min(w * 0.034, 16), color: '#9A9A9A' }}>{t('Made by monero2014.com')}</Text>
            <View style={st.rule} />
          </View>
          {topRight ? <View style={{ position: 'absolute', top: ins.top + 10, right: 16 }}>{topRight}</View> : null}
        </>
      ) : null}
    </View>
  );
}

const st = StyleSheet.create({
  head: { fontFamily: F.b, color: '#FFFFFF', textAlign: 'center', letterSpacing: -0.6 },
  body: { fontFamily: F.r, color: '#A9A9AE', textAlign: 'center' },
  dots: { position: 'absolute', left: 0, right: 0, flexDirection: 'row', justifyContent: 'center', gap: 4 },
  dotHit: { width: 27, height: 23, alignItems: 'center', justifyContent: 'center' },
  dot: { width: 11, height: 11, borderRadius: 6 },
  btn: { position: 'absolute', flexDirection: 'row', alignItems: 'center', justifyContent: 'center', shadowOpacity: 0.45, shadowRadius: 18, shadowOffset: { width: 0, height: 4 }, elevation: 10 },
  foot: { position: 'absolute', flexDirection: 'row', alignItems: 'center', gap: 14, height: 20 },
  rule: { flex: 1, height: 1, backgroundColor: '#2A2A2C' },
});
