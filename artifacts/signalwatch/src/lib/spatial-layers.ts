/**
 * Global Layer Engine — spatial surfaces.
 *
 * `lib/global-layers.ts` normalises provider records into point observations:
 * every one of them has a latitude, a longitude and a record id. Continuous
 * surfaces have none of those. A radar mosaic covers millions of square
 * kilometres, carries no record identity, and its blank areas mean two
 * completely different things depending on whether they fall inside the
 * provider's coverage.
 *
 * This module is the parallel contract for those surfaces. It is pure — no
 * React, no network, no Leaflet — so that every decision the renderer acts on
 * (CRS, format, bounds, the optional time parameter, freshness, coverage
 * state) is computed here and can be tested directly. The map receives a
 * descriptor and draws it; it never learns which provider it came from.
 *
 * See docs/research/weather-layer-architecture.md.
 */

import type { SpatialProduct } from "@workspace/api-client-react";

export type { SpatialProduct };

/** A named geographic extent in EPSG:4326 degrees. */
export type SpatialBounds = {
  name: string;
  west: number;
  south: number;
  east: number;
  north: number;
};

/**
 * Renderable state of a surface for a given viewport.
 *
 * `outside-coverage` is resolved here rather than by the API because it is a
 * property of where the user is looking, not of the product.
 */
export type SpatialAvailability =
  | "covered"
  | "outside-coverage"
  | "stale"
  | "unavailable"
  | "unconfigured";

/** Freshness vocabulary shared with the observation layers. */
export type SpatialFreshness = "fresh" | "stale" | "unknown";

/**
 * A surface resolved for rendering.
 *
 * `render` is the single question the map asks. Everything else is provenance
 * the inspector and panel display.
 */
export type RenderableImagery = {
  key: string;
  productId: string;
  layerId: string;
  /** False whenever the surface must not be drawn, for any reason. */
  render: boolean;
  availability: SpatialAvailability;
  freshness: SpatialFreshness;
  /** Plain-language explanation of `availability`. Always populated. */
  message: string;
  service: SpatialImageryService;
  /**
   * Clip areas. Leaflet requests no tile outside them, so there is no code
   * path that can paint a surface over an area the provider does not
   * observe. An empty list means the product is global.
   */
  areas: SpatialBounds[];
  attribution: string;
  opacity: number;
  /** Explicit frame selection; null asks the provider for its latest. */
  time: string | null;
};

export type SpatialImageryService = NonNullable<SpatialProduct["imagery"]>;

/* -------------------------------------------------------------------------
 * Bounds
 * ---------------------------------------------------------------------- */

type Extent = Pick<SpatialBounds, "west" | "south" | "east" | "north">;

/** True when two extents share any area. */
export function boundsIntersect(a: Extent, b: Extent): boolean {
  return (
    a.west <= b.east && a.east >= b.west && a.south <= b.north && a.north >= b.south
  );
}

/**
 * True when the viewport overlaps none of the product's observed areas.
 *
 * Areas are tested individually and never merged. Merging NOAA's five
 * regions into one envelope would stretch from Guam to the Caribbean and
 * declare Europe "covered", which is the exact over-claim this model exists
 * to prevent.
 */
export function isOutsideCoverage(
  areas: readonly SpatialBounds[],
  viewport: Extent | null,
): boolean {
  if (areas.length === 0) return false; // global product
  if (!viewport) return false; // viewport unknown: do not pre-emptively hide
  return !areas.some((area) => boundsIntersect(area, viewport));
}

/* -------------------------------------------------------------------------
 * Freshness
 * ---------------------------------------------------------------------- */

/**
 * Freshness from the product's own cadence, never from a global threshold.
 *
 * A camera catalogue entry and a radar frame age at completely different
 * rates, so point-observation thresholds are deliberately not reused here.
 * A product with no published source time is `unknown` — not `fresh`, and not
 * given an invented timestamp.
 */
