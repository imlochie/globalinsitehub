/**
 * Public-event (civic incident) provider contract.
 *
 * A public event is geolocated civic reporting published by an authority:
 * incidents, crashes, closures, roadworks, flooding-affected roads, major
 * events. It is deliberately not a hazard observation and not a news item.
 *
 * Classification is always the category the source assigned. Nothing here is
 * reclassified from wording — a road closed because of flooding is a civic
 * incident reported by a transport authority, not a geophysical hazard.
 */
export type PublicEventCoverage = {
  scope: "global" | "regional" | "local";
  regions: string[];
  note: string;
};

/**
 * A location derived from a provider geometry that is not a single point.
 *
 * QLDTraffic road events are GeometryCollections of LineStrings covering
 * several non-contiguous road segments, so there is no "the" location. When a
 * point has to be derived, it is flagged so the UI can say so rather than
 * implying a surveyed coordinate.
 */
export type PublicEventLocation = {
  latitude: number;
  longitude: number;
  derived: boolean;
  derivedFrom: string | null;
};

export type PublicEventImpact = {
  direction: string | null;
  towards: string | null;
  impactType: string | null;
  impactSubtype: string | null;
  delay: string | null;
};

export type PublicEventRoadSummary = {
  roadName: string | null;
  locality: string | null;
  postcode: string | null;
  localGovernmentArea: string | null;
  district: string | null;
};

export type PublicEventRecord = {
  /** Stable identity: `<provider>:<provider record id>`. */
  id: string;
  provider: string;
  /** Category exactly as the source classifies it. Never inferred. */
  eventType: string;
  eventSubtype: string | null;
  /** Source-supplied cause, where the source publishes one. */
  eventDueTo: string | null;
  title: string;
  description: string | null;
  advice: string | null;
  latitude: number;
  longitude: number;
  /** True when the coordinate was derived rather than published as a point. */
  locationDerived: boolean;
  locationNote: string | null;
  /**
   * The source's own priority label (e.g. QLDTraffic "Low"). It is NOT a
   * severity score, is never numeric, and is never compared across providers.
   */
  sourcePriority: string | null;
  /** Source publication state, e.g. QLDTraffic "Published". */
  status: string | null;
  impact: PublicEventImpact | null;
  roadSummary: PublicEventRoadSummary | null;
  /** When the source published the record. */
  publishedAt: Date | null;
  /** When the source last revised it. */
  lastUpdatedAt: Date | null;
  /** Source-declared start/end of the event, where published. */
  startedAt: Date | null;
  endsAt: Date | null;
  /** When the Signalwatch API server received it. */
  receivedAt: Date;
  sourceUrl: string;
  /**
   * The body that actually supplied the record. QLDTraffic republishes records
   * from TMR, Transport for NSW and local governments, so this can differ from
   * the provider Signalwatch fetched from.
   */
  suppliedBy: string | null;
  attribution: string;
  licence: string;
};

export type PublicEventProviderStatus = {
  id: string;
  name: string;
  attribution: string;
  licence: string;
  licenceUrl: string;
  catalogueUrl: string;
  /**
   * `unconfigured` means the provider needs a credential Signalwatch does not
   * have. It is reported honestly and never blocks the other providers.
   */
  status: "available" | "unavailable" | "unconfigured";
  coverage: PublicEventCoverage;
  eventCount: number;
  checkedAt: Date;
  message: string;
};

export type PublicEventProviderSnapshot = {
  events: PublicEventRecord[];
  provider: PublicEventProviderStatus;
};

export type PublicEventProviderAdapter = {
  id: string;
  fetchSnapshot: (receivedAt: Date) => Promise<PublicEventProviderSnapshot>;
};
