import { Feather } from '@expo/vector-icons';
import { Image } from 'expo-image';
import React from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { tap } from '@/components/ui';
import { useColors } from '@/hooks/useColors';
// License text for these assets is preserved in lib/fluent-avatars.ts and assets.
import { FLUENT_AVATARS } from '@/lib/fluent-avatars';
import type { AvatarId } from '@/lib/wallet-model';

const LOGO = require('@/assets/images/monero-premium.png');
const BY_ID = new Map<string, (typeof FLUENT_AVATARS)[number]>(FLUENT_AVATARS.map((a) => [a.id, a]));
const PICKABLE: { id: AvatarId; label: string }[] = [
  ...FLUENT_AVATARS.map((a) => ({ id: a.id as AvatarId, label: a.label })),
  { id: 'monero', label: 'Monero' },
];

export function avatarLabel(id: AvatarId) {
  return id === 'monero' ? 'Monero' : BY_ID.get(id)?.label ?? 'Avatar';
}

/** Fluent 3D emoji (or the Monero mark) inside a subtle translucent grey circle. */
export function WalletAvatar({ id, size = 44, framed = true }: { id: AvatarId; size?: number; framed?: boolean; fallback?: string }) {
  if (id === 'monero' || !BY_ID.get(id)) {
    // Circular crop of the existing logo: the coin spans ~68% of the asset, so scale it up and clip away the dark glow.
    const big = size / 0.66;
    return (
      <View style={{ width: size, height: size, borderRadius: size / 2, overflow: 'hidden', alignItems: 'center', justifyContent: 'center' }}>
        <Image source={LOGO} style={{ width: big, height: big }} contentFit="contain" accessibilityLabel="Monero avatar" />
      </View>
    );
  }
  const src = BY_ID.get(id)!.source;
  const inner = size * 0.68;
  const img = <Image source={src} style={{ width: inner, height: inner }} contentFit="contain" accessibilityLabel={`${avatarLabel(id)} avatar`} />;
  if (!framed) return img;
  return <View style={[st.frame, { width: size, height: size, borderRadius: size / 2 }]}>{img}</View>;
}

export function AvatarPicker({ value, onChange }: { value: AvatarId; onChange: (id: AvatarId) => void }) {
  const c = useColors();
  return (
    <View style={{ gap: 12 }}>
    <View style={st.grid}>
      {PICKABLE.map(({ id, label }) => {
        const on = id === value;
        return (
          <Pressable key={id} testID={`avatar-${id}`} accessibilityLabel={label} accessibilityState={{ selected: on }}
            onPress={() => { tap(); onChange(id); }}
            style={({ pressed }) => [st.cell, { borderColor: on ? c.primary : 'transparent', transform: [{ scale: pressed ? 0.92 : 1 }] }]}>
            <WalletAvatar id={id} size={52} />
            {on ? <View style={[st.check, { backgroundColor: c.primary }]}><Feather name="check" size={10} color={c.primaryForeground} /></View> : null}
          </Pressable>
        );
      })}
    </View>
    </View>
  );
}

const st = StyleSheet.create({
  frame: { backgroundColor: 'rgba(255,255,255,0.09)', alignItems: 'center', justifyContent: 'center', overflow: 'hidden' },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, justifyContent: 'center' },
  cell: { width: 62, height: 62, borderRadius: 31, borderWidth: 2, alignItems: 'center', justifyContent: 'center' },
  check: { position: 'absolute', right: 0, top: 0, width: 18, height: 18, borderRadius: 9, alignItems: 'center', justifyContent: 'center' },
});