export function evaluateFreshness(
  product: Pick<SpatialProduct, "sourceTimestamp" | "staleAfterMs">,
  now: Date,
): SpatialFreshness {
  const source = product.sourceTimestamp;
  if (!source) return "unknown";
  const sourceMs = new Date(source).getTime();
  if (Number.isNaN(sourceMs)) return "unknown";
  return now.getTime() - sourceMs > product.staleAfterMs ? "stale" : "fresh";
}

/** Age of the surface in milliseconds, or null when no source time exists. */
export function surfaceAgeMs(
  product: Pick<SpatialProduct, "sourceTimestamp">,
  now: Date,
): number | null {
  if (!product.sourceTimestamp) return null;
  const sourceMs = new Date(product.sourceTimestamp).getTime();
  return Number.isNaN(sourceMs) ? null : now.getTime() - sourceMs;
}

/* -------------------------------------------------------------------------
 * Availability
 * ---------------------------------------------------------------------- */

/**
 * Resolves what the user is actually looking at.
 *
 * Order matters. Provider failure outranks everything: if NOAA did not
 * answer, "outside coverage" would be a claim Signalwatch cannot support.
 */
export function resolveAvailability(
  product: SpatialProduct,
  viewport: Extent | null,
  now: Date,
): SpatialAvailability {
  if (product.availability === "unavailable") return "unavailable";
  if (product.availability === "unconfigured") return "unconfigured";
  if (!product.imagery) return "unconfigured";
  if (isOutsideCoverage(product.coverage.areas, viewport)) {
    return "outside-coverage";
  }
  return evaluateFreshness(product, now) === "stale" ? "stale" : "covered";
}

/**
 * The sentence shown next to the layer.
 *
 * The `outside-coverage` wording is the whole point of the coverage model:
 * it says there is no source, and deliberately makes no claim about the
 * weather. "No radar here" and "no rain here" are different statements and
 * Signalwatch must never conflate them.
 */
export function describeAvailability(
  product: SpatialProduct,
  availability: SpatialAvailability,
): string {
  switch (availability) {
    case "outside-coverage":
      return (
        `${product.providerName} does not observe this area. ` +
        `${product.coverage.note} No surface is drawn here, and that is not a ` +
        "report that conditions are clear."
      );
    case "unconfigured":
      return `${product.productName} is not configured in this deployment.`;
    case "unavailable":
    case "stale":
    case "covered":
    default:
      return product.message;
  }
}

/* -------------------------------------------------------------------------
 * Rendering
 * ---------------------------------------------------------------------- */

/**
 * CRS codes the 2D map can request.
 *
 * EPSG:3857 is the map's native projection and the one the admitted radar
 * service is requested in. EPSG:4326 is listed because Leaflet supports it,
 * but note that WMS 1.3.0 reverses its axis order (BBOX is
 * miny,minx,maxy,maxx) — which is precisely why 3857 was chosen for radar.
 *
 * A product advertising anything else is not drawn. Silently substituting a
 * CRS would label the request with one projection while the extent was
 * computed in another, putting a plausible-looking surface in the wrong
 * place. For a layer whose entire value is being in the right place, drawing
 * nothing is the correct failure.
 */
export const RENDERABLE_CRS: readonly string[] = ["EPSG:3857", "EPSG:4326"];

export function isRenderableCrs(crs: string): boolean {
  return RENDERABLE_CRS.includes(crs);
}

/**
 * Turns a product into the descriptor the map consumes.
 *
 * Returns null when the product carries no imagery service at all, so the
 * renderer never has to reason about a half-populated surface.
 */
export function toRenderableImagery(
  product: SpatialProduct,
  viewport: Extent | null,
  now: Date,
  options: { time?: string | null } = {},
): RenderableImagery | null {
  const availability = resolveAvailability(product, viewport, now);
  const service = product.imagery;
  if (!service) return null;

  const drawable =
    (availability === "covered" || availability === "stale") &&
    isRenderableCrs(service.crs);

  return {
    key: `${product.layerId}:${product.id}`,
    productId: product.id,
    layerId: product.layerId,
    // Stale imagery is still drawn — it is real data, labelled as old. An
    // unavailable or out-of-coverage surface is not drawn at all, because
    // there is nothing honest to put on the map, and neither is one in a
    // projection this map cannot request faithfully.
    render: drawable,
    availability,
    freshness: evaluateFreshness(product, now),
    message: isRenderableCrs(service.crs)
      ? describeAvailability(product, availability)
      : `${product.productName} is published in ${service.crs}, which this map cannot request without reprojecting it. No surface is drawn.`,
    service,
    areas: product.coverage.areas,
    attribution: product.attribution,
    opacity: service.opacity,
    time: options.time ?? null,
  };
}

