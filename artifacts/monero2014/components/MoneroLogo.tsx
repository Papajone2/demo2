import React from 'react';
import Svg, { Circle, Path } from 'react-native-svg';
export function MoneroLogo({ size = 32 }: { size?: number }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" accessibilityLabel="Monero">
      <Circle cx="12" cy="12" r="12" fill="#FFFFFF" />
      <Path fill="#FF6600" d="M12 0C5.365 0 0 5.373 0 12.015c0 1.335.228 2.607.618 3.81h3.577V5.729L12 13.545l7.805-7.815v10.095h3.577c.389-1.203.618-2.475.618-3.81C24 5.375 18.635 0 12 0z" />
      <Path fill="#4C4C4C" d="m10.212 15.307-3.417-3.421v6.351H1.758C3.87 21.689 7.678 24 12 24s8.162-2.311 10.245-5.764h-5.04v-6.351l-3.386 3.421-1.788 1.79-1.814-1.79h-.005z" />
    </Svg>
  );
}
