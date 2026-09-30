/**
 * Maritime layer source: free regional AIS feeds -> MaritimeObservation[].
 *
 * Coverage is regional by construction. This module deliberately exposes the
 * feed's coverage statement and per-provider health alongside the observations
 * so the UI can say "no source here" instead of implying empty water.
 */
import { useMemo } from "react";
import { useVesselFeed } from "@/hooks/use-vessel-feed";
import {
  createMaritimeLayerProviderAdapter,
  type MaritimeObservation,
} from "@/lib/global-layers";
import type { LayerSourceContext, LayerSourceResult } from "./types";

export type MaritimeLayerSourceResult = LayerSourceResult<MaritimeObservation> & {
  feed: ReturnType<typeof useVesselFeed>;
};

export function useMaritimeLayerSource({
  enabled,
  state,
}: LayerSourceContext): MaritimeLayerSourceResult {
  const filters = state.maritimeFilters;
  const feed = useVesselFeed({
    enabled,
    provider: filters.provider,
    search: filters.debouncedSearch,
  });

  const observations = useMemo(() => {
    // Freshness is evaluated once per feed response, against the response we
    // actually received, so stale positions drop out on the next poll.
    const adapter = createMaritimeLayerProviderAdapter(feed.providers, Date.now());
    return feed.vessels
      .map((record) => adapter.normalize(record))
      .filter(
        (observation): observation is MaritimeObservation => observation !== null,
      );
  }, [feed.vessels, feed.providers]);

  return {
    layerId: "maritime",
    enabled,
    observations,
    status: {
      isLoading: feed.isLoading,
      isFetching: feed.isFetching,
      hasError: feed.hasError,
      isUnavailable: feed.isUnavailable,
    },
    refetch: feed.refetch,
    feed,
  };
}
