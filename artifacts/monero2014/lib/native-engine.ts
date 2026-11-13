import { Platform } from 'react-native';
import { requireOptionalNativeModule } from 'expo-modules-core';
import type { Tx } from './wallet-model';

export const IS_NATIVE_ANDROID = Platform.OS === 'android';
export type NativeAccount = { id: string; name: string; iconId: string; network: 'mainnet' | 'stagenet'; needsCustomization: boolean };
export type NativeSnapshot = {
  id: string; address: string; addresses: string[]; txs: Tx[]; available: string; total: string;
  height: number; target: number; complete: boolean; daemon: string; broadcastWarning: string; network: 'mainnet' | 'stagenet'; tor: boolean;
};
export type NativeQuote = { token: string; address: string; amount: string; fee: string; txid: string };
type Engine = {
  list(): Promise<NativeAccount[]>;
  create(name: string, seed: string, height: string, network: number): Promise<{ id: string; seed: string; address: string }>;
  deriveSecret(secret: string, salt: string, iterations: number): Promise<string>;
  copyPrivateText(text: string): Promise<void>;
  open(id: string): Promise<NativeSnapshot>;
  connect(url: string): Promise<void>;
  privacy(): Promise<{ tor: boolean }>;
  configureNode(url: string, tor: boolean): Promise<void>;
  snapshot(): Promise<NativeSnapshot>;
  subaddress(): Promise<NativeSnapshot>;
  profile(id: string, name: string, icon: string): Promise<void>;
  reportUsername(): Promise<void>;
  secret(id: string, recovery: boolean): Promise<string>;
  remove(id: string): Promise<void>;
  prepare(address: string, atomic: string): Promise<NativeQuote>;
  commit(token: string): Promise<string>;
  discard(): Promise<void>;
  close(): Promise<void>;
  erase(): Promise<void>;
};
export function nativeEngine(): Engine {
  const engine = requireOptionalNativeModule<Engine>('MoneroEngine');
  if (!IS_NATIVE_ANDROID || !engine) {
    throw new Error('Native Monero engine missing. Install the GitHub Actions APK; Expo Go and JavaScript exports cannot load it.');
  }
  return engine;
}
