import type { CameraProviderStatus } from "@workspace/api-zod";
import type {
  CameraProviderAdapter,
  CameraProviderSnapshot,
} from "./types";
import { openTrafficCamMapProvider } from "./opentrafficcammap";
import { queenslandTmrProvider } from "./queensland-tmr";
import { transportForNswProvider } from "./transport-for-nsw";

const providers: readonly CameraProviderAdapter[] = [
  openTrafficCamMapProvider,
  queenslandTmrProvider,
  transportForNswProvider,
];

async function snapshotFor(
  adapter: CameraProviderAdapter,
): Promise<CameraProviderSnapshot> {
  try {
    return await adapter.getSnapshot();
  } catch {
    const provider: CameraProviderStatus = {
      id: adapter.id,
      name: adapter.name,
      attribution: adapter.attribution,
      catalogueUrl: adapter.catalogueUrl,
      status: "unavailable",
      feedReachability: "not-probed",
      cameraCount: 0,
      checkedAt: new Date(),
      lastSuccessfulFetchAt: null,
      message:
        "Provider catalogue is unavailable. Individual camera feed reachability is not checked.",
    };
    return { provider, cameras: [] };
  }
}

export async function getCameraProviderSnapshots(): Promise<
  CameraProviderSnapshot[]
> {
  return Promise.all(providers.map(snapshotFor));
}