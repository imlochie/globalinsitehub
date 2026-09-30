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
 * Stable source-id prefixes owned by the natural-hazards layer.
 *
 * The briefing feed still carries USGS and EONET records — they remain part of
 * the written briefing — but they are hazard-source records, so the map renders
 * them under Natural hazards and this layer skips them. Matching is on the
 * provider id the record was minted with, never on words in the title: a news
 * item about an earthquake is a public event and stays here.
 */
const HAZARD_SOURCED_EVENT_ID_PREFIXES = ["usgs-", "eonet-"] as const;

export function isHazardSourcedEvent(event: { id: string }): boolean {
  return HAZARD_SOURCED_EVENT_ID_PREFIXES.some((prefix) =>
    event.id.startsWith(prefix),
  );
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
