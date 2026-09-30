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

export type PublicEventLayerSourceResult =
  LayerSourceResult<PublicEventObservation> & {
    briefing: Briefing | undefined;
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
  };
}
