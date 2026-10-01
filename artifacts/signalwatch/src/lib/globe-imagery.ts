/**
 * Projecting admitted spatial imagery onto the globe.
 *
 * This is the globe's half of the split the registry now describes: the same
 * `RenderableImagery` the 2D map consumes, turned into curved surface patches
 * on a sphere. There is deliberately no second weather product type, and no
 * provider metadata is restated here — everything comes from the authoritative
 * descriptor the API already produced.
 *
 *
 * WHY ONE PATCH PER COVERAGE AREA
 * -------------------------------
 * NOAA publishes five disjoint radar areas. They are never merged into an
 * envelope, here or anywhere else: the bounding box of Alaska and Guam
 * contains most of the Pacific, and painting a transparent raster across it
 * would say "no rain here" over an ocean NOAA does not observe. One patch per
 * declared area means there is no code path that can draw outside coverage,
 * which is the same guarantee Leaflet's `bounds` gives on the 2D map.
 *
 *
 * WHY CRS:84 AND NOT EPSG:3857
 * ----------------------------
 * three-globe's tile layer places a texture on a latitude/longitude rectangle
 * and curves it to the sphere. That is an equirectangular (plate carrée)
 * frame, so the texture must be requested in one.
 *
 * The 2D map uses EPSG:3857 because Leaflet's tile pyramid is Web Mercator.
 * Handing a Mercator image to a lat/lng patch would stretch everything
 * north-south — the radar would sit visibly north of the weather.
 *
 * Of the two geographic options NOAA advertises, CRS:84 is correct and
 * EPSG:4326 is a trap: WMS 1.3.0 flips EPSG:4326 to latitude-first axis
 * order, so a west,south,east,north bbox silently means something else.
 * CRS:84 is defined as longitude-first, so the same bbox tuple used
 * everywhere else in this codebase stays valid.
 *
 * This is a renderer-specific projection derived from the shared service
 * descriptor, not a duplicate of it: the endpoint, layer, version, format,
 * transparency, frame and attribution all still come from the one object.
 */

import { layerRegistry } from "@/lib/layer-registry";
import {
  buildWmsGetMapUrl,
  type RenderableImagery,
  type SpatialBounds,
} from "@/lib/spatial-layers";

/**
 * The CRS the globe requests imagery in.
 *
 * Longitude-first by definition, which is why it is used instead of
 * EPSG:4326. See the module note above.
 */
export const GLOBE_IMAGERY_CRS = "CRS:84";

/**
 * Longest edge, in pixels, of a requested surface texture.
 *
 * A compromise, stated rather than tuned by eye. MRMS resolves about 565 m,
 * so matching it across the continental United States would need roughly
 * 11,000 pixels — far past common GPU texture limits and far past what a
 * globe-scale view can show. 2048 keeps the longest edge inside the 4096
 * floor that WebGL implementations are required to support, and at
 * continental extent still resolves a few kilometres per pixel, which is
 * finer than the globe can display.
 */
export const GLOBE_TEXTURE_MAX_EDGE = 2048;

/** Altitude of the surface above the globe, in units of globe radius. */
export const GLOBE_IMAGERY_ALTITUDE = 0.006;

/**
 * Angular step used to curve each patch to the sphere.
 *
 * Smaller means a smoother fit and more geometry. Five degrees puts roughly
 * a dozen segments across a continent-sized area, which is enough that the
 * patch follows the curvature rather than floating as a flat card.
 */
export const GLOBE_IMAGERY_CURVATURE_RESOLUTION = 4;

/** A single projected surface patch, in the shape three-globe's tiles want. */
export type GlobeImageryTile = {
  /** Stable identity: product plus coverage area. */
  key: string;
  productId: string;
  layerId: string;
  /** The provider's own name for this coverage area. */
  areaName: string;
  /** Patch centroid. */
  lat: number;
  lng: number;
  /** Patch size in degrees. */
  widthDegrees: number;
  heightDegrees: number;
  /** Direct provider URL. The browser fetches this; the API never relays it. */
  textureUrl: string;
  opacity: number;
  attribution: string;
  /** Selected frame, or null for the provider's latest. */
  time: string | null;
};

/** Pixel dimensions for a bounds, preserving aspect ratio. */
export function textureDimensions(
  bounds: SpatialBounds,
  maxEdge = GLOBE_TEXTURE_MAX_EDGE,
): { width: number; height: number } {
  const spanLng = Math.abs(bounds.east - bounds.west);
  const spanLat = Math.abs(bounds.north - bounds.south);
  if (spanLng <= 0 || spanLat <= 0) return { width: 1, height: 1 };

  const scale = maxEdge / Math.max(spanLng, spanLat);
  return {
    width: Math.max(1, Math.round(spanLng * scale)),
    height: Math.max(1, Math.round(spanLat * scale)),
  };
}

