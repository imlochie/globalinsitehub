import {
  getGetMonitoringCamerasQueryKey,
  useGetMonitoringCameras,
  type CameraProviderStatus,
  type CameraRecord,
} from "@workspace/api-client-react";
import { cameraProviderIdsForFilter } from "@/lib/global-layers";

export type CameraCountry = "AU" | "US";
export type CameraProviderSelection =
  | "all"
  | "qld-tmr"
  | "transport-for-nsw"
  | "opentrafficcammap";

const CAMERA_REQUEST_LIMIT = 250;
const QUERY_STALE_TIME_MS = 5 * 60_000;

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
  const qldParams = {
    country,
    provider: "qld-tmr",
    limit: CAMERA_REQUEST_LIMIT,
    q: queryText,
  };
  const nswParams = {
    country,
    provider: "transport-for-nsw",
    limit: CAMERA_REQUEST_LIMIT,
    q: queryText,
  };
  const usParams = {
    country,
    provider: "opentrafficcammap",
    limit: CAMERA_REQUEST_LIMIT,
    q: queryText,
  };

  const requestedProviders = cameraProviderIdsForFilter(country, provider);
  const qldEnabled = enabled && requestedProviders.includes("qld-tmr");
  const nswEnabled =
    enabled && requestedProviders.includes("transport-for-nsw");
  const usEnabled =
    enabled && requestedProviders.includes("opentrafficcammap");

  const qldQuery = useGetMonitoringCameras(qldParams, {
    query: {
      enabled: qldEnabled,
      queryKey: getGetMonitoringCamerasQueryKey(qldParams),
      staleTime: QUERY_STALE_TIME_MS,
    },
  });
  const nswQuery = useGetMonitoringCameras(nswParams, {
    query: {
      enabled: nswEnabled,
      queryKey: getGetMonitoringCamerasQueryKey(nswParams),
      staleTime: QUERY_STALE_TIME_MS,
    },
  });
  const usQuery = useGetMonitoringCameras(usParams, {
    query: {
      enabled: usEnabled,
      queryKey: getGetMonitoringCamerasQueryKey(usParams),
      staleTime: QUERY_STALE_TIME_MS,
    },
  });

  const requests = [
    { providerId: "qld-tmr", enabled: qldEnabled, query: qldQuery },
    { providerId: "transport-for-nsw", enabled: nswEnabled, query: nswQuery },
    { providerId: "opentrafficcammap", enabled: usEnabled, query: usQuery },
  ].filter((request) => request.enabled);

  const camerasById = new Map<string, CameraRecord>();
  const providerStatuses = new Map<string, CameraProviderStatus>();
  for (const request of requests) {
    for (const camera of request.query.data?.cameras ?? []) {
      if (!camerasById.has(camera.id)) camerasById.set(camera.id, camera);
    }
    for (const status of request.query.data?.providers ?? []) {
      providerStatuses.set(status.id, status);
    }
  }

  const cameras = [...camerasById.values()];
  const matchedCount = requests.reduce(
    (total, request) => total + (request.query.data?.matchedCount ?? 0),
    0,
  );
  const isFetching = requests.some((request) => request.query.isFetching);
  const hasError = requests.some((request) => request.query.isError);
  const isLoading =
    requests.length > 0 &&
    requests.some((request) => request.query.isLoading) &&
    cameras.length === 0;
  const isUnavailable =
    requests.length > 0 &&
    requests.every((request) => request.query.isError) &&
    cameras.length === 0;

  function refetch() {
    for (const request of requests) {
      void request.query.refetch();
    }
  }

  return {
    cameras,
    providers: [...providerStatuses.values()],
    requestedProviderIds: requests.map((request) => request.providerId),
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