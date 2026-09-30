import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import type {
  ObservationIdentity,
} from "@/lib/global-layers";
import { clearLayerSelection } from "@/lib/global-layers";
import type {
  CameraCountry,
  CameraProviderSelection,
} from "@/hooks/use-camera-catalogue";

type GlobalLayerContextValue = {
  camerasEnabled: boolean;
  setCamerasEnabled: (enabled: boolean) => void;
  publicEventsEnabled: boolean;
  setPublicEventsEnabled: (enabled: boolean) => void;
  cameraCountry: CameraCountry;
  setCameraCountry: (country: CameraCountry) => void;
  cameraProvider: CameraProviderSelection;
  setCameraProvider: (provider: CameraProviderSelection) => void;
  cameraSearch: string;
  setCameraSearch: (search: string) => void;
  debouncedCameraSearch: string;
  selectedObservation: ObservationIdentity | null;
  selectObservation: (observation: ObservationIdentity) => void;
  clearSelectedObservation: () => void;
};

const GlobalLayerContext = createContext<GlobalLayerContextValue | null>(null);

export function GlobalLayerProvider({ children }: { children: ReactNode }) {
  const [camerasEnabled, setCamerasEnabledState] = useState(true);
  const [publicEventsEnabled, setPublicEventsEnabledState] = useState(true);
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

  const setCamerasEnabled = useCallback((enabled: boolean) => {
    setCamerasEnabledState(enabled);
    if (!enabled) {
        setSelectedObservation((selected) =>
          clearLayerSelection(selected, "cameras"),
        );
    }
  }, []);

  const setPublicEventsEnabled = useCallback((enabled: boolean) => {
    setPublicEventsEnabledState(enabled);
    if (!enabled) {
      setSelectedObservation((selected) =>
          clearLayerSelection(selected, "public-events"),
      );
    }
  }, []);

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

  const value = useMemo<GlobalLayerContextValue>(
    () => ({
      camerasEnabled,
      setCamerasEnabled,
      publicEventsEnabled,
      setPublicEventsEnabled,
      cameraCountry,
      setCameraCountry,
      cameraProvider,
      setCameraProvider,
      cameraSearch,
      setCameraSearch,
      debouncedCameraSearch,
      selectedObservation,
      selectObservation,
      clearSelectedObservation,
    }),
    [
      camerasEnabled,
      setCamerasEnabled,
      publicEventsEnabled,
      setPublicEventsEnabled,
      cameraCountry,
      setCameraCountry,
      cameraProvider,
      setCameraProvider,
      cameraSearch,
      debouncedCameraSearch,
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