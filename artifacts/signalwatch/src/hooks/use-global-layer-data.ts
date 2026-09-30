/**
 * Global Layer Engine — data orchestration.
 *
 * The hook resolves every registered operational layer through its layer
 * source binding, combines the normalized observations, and derives shared
 * selection/sampling state. Layer-specific knowledge lives in the source
 * modules and the registry, not here: adding a layer means registering a
 * definition and binding one source, not adding another block of logic to the
 * shared surfaces.
 */
import { useEffect, useMemo } from "react";
import { useGlobalLayerState } from "@/components/global-layer-provider";
import {
  useCameraLayerSource,
  type CameraLayerSourceResult,
} from "@/hooks/layer-sources/camera-layer-source";
import {
  useMaritimeLayerSource,
  type MaritimeLayerSourceResult,
} from "@/hooks/layer-sources/maritime-layer-source";
import {
  usePublicEventLayerSource,
  type PublicEventLayerSourceResult,
} from "@/hooks/layer-sources/public-event-layer-source";
import type {
  LayerFetchStatus,
  LayerSourceResult,
} from "@/hooks/layer-sources/types";
import {
  findObservation,
  normalizePublicEvent,
  selectRenderableObservations,
  type GlobalObservation,
} from "@/lib/global-layers";

/**
 * Combines layer sources. Kept generic so callers/renderers never inspect a
 * particular layer to build the observation set.
 */
export function combineLayerSources(
  sources: readonly LayerSourceResult<GlobalObservation>[],
): {
  observations: GlobalObservation[];
  statusByLayer: Record<string, LayerFetchStatus>;
} {
  const observations: GlobalObservation[] = [];
  const statusByLayer: Record<string, LayerFetchStatus> = {};
  for (const source of sources) {
    statusByLayer[source.layerId] = source.status;
    if (!source.enabled) continue;
    observations.push(...source.observations);
  }
  return { observations, statusByLayer };
}

export function useGlobalLayerData() {
  const layerState = useGlobalLayerState();

  // Layer sources are invoked in a fixed order so React hook rules hold. Each
  // source encapsulates its own providers, queries and normalization.
  const cameraSource: CameraLayerSourceResult = useCameraLayerSource({
    enabled: layerState.isLayerEnabled("cameras"),
    state: layerState,
  });
  const publicEventSource: PublicEventLayerSourceResult =
    usePublicEventLayerSource({
      enabled: layerState.isLayerEnabled("public-events"),
      state: layerState,
    });

  const maritimeSource: MaritimeLayerSourceResult = useMaritimeLayerSource({
    enabled: layerState.isLayerEnabled("maritime"),
    state: layerState,
  });

  const sources = useMemo<LayerSourceResult<GlobalObservation>[]>(
    () => [cameraSource, publicEventSource, maritimeSource],
    [cameraSource, publicEventSource, maritimeSource],
  );

  const { observations, statusByLayer } = useMemo(
    () => combineLayerSources(sources),
    [sources],
  );

  const renderable = useMemo(
    () =>
      selectRenderableObservations(
        observations,
        layerState.selectedObservation,
        layerState.registry,
      ),
    [observations, layerState.selectedObservation, layerState.registry],
  );

  const selectedObservation = useMemo(
    () => findObservation(observations, layerState.selectedObservation),
    [observations, layerState.selectedObservation],
  );

  // Selection survives reloads, and is cleared once the owning layer has
  // settled without the record. Works for any layer id.
  useEffect(() => {
    const identity = layerState.selectedObservation;
    if (!identity || selectedObservation) return;
    const status = statusByLayer[identity.layerId];
    if (status?.isLoading || status?.isFetching) return;
    layerState.clearSelectedObservation();
  }, [
    layerState,
    selectedObservation,
    statusByLayer,
  ]);

  const briefing = publicEventSource.briefing;
  const allEvents = briefing?.events ?? [];
  const locatedEventCount = useMemo(
    () =>
      allEvents.filter((event) => normalizePublicEvent(event) !== null).length,
    [allEvents],
  );

  return {
    ...layerState,
    sources,
    statusByLayer,
    observations,
    globeObservations: renderable.observations,
    globeSamples: renderable.samples,
    selectedObservation,

    // Layer-specific surfaces (lists, counters) consume their own source.
    cameraCatalogue: cameraSource.catalogue,
    vesselFeed: maritimeSource.feed,
    briefing,
    briefingLoading: publicEventSource.status.isLoading,
    briefingFetching: publicEventSource.status.isFetching,
    briefingError: publicEventSource.status.hasError,
    refetchBriefing: publicEventSource.refetch,
    events: allEvents,
    headlines: briefing?.headlines ?? [],
    locatedEventCount,
    eventRecordCount: allEvents.length,
    headlineCount: briefing?.headlines.length ?? 0,
    sourcesOnline: briefing?.sourcesOnline ?? 0,
    sourceCount: briefing?.sources.length ?? 0,
    briefingGeneratedAt: briefing?.generatedAt,
  };
}
