/**
 * Natural hazards layer source: free hazard feeds -> NaturalHazardObservation[].
 *
 * Coverage is global in reach but bounded in completeness, so this module
 * exposes the feed's derived coverage statement and per-source health next to
 * the observations. A source being unreachable is reported as unavailable; it
 * is never allowed to read as "no hazards here".
 */
import { useMemo } from "react";
import { useHazardFeed } from "@/hooks/use-hazard-feed";
import {
  createNaturalHazardLayerProviderAdapter,
  type NaturalHazardObservation,
} from "@/lib/global-layers";
import type { LayerSourceContext, LayerSourceResult } from "./types";

export type NaturalHazardLayerSourceResult =
  LayerSourceResult<NaturalHazardObservation> & {
    feed: ReturnType<typeof useHazardFeed>;
  };

export function useNaturalHazardLayerSource({
  enabled,
  state,
}: LayerSourceContext): NaturalHazardLayerSourceResult {
  const filters = state.naturalHazardFilters;
  const feed = useHazardFeed({
    enabled,
    source: filters.source,
    search: filters.debouncedSearch,
  });

  const observations = useMemo(() => {
    const adapter = createNaturalHazardLayerProviderAdapter(feed.sources);
    return feed.hazards
      .map((record) => adapter.normalize(record))
      .filter(
        (observation): observation is NaturalHazardObservation =>
          observation !== null,
      );
  }, [feed.hazards, feed.sources]);

  return {
    layerId: "natural-hazards",
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
