import { useSyncExternalStore } from 'react';
import { walletEngine } from '@/lib/wallet-engine';
import { useGetMoneroNode, useGetMoneroPrice, getGetMoneroNodeQueryKey, getGetMoneroPriceQueryKey } from '@workspace/api-client-react';
import { usePrefs } from '@/lib/prefs';

const subscribe = (l: () => void) => walletEngine.subscribe(l);
const getSnapshot = () => walletEngine.getSnapshot();

export function useWallet() {
  return useSyncExternalStore(subscribe, getSnapshot);
}

export function usePrice() {
  const { currency } = usePrefs();
  return useGetMoneroPrice({ currency }, { query: { queryKey: getGetMoneroPriceQueryKey({ currency }), refetchInterval: 60000, retry: 1 } });
}

export function useNode() {
  return useGetMoneroNode({ network: 'stagenet' }, { query: { queryKey: getGetMoneroNodeQueryKey({ network: 'stagenet' }), refetchInterval: 30000, retry: 1 } });
}
