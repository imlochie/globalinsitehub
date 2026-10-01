import {
  getGetMonitoringWeatherQueryKey,
  useGetMonitoringWeather,
} from "@workspace/api-client-react";
import type { SpatialProduct } from "@/lib/spatial-layers";

/**
 * Weather spatial products.
 *
 * Only the *metadata* travels this path — which frame the provider is
 * publishing, whether the service is healthy, what it covers. The imagery
 * itself never passes through Signalwatch: the map requests tiles from the
 * provider directly, the same arrangement used for camera media.
 *
 * The poll interval is a provider term, not a UI preference. NOAA's radar
 * mosaic updates roughly every ten minutes and the NWS Public Notice of
 * Appropriate Use treats requesting faster than the data refreshes as abuse,
 * so this asks once per cycle and the API server caches for the same period.
 * A visibly "live" layer is not a reason to poll harder.
 */
const QUERY_STALE_TIME_MS = 540_000;
const QUERY_REFETCH_MS = 600_000;

/**
 * Stable empty fallback.
 *
 * Not cosmetic. A fresh `[]` on every render would give the derived surface
 * list a new identity each time, and the map would tear down and rebuild its
 * WMS layers on every React render — re-requesting provider tiles far more
 * often than the 10-minute cadence NOAA's appropriate-use policy allows.
 */
const EMPTY_PRODUCTS: SpatialProduct[] = [];

export type WeatherSurfacesResult = {
  products: SpatialProduct[];
  coverage: { scope: string; regions: string[]; note: string } | null;
  generatedAt: string | null;
  isLoading: boolean;
  isFetching: boolean;
  hasError: boolean;
  /** Signalwatch has no usable surface to draw at all. */
  isUnavailable: boolean;
  refetch: () => void;
};

export function useWeatherSurfaces(enabled: boolean): WeatherSurfacesResult {
  const query = useGetMonitoringWeather({
    query: {
      enabled,
      queryKey: getGetMonitoringWeatherQueryKey(),
      staleTime: QUERY_STALE_TIME_MS,
      refetchInterval: enabled ? QUERY_REFETCH_MS : false,
    },
  });

  const products = query.data?.products ?? EMPTY_PRODUCTS;
  const renderable = products.filter(
    (product) => product.imagery !== null && product.availability !== "unavailable",
  );

  return {
    products,
    coverage: query.data?.coverage ?? null,
    generatedAt: query.data?.generatedAt ?? null,
    isFetching: enabled && query.isFetching,
    isLoading: enabled && query.isLoading && products.length === 0,
    hasError: enabled && query.isError,
    // Unavailable means nothing can be drawn: either the request failed, or
    // every product reported its provider as unreachable. It is never
    // inferred from an empty map.
    isUnavailable:
      enabled && !query.isLoading && (query.isError || renderable.length === 0),
    refetch: () => {
      void query.refetch();
    },
  };
}
