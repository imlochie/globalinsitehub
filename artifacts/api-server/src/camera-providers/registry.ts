import { openTrafficCamMapProvider } from "./opentrafficcammap";
import { queenslandTmrProvider } from "./queensland-tmr";
import { transportForNswProvider } from "./transport-for-nsw";
import type { CameraProviderAdapter, CameraProviderSnapshot } from "./types";

/** Registered camera catalogue providers, in response order. */
export const cameraProviders: CameraProviderAdapter[] = [
  queenslandTmrProvider,
  transportForNswProvider,
  openTrafficCamMapProvider,
];

/**
 * Collects one snapshot per provider. A provider that rejects outright still
 * contributes an `unavailable` status rather than failing the whole request,
 * so partial provider failures stay visible instead of hiding the catalogue.
 */
export async function getCameraProviderSnapshots(): Promise<
  CameraProviderSnapshot[]
> {
  const results = await Promise.allSettled(
    cameraProviders.map((provider) => provider.getSnapshot()),
  );
  return results.map((result, index) => {
    if (result.status === "fulfilled") return result.value;
    const provider = cameraProviders[index]!;
    return {
      cameras: [],
      provider: {
        id: provider.id,
        name: provider.name,
        attribution: provider.attribution,
        catalogueUrl: provider.catalogueUrl,
        status: "unavailable" as const,
        feedReachability: "not-probed" as const,
        cameraCount: 0,
        checkedAt: new Date(),
        lastSuccessfulFetchAt: null,
        message:
          "The provider catalogue could not be loaded. No individual camera feed reachability is claimed.",
      },
    };
  });
}
