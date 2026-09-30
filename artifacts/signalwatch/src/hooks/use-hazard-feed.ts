import {
  getGetMonitoringHazardsQueryKey,
  useGetMonitoringHazards,
} from "@workspace/api-client-react";

/**
 * Natural hazard feed.
 *
 * One bounded request to the Signalwatch API, which aggregates USGS and NASA
 * EONET server-side. The browser never contacts a hazard provider directly.
 *
 * Hazard records move far more slowly than AIS positions — USGS regenerates
 * its summary feed once a minute and EONET events persist for days — so this
 * polls gently rather than continuously.
 */
const HAZARD_REQUEST_LIMIT = 250;
const QUERY_STALE_TIME_MS = 120_000;
const QUERY_REFETCH_MS = 180_000;

type UseHazardFeedOptions = {
  enabled: boolean;
  source: string;
  search: string;
};

export function useHazardFeed({
  enabled,
  source,
  search,
}: UseHazardFeedOptions) {
  const params = {
    limit: HAZARD_REQUEST_LIMIT,
    q: search.trim() || undefined,
    source: source === "all" ? undefined : source,
  };

  const query = useGetMonitoringHazards(params, {
    query: {
      enabled,
      queryKey: getGetMonitoringHazardsQueryKey(params),
      staleTime: QUERY_STALE_TIME_MS,
      refetchInterval: enabled ? QUERY_REFETCH_MS : false,
    },
  });

  const hazards = query.data?.hazards ?? [];
  const sources = query.data?.sources ?? [];

  return {
    hazards,
    sources,
    coverage: query.data?.coverage ?? null,
    matchedCount: query.data?.matchedCount ?? 0,
    returnedCount: hazards.length,
    generatedAt: query.data?.generatedAt ?? null,
    isFetching: enabled && query.isFetching,
    isLoading: enabled && query.isLoading && hazards.length === 0,
    hasError: enabled && query.isError,
    /**
     * Unavailable means Signalwatch has nothing to show, either because the
     * request failed or because every hazard source reported unavailable. A
     * source being down is never presented as "no hazards".
     */
    isUnavailable:
      enabled &&
      (query.isError ||
        (sources.length > 0 &&
          sources.every((entry) => entry.status === "unavailable"))) &&
      hazards.length === 0,
    isTruncated: (query.data?.matchedCount ?? 0) > hazards.length,
    refetch: () => {
      void query.refetch();
    },
  };
}
