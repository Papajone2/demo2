import { useSyncExternalStore } from 'react';

export type FlowMode = 'welcome' | 'create' | 'restore' | null;
let flow: FlowMode = null;
const ls = new Set<() => void>();
export const flowStore = {
  get: () => flow,
  set(f: FlowMode) {
    flow = f;
    ls.forEach((l) => l());
  },
  subscribe(l: () => void) {
    ls.add(l);
    return () => ls.delete(l);
  },
};
export function useFlow() {
  return useSyncExternalStore(flowStore.subscribe, flowStore.get);
}
