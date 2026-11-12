import { Feather } from '@expo/vector-icons';
import React, { useState } from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Group } from '@/components/account-ui';
import { F, tap, useInsets } from '@/components/ui';
import { useLanguage } from '@/context/LanguageContext';
import { useColors } from '@/hooks/useColors';
import { type LanguageCode, SUPPORTED_LANGUAGES } from '@/lib/languages';

/** Renders "[accent]" segments of translated copy in the given color. */
export function accent(text: string, color: string) {
  return text.split(/(\[[^\]]+\])/).filter(Boolean).map((part, i) =>
    part.startsWith('[') && part.endsWith(']')
      ? <Text key={i} style={{ color }}>{part.slice(1, -1)}</Text>
      : <React.Fragment key={i}>{part}</React.Fragment>);
}

function useChoose() {
  const { setLanguage, t } = useLanguage();
  const [err, setErr] = useState<string | null>(null);
  const choose = async (code: LanguageCode) => {
    tap();
    setErr(null);
    try { await setLanguage(code); return true; }
    catch { setErr(t('Could not save your choice. It applies until the app restarts.')); return false; }
  };
  return { choose, err };
}

/** Plain list of languages in native names; used by Settings › General › Language. */
export function LanguageList() {
  const c = useColors();
  const { language } = useLanguage();
  const { choose, err } = useChoose();
  return (
    <View style={{ gap: 12 }}>
      <Group>
        {SUPPORTED_LANGUAGES.map((l) => {
          const on = l.code === language;
          return (
            <Pressable key={l.code} testID={`language-option-${l.code}`} accessibilityRole="radio" accessibilityState={{ selected: on }}
              onPress={() => choose(l.code)} style={({ pressed }) => [st.row, pressed && { backgroundColor: c.secondary }]}>
              <Text style={{ flex: 1, fontFamily: on ? F.s : F.m, fontSize: 16, color: c.foreground }}>{l.name}</Text>
              {on ? <Feather name="check" size={18} color={c.foreground} /> : null}
            </Pressable>
          );
        })}
      </Group>
      {err ? <Text testID="language-error" style={{ fontFamily: F.m, fontSize: 13, color: c.destructive }}>{err}</Text> : null}
    </View>
  );
}

/** Small globe + native name + chevron. Opens a quiet bottom sheet. */
export function LanguageButton() {
  const c = useColors();
  const ins = useInsets();
  const { language, languageName, t } = useLanguage();
  const { choose, err } = useChoose();
  const [open, setOpen] = useState(false);
  return (
    <>
      <Pressable testID="language-selector" accessibilityRole="button" accessibilityLabel={t('Language')} accessibilityValue={{ text: languageName }}
        onPress={() => { tap(); setOpen(true); }} hitSlop={8} style={({ pressed }) => [st.btn, { opacity: pressed ? 0.6 : 1 }]}>
        <Feather name="globe" size={15} color="#C7C7CC" />
        <Text testID="language-current" style={{ fontFamily: F.m, fontSize: 14, color: '#E5E5EA' }}>{languageName}</Text>
        <Feather name="chevron-down" size={15} color="#8E8E93" />
      </Pressable>
      <Modal visible={open} transparent animationType="fade" onRequestClose={() => setOpen(false)} statusBarTranslucent>
        <Pressable style={st.scrim} onPress={() => setOpen(false)} accessibilityLabel={t('Close')} />
        <View testID="language-sheet" accessibilityViewIsModal style={[st.sheet, { paddingBottom: ins.bottom + 14 }]}>
          <View style={st.grab} />
          <Text style={{ fontFamily: F.b, fontSize: 19, color: c.inkForeground, marginBottom: 6, paddingHorizontal: 6 }}>{t('Language')}</Text>
          <ScrollView style={{ maxHeight: 460 }}>
            {SUPPORTED_LANGUAGES.map((l) => {
              const on = l.code === language;
              return (
                <Pressable key={l.code} testID={`language-option-${l.code}`} accessibilityRole="radio" accessibilityState={{ selected: on }}
                  onPress={async () => { if (await choose(l.code)) setOpen(false); }}
                  style={({ pressed }) => [st.opt, { backgroundColor: pressed ? '#232326' : on ? '#1D1D20' : 'transparent' }]}>
                  <Text style={{ flex: 1, fontFamily: on ? F.s : F.m, fontSize: 16, color: c.inkForeground }}>{l.name}</Text>
                  {on ? <Feather name="check" size={18} color={c.inkForeground} /> : null}
                </Pressable>
              );
            })}
          </ScrollView>
          {err ? <Text testID="language-error" accessibilityRole="alert" style={{ fontFamily: F.m, fontSize: 13, color: c.destructive, paddingHorizontal: 6, paddingTop: 8 }}>{err}</Text> : null}
        </View>
      </Modal>
      {err && !open ? <Text testID="language-error" style={{ position: 'absolute', top: 40, right: 0, width: 220, textAlign: 'right', fontFamily: F.m, fontSize: 12, color: c.destructive }}>{err}</Text> : null}
    </>
  );
}

const st = StyleSheet.create({
  btn: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingVertical: 8, paddingHorizontal: 12, borderRadius: 999, backgroundColor: 'rgba(28,28,30,0.72)' },
  scrim: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.6)' },
  sheet: { position: 'absolute', left: 0, right: 0, bottom: 0, backgroundColor: '#161618', borderTopLeftRadius: 28, borderTopRightRadius: 28, paddingHorizontal: 16, paddingTop: 10, gap: 4 },
  grab: { alignSelf: 'center', width: 40, height: 5, borderRadius: 3, backgroundColor: '#3A3A3D', marginBottom: 8 },
  opt: { flexDirection: 'row', alignItems: 'center', minHeight: 50, paddingHorizontal: 14, borderRadius: 14 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 14, paddingHorizontal: 18, minHeight: 54 },
});
