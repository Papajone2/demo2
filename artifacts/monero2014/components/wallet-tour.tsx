import { Feather } from '@expo/vector-icons';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { F, tap, useInsets } from '@/components/ui';
import { msg, useLanguage } from '@/context/LanguageContext';
import { useColors } from '@/hooks/useColors';

export type TourTarget = 'send' | 'receive' | 'sync';
export const TOUR: { target: TourTarget; icon: keyof typeof Feather.glyphMap; title: string; body: string }[] = [
  { target: 'send', icon: 'arrow-up-right', title: msg('Send'), body: msg('Pay an address. You review every detail before it goes.') },
  { target: 'receive', icon: 'arrow-down-left', title: msg('Receive'), body: msg('Show your address or QR code to get paid.') },
  { target: 'sync', icon: 'refresh-cw', title: msg('Sync'), body: msg('Sending unlocks once the wallet is fully synced. Here the sync is simulated.') },
];

const block = { onStartShouldSetResponder: () => true };

/** Transparent touch blocker + bottom card. The dim lives inside the scroll content so the ORIGINAL target can be raised above it. */
export function TourOverlay({ step, onCardHeight, onNext, onBack, onSkip, busy, error }: {
  step: number; onCardHeight?: (h: number) => void; onNext: () => void; onBack: () => void; onSkip: () => void; busy?: boolean; error?: string | null;
}) {
  const c = useColors();
  const ins = useInsets();
  const { t } = useLanguage();
  const s = TOUR[step];
  const last = step === TOUR.length - 1;
  return (
    <View style={StyleSheet.absoluteFill} {...block} testID="tour-overlay">
      <View pointerEvents="box-none" style={[StyleSheet.absoluteFill, { justifyContent: 'flex-end', padding: 14, paddingTop: ins.top + 14, paddingBottom: ins.bottom + 14 }]}>
        <View testID="tour-card" onLayout={(e) => onCardHeight?.(e.nativeEvent.layout.height)} accessibilityViewIsModal style={[st.card, { backgroundColor: '#1B1B1D' }]}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
            <View style={[st.ic, { backgroundColor: c.charcoal }]}><Feather name={s.icon} size={17} color={c.foreground} /></View>
            <Text style={{ fontFamily: F.b, fontSize: 18, color: c.foreground, flex: 1 }}>{t(s.title)}</Text>
            <Text style={{ fontFamily: F.m, fontSize: 12.5, color: c.mutedForeground }}>{t('{a} of {b}', { a: step + 1, b: TOUR.length })}</Text>
          </View>
          <Text style={{ fontFamily: F.r, fontSize: 14.5, lineHeight: 21, color: '#B5B5BA' }}>{t(s.body)}</Text>
          {error ? <Text style={{ fontFamily: F.m, fontSize: 12.5, color: c.destructive }}>{error}</Text> : null}
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
            <Pressable testID="tour-skip" disabled={busy} onPress={() => { tap(); onSkip(); }} hitSlop={8} style={st.ghost}>
              <Text style={{ fontFamily: F.m, color: c.mutedForeground }}>{t('Skip')}</Text>
            </Pressable>
            <View style={{ flex: 1 }} />
            {step > 0 ? (
              <Pressable testID="tour-back" disabled={busy} onPress={() => { tap(); onBack(); }} style={[st.btn, { backgroundColor: c.charcoal }]}>
                <Text style={{ fontFamily: F.s, color: c.foreground }}>{t('Back')}</Text>
              </Pressable>
            ) : null}
            <Pressable testID={last ? 'tour-done' : 'tour-next'} disabled={busy} onPress={() => { tap(); onNext(); }} style={({ pressed }) => [st.btn, { backgroundColor: c.primary, opacity: busy ? 0.6 : 1, transform: [{ scale: pressed ? 0.96 : 1 }] }]}>
              <Text style={{ fontFamily: F.s, color: c.primaryForeground }}>{last ? t('Done') : t('Next')}</Text>
            </Pressable>
          </View>
        </View>
      </View>
    </View>
  );
}

export function TourError({ onRetry, onDismiss }: { onRetry: () => void; onDismiss: () => void }) {
  const c = useColors();
  const ins = useInsets();
  const { t } = useLanguage();
  return (
    <View pointerEvents="box-none" style={[StyleSheet.absoluteFill, { justifyContent: 'flex-end', padding: 14, paddingBottom: ins.bottom + 14 }]}>
      <View testID="tour-error" style={[st.card, { backgroundColor: c.card }]}>
        <Text style={{ fontFamily: F.m, fontSize: 14, color: c.foreground }}>{t('Couldn’t check whether you’ve seen the wallet tour.')}</Text>
        <View style={{ flexDirection: 'row', gap: 8, justifyContent: 'flex-end' }}>
          <Pressable testID="tour-error-dismiss" onPress={onDismiss} style={[st.btn, { backgroundColor: c.charcoal }]}><Text style={{ fontFamily: F.s, color: c.foreground }}>{t('Dismiss')}</Text></Pressable>
          <Pressable testID="tour-error-retry" onPress={onRetry} style={[st.btn, { backgroundColor: c.primary }]}><Text style={{ fontFamily: F.s, color: c.primaryForeground }}>{t('Retry')}</Text></Pressable>
        </View>
      </View>
    </View>
  );
}

const st = StyleSheet.create({
  card: { borderRadius: 22, padding: 16, gap: 12, maxWidth: 520, alignSelf: 'center', width: '100%', shadowColor: '#000', shadowOpacity: 0.5, shadowRadius: 20, shadowOffset: { width: 0, height: 8 }, elevation: 12 },
  ic: { width: 32, height: 32, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  btn: { minHeight: 40, paddingHorizontal: 18, borderRadius: 20, alignItems: 'center', justifyContent: 'center' },
  ghost: { minHeight: 40, paddingHorizontal: 6, justifyContent: 'center' },
});