/**
 * Options for Leaflet's native `L.tileLayer.wms`.
 *
 * Built here rather than inline in the map so the parameter set is a tested
 * value instead of a hand-written literal buried in an effect. The time
 * parameter is only present when the caller selected a frame; omitting it is
 * how the provider is asked for its most recent one.
 */
export type WmsLayerOptions = {
  layers: string;
  version: string;
  format: string;
  transparent: boolean;
  crs: string;
  opacity: number;
  attribution: string;
  uppercase: true;
} & Record<string, string | number | boolean>;

export function buildWmsLayerOptions(
  imagery: Pick<RenderableImagery, "service" | "opacity" | "attribution" | "time">,
): WmsLayerOptions {
  const { service } = imagery;
  const options: WmsLayerOptions = {
    layers: service.layer,
    version: service.version,
    format: service.format,
    transparent: service.transparent,
    crs: service.crs,
    opacity: imagery.opacity,
    attribution: imagery.attribution,
    // WMS 1.3.0 parameter names are conventionally uppercase; Leaflet lowercases
    // them unless told otherwise, and some ArcGIS endpoints are strict.
    uppercase: true,
  };
  if (service.timeParameter && imagery.time) {
    options[service.timeParameter] = imagery.time;
  }
  return options;
}

/**
 * The exact GetMap URL for a given extent and pixel size.
 *
 * Leaflet builds its own tile URLs, so this is not on the tile path. It
 * exists so the panel can offer "open this frame at the provider" — the same
 * external-viewer affordance the camera layer uses — and so tests can pin the
 * precise query string rather than trusting the parameter set by eye.
 *
 * `bbox` is emitted in x,y order, which is correct for EPSG:3857. The axis
 * reversal that WMS 1.3.0 applies to EPSG:4326 is avoided by not using 4326.
 */
export function buildWmsGetMapUrl(
  service: SpatialImageryService,
  request: {
    bbox: [number, number, number, number];
    width: number;
    height: number;
    time?: string | null;
  },
): string {
  const url = new URL(service.endpoint);
  const params = url.searchParams;
  params.set("SERVICE", "WMS");
  params.set("VERSION", service.version);
  params.set("REQUEST", "GetMap");
  params.set("LAYERS", service.layer);
  params.set("STYLES", "");
  params.set("CRS", service.crs);
  params.set("BBOX", request.bbox.join(","));
  params.set("WIDTH", String(request.width));
  params.set("HEIGHT", String(request.height));
  params.set("FORMAT", service.format);
  params.set("TRANSPARENT", service.transparent ? "TRUE" : "FALSE");
  if (service.timeParameter && request.time) {
    params.set(service.timeParameter.toUpperCase(), request.time);
  }
  return url.toString();
}

/** Web-Mercator metres for a longitude/latitude pair, for GetMap extents. */
export function toWebMercator(
  longitude: number,
  latitude: number,
): [number, number] {
  const R = 6_378_137;
  const clampedLat = Math.max(-85.051129, Math.min(85.051129, latitude));
  const x = (R * longitude * Math.PI) / 180;
  const y = R * Math.log(Math.tan(Math.PI / 4 + (clampedLat * Math.PI) / 360));
  return [x, y];
}

/** Converts declared degree bounds into the EPSG:3857 bbox GetMap expects. */
export function boundsToMercatorBbox(
  bounds: Extent,
): [number, number, number, number] {
  const [west, south] = toWebMercator(bounds.west, bounds.south);
  const [east, north] = toWebMercator(bounds.east, bounds.north);
  return [west, south, east, north];
}
