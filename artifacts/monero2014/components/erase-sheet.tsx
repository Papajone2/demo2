import { Feather } from '@expo/vector-icons';
import React, { useEffect, useRef, useState } from 'react';
import { Animated, Modal, Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import { Check } from '@/components/setup-parts';
import { F, tap, useInsets } from '@/components/ui';
import { msg, useLanguage } from '@/context/LanguageContext';
import { useColors } from '@/hooks/useColors';

const BODY = msg('There is no way to recover a forgotten PIN or password. You can erase this device\u2019s sandbox wallet and lock, then start over.');

/** Two-step bottom sheet for "Forgot PIN/password". Cancel at any point leaves all data untouched. */
export function EraseSheet({ visible, label, onCancel, onErase }: { visible: boolean; label: string; onCancel: () => void; onErase: () => Promise<void> }) {
  const c = useColors();
  const ins = useInsets();
  const { t } = useLanguage();
  const [step, setStep] = useState<1 | 2>(1);
  const [ack, setAck] = useState(false);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const y = useRef(new Animated.Value(400)).current;
  useEffect(() => {
    if (!visible) return;
    setStep(1); setAck(false); setBusy(false); setErr(null);
    y.setValue(400);
    Animated.spring(y, { toValue: 0, useNativeDriver: Platform.OS !== 'web', speed: 16, bounciness: 2 }).start();
  }, [visible, y]);
  const cancel = () => { if (!busy) { tap(); onCancel(); } };
  const erase = async () => {
    setBusy(true); setErr(null);
    try { await onErase(); } catch { setErr(t('Could not finish erasing storage. Some local data may already have been removed. Try again.')); setBusy(false); }
  };

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={cancel} statusBarTranslucent>
      <Pressable style={st.scrim} onPress={cancel} accessibilityLabel={t('Cancel')} testID="erase-scrim" />
      <Animated.View testID="erase-sheet" accessibilityViewIsModal style={[st.sheet, { backgroundColor: '#161618', paddingBottom: ins.bottom + 18, transform: [{ translateY: y }] }]}>
        <View style={st.grab} />
        {step === 1 ? (
          <>
            <Text style={[st.h, { color: c.inkForeground }]}>{label === 'PIN' ? t('Forgot PIN?') : t('Forgot password?')}</Text>
            <Text testID="erase-body" style={[st.p, { color: '#B0B0B5' }]}>{t(BODY)}</Text>
            <Text style={[st.q, { color: c.inkForeground }]}>{t('Erase everything?')}</Text>
            <Check testID="erase-ack" checked={ack} onToggle={() => setAck((v) => !v)} label={t('I understand this wallet and lock will be removed from this device.')} />
            <Btn testID="erase-continue" label={t('Continue')} danger disabled={!ack} onPress={() => setStep(2)} />
            <Btn testID="erase-cancel" label={t('Cancel')} onPress={cancel} />
          </>
        ) : (
          <>
            <View style={[st.ic, { backgroundColor: 'rgba(255,51,85,0.14)' }]}><Feather name="alert-triangle" size={22} color={c.destructive} /></View>
            <Text style={[st.h, { color: c.inkForeground }]}>{t('This cannot be undone')}</Text>
            <Text style={[st.p, { color: '#B0B0B5' }]}>{t('Erasing is irreversible. Without a backup of your recovery phrase, access to these wallets is lost for good. It does not destroy coins on the network; it removes this device’s copy.')}</Text>
            {err ? <Text testID="erase-error" style={{ fontFamily: F.m, fontSize: 13.5, color: c.destructive }}>{err}</Text> : null}
            <Btn testID="erase-confirm" label={busy ? t('Erasing…') : t('Erase everything')} danger disabled={busy} onPress={erase} />
            <Btn testID="erase-cancel-2" label={t('Cancel')} disabled={busy} onPress={cancel} />
          </>
        )}
      </Animated.View>
    </Modal>
  );
}

function Btn({ label, onPress, danger, disabled, testID }: { label: string; onPress: () => void; danger?: boolean; disabled?: boolean; testID: string }) {
  const c = useColors();
  return (
    <Pressable testID={testID} accessibilityRole="button" accessibilityState={{ disabled }} disabled={disabled} onPress={() => { tap(); onPress(); }}
      style={({ pressed }) => [st.btn, { backgroundColor: danger ? c.destructive : '#232326', opacity: disabled ? 0.4 : 1, transform: [{ scale: pressed ? 0.98 : 1 }] }]}>
      <Text style={{ fontFamily: F.s, fontSize: 16, color: danger ? '#FFFFFF' : c.inkForeground }}>{label}</Text>
    </Pressable>
  );
}

const st = StyleSheet.create({
  scrim: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.6)' },
  sheet: { position: 'absolute', left: 0, right: 0, bottom: 0, borderTopLeftRadius: 28, borderTopRightRadius: 28, paddingHorizontal: 22, paddingTop: 10, gap: 12 },
  grab: { alignSelf: 'center', width: 40, height: 5, borderRadius: 3, backgroundColor: '#3A3A3D', marginBottom: 6 },
  h: { fontFamily: F.b, fontSize: 22, letterSpacing: -0.4 },
  p: { fontFamily: F.r, fontSize: 15, lineHeight: 22 },
  q: { fontFamily: F.s, fontSize: 16, marginTop: 2 },
  ic: { width: 46, height: 46, borderRadius: 23, alignItems: 'center', justifyContent: 'center' },
  btn: { height: 52, borderRadius: 26, alignItems: 'center', justifyContent: 'center' },
});
