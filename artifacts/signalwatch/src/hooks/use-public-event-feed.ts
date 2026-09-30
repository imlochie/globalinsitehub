import {
  getGetMonitoringPublicEventsQueryKey,
  useGetMonitoringPublicEvents,
} from "@workspace/api-client-react";

/**
 * Civic incident feed.
 *
 * One bounded request to the Signalwatch API, which aggregates the road
 * authority providers server-side. The browser never contacts an authority
 * directly, so no provider credential reaches the client.
 */
const REQUEST_LIMIT = 400;
const QUERY_STALE_TIME_MS = 60_000;
const QUERY_REFETCH_MS = 120_000;

type UsePublicEventFeedOptions = {
  enabled: boolean;
  provider: string;
  search: string;
};

export function usePublicEventFeed({
  enabled,
  provider,
  search,
}: UsePublicEventFeedOptions) {
  const params = {
    limit: REQUEST_LIMIT,
    q: search.trim() || undefined,
    provider: provider === "all" ? undefined : provider,
  };

  const query = useGetMonitoringPublicEvents(params, {
    query: {
      enabled,
      queryKey: getGetMonitoringPublicEventsQueryKey(params),
      staleTime: QUERY_STALE_TIME_MS,
      refetchInterval: enabled ? QUERY_REFETCH_MS : false,
    },
  });

  const events = query.data?.events ?? [];
  const providers = query.data?.providers ?? [];

  return {
    events,
    providers,
    coverage: query.data?.coverage ?? null,
    matchedCount: query.data?.matchedCount ?? 0,
    returnedCount: events.length,
    generatedAt: query.data?.generatedAt ?? null,
    isFetching: enabled && query.isFetching,
    isLoading: enabled && query.isLoading && events.length === 0,
    hasError: enabled && query.isError,
    /**
     * Unavailable means Signalwatch has nothing to show. A provider that is
     * merely `unconfigured` does not make the layer unavailable — the other
     * providers still cover their regions.
     */
    isUnavailable:
      enabled &&
      (query.isError ||
        (providers.length > 0 &&
          providers.every((entry) => entry.status !== "available"))) &&
      events.length === 0,
    isTruncated: (query.data?.matchedCount ?? 0) > events.length,
    refetch: () => {
      void query.refetch();
    },
  };
}
