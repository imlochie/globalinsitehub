import { barentswatchProvider } from "./barentswatch";
import { digitrafficProvider } from "./digitraffic";
import type {
  MaritimeCoverage,
  VesselProviderAdapter,
  VesselProviderSnapshot,
} from "./types";

/** Registered maritime providers, in response order. */
export const maritimeProviders: VesselProviderAdapter[] = [
  digitrafficProvider,
  barentswatchProvider,
];

/**
 * Derives the coverage of the maritime layer from its providers.
 *
 * The scope is only reported as `global` if every provider is global, which no
 * currently registered free source is. Regions are concatenated rather than
 * generalised, so the answer stays specific.
 */
export function deriveCoverage(
  providers: readonly Pick<VesselProviderAdapter, "coverage">[],
): MaritimeCoverage {
  const regions = [
    ...new Set(providers.flatMap((provider) => provider.coverage.regions)),
  ];
  const scope = providers.length > 0 &&
    providers.every((provider) => provider.coverage.scope === "global")
    ? "global"
    : providers.some((provider) => provider.coverage.scope !== "local")
      ? "regional"
      : "local";
  return {
    scope,
    regions,
    note:
      regions.length > 0
        ? `Signalwatch maritime coverage is regional: ${regions.join("; ")}. Outside these regions Signalwatch has no maritime source, which is not evidence that no vessels are present.`
        : "No maritime source is registered, so no vessel coverage is claimed anywhere.",
  };
}

/**
 * Collects one snapshot per provider. A provider that rejects outright still
 * contributes an `unavailable` status rather than failing the whole request,
 * so one feed going down never empties the other feed's region.
 */
export async function getMaritimeProviderSnapshots(
  providers: readonly VesselProviderAdapter[] = maritimeProviders,
): Promise<VesselProviderSnapshot[]> {
  const results = await Promise.allSettled(
    providers.map((provider) => provider.getSnapshot()),
  );
  return results.map((result, index) => {
    if (result.status === "fulfilled") return result.value;
    const provider = providers[index]!;
    return {
      vessels: [],
      provider: {
        id: provider.id,
        name: provider.name,
        attribution: provider.attribution,
        licence: provider.licence,
        licenceUrl: provider.licenceUrl,
        catalogueUrl: provider.catalogueUrl,
        status: "unavailable" as const,
        coverage: provider.coverage,
        vesselCount: 0,
        checkedAt: new Date(),
        lastSuccessfulFetchAt: null,
        message:
          "The provider feed could not be loaded. No vessel positions are claimed for its region.",
      },
    };
  });
}
