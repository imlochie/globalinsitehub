/**
 * Global Layer Engine — runtime state.
 *
 * Holds only mutable state: which layers are enabled, layer filter state, and
 * the shared selection. Static layer facts live in the layer registry.
 */
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import type { LayerEnablement, ObservationIdentity } from "@/lib/global-layers";
import { clearLayerSelection } from "@/lib/global-layers";
import {
  layerRegistry,
  type LayerFlags,
  type LayerId,
  type LayerRegistry,
} from "@/lib/layer-registry";
import type {
  CameraCountry,
  CameraProviderSelection,
} from "@/hooks/use-camera-catalogue";

/**
 * Per-layer filter state. Each layer that declares filtering capabilities owns
 * one slice here; layers without filters contribute nothing.
 */
export type CameraLayerFilters = {
  country: CameraCountry;
  provider: CameraProviderSelection;
  search: string;
  debouncedSearch: string;
};

export type MaritimeLayerFilters = {
  /** Provider id, or "all". Maritime coverage is regional per provider. */
  provider: string;
  search: string;
  debouncedSearch: string;
};

export type PublicEventLayerFilters = {
  /** Provider id, or "all". Public-event coverage is regional per provider. */
  provider: string;
  search: string;
  debouncedSearch: string;
};

export type NaturalHazardLayerFilters = {
  /** Hazard source id, or "all". Each source has its own coverage. */
  source: string;
  search: string;
  debouncedSearch: string;
};

export type GlobalLayerContextValue = {
  registry: LayerRegistry;
  enabledLayers: LayerEnablement;
  isLayerEnabled: (layerId: LayerId) => boolean;
  setLayerEnabled: (layerId: LayerId, enabled: boolean) => void;
  cameraFilters: CameraLayerFilters;
  setCameraCountry: (country: CameraCountry) => void;
  setCameraProvider: (provider: CameraProviderSelection) => void;
  setCameraSearch: (search: string) => void;
  maritimeFilters: MaritimeLayerFilters;
  setMaritimeProvider: (provider: string) => void;
  setMaritimeSearch: (search: string) => void;
  publicEventFilters: PublicEventLayerFilters;
  setPublicEventProvider: (provider: string) => void;
  setPublicEventSearch: (search: string) => void;
  naturalHazardFilters: NaturalHazardLayerFilters;
  setNaturalHazardSource: (source: string) => void;
  setNaturalHazardSearch: (search: string) => void;
  selectedObservation: ObservationIdentity | null;
  selectObservation: (observation: ObservationIdentity) => void;
  clearSelectedObservation: () => void;
};

const GlobalLayerContext = createContext<GlobalLayerContextValue | null>(null);

