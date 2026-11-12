import qrcode from 'qrcode-generator';
import React, { useMemo } from 'react';
import { View } from 'react-native';
import Svg, { Path, Rect } from 'react-native-svg';

/** Real QR encoding of exactly `value` (byte mode, ECC M). Dark modules on a light quiet zone. */
export function QrCode({ value, size = 200, testID }: { value: string; size?: number; testID?: string }) {
  const { d, n } = useMemo(() => {
    const qr = qrcode(0, 'M');
    qr.addData(value, 'Byte');
    qr.make();
    const count = qr.getModuleCount();
    let path = '';
    for (let r = 0; r < count; r++) for (let c = 0; c < count; c++) if (qr.isDark(r, c)) path += `M${c + 4} ${r + 4}h1v1h-1z`;
    return { d: path, n: count + 8 };
  }, [value]);
  return (
    <View testID={testID} accessible accessibilityRole="image" accessibilityLabel={`QR code for ${value}`} style={{ borderRadius: 18, overflow: 'hidden' }}>
      <Svg width={size} height={size} viewBox={`0 0 ${n} ${n}`}>
        <Rect x={0} y={0} width={n} height={n} fill="#F5F5F5" />
        <Path d={d} fill="#111111" />
      </Svg>
    </View>
  );
}
