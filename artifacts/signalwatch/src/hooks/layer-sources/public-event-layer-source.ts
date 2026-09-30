/** Public events layer source: the public briefing -> PublicEventObservation[]. */
import { useMemo } from "react";
import { useBriefing } from "@/hooks/use-briefing";
import {
  publicEventProviderAdapter,
  type PublicEventObservation,
} from "@/lib/global-layers";
import type { Briefing } from "@/lib/monitoring";
import type { LayerSourceContext, LayerSourceResult } from "./types";

const BRIEFING_LIMIT = 60;

/**
 * Records whose feed is hazard-oriented belong to the natural-hazards layer.
 *
 * This reads the record's explicit `sourceKind` provenance, set server-side
 * where the record is created. It is deliberately not a match on id prefixes or
 * on words in the title: a news story about an earthquake is `sourceKind:
 * "news"` and stays a public event.
 */
export function isHazardSourcedEvent(event: {
  sourceKind: 'hazard' | 'news';
}): boolean {
  return event.sourceKind === 'hazard';
}

export type PublicEventLayerSourceResult =
  LayerSourceResult<PublicEventObservation> & {
    briefing: Briefing | undefined;
    /** Briefing events this layer can place on the map. */
    locatedEventCount: number;
  };

export function usePublicEventLayerSource({
  enabled,
}: LayerSourceContext): PublicEventLayerSourceResult {
  // Data acquisition follows enablement: the briefing query is not started
  // while the layer is off.
  const query = useBriefing(BRIEFING_LIMIT, { enabled });
  const briefing = enabled ? query.briefing : undefined;

  const observations = useMemo(
    () =>
      (briefing?.events ?? [])
        .filter((record) => !isHazardSourcedEvent(record))
        .map((record) => publicEventProviderAdapter.normalize(record))
        .filter((observation): observation is PublicEventObservation =>
          observation !== null,
        ),
    [briefing?.events],
  );

  return {
    layerId: "public-events",
    enabled,
    observations,
    status: {
      isLoading: enabled && query.isLoading,
      isFetching: enabled && query.isFetching,
      hasError: enabled && query.isError,
      isUnavailable: enabled && query.isError && !briefing,
    },
    refetch: () => {
      void query.refetch();
    },
    briefing,
    locatedEventCount: observations.length,
  };
}
