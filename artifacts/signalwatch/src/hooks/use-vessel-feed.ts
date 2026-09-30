import {
  getGetMonitoringMaritimeQueryKey,
  useGetMonitoringMaritime,
} from "@workspace/api-client-react";

/**
 * Vessel feed.
 *
 * One bounded request to the Signalwatch API, which does the provider
 * aggregation server-side. The browser never contacts an AIS provider, so no
 * provider credential ever reaches the client and no provider sees Signalwatch
 * users directly.
 *
 * AIS positions age in minutes, so this polls; it does not tile by viewport,
 * because both registered feeds are small regional datasets that are cheaper to
 * fetch whole than to slice.
 */
const VESSEL_REQUEST_LIMIT = 400;
const QUERY_STALE_TIME_MS = 60_000;
const QUERY_REFETCH_MS = 90_000;

type UseVesselFeedOptions = {
  enabled: boolean;
  provider: string;
  search: string;
};

export function useVesselFeed({ enabled, provider, search }: UseVesselFeedOptions) {
  const params = {
    limit: VESSEL_REQUEST_LIMIT,
    q: search.trim() || undefined,
    provider: provider === "all" ? undefined : provider,
  };

  const query = useGetMonitoringMaritime(params, {
    query: {
      enabled,
      queryKey: getGetMonitoringMaritimeQueryKey(params),
      staleTime: QUERY_STALE_TIME_MS,
      refetchInterval: enabled ? QUERY_REFETCH_MS : false,
    },
  });

  const vessels = query.data?.vessels ?? [];
  const providers = query.data?.providers ?? [];

  return {
    vessels,
    providers,
    coverage: query.data?.coverage ?? null,
    matchedCount: query.data?.matchedCount ?? 0,
    returnedCount: vessels.length,
    generatedAt: query.data?.generatedAt ?? null,
    isFetching: enabled && query.isFetching,
    isLoading: enabled && query.isLoading && vessels.length === 0,
    hasError: enabled && query.isError,
    /**
     * Unavailable means Signalwatch has nothing to show, either because the
     * request failed or because every registered feed reported unavailable.
     */
    isUnavailable:
      enabled &&
      (query.isError ||
        (providers.length > 0 &&
          providers.every((entry) => entry.status === "unavailable"))) &&
      vessels.length === 0,
    isTruncated: (query.data?.matchedCount ?? 0) > vessels.length,
    refetch: () => {
      void query.refetch();
    },
  };
}
