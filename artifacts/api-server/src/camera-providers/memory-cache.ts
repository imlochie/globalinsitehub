import type {
  CameraProviderStatus,
  CameraRecord,
} from "@workspace/api-zod";
import type {
  CameraProviderAdapter,
  CameraProviderSnapshot,
} from "./types";

export type CameraCatalogueLoadResult = {
  cameras?: CameraRecord[];
  etag?: string;
  notModified?: boolean;
};

type CachedCameraProviderConfig = Omit<CameraProviderAdapter, "getSnapshot"> & {
  load: (etag?: string) => Promise<CameraCatalogueLoadResult>;
  availableMessage: string;
  describeFailure: (error: unknown) => string;
  cacheTtlMs?: number;
  retryTtlMs?: number;
};

type CachedSnapshot = {
  snapshot: CameraProviderSnapshot;
  refreshAfter: number;
};

const DEFAULT_CACHE_TTL_MS = 15 * 60_000;
const DEFAULT_RETRY_TTL_MS = 5 * 60_000;

export function createMemoryCachedCameraProvider(
  config: CachedCameraProviderConfig,
): CameraProviderAdapter {
  let cached: CachedSnapshot | undefined;
  let refreshInFlight: Promise<CameraProviderSnapshot> | undefined;
  let etag: string | undefined;

  function providerStatus(
    status: CameraProviderStatus["status"],
    cameraCount: number,
    checkedAt: Date,
    lastSuccessfulFetchAt: Date | null,
    message: string,
  ): CameraProviderStatus {
    return {
      id: config.id,
      name: config.name,
      attribution: config.attribution,
      catalogueUrl: config.catalogueUrl,
      status,
      feedReachability: "not-probed",
      cameraCount,
      checkedAt,
      lastSuccessfulFetchAt,
      message,
    };
  }

  async function refresh(): Promise<CameraProviderSnapshot> {
    const checkedAt = new Date();
    try {
      const result = await config.load(etag);
      if (result.notModified) {
        if (!cached) {
          throw new Error("Provider returned not-modified without a cached catalogue");
        }
        if (result.etag !== undefined) etag = result.etag;
        const snapshot: CameraProviderSnapshot = {
          cameras: cached.snapshot.cameras,
          provider: providerStatus(
            "available",
            cached.snapshot.cameras.length,
            checkedAt,
            checkedAt,
            config.availableMessage,
          ),
        };
        cached = {
          snapshot,
          refreshAfter: Date.now() + (config.cacheTtlMs ?? DEFAULT_CACHE_TTL_MS),
        };
        return snapshot;
      }

      if (!result.cameras) {
        throw new Error("Provider response did not contain camera records");
      }

      etag = result.etag;
      const snapshot: CameraProviderSnapshot = {
        cameras: result.cameras,
        provider: providerStatus(
          "available",
          result.cameras.length,
          checkedAt,
          checkedAt,
          config.availableMessage,
        ),
      };
      cached = {
        snapshot,
        refreshAfter: Date.now() + (config.cacheTtlMs ?? DEFAULT_CACHE_TTL_MS),
      };
      return snapshot;
    } catch (error) {
      const previous = cached?.snapshot;
      const message = config.describeFailure(error);
      const snapshot: CameraProviderSnapshot = {
        cameras: previous?.cameras ?? [],
        provider: providerStatus(
          previous ? "stale" : "unavailable",
          previous?.cameras.length ?? 0,
          checkedAt,
          previous?.provider.lastSuccessfulFetchAt ?? null,
          previous
            ? `Catalogue refresh failed; serving the last successful metadata snapshot. ${message}`
            : `Catalogue unavailable. ${message}`,
        ),
      };
      cached = {
        snapshot,
        refreshAfter: Date.now() + (config.retryTtlMs ?? DEFAULT_RETRY_TTL_MS),
      };
      return snapshot;
    }
  }

  return {
    id: config.id,
    name: config.name,
    attribution: config.attribution,
    catalogueUrl: config.catalogueUrl,
    async getSnapshot() {
      if (cached && cached.refreshAfter > Date.now()) {
        return cached.snapshot;
      }
      if (!refreshInFlight) {
        refreshInFlight = refresh().finally(() => {
          refreshInFlight = undefined;
        });
      }
      return refreshInFlight;
    },
  };
}