import type {
  MaritimeCoverage,
  MaritimeProviderStatus,
  VesselRecord,
} from "@workspace/api-zod";

/**
 * Maritime provider contract.
 *
 * Mirrors the camera provider contract deliberately: each provider owns its own
 * fetching, caching and failure reporting, and one provider failing must never
 * remove the others from the response.
 *
 * Coverage is part of the contract, not decoration. Signalwatch has no global
 * AIS source, so every provider must state the region it actually covers.
 */
export type VesselProviderSnapshot = {
  vessels: VesselRecord[];
  provider: MaritimeProviderStatus;
};

export type VesselProviderAdapter = {
  id: string;
  name: string;
  attribution: string;
  licence: string;
  licenceUrl: string;
  catalogueUrl: string;
  coverage: MaritimeCoverage;
  getSnapshot(): Promise<VesselProviderSnapshot>;
};

export type { MaritimeCoverage, MaritimeProviderStatus, VesselRecord };
