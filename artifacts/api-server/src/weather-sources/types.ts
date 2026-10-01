/**
 * Spatial product contract.
 *
 * Signalwatch's existing layers are point observations: a record with a
 * latitude, a longitude and an identity. Weather is not that. A radar frame is
 * a continuous surface covering millions of square kilometres, with no record
 * id and no single coordinate, and a model field is a gridded array of values.
 *
 * Forcing either into the observation contract would mean inventing a centroid
 * the provider never published, and — far worse — losing the distinction
 * between "measured here, nothing detected" and "no source observes here at
 * all". See docs/research/weather-layer-architecture.md section 2.
 *
 * So weather products are described by this parallel, deliberately small
 * contract. It shares the vocabulary of the observation layers (provider
 * identity, attribution, licence, coverage, availability) without sharing
 * their shape.
 */

/** Matches the layer registry's coverage scopes. */
export type SpatialCoverageScope = "global" | "regional" | "local";

/** Geographic bounds in EPSG:4326 degrees. */
export type SpatialBounds = {
  /** Region name, so a clip box is never an unattributed number. */
  name: string;
  west: number;
  south: number;
  east: number;
  north: number;
};

export type SpatialCoverage = {
  scope: SpatialCoverageScope;
  /** Human-readable regions actually observed. */
  regions: string[];
  /** Plain-language statement of what is and is not covered. */
  note: string;
  /**
   * Areas the product actually observes, as disjoint boxes. An EMPTY list
   * means global.
   *
   * A list rather than a single box, because a single box is wrong for most
   * real products. NOAA's radar service publishes one geographic bounding
   * box of -176..150 longitude — the plain min/max of regions that include
   * both Guam (+145) and the Caribbean (-65). Treated as one extent that
   * envelope covers Europe, Africa and Asia, where the service has no data
   * at all and would answer with transparent pixels. Transparent pixels over
   * Europe are indistinguishable from "no precipitation in Europe", which is
   * the single claim this layer must never make.
   *
   * So coverage is clipped per region instead. The boxes are drawn
   * generously around the regions the provider itself names, so no published
   * data is ever hidden, while areas the provider plainly does not observe
   * are never requested.
   */
  areas: SpatialBounds[];
};

/**
 * Coverage/health state of a spatial product.
 *
 *   covered          — inside coverage, provider healthy, surface fresh
 *   stale            — surface older than the product's stale threshold
 *   unavailable      — the provider or its metadata could not be reached
 *   unconfigured     — admitted but not configured in this deployment
 *
 * `outside-coverage` is deliberately NOT part of this union: it is a property
 * of the viewport, not of the product, and is decided client-side against
 * `coverage.bounds`.
 */
export type SpatialAvailability =
  | "covered"
  | "stale"
  | "unavailable"
  | "unconfigured";

/**
 * How a raster product is rendered.
 *
 * A discriminated union with one member today. A future XYZ or WMTS source
 * adds a member instead of overloading the WMS shape with optional fields.
 */
export type SpatialImageryService = {
  protocol: "wms";
  /** GetMap base URL. The browser requests tiles from here directly. */
  endpoint: string;
  /** WMS layer name. */
  layer: string;
  /** WMS protocol version, e.g. "1.3.0". */
  version: string;
  /**
   * Requested CRS. EPSG:3857 is chosen deliberately: WMS 1.3.0 reverses axis
   * order for EPSG:4326 (BBOX is miny,minx,maxy,maxx), and 3857 is also the
   * map's native CRS, so no reprojection and no axis trap.
   */
  crs: string;
  format: string;
  transparent: boolean;
  /**
   * Name of the time parameter when the service is time-enabled, else null.
   * Omitting the parameter asks the provider for its most recent frame.
   */
  timeParameter: string | null;
  /** Default render opacity, 0..1. */
  opacity: number;
};

/**
 * Gridded numeric field descriptor.
 *
 * DESIGN ONLY in this batch. No GRIB2 decoder, no GFS ingestion and no field
 * provider exists. This is declared so the next batch extends the model
 * instead of replacing it, and so the shared parts (coverage, freshness,
 * provenance, health) are provably reusable.
 */
export type SpatialFieldDescriptor = {
  /** Provider's variable name, e.g. "temperature_2m". */
  variable: string;
  /** Unit as the provider publishes it. Never converted silently. */
  unit: string;
  grid: { width: number; height: number };
  resolutionDegrees: number;
  /** Published value range, where the provider states one. */
  valueRange: { min: number; max: number } | null;
  /** How the provider encodes "no data". Never confused with zero. */
  missingValue: number | null;
  modelId: string | null;
  runId: string | null;
};

/**
 * A spatial product as published to the API.
 *
 * The three timestamps are kept separate on purpose. Collapsing them would
 * make a forecast indistinguishable from an observation.
 */
export type SpatialProduct = {
  /** Stable product id, e.g. "nws-radar-base-reflectivity". */
  id: string;
  /** Owning registry layer id. */
  layerId: string;
  kind: "imagery" | "field";
  providerId: string;
  providerName: string;
  productName: string;
  /** What the product actually measures, in the provider's own terms. */
  productDescription: string;
  attribution: string;
  sourceUrl: string;
  licence: string;
  coverage: SpatialCoverage;
  /** When the provider says the content is valid. Null when not published. */
  sourceTimestamp: Date | null;
  /** When the Signalwatch API server retrieved it. Never the source time. */
  ingestionTimestamp: Date;
  /** Model valid time. Null for observations — radar is an observation. */
  validTime: Date | null;
  /** Model run/reference time. Null for observations. */
  runTime: Date | null;
  /** Documented provider cadence. Clients must not poll faster. */
  refreshIntervalMs: number;
  /** Age past which the surface is stale. */
  staleAfterMs: number;
  availability: SpatialAvailability;
  /** Plain-language status sentence shown next to the layer. */
  message: string;
  /** Present when kind === "imagery". */
  imagery: SpatialImageryService | null;
  /** Present when kind === "field". Always null in this batch. */
  field: SpatialFieldDescriptor | null;
};