export function GlobalLayerProvider({
  children,
  registry = layerRegistry,
}: {
  children: ReactNode;
  registry?: LayerRegistry;
}) {
  const [enabledLayers, setEnabledLayers] = useState<LayerFlags>(() =>
    registry.defaultEnablement(),
  );
  const [cameraCountry, setCameraCountryState] =
    useState<CameraCountry>("AU");
  const [cameraProvider, setCameraProviderState] =
    useState<CameraProviderSelection>("all");
  const [cameraSearch, setCameraSearch] = useState("");
  const [debouncedCameraSearch, setDebouncedCameraSearch] = useState("");
  const [maritimeProvider, setMaritimeProviderState] = useState<string>("all");
  const [maritimeSearch, setMaritimeSearch] = useState("");
  const [debouncedMaritimeSearch, setDebouncedMaritimeSearch] = useState("");
  const [publicEventProvider, setPublicEventProviderState] =
    useState<string>("all");
  const [publicEventSearch, setPublicEventSearch] = useState("");
  const [debouncedPublicEventSearch, setDebouncedPublicEventSearch] =
    useState("");
  const [naturalHazardSource, setNaturalHazardSourceState] =
    useState<string>("all");
  const [naturalHazardSearch, setNaturalHazardSearch] = useState("");
  const [debouncedNaturalHazardSearch, setDebouncedNaturalHazardSearch] =
    useState("");
  const [selectedObservation, setSelectedObservation] =
    useState<ObservationIdentity | null>(null);

  useEffect(() => {
    const timer = window.setTimeout(
      () => setDebouncedCameraSearch(cameraSearch),
      250,
    );
    return () => window.clearTimeout(timer);
  }, [cameraSearch]);

  useEffect(() => {
    const timer = window.setTimeout(
      () => setDebouncedMaritimeSearch(maritimeSearch),
      250,
    );
    return () => window.clearTimeout(timer);
  }, [maritimeSearch]);

  useEffect(() => {
    const timer = window.setTimeout(
      () => setDebouncedPublicEventSearch(publicEventSearch),
      250,
    );
    return () => window.clearTimeout(timer);
  }, [publicEventSearch]);

  useEffect(() => {
    const timer = window.setTimeout(
      () => setDebouncedNaturalHazardSearch(naturalHazardSearch),
      250,
    );
    return () => window.clearTimeout(timer);
  }, [naturalHazardSearch]);

  const setLayerEnabled = useCallback(
    (layerId: LayerId, enabled: boolean) => {
      setEnabledLayers((current) => ({ ...current, [layerId]: enabled }));
      if (!enabled) {
        setSelectedObservation((selected) =>
          clearLayerSelection(selected, layerId),
        );
      }
    },
    [],
  );

  const isLayerEnabled = useCallback(
    (layerId: LayerId) => enabledLayers[layerId] === true,
    [enabledLayers],
  );

  const setCameraCountry = useCallback((country: CameraCountry) => {
    setCameraCountryState(country);
    setCameraProviderState("all");
    setSelectedObservation((selected) =>
      clearLayerSelection(selected, "cameras"),
    );
  }, []);

  const setCameraProvider = useCallback(
    (provider: CameraProviderSelection) => {
      setCameraProviderState(provider);
      setSelectedObservation((selected) =>
        clearLayerSelection(selected, "cameras"),
      );
    },
    [],
  );

  const setMaritimeProvider = useCallback((provider: string) => {
    setMaritimeProviderState(provider);
    setSelectedObservation((selected) =>
      clearLayerSelection(selected, "maritime"),
    );
  }, []);

  const selectObservation = useCallback(
    (observation: ObservationIdentity) => {
      setSelectedObservation(observation);
    },
    [],
  );

  const clearSelectedObservation = useCallback(() => {
    setSelectedObservation(null);
  }, []);

  const cameraFilters = useMemo<CameraLayerFilters>(
    () => ({
      country: cameraCountry,
      provider: cameraProvider,
      search: cameraSearch,
      debouncedSearch: debouncedCameraSearch,
    }),
    [cameraCountry, cameraProvider, cameraSearch, debouncedCameraSearch],
  );

  const setPublicEventProvider = useCallback((provider: string) => {
    setPublicEventProviderState(provider);
    setSelectedObservation((selected) =>
      clearLayerSelection(selected, "public-events"),
    );
  }, []);

  const publicEventFilters = useMemo<PublicEventLayerFilters>(
    () => ({
      provider: publicEventProvider,
      search: publicEventSearch,
      debouncedSearch: debouncedPublicEventSearch,
    }),
    [publicEventProvider, publicEventSearch, debouncedPublicEventSearch],
  );

  const setNaturalHazardSource = useCallback((source: string) => {
    setNaturalHazardSourceState(source);
    setSelectedObservation((selected) =>
      clearLayerSelection(selected, "natural-hazards"),
    );
  }, []);

  const naturalHazardFilters = useMemo<NaturalHazardLayerFilters>(
    () => ({
      source: naturalHazardSource,
      search: naturalHazardSearch,
      debouncedSearch: debouncedNaturalHazardSearch,
    }),
    [naturalHazardSource, naturalHazardSearch, debouncedNaturalHazardSearch],
  );

  const maritimeFilters = useMemo<MaritimeLayerFilters>(
    () => ({
      provider: maritimeProvider,
      search: maritimeSearch,
      debouncedSearch: debouncedMaritimeSearch,
    }),
    [maritimeProvider, maritimeSearch, debouncedMaritimeSearch],
  );

  const value = useMemo<GlobalLayerContextValue>(
    () => ({
      registry,
      enabledLayers,
      isLayerEnabled,
      setLayerEnabled,
      cameraFilters,
      setCameraCountry,
      setCameraProvider,
      setCameraSearch,
      maritimeFilters,
      setMaritimeProvider,
      setMaritimeSearch,
      publicEventFilters,
      setPublicEventProvider,
      setPublicEventSearch,
      naturalHazardFilters,
      setNaturalHazardSource,
      setNaturalHazardSearch,
      selectedObservation,
      selectObservation,
      clearSelectedObservation,
    }),
    [
      registry,
      enabledLayers,
      isLayerEnabled,
      setLayerEnabled,
      cameraFilters,
      setCameraCountry,
      setCameraProvider,
      maritimeFilters,
      setMaritimeProvider,
      publicEventFilters,
      setPublicEventProvider,
      naturalHazardFilters,
      setNaturalHazardSource,
      selectedObservation,
      selectObservation,
      clearSelectedObservation,
    ],
  );

  return (
    <GlobalLayerContext.Provider value={value}>
      {children}
    </GlobalLayerContext.Provider>
  );
}

export function useGlobalLayerState() {
  const context = useContext(GlobalLayerContext);
  if (!context) {
    throw new Error(
      "useGlobalLayerState must be used inside GlobalLayerProvider",
    );
  }
  return context;
}
