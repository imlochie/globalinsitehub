import type {
  MaritimeCoverage,
  VesselProviderAdapter,
  VesselProviderSnapshot,
  VesselRecord,
} from "./types";

/**
 * In-memory cache wrapper for a maritime provider.
 *
 * Same availability philosophy as the camera providers: a successful fetch is
 * `available`, a failed fetch with usable previous data is `stale`, and a
 * failed fetch with nothing to fall back on is `unavailable`. AIS positions age
 * much faster than a camera catalogue, so the defaults here are minutes, not
 * a quarter of an hour, and cached vessels older than `maxRecordAgeMs` are
 * dropped rather than replayed as if they were live.
 */
export type CachedVesselProviderConfig = {
  id: string;
  name: string;
  attribution: string;
  licence: string;
  licenceUrl: string;
  catalogueUrl: string;
  coverage: MaritimeCoverage;
  /** Message used when the last fetch succeeded. */
  availableMessage: string;
  /** How long a successful snapshot is served before refetching. */
  cacheTtlMs?: number;
  /** How long to wait before retrying after a failure. */
  retryTtlMs?: number;
  /**
   * Maximum age of a cached record, measured from Signalwatch receipt time.
   * Older records are removed instead of being presented as current positions.
   */
  maxRecordAgeMs?: number;
  load(): Promise<VesselRecord[]>;
  describeFailure(error: unknown): string;
};

const DEFAULT_CACHE_TTL_MS = 60_000;
const DEFAULT_RETRY_TTL_MS = 30_000;
const DEFAULT_MAX_RECORD_AGE_MS = 15 * 60_000;

export function createMemoryCachedVesselProvider(
  config: CachedVesselProviderConfig,
): VesselProviderAdapter {
  const cacheTtlMs = config.cacheTtlMs ?? DEFAULT_CACHE_TTL_MS;
  const retryTtlMs = config.retryTtlMs ?? DEFAULT_RETRY_TTL_MS;
  const maxRecordAgeMs = config.maxRecordAgeMs ?? DEFAULT_MAX_RECORD_AGE_MS;

  let cached: { snapshot: VesselProviderSnapshot; refreshAfter: number } | undefined;
  let refreshInFlight: Promise<VesselProviderSnapshot> | undefined;

  function buildStatus(
    status: "available" | "stale" | "unavailable",
    vesselCount: number,
    checkedAt: Date,
    lastSuccessfulFetchAt: Date | null,
    message: string,
  ): VesselProviderSnapshot["provider"] {
    return {
      id: config.id,
      name: config.name,
      attribution: config.attribution,
      licence: config.licence,
      licenceUrl: config.licenceUrl,
      catalogueUrl: config.catalogueUrl,
      status,
      coverage: config.coverage,
      vesselCount,
      checkedAt,
      lastSuccessfulFetchAt,
      message,
    };
  }

  /** Cached positions are only reusable while they are still recent. */
  function usableCachedVessels(now: number): VesselRecord[] {
    const previous = cached?.snapshot.vessels ?? [];
    return previous.filter((vessel) => {
      const receivedAt = new Date(vessel.receivedAt).getTime();
      return Number.isFinite(receivedAt) && now - receivedAt <= maxRecordAgeMs;
    });
  }

  async function refresh(): Promise<VesselProviderSnapshot> {
    const checkedAt = new Date();
    try {
      const vessels = await config.load();
      const snapshot: VesselProviderSnapshot = {
        vessels,
        provider: buildStatus(
          "available",
          vessels.length,
          checkedAt,
          checkedAt,
          config.availableMessage,
        ),
      };
      cached = { snapshot, refreshAfter: Date.now() + cacheTtlMs };
      return snapshot;
    } catch (error) {
      const vessels = usableCachedVessels(checkedAt.getTime());
      const snapshot: VesselProviderSnapshot = {
        vessels,
        provider: buildStatus(
          vessels.length > 0 ? "stale" : "unavailable",
          vessels.length,
          checkedAt,
          cached?.snapshot.provider.lastSuccessfulFetchAt ?? null,
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
    licence: config.licence,
    licenceUrl: config.licenceUrl,
    catalogueUrl: config.catalogueUrl,
    coverage: config.coverage,
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
