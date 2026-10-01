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
import { useBriefing } from "@/hooks/use-briefing";
import {
  useCameraLayerSource,
  type CameraLayerSourceResult,
} from "@/hooks/layer-sources/camera-layer-source";
import {
  useMaritimeLayerSource,
  type MaritimeLayerSourceResult,
} from "@/hooks/layer-sources/maritime-layer-source";
import {
  useNaturalHazardLayerSource,
  type NaturalHazardLayerSourceResult,
} from "@/hooks/layer-sources/natural-hazard-layer-source";
import {
  usePublicEventLayerSource,
  type PublicEventLayerSourceResult,
} from "@/hooks/layer-sources/public-event-layer-source";
import {
  useWeatherLayerSource,
  type WeatherLayerSourceResult,
} from "@/hooks/layer-sources/weather-layer-source";
import type {
  LayerFetchStatus,
  LayerSourceResult,
  SpatialLayerSourceResult,
} from "@/hooks/layer-sources/types";
import {
  findObservation,
  selectRenderableObservations,
  type GlobalObservation,
} from "@/lib/global-layers";
import type { RenderableImagery } from "@/lib/spatial-layers";

/**
 * Combines layer sources. Kept generic so callers/renderers never inspect a
 * particular layer to build the observation set.
 */
const BRIEFING_LIMIT = 60;

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

/**
 * Combines spatial sources.
 *
 * The deliberate sibling of `combineLayerSources`. Surfaces are kept on their
 * own channel because every stage of the observation pipeline —
 * `selectRenderableObservations` sampling, `findObservation` selection, the
 * stale-selection effect — is typed on a record with a coordinate and an id.
 * A raster has neither, and sampling a raster is meaningless. Merging the two
 * would not just be untidy; it would silently apply a marker cap to something
 * that has no markers.
 */
export function combineSpatialSources(
  sources: readonly SpatialLayerSourceResult[],
): {
  imagery: RenderableImagery[];
  statusByLayer: Record<string, LayerFetchStatus>;
} {
  const imagery: RenderableImagery[] = [];
  const statusByLayer: Record<string, LayerFetchStatus> = {};
  for (const source of sources) {
    statusByLayer[source.layerId] = source.status;
    if (!source.enabled) continue;
    imagery.push(...source.imagery.filter((surface) => surface.render));
  }
  return { imagery, statusByLayer };
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

  // The public briefing is a reporting surface in its own right (the briefing
  // and sources pages), no longer the data source for the public-events layer,
  // so it is fetched independently of layer enablement.
  const briefingSource = useBriefing(BRIEFING_LIMIT);

  const naturalHazardSource: NaturalHazardLayerSourceResult =
    useNaturalHazardLayerSource({
      enabled: layerState.isLayerEnabled("natural-hazards"),
      state: layerState,
    });

  // Spatial layers run on their own channel. The viewport is not plumbed
  // through yet: the coverage clip is applied by the renderer via Leaflet's
  // bounds option, which is strictly stronger than filtering here because it
  // stops the request ever being issued.
  const weatherSource: WeatherLayerSourceResult = useWeatherLayerSource({
    enabled: layerState.isLayerEnabled("weather"),
    viewport: null,
  });

  const sources = useMemo<LayerSourceResult<GlobalObservation>[]>(
    () => [
      cameraSource,
      publicEventSource,
      maritimeSource,
      naturalHazardSource,
    ],
    [cameraSource, publicEventSource, maritimeSource, naturalHazardSource],
  );

  const spatialSources: SpatialLayerSourceResult[] = [weatherSource];

  const { observations, statusByLayer: observationStatusByLayer } = useMemo(
    () => combineLayerSources(sources),
    [sources],
  );

  // Memoized on the source's stable parts rather than on the source object,
  // which is a fresh literal every render. Imagery layers are mounted into
  // Leaflet by identity: an unstable array would make the map destroy and
  // recreate its WMS layers on each render, re-requesting provider tiles far
  // more often than the admitted refresh cadence permits.
  const { imagery, statusByLayer: spatialStatusByLayer } = useMemo(
    () => combineSpatialSources(spatialSources),
    [
      weatherSource.enabled,
      weatherSource.imagery,
      weatherSource.status.isLoading,
      weatherSource.status.isFetching,
      weatherSource.status.hasError,
      weatherSource.status.isUnavailable,
    ],
  );

  const statusByLayer = useMemo(
    () => ({ ...observationStatusByLayer, ...spatialStatusByLayer }),
    [observationStatusByLayer, spatialStatusByLayer],
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

  const briefing = briefingSource.briefing;
  const allEvents = briefing?.events ?? [];

  return {
    ...layerState,
    sources,
    spatialSources,
    statusByLayer,
    observations,
    /** Surfaces cleared for rendering. Never part of `observations`. */
    imagery,
    globeObservations: renderable.observations,
    globeSamples: renderable.samples,
    selectedObservation,

    // Layer-specific surfaces (lists, counters) consume their own source.
    cameraCatalogue: cameraSource.catalogue,
    vesselFeed: maritimeSource.feed,
    hazardFeed: naturalHazardSource.feed,
    publicEventFeed: publicEventSource.feed,
    weatherSurfaces: weatherSource.surfaces,
    briefing,
    briefingLoading: briefingSource.isLoading,
    briefingFetching: briefingSource.isFetching,
    briefingError: briefingSource.isError,
    refetchBriefing: () => {
      void briefingSource.refetch();
    },
    events: allEvents,
    headlines: briefing?.headlines ?? [],
    locatedEventCount: publicEventSource.observations.length,
    eventRecordCount: allEvents.length,
    headlineCount: briefing?.headlines.length ?? 0,
    sourcesOnline: briefing?.sourcesOnline ?? 0,
    sourceCount: briefing?.sources.length ?? 0,
    briefingGeneratedAt: briefing?.generatedAt,
  };
}
