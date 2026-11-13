import { useQuery } from '@tanstack/react-query';
import { Platform } from 'react-native';
import { getMoneroHistory, getMoneroStats, getGetMoneroHistoryQueryKey, getGetMoneroStatsQueryKey,
  type GetMoneroHistoryParams, type GetMoneroStatsParams } from '@workspace/api-client-react';
import { nativeMarketHistory, nativeMarketStats } from '@/lib/native-market';
import { useMarketBlocked } from '@/lib/network-policy';

type Options = { query?: { queryKey?: readonly unknown[]; staleTime?: number; refetchInterval?: number; retry?: number; enabled?: boolean } };
export function useMarketHistory(params: GetMoneroHistoryParams, options?: Options) {
  const blocked = useMarketBlocked();
  const query = useQuery({
    ...options?.query,
    queryKey: getGetMoneroHistoryQueryKey(params),
    enabled: !blocked && options?.query?.enabled !== false,
    queryFn: () => Platform.OS === 'android' ? nativeMarketHistory(params) : getMoneroHistory(params),
  });
  return { ...query, data: blocked ? undefined : query.data, isError: blocked || query.isError, isLoading: !blocked && query.isLoading };
}
export function useMarketStats(params: GetMoneroStatsParams, options?: Options) {
  const blocked = useMarketBlocked();
  const query = useQuery({
    ...options?.query,
    queryKey: getGetMoneroStatsQueryKey(params),
    enabled: !blocked && options?.query?.enabled !== false,
    queryFn: () => Platform.OS === 'android' ? nativeMarketStats(params.currency ?? 'usd') : getMoneroStats(params),
  });
  return { ...query, data: blocked ? undefined : query.data, isError: blocked || query.isError, isLoading: !blocked && query.isLoading };
}
