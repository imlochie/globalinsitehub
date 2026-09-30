import type {
  CameraProviderStatus,
  CameraRecord,
} from "@workspace/api-zod";

/**
 * One provider catalogue snapshot: the catalogue records plus the provider's
 * catalogue health. Feed reachability is never part of this: Signalwatch does
 * not probe or proxy individual camera feeds.
 */
export type CameraProviderSnapshot = {
  provider: CameraProviderStatus;
  cameras: CameraRecord[];
};

/** A camera catalogue source that can produce a snapshot on demand. */
export type CameraProviderAdapter = {
  id: string;
  name: string;
  attribution: string;
  catalogueUrl: string;
  getSnapshot(): Promise<CameraProviderSnapshot>;
};
