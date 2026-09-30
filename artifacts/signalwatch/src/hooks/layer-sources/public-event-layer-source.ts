/**
 * Public events layer source: civic incident feeds -> PublicEventObservation[].
 *
 * Coverage is regional by construction, so this module exposes the feed's
 * derived coverage statement and per-provider health next to the observations.
 * A provider that is unconfigured or unreachable is reported as such; it is
 * never allowed to read as "no incidents".
 */
import { useMemo } from "react";
import { usePublicEventFeed } from "@/hooks/use-public-event-feed";
import {
  createPublicEventLayerProviderAdapter,
  type PublicEventObservation,
} from "@/lib/global-layers";
import type { LayerSourceContext, LayerSourceResult } from "./types";

export type PublicEventLayerSourceResult =
  LayerSourceResult<PublicEventObservation> & {
    feed: ReturnType<typeof usePublicEventFeed>;
  };

export function usePublicEventLayerSource({
  enabled,
  state,
}: LayerSourceContext): PublicEventLayerSourceResult {
  const filters = state.publicEventFilters;
  const feed = usePublicEventFeed({
    enabled,
    provider: filters.provider,
    search: filters.debouncedSearch,
  });

  const observations = useMemo(() => {
    const adapter = createPublicEventLayerProviderAdapter(feed.providers);
    return feed.events
      .map((record) => adapter.normalize(record))
      .filter(
        (observation): observation is PublicEventObservation =>
          observation !== null,
      );
  }, [feed.events, feed.providers]);

  return {
    layerId: "public-events",
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
