import {
  getGetMonitoringCamerasQueryKey,
  useGetMonitoringCameras,
  type CameraProviderStatus,
  type CameraRecord,
} from "@workspace/api-client-react";
import { cameraProviderIdsForFilter } from "@/lib/global-layers";
import { cameraLayerDefinition } from "@/lib/layer-registry";

/** ISO alpha-2 code of the country whose camera providers are requested. */
export type CameraCountry = string;
/** A registered camera provider id, or every provider for the country. */
export type CameraProviderSelection = string;

const CAMERA_REQUEST_LIMIT = 250;
const QUERY_STALE_TIME_MS = 5 * 60_000;

/**
 * How many provider queries this hook can issue.
 *
 * One request per provider, rather than one per country, so a large
 * catalogue cannot consume the whole response limit and crowd its
 * co-located providers out of the layer.
 *
 * React requires an unchanging hook count across renders, so the slot count
 * is fixed at module load from the static registry — the largest number of
 * camera providers any single country has, with headroom. It is derived
 * rather than hard-coded so that registering a provider cannot silently
 * exceed it.
 */
const PROVIDER_QUERY_SLOTS = Math.max(
  4,
  ...[
    ...new Set(
      cameraLayerDefinition.providers.flatMap((provider) => provider.countries),
    ),
  ].map(
    (country) =>
      cameraLayerDefinition.providers.filter((provider) =>
        provider.countries.includes(country),
      ).length,
  ),
);

type UseCameraCatalogueOptions = {
  enabled: boolean;
  country: CameraCountry;
  provider: CameraProviderSelection;
  search: string;
};

export function useCameraCatalogue({
  enabled,
  country,
  provider,
  search,
}: UseCameraCatalogueOptions) {
  const queryText = search.trim() || undefined;
  const requestedProviders = cameraProviderIdsForFilter(country, provider);

  const camerasById = new Map<string, CameraRecord>();
  const providerStatuses = new Map<string, CameraProviderStatus>();
  const requestedProviderIds: string[] = [];
  const refetchers: Array<() => void> = [];
  let matchedCount = 0;
  let activeRequests = 0;
  let fetchingRequests = 0;
  let loadingRequests = 0;
  let erroredRequests = 0;

  for (let slot = 0; slot < PROVIDER_QUERY_SLOTS; slot += 1) {
    const providerId = requestedProviders[slot] ?? null;
    const slotEnabled = enabled && providerId !== null;
    // An idle slot still needs stable params so its query key can never
    // collide with an active slot's.
    const params = {
      country,
      provider: providerId ?? `__idle-slot-${slot}`,
      limit: CAMERA_REQUEST_LIMIT,
      q: queryText,
    };
    // Called unconditionally on every render: the loop bound is a module
    // constant, so the hook order is stable.
    const query = useGetMonitoringCameras(params, {
      query: {
        enabled: slotEnabled,
        queryKey: getGetMonitoringCamerasQueryKey(params),
        staleTime: QUERY_STALE_TIME_MS,
      },
    });

    if (!slotEnabled || providerId === null) continue;

    activeRequests += 1;
    requestedProviderIds.push(providerId);
    refetchers.push(() => void query.refetch());
    matchedCount += query.data?.matchedCount ?? 0;
    if (query.isFetching) fetchingRequests += 1;
    if (query.isLoading) loadingRequests += 1;
    if (query.isError) erroredRequests += 1;

    for (const camera of query.data?.cameras ?? []) {
      if (!camerasById.has(camera.id)) camerasById.set(camera.id, camera);
    }
    for (const status of query.data?.providers ?? []) {
      providerStatuses.set(status.id, status);
    }
  }

  const cameras = [...camerasById.values()];
  const isFetching = fetchingRequests > 0;
  const hasError = erroredRequests > 0;
  const isLoading =
    activeRequests > 0 && loadingRequests > 0 && cameras.length === 0;
  const isUnavailable =
    activeRequests > 0 &&
    erroredRequests === activeRequests &&
    cameras.length === 0;

  function refetch() {
    for (const run of refetchers) run();
  }

  return {
    cameras,
    providers: [...providerStatuses.values()],
    requestedProviderIds,
    matchedCount,
    returnedCount: cameras.length,
    isFetching,
    isLoading,
    hasError,
    isUnavailable,
    isTruncated: matchedCount > cameras.length,
    refetch,
  };
}
