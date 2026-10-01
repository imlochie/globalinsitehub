/**
 * Natural-hazard source contract.
 *
 * A hazard record is a structured observation published by a hazard-oriented
 * data source. It is deliberately not the same thing as a news item that
 * happens to mention a hazard: nothing here is derived from a headline.
 *
 * Fields are optional wherever the sources genuinely differ. Nothing is
 * normalized across providers unless the providers document a common meaning —
 * in particular there is no invented cross-provider severity number.
 */
export type HazardSourceCoverage = {
  scope: "global" | "regional" | "local";
  regions: string[];
  note: string;
};

export type HazardRecord = {
  /** Stable identity: `<source>:<provider record id>`. */
  id: string;
  source: string;
  /** Hazard category exactly as the source classifies it. Never inferred. */
  hazardType: string;
  title: string;
  latitude: number;
  longitude: number;
  /** When the source says the hazard was observed. Never the fetch time. */
  occurredAt: Date;
  /** When the source last revised the record, when it publishes that. */
  updatedAt: Date | null;
  /** When the Signalwatch API server received it. */
  receivedAt: Date;
  /**
   * Source-declared activity state ("open" / "closed"), only where the source
   * documents one. Null means the source makes no such claim.
   */
  activityStatus: "open" | "closed" | null;
  /** Magnitude as published, with its unit kept alongside it. */
  magnitudeValue: number | null;
  magnitudeUnit: string | null;
  magnitudeDescription: string | null;
  depthKm: number | null;
  /** Provider review state, e.g. USGS "automatic" / "reviewed". */
  reviewStatus: string | null;
  /**
   * The source's own severity label, where it publishes one. Carried verbatim;
   * never ranked or compared across sources, because an NWS CAP "Severe" and
   * an earthquake magnitude are not points on one scale.
   */
  sourceSeverity: string | null;
  place: string | null;
  description: string | null;
  sourceUrl: string;
  attribution: string;
  licence: string;
};

export type HazardSourceStatus = {
  id: string;
  name: string;
  attribution: string;
  licence: string;
  licenceUrl: string;
  catalogueUrl: string;
  status: "available" | "unavailable";
  coverage: HazardSourceCoverage;
  hazardCount: number;
  checkedAt: Date;
  message: string;
};

export type HazardSourceSnapshot = {
  hazards: HazardRecord[];
  source: HazardSourceStatus;
};