/**
 * Turns map-ready surfaces into globe patches.
 *
 * Only surfaces the shared availability model already cleared for drawing
 * are projected. A surface that is outside coverage, beyond its scale cap,
 * stale-but-undrawable, or unavailable contributes nothing — the globe
 * inherits those decisions rather than re-deciding them, which is what keeps
 * the two renderers from disagreeing about what the provider is serving.
 *
 * A product with no declared areas is global by the coverage model's own
 * convention, and is projected as a single world patch.
 */
export function toGlobeImageryTiles(
  surfaces: readonly RenderableImagery[],
  options: { maxEdge?: number } = {},
): GlobeImageryTile[] {
  const maxEdge = options.maxEdge ?? GLOBE_TEXTURE_MAX_EDGE;
  const tiles: GlobeImageryTile[] = [];

  for (const surface of surfaces) {
    if (!surface.render) continue;

    // A surface is only projected if its layer has actually been granted a
    // globe renderer. Enforced here, in the shared module, rather than left
    // to each caller: "this provider is admitted" and "this provider has an
    // authorised globe projection" are separate permissions, and the second
    // is the one that licenses drawing on the sphere.
    const definition = layerRegistry.get(surface.layerId);
    if (!definition?.capabilities.globe) continue;

    const areas: SpatialBounds[] =
      surface.areas.length > 0
        ? surface.areas
        : [{ name: "Global", west: -180, south: -90, east: 180, north: 90 }];

    for (const area of areas) {
      const { width, height } = textureDimensions(area, maxEdge);
      tiles.push({
        key: `${surface.key}:${area.name}`,
        productId: surface.productId,
        layerId: surface.layerId,
        areaName: area.name,
        lat: (area.north + area.south) / 2,
        lng: (area.east + area.west) / 2,
        widthDegrees: area.east - area.west,
        heightDegrees: area.north - area.south,
        textureUrl: buildWmsGetMapUrl(
          // Same service, different projection. Deriving rather than
          // restating is what keeps endpoint, layer, version, format and
          // transparency single-sourced.
          { ...surface.service, crs: GLOBE_IMAGERY_CRS },
          {
            bbox: [area.west, area.south, area.east, area.north],
            width,
            height,
            time: surface.time,
          },
        ),
        opacity: surface.opacity,
        attribution: surface.attribution,
        time: surface.time,
      });
    }
  }

  return tiles;
}

/**
 * A value identity for a set of globe patches.
 *
 * The globe's equivalent of `imageryRenderSignature`, and it exists for the
 * same reason: the camera moves constantly. Rotating the globe, zooming, and
 * the solar light stepping forward each minute all produce a fresh React
 * render, and if the renderer treated that as new imagery it would rebuild
 * the patches and re-request every texture from NOAA — which the NWS
 * appropriate-use notice treats as abuse rather than waste.
 *
 * So this covers exactly what determines the request: the texture URL, which
 * already encodes endpoint, layer, CRS, bbox, size, format and frame, plus
 * the opacity and attribution used to build the material. It deliberately
 * excludes everything about the camera, the Sun, and the availability
 * message, none of which change what is fetched.
 */
export function globeImagerySignature(
  tiles: readonly GlobeImageryTile[],
): string {
  return tiles
    .map((tile) =>
      [
        tile.key,
        tile.textureUrl,
        String(tile.opacity),
        tile.attribution,
        String(tile.lat),
        String(tile.lng),
        String(tile.widthDegrees),
        String(tile.heightDegrees),
      ].join("~"),
    )
    .join("\n");
}

/**
 * What the globe should say when it draws nothing.
 *
 * The same discipline as the 2D panel: an absent surface is a statement
 * about Signalwatch's sources, never about the weather. "No radar source
 * here" and "clear" are different claims and must never be conflated.
 */
export function describeGlobeImageryAbsence(
  surfaces: readonly RenderableImagery[],
): string | null {
  if (surfaces.length === 0) return null;
  if (surfaces.some((surface) => surface.render)) return null;
  const outside = surfaces.filter(
    (surface) => surface.availability === "outside-coverage",
  );
  if (outside.length === surfaces.length) {
    return "No radar source for this part of the globe";
  }
  return "No radar surface drawn";
}
