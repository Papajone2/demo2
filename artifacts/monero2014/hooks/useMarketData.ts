import { useQuery } from '@tanstack/react-query';
import { Platform } from 'react-native';
import { getMoneroHistory, getMoneroStats, getGetMoneroHistoryQueryKey, getGetMoneroStatsQueryKey,
  type GetMoneroHistoryParams, type GetMoneroStatsParams } from '@workspace/api-client-react';
import { nativeMarketHistory, nativeMarketStats } from '@/lib/native-market';

type Options = { query?: { queryKey?: readonly unknown[]; staleTime?: number; refetchInterval?: number; retry?: number; enabled?: boolean } };
export function useMarketHistory(params: GetMoneroHistoryParams, options?: Options) {
  return useQuery({
    ...options?.query,
    queryKey: getGetMoneroHistoryQueryKey(params),
    queryFn: () => Platform.OS === 'android' ? nativeMarketHistory(params) : getMoneroHistory(params),
  });
}
export function useMarketStats(params: GetMoneroStatsParams, options?: Options) {
  return useQuery({
    ...options?.query,
    queryKey: getGetMoneroStatsQueryKey(params),
    queryFn: () => Platform.OS === 'android' ? nativeMarketStats(params.currency ?? 'usd') : getMoneroStats(params),
  });
}
