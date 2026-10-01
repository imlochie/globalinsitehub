/**
 * Weather product registry.
 *
 * Mirrors the hazard-source registry: one upstream metadata request per
 * refresh interval behind a single-flight cache, products settled
 * independently so one failing provider never empties the layer.
 *
 * What is cached here is METADATA only — which frame the provider is serving
 * and whether the service is healthy. The imagery itself is never relayed
 * through Signalwatch; the browser requests tiles from the provider directly,
 * the same split used for camera media. See
 * docs/research/weather-layer-architecture.md section 7.
 */

import {
  buildRadarProduct,
  fetchRadarCapabilities,
  REFRESH_INTERVAL_MS,
} from "./nws-radar";
import type { SpatialCoverage, SpatialProduct } from "./types";

/**
 * Cache TTL equals the provider's documented refresh cadence. N connected
 * clients therefore cause at most one capabilities request per cycle, which
 * is what the NWS appropriate-use notice asks for.
 */
const CACHE_TTL_MS = REFRESH_INTERVAL_MS;

type ProductLoader = (now: Date) => Promise<SpatialProduct>;

const loaders: ProductLoader[] = [
  async (now) => buildRadarProduct(await fetchRadarCapabilities(), now),
];

let cached: { value: SpatialProduct[]; expiresAt: number } | undefined;
let inFlight: Promise<SpatialProduct[]> | undefined;

async function refresh(): Promise<SpatialProduct[]> {
  const now = new Date();
  const settled = await Promise.allSettled(loaders.map((load) => load(now)));
  return settled.flatMap((result) =>
    result.status === "fulfilled" ? [result.value] : [],
  );
}

/** Returns the current weather products, refreshing at most once per TTL. */
export async function getWeatherProducts(): Promise<SpatialProduct[]> {
  if (cached && cached.expiresAt > Date.now()) return cached.value;
  if (!inFlight) {
    inFlight = refresh()
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

/** Test seam: drops the cache so a test can control the next fetch. */
export function resetWeatherProductCache(): void {
  cached = undefined;
  inFlight = undefined;
}

/**
 * Coverage of the weather layer as a whole, derived from the products that
 * actually answered.
 *
 * Deriving never upgrades the scope: one regional product keeps the layer
 * regional. With no products the layer reports local scope and says plainly
 * that nothing is configured, rather than defaulting to a global claim.
 */
export function deriveWeatherCoverage(
  products: SpatialProduct[],
): SpatialCoverage {
  const usable = products.filter(
    (product) => product.availability !== "unconfigured",
  );
  if (usable.length === 0) {
    return {
      scope: "local",
      regions: [],
      note: "No weather product is configured in this deployment.",
      areas: [],
    };
  }

  const regions = [...new Set(usable.flatMap((product) => product.coverage.regions))];
  const scope = usable.every((product) => product.coverage.scope === "global")
    ? ("global" as const)
    : usable.some((product) => product.coverage.scope !== "local")
      ? ("regional" as const)
      : ("local" as const);

  // Areas are concatenated, never merged into an envelope: merging two
  // disjoint regions into their bounding box is exactly the over-claim this
  // model exists to avoid. A product with no areas is global, which makes
  // every other product's clip irrelevant.
  const areas = usable.some((product) => product.coverage.areas.length === 0)
    ? []
    : usable.flatMap((product) => product.coverage.areas);

  return {
    scope,
    regions,
    note:
      scope === "global"
        ? "Worldwide coverage."
        : `Covers ${regions.join("; ")}. Elsewhere Signalwatch has no weather source, ` +
          "which is not a statement that the weather there is clear.",
    areas,
  };
}
