import { useEffect, useMemo } from "react";
import { useGlobalLayerState } from "@/components/global-layer-provider";
import { useCameraCatalogue } from "@/hooks/use-camera-catalogue";
import { useBriefing } from "@/hooks/use-briefing";
import {
  createCameraLayerProviderAdapter,
  selectEnabledLayerObservations,
  normalizePublicEvent,
  publicEventProviderAdapter,
  selectGlobeObservations,
  type GlobalObservation,
} from "@/lib/global-layers";

export function useGlobalLayerData() {
  const layerState = useGlobalLayerState();
  const cameraCatalogue = useCameraCatalogue({
    enabled: layerState.camerasEnabled,
    country: layerState.cameraCountry,
    provider: layerState.cameraProvider,
    search: layerState.debouncedCameraSearch,
  });
  const briefingQuery = useBriefing(60);
  const briefing = briefingQuery.briefing;

  const observations = useMemo<GlobalObservation[]>(() => {
    const cameraAdapter = createCameraLayerProviderAdapter(
      cameraCatalogue.providers,
    );
    const cameras = cameraCatalogue.cameras
      .map((record) => cameraAdapter.normalize(record))
      .filter((record) => record !== null);
    const events = (briefing?.events ?? [])
      .map(publicEventProviderAdapter.normalize)
      .filter((record) => record !== null);
    return selectEnabledLayerObservations([...cameras, ...events], {
      cameras: layerState.camerasEnabled,
      publicEvents: layerState.publicEventsEnabled,
    });
  }, [
    cameraCatalogue.cameras,
    cameraCatalogue.providers,
    briefing?.events,
    layerState.camerasEnabled,
    layerState.publicEventsEnabled,
  ]);

  const globeDisplay = useMemo(
    () =>
      selectGlobeObservations(observations, layerState.selectedObservation),
    [observations, layerState.selectedObservation],
  );

  const selectedObservation = useMemo(
    () =>
      layerState.selectedObservation
        ? observations.find(
            (observation) =>
              observation.layerId === layerState.selectedObservation?.layerId &&
              observation.id === layerState.selectedObservation?.id,
          ) ?? null
        : null,
    [layerState.selectedObservation, observations],
  );

  useEffect(() => {
    if (!layerState.selectedObservation || selectedObservation) return;
    const isPending =
      layerState.selectedObservation.layerId === "cameras"
        ? cameraCatalogue.isLoading || cameraCatalogue.isFetching
        : briefingQuery.isLoading || briefingQuery.isFetching;
    if (!isPending) layerState.clearSelectedObservation();
  }, [
    layerState.selectedObservation,
    layerState.clearSelectedObservation,
    selectedObservation,
    cameraCatalogue.isLoading,
    cameraCatalogue.isFetching,
    briefingQuery.isLoading,
    briefingQuery.isFetching,
  ]);

  const allEvents = briefing?.events ?? [];
  const locatedEventCount = useMemo(
    () =>
      allEvents.filter((event) => normalizePublicEvent(event) !== null).length,
    [allEvents],
  );

  return {
    ...layerState,
    cameraCatalogue,
    briefing,
    briefingLoading: briefingQuery.isLoading,
    briefingFetching: briefingQuery.isFetching,
    briefingError: briefingQuery.isError,
    refetchBriefing: briefingQuery.refetch,
    observations,
    globeObservations: globeDisplay.observations,
    globeCameraOmitted: globeDisplay.cameraOmitted,
    selectedObservation,
    events: layerState.publicEventsEnabled ? allEvents : [],
    headlines: briefing?.headlines ?? [],
    locatedEventCount,
    eventRecordCount: allEvents.length,
    headlineCount: briefing?.headlines.length ?? 0,
    sourcesOnline: briefing?.sourcesOnline ?? 0,
    sourceCount: briefing?.sources.length ?? 0,
    briefingGeneratedAt: briefing?.generatedAt,
  };
}