/**
 * Global Layer Engine — map scale bands.
 *
 * Signalwatch is meant to answer a different question at each scale:
 *
 *   global        what is happening?
 *   regional      what is happening here?
 *   city          what is happening around this place?
 *   street        what is happening on this road?
 *   streetContext what does the situation look like from here?
 *
 * A zoom level is the wrong thing for shared code to reason about, because a
 * zoom number means nothing on its own — it is only meaningful next to the
 * ground resolution it implies. This module converts Leaflet's zoom integer
 * into a named band once, so that renderers, layer policy and panels all
 * branch on the same vocabulary instead of on scattered magic numbers.
 *
 * The band edges are derived from Leaflet's actual projection rather than
 * chosen by eye. Leaflet's EPSG:3857 CRS uses 256 px tiles over a
 * 40_075_016.686 m equator, so:
 *
 *   metres per pixel = 40_075_016.686 / (256 * 2^zoom)
 *
 * which gives, with the span of a 1024 px-wide viewport:
 *
 *   zoom   m/px      1024 px spans    what is legible
 *    2     39_135    40_074 km        whole world; a street is sub-pixel
 *    3     19_567    20_037 km        hemisphere
 *    4      9_784    10_018 km        continent
 *    5      4_892     5_009 km        large country
 *    6      2_446     2_505 km        country
 *    7      1_223     1_252 km        state / province
 *    8        611       626 km        metropolitan region
 *    9        306       313 km        metro area
 *   10        153       156 km        city and its surroundings
 *   11         76        78 km        city
 *   12         38        39 km        a major road is about 1 px wide
 *   13         19        20 km        road network becomes legible
 *   14         10        10 km        suburb
 *   15          5         4.9 km      neighbourhood; roads ~3 px
 *   16          2.4       2.4 km      street; a building is tens of px
 *   17          1.2       1.2 km      lane level
 *   18          0.6       0.6 km      individual vehicles would be visible
 *
 * The bands are cut where that table changes character, not at round numbers:
 *
 *   global        2-3    a road is smaller than one pixel. Only phenomena
 *                        measured in hundreds of kilometres mean anything.
 *   regional      4-7    country to continent. Weather systems, hazard
 *                        clusters and coverage boundaries are the subject.
 *   city          8-11   a city fits on screen. Individual infrastructure
 *                        becomes locatable but roads are still hairlines.
 *   street       12-15   roads acquire width and separation; this is the
 *                        first band where "which road" is a real question.
 *   streetContext 16-18  lane and frontage level; the band where
 *                        street-level imagery would make sense.
 *
 * Nothing here knows about any particular layer or provider.
 */

/** Named spatial scales, ordered from coarsest to finest. */
export const MAP_SCALE_BANDS = [
  "global",
  "regional",
  "city",
  "street",
  "streetContext",
] as const;

export type MapScaleBand = (typeof MAP_SCALE_BANDS)[number];

/**
 * The zoom range of each band, inclusive at both ends.
 *
 * `minZoom`/`maxZoom` of the map itself are derived from this table rather
 * than declared separately, so a band cannot drift out of the reachable
 * range.
 */
export const MAP_SCALE_BAND_ZOOM: Record<
  MapScaleBand,
  { minZoom: number; maxZoom: number }
> = {
  global: { minZoom: 2, maxZoom: 3 },
  regional: { minZoom: 4, maxZoom: 7 },
  city: { minZoom: 8, maxZoom: 11 },
  street: { minZoom: 12, maxZoom: 15 },
  streetContext: { minZoom: 16, maxZoom: 18 },
};

/** Lowest zoom the map allows. Below it no band is defined. */
export const MAP_MIN_ZOOM = MAP_SCALE_BAND_ZOOM.global.minZoom;
/** Highest zoom the map allows. */
export const MAP_MAX_ZOOM = MAP_SCALE_BAND_ZOOM.streetContext.maxZoom;

/**
 * The initial map camera is NOT defined here.
 *
 * It is a product preference — which region Signalwatch opens on — and lives
 * in `regional-priority.ts` so this module stays the physical band model and
 * nothing more. Importing it the other way round would be a cycle.
 */

/**
 * Zoom used when the app focuses a selected record.
 *
 * `city` rather than `street`: selecting a camera or an incident should show
 * it in its surroundings, not fill the screen with one intersection. The
 * previous literal `6` sat in the middle of `regional`, which put a selected
 * camera on a view spanning well over a thousand kilometres.
 */
export const MAP_FOCUS_ZOOM = MAP_SCALE_BAND_ZOOM.city.minZoom;

/** Equatorial circumference used by the EPSG:3857 pixel grid. */
const EQUATOR_METRES = 40_075_016.686;
const TILE_SIZE = 256;

/** Ground resolution at the equator, in metres per pixel, for a zoom level. */
export function metresPerPixel(zoom: number): number {
  return EQUATOR_METRES / (TILE_SIZE * 2 ** zoom);
}

const ORDER = new Map<MapScaleBand, number>(
  MAP_SCALE_BANDS.map((band, index) => [band, index]),
);

/** Position of a band in the coarse-to-fine ordering. */
export function bandIndex(band: MapScaleBand): number {
  return ORDER.get(band) ?? 0;
}

/**
 * The band containing a zoom level.
 *
 * Zooms outside the configured range clamp to the nearest band rather than
 * throwing: Leaflet can briefly report a fractional or out-of-range zoom
 * mid-animation, and a renderer must not crash because an easing function
 * overshot. Fractional zooms floor, matching how Leaflet picks a tile level.
 */
export function scaleBandForZoom(zoom: number): MapScaleBand {
  if (!Number.isFinite(zoom)) return "global";
  const level = Math.floor(zoom);
  if (level <= MAP_MIN_ZOOM) return "global";
  if (level >= MAP_MAX_ZOOM) return "streetContext";
  for (const band of MAP_SCALE_BANDS) {
    const range = MAP_SCALE_BAND_ZOOM[band];
    if (level >= range.minZoom && level <= range.maxZoom) return band;
  }
  return "global";
}

/** True when `band` is at least as fine-grained as `minimum`. */
export function isBandAtLeast(band: MapScaleBand, minimum: MapScaleBand): boolean {
  return bandIndex(band) >= bandIndex(minimum);
}

/** True when `band` is no finer than `maximum`. */
export function isBandAtMost(band: MapScaleBand, maximum: MapScaleBand): boolean {
  return bandIndex(band) <= bandIndex(maximum);
}

/** Inclusive list of bands between two endpoints, in coarse-to-fine order. */
export function bandsBetween(
  from: MapScaleBand,
  to: MapScaleBand,
): MapScaleBand[] {
  const start = Math.min(bandIndex(from), bandIndex(to));
  const end = Math.max(bandIndex(from), bandIndex(to));
  return MAP_SCALE_BANDS.slice(start, end + 1);
}

/** Short caption for the band, for status readouts. */
export const MAP_SCALE_BAND_LABEL: Record<MapScaleBand, string> = {
  global: "Global",
  regional: "Regional",
  city: "City",
  street: "Street",
  streetContext: "Street context",
};

/**
 * The question each band is meant to answer.
 *
 * Surfaced in the UI so the scale readout explains itself instead of showing
 * a bare zoom integer the user has no way to interpret.
 */
export const MAP_SCALE_BAND_QUESTION: Record<MapScaleBand, string> = {
  global: "What is happening?",
  regional: "What is happening here?",
  city: "What is happening around this place?",
  street: "What is happening on this road?",
  streetContext: "What does the situation look like from here?",
};
