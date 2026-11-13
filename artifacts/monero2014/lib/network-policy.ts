import { useSyncExternalStore } from 'react';
import { IS_NATIVE_ANDROID, nativeEngine } from './native-engine';

// Unknown defaults closed: no price-provider connection before native policy loads.
let blocked = IS_NATIVE_ANDROID;
const listeners = new Set<() => void>();
const controllers = new Set<AbortController>();
export function setMarketBlocked(value: boolean) {
  blocked = value;
  if (value) for (const controller of controllers) controller.abort();
  for (const listener of listeners) listener();
}
export async function loadNetworkPolicy() {
  if (IS_NATIVE_ANDROID) setMarketBlocked((await nativeEngine().privacy()).tor);
}
export function useMarketBlocked() {
  return useSyncExternalStore(cb => { listeners.add(cb); return () => { listeners.delete(cb); }; }, () => blocked, () => true);
}
export function guardMarketRequest(controller: AbortController) {
  if (blocked) throw new Error('Price connections are disabled in Tor mode.');
  controllers.add(controller);
  return () => controllers.delete(controller);
}
