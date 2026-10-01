/**
 * Weather layer source: provider products -> renderable surfaces.
 *
 * This is the spatial sibling of the observation layer sources. It returns a
 * `SpatialLayerSourceResult`, not a `LayerSourceResult`, and that difference
 * is the point: nothing here ever enters `combineLayerSources`, so weather
 * cannot be swept into the observation array, the marker sampler or the
 * record inspector.
 */
import { useMemo } from "react";
import { useWeatherSurfaces } from "@/hooks/use-weather-surfaces";
import { toRenderableImagery, type RenderableImagery } from "@/lib/spatial-layers";
import type { SpatialLayerSourceContext, SpatialLayerSourceResult } from "./types";

export type WeatherLayerSourceResult = SpatialLayerSourceResult & {
  surfaces: ReturnType<typeof useWeatherSurfaces>;
};

export function useWeatherLayerSource({
  enabled,
  viewport,
  now,
}: SpatialLayerSourceContext): WeatherLayerSourceResult {
  const surfaces = useWeatherSurfaces(enabled);
  const products = surfaces.products;

  // Recomputed only when the provider metadata itself changes, so the
  // surface list keeps a stable identity across renders and the map does not
  // rebuild its tile layers for free. Freshness is therefore evaluated at
  // metadata-refresh time rather than continuously; that is sufficient here
  // because a stale surface is still drawn, and the panel re-evaluates
  // freshness on every render for the text the user reads.
  const imagery = useMemo<RenderableImagery[]>(() => {
    const at = now ?? new Date();
    return products
      .map((product) => toRenderableImagery(product, viewport ?? null, at))
      .filter((entry): entry is RenderableImagery => entry !== null);
  }, [products, viewport, now]);

  return {
    layerId: "weather",
    enabled,
    kind: "imagery",
    products,
    imagery,
    status: {
      isLoading: surfaces.isLoading,
      isFetching: surfaces.isFetching,
      hasError: surfaces.hasError,
      isUnavailable: surfaces.isUnavailable,
    },
    refetch: surfaces.refetch,
    surfaces,
  };
}
