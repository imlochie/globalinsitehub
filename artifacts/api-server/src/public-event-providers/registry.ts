import { fetchQldTrafficSnapshot, qldtrafficProvider } from "./qldtraffic";
import { fetchTfnswSnapshot, tfnswProvider } from "./tfnsw";
import type {
  PublicEventCoverage,
  PublicEventProviderSnapshot,
} from "./types";

/** Registered civic incident providers, in display order. */
export const publicEventProviders = [qldtrafficProvider, tfnswProvider] as const;

const CACHE_TTL_MS = 60_000;

let cached: { value: PublicEventProviderSnapshot[]; expiresAt: number } | undefined;
let inFlight: Promise<PublicEventProviderSnapshot[]> | undefined;

async function loadSnapshots(): Promise<PublicEventProviderSnapshot[]> {
  const receivedAt = new Date();
  // Settled independently: one provider failing or being unconfigured never
  // removes the others.
  const results = await Promise.allSettled([
    fetchQldTrafficSnapshot(receivedAt),
    fetchTfnswSnapshot(receivedAt),
  ]);

  return results.map((result, index) => {
    if (result.status === "fulfilled") return result.value;
    const definition = publicEventProviders[index];
    return {
      events: [],
      provider: {
        ...definition,
        status: "unavailable" as const,
        eventCount: 0,
        checkedAt: receivedAt,
        message: `${definition.name} could not be read: ${
          result.reason instanceof Error ? result.reason.message : "unknown error"
        }.`,
      },
    };
  });
}

export async function getPublicEventProviderSnapshots(): Promise<
  PublicEventProviderSnapshot[]
> {
  if (cached && cached.expiresAt > Date.now()) return cached.value;
  if (!inFlight) {
    inFlight = loadSnapshots()
      .then((value) => {
        cached = { value, expiresAt: Date.now() + CACHE_TTL_MS };
        return value;
      })
      .finally(() => {
        inFlight = undefined;
      });
  }
  return inFlight;
}

/** Test seam. */
export function resetPublicEventProviderCache(): void {
  cached = undefined;
  inFlight = undefined;
}

/**
 * Coverage is derived from the providers that actually returned data.
 *
 * A provider that is unavailable or unconfigured contributes no regions, so the
 * layer never claims coverage it is not currently delivering. With nothing
 * available the layer reports that it has no coverage rather than implying the
 * roads are clear.
 */
export function derivePublicEventCoverage(
  snapshots: readonly PublicEventProviderSnapshot[],
): PublicEventCoverage {
  const available = snapshots.filter(
    (snapshot) => snapshot.provider.status === "available",
  );

  if (available.length === 0) {
    return {
      scope: "local",
      regions: [],
      note: "No civic incident provider is currently supplying data, so no coverage can be claimed.",
    };
  }

  const regions = [
    ...new Set(
      available.flatMap((snapshot) => snapshot.provider.coverage.regions),
    ),
  ];

  return {
    // Every registered provider is a state road authority: regional by
    // construction. This must never be presented as national or global.
    scope: "regional",
    regions,
    note:
      `Regional coverage: ${regions.join(", ")}. ` +
      "Empty space elsewhere means Signalwatch has no civic incident source there, " +
      "not that no incidents are occurring. Current conditions only, not a historical archive.",
  };
}
