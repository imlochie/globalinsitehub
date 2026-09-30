import type { CameraRecord } from "@workspace/api-zod";
import type {
  CameraProviderAdapter,
  CameraProviderSnapshot,
} from "./types";

/**
 * Result of one catalogue fetch. `notModified` is returned when the upstream
 * answered HTTP 304 for the supplied ETag.
 */
export type CameraCatalogueLoadResult =
  | { cameras: CameraRecord[]; etag?: string; notModified?: false }
  | { notModified: true; etag?: string };

export type MemoryCachedCameraProviderConfig = {
  id: string;
  name: string;
  attribution: string;
  catalogueUrl: string;
  /** Status message used while the catalogue is available. */
  availableMessage: string;
  /** Status message used after a failed refresh. */
  describeFailure: (error: unknown) => string;
  /** How long a successful snapshot is reused. Default 15 minutes. */
  cacheTtlMs?: number;
  /** How long a failed snapshot is reused before retrying. Default 5 minutes. */
  retryTtlMs?: number;
  load: (etag?: string) => Promise<CameraCatalogueLoadResult>;
};

const DEFAULT_CACHE_TTL_MS = 15 * 60_000;
const DEFAULT_RETRY_TTL_MS = 5 * 60_000;

type CachedCatalogue = {
  snapshot: CameraProviderSnapshot;
  refreshAfter: number;
};

/**
 * Wraps a catalogue loader with an in-memory cache that distinguishes:
 *
 *   available   - the catalogue was fetched (or revalidated) successfully
 *   stale       - a refresh failed but previously fetched records are reused
 *   unavailable - the first load failed, so no records exist
 *
 * `feedReachability` is always "not-probed": the cache only describes
 * catalogue health, never the reachability of an individual camera feed.
 */
export function createMemoryCachedCameraProvider(
  config: MemoryCachedCameraProviderConfig,
): CameraProviderAdapter {
  const cacheTtlMs = config.cacheTtlMs ?? DEFAULT_CACHE_TTL_MS;
  const retryTtlMs = config.retryTtlMs ?? DEFAULT_RETRY_TTL_MS;

  let cached: CachedCatalogue | undefined;
  let catalogueEtag: string | undefined;
  let refreshInFlight: Promise<CameraProviderSnapshot> | undefined;

  function buildStatus(
    status: "available" | "stale" | "unavailable",
    cameraCount: number,
    checkedAt: Date,
    lastSuccessfulFetchAt: Date | null,
    message: string,
  ): CameraProviderSnapshot["provider"] {
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
      const result = await config.load(catalogueEtag);
      if (result.etag) catalogueEtag = result.etag;

      const previous = cached?.snapshot;
      const cameras =
        result.notModified === true ? (previous?.cameras ?? []) : result.cameras;
      if (result.notModified === true && !previous) {
        throw new Error(
          "Catalogue responded 304 Not Modified without a cached snapshot",
        );
      }

      const snapshot: CameraProviderSnapshot = {
        cameras,
        provider: buildStatus(
          "available",
          cameras.length,
          checkedAt,
          checkedAt,
          config.availableMessage,
        ),
      };
      cached = { snapshot, refreshAfter: Date.now() + cacheTtlMs };
      return snapshot;
    } catch (error) {
      const previous = cached?.snapshot;
      const stale = previous !== undefined && previous.cameras.length > 0;
      const snapshot: CameraProviderSnapshot = {
        cameras: previous?.cameras ?? [],
        provider: buildStatus(
          stale ? "stale" : "unavailable",
          previous?.cameras.length ?? 0,
          checkedAt,
          previous?.provider.lastSuccessfulFetchAt ?? null,
          config.describeFailure(error),
        ),
      };
      cached = { snapshot, refreshAfter: Date.now() + retryTtlMs };
      return snapshot;
    }
  }

  return {
    id: config.id,
    name: config.name,
    attribution: config.attribution,
    catalogueUrl: config.catalogueUrl,
    async getSnapshot() {
      if (cached && cached.refreshAfter > Date.now()) return cached.snapshot;
      if (!refreshInFlight) {
        refreshInFlight = refresh().finally(() => {
          refreshInFlight = undefined;
        });
      }
      return refreshInFlight;
    },
  };
}
