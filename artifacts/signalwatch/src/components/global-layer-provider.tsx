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

export type GlobalLayerContextValue = {
  registry: LayerRegistry;
  enabledLayers: LayerEnablement;
  isLayerEnabled: (layerId: LayerId) => boolean;
  setLayerEnabled: (layerId: LayerId, enabled: boolean) => void;
  cameraFilters: CameraLayerFilters;
  setCameraCountry: (country: CameraCountry) => void;
  setCameraProvider: (provider: CameraProviderSelection) => void;
  setCameraSearch: (search: string) => void;
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
  const [selectedObservation, setSelectedObservation] =
    useState<ObservationIdentity | null>(null);

  useEffect(() => {
    const timer = window.setTimeout(
      () => setDebouncedCameraSearch(cameraSearch),
      250,
    );
    return () => window.clearTimeout(timer);
  }, [cameraSearch]);

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
