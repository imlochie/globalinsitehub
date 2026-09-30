/** Camera layer source: provider catalogues -> CameraObservation[]. */
import { useMemo } from "react";
import { useCameraCatalogue } from "@/hooks/use-camera-catalogue";
import {
  createCameraLayerProviderAdapter,
  type CameraObservation,
} from "@/lib/global-layers";
import type { LayerSourceContext, LayerSourceResult } from "./types";

export type CameraLayerSourceResult = LayerSourceResult<CameraObservation> & {
  catalogue: ReturnType<typeof useCameraCatalogue>;
};

export function useCameraLayerSource({
  enabled,
  state,
}: LayerSourceContext): CameraLayerSourceResult {
  const filters = state.cameraFilters;
  const catalogue = useCameraCatalogue({
    enabled,
    country: filters.country,
    provider: filters.provider,
    search: filters.debouncedSearch,
  });

  const observations = useMemo(() => {
    const adapter = createCameraLayerProviderAdapter(catalogue.providers);
    return catalogue.cameras
      .map((record) => adapter.normalize(record))
      .filter((observation): observation is CameraObservation =>
        observation !== null,
      );
  }, [catalogue.cameras, catalogue.providers]);

  return {
    layerId: "cameras",
    enabled,
    observations,
    status: {
      isLoading: catalogue.isLoading,
      isFetching: catalogue.isFetching,
      hasError: catalogue.hasError,
      isUnavailable: catalogue.isUnavailable,
    },
    refetch: catalogue.refetch,
    catalogue,
  };
}
