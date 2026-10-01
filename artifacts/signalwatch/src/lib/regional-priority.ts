/**
 * Regional priority — which part of the world the product opens on.
 *
 * This is a PRESENTATION PREFERENCE, NOT A COVERAGE CLAIM. Signalwatch is a
 * global system; a profile says where the camera starts and which layers are
 * offered first, and says nothing whatsoever about where data exists. Opening
 * on Australia does not mean Signalwatch has Australian radar — at the time
 * of writing it does not, because the Bureau of Meteorology licenses radar
 * imagery separately (see docs/research/checkpoint-c-inspection.md §11.1).
 *
 * The point of putting this in one module is to keep `country === "AU"` out
 * of the renderers. A profile is data read once to seed initial state. It is
 * not a mode, and no renderer may branch on `profile.id` — doing so would
 * rebuild the Australia-specific map this architecture exists to prevent.
 *
 * What a profile may NOT do:
 *   - make an unimplemented layer operational (layer status comes from the
 *     registry, which earns it from provider semantics);
 *   - imply coverage (coverage comes from providers);
 *   - restrict navigation (the user can pan and rotate anywhere);
 *   - use the viewer's own location (this is a product default, not geo-IP).
 */

import {
  MAP_MAX_ZOOM,
  MAP_MIN_ZOOM,
  MAP_SCALE_BAND_ZOOM,
  scaleBandForZoom,
  type MapScaleBand,
} from "@/lib/map-scale";
import type { LayerId } from "@/lib/layer-registry";

/** Degree bounds of the region a profile prioritises. */
export type RegionalExtent = {
  west: number;
  south: number;
  east: number;
  north: number;
};

export const REGIONAL_PRIORITY_PROFILE_IDS = [
  "australia",
  "north-america",
  "europe",
  "asia",
  "global",
] as const;

export type RegionalPriorityProfileId =
  (typeof REGIONAL_PRIORITY_PROFILE_IDS)[number];

export type RegionalPriorityProfile = {
  id: RegionalPriorityProfileId;
  label: string;
  /** One sentence the UI can show so the default is never mysterious. */
  rationale: string;
  /** Initial 2D map centre, [latitude, longitude]. */
  mapCenter: readonly [number, number];
  /** Initial 2D map zoom. Validated against the band model. */
  mapZoom: number;
  /**
   * Initial globe camera. `altitude` is in react-globe.gl units — multiples
   * of the globe radius above the surface, where ~2.5 frames the whole disc.
   */
  globeView: { lat: number; lng: number; altitude: number };
  /**
   * The region itself. Used by tests to prove the initial view actually
   * contains it, never to clip or filter data.
   */
  extent: RegionalExtent;
  /**
   * Presentation order for the layer control, most prominent first. Layers
   * omitted here keep their registry order after the listed ones, so adding
   * a layer to the registry can never make it silently disappear.
   */
  layerOrder: readonly LayerId[];
};

/**
 * Australia.
 *
 * Centre 136°E, 26°S is roughly the continental centroid. Zoom 4 is the
 * bottom of the `regional` band: the whole continent plus the Tasman, the
 * Arafura Sea and part of Indonesia — enough surrounding context to read a
 * regional situation, and deliberately not a capital city. The brief asks
 * for Australia-wide, not Brisbane.
 *
 * The globe faces the same point from altitude 2.2, the existing framing
 * distance, so Australia is simply what is turned toward the viewer.
 */
const AUSTRALIA: RegionalPriorityProfile = {
  id: "australia",
  label: "Australia",
  rationale:
    "Australia is the first region to receive deep operational coverage. " +
    "The map still pans and zooms worldwide.",
  mapCenter: [-26, 136],
  mapZoom: 4,
  globeView: { lat: -26, lng: 136, altitude: 2.2 },
  extent: { west: 112, south: -44, east: 154, north: -9 },
  // Weather and Navigation lead because they are what an Australian operator
  // checks first. Navigation is not in the registry yet; see the filter in
  // `orderLayersForProfile`, which drops unknown ids rather than inventing
  // them.
  layerOrder: [
    "weather",
    "public-events",
    "cameras",
    "natural-hazards",
    "maritime",
  ],
};

/**
 * Global — the behaviour before Checkpoint C, kept so "no regional
 * preference" stays expressible and testable rather than being a deleted
 * branch of history.
 */
const GLOBAL: RegionalPriorityProfile = {
  id: "global",
  label: "Global",
  rationale: "No regional preference. The map opens on the whole world.",
  mapCenter: [18, 0],
  mapZoom: MAP_SCALE_BAND_ZOOM.global.minZoom,
  globeView: { lat: 18, lng: 12, altitude: 2.2 },
  extent: { west: -180, south: -85, east: 180, north: 85 },
  layerOrder: [],
};

export const REGIONAL_PRIORITY_PROFILES: Readonly<
  Record<"australia" | "global", RegionalPriorityProfile>
> = { australia: AUSTRALIA, global: GLOBAL };

/**
 * The product's default regional context.
 *
 * Deliberately a constant, not a lookup against the viewer's location: the
 * brief requires the default to be a product decision, so that two operators
 * in different countries see the same starting state.
 */
export const DEFAULT_REGIONAL_PRIORITY_PROFILE_ID: RegionalPriorityProfileId =
  "australia";

export function regionalPriorityProfile(
  id: RegionalPriorityProfileId = DEFAULT_REGIONAL_PRIORITY_PROFILE_ID,
): RegionalPriorityProfile {
  const profile =
    REGIONAL_PRIORITY_PROFILES[id as "australia" | "global"] ?? AUSTRALIA;
  return profile;
}

/** The active profile. One call site for "where does the product open?". */
export function activeRegionalPriorityProfile(): RegionalPriorityProfile {
  return regionalPriorityProfile(DEFAULT_REGIONAL_PRIORITY_PROFILE_ID);
}

/**
 * Orders layer ids for presentation.
 *
 * Unknown ids in `layerOrder` are dropped and unlisted ids keep their
 * original relative order at the end. Both rules exist so that ordering can
 * never change *which* layers exist — a profile naming a layer that is not
 * implemented must not conjure it, and a profile forgetting a layer must not
 * hide it.
 */
export function orderLayersForProfile<T extends { id: string }>(
  items: readonly T[],
  profile: RegionalPriorityProfile = activeRegionalPriorityProfile(),
): T[] {
  const rank = new Map<string, number>();
  profile.layerOrder.forEach((id, index) => rank.set(id, index));
  return [...items].sort((a, b) => {
    const ra = rank.get(a.id) ?? Number.MAX_SAFE_INTEGER;
    const rb = rank.get(b.id) ?? Number.MAX_SAFE_INTEGER;
    if (ra !== rb) return ra - rb;
    return items.indexOf(a) - items.indexOf(b); // stable for unlisted layers
  });
}

/** True when the initial view actually shows the region it claims to. */
export function initialViewContainsExtent(
  profile: RegionalPriorityProfile,
): boolean {
  const { mapCenter, extent } = profile;
  const [lat, lng] = mapCenter;
  return (
    lat >= extent.south &&
    lat <= extent.north &&
    lng >= extent.west &&
    lng <= extent.east
  );
}

/**
 * Throws on a profile that cannot be honoured.
 *
 * A bad initial camera is not a cosmetic problem: a zoom outside the band
 * model would put the map in a state `scaleBandForZoom` cannot describe, and
 * every layer's scale policy is evaluated against that band.
 */
export function validateRegionalPriorityProfile(
  profile: RegionalPriorityProfile,
): void {
  const { id, mapZoom, mapCenter, extent, globeView } = profile;

  if (!Number.isInteger(mapZoom) || mapZoom < MAP_MIN_ZOOM || mapZoom > MAP_MAX_ZOOM) {
    throw new Error(
      `Regional profile "${id}" has mapZoom ${mapZoom}, outside the map's ${MAP_MIN_ZOOM}–${MAP_MAX_ZOOM} range.`,
    );
  }
  const [lat, lng] = mapCenter;
  if (lat < -90 || lat > 90 || lng < -180 || lng > 180) {
    throw new Error(
      `Regional profile "${id}" has an out-of-range mapCenter [${lat}, ${lng}].`,
    );
  }
  if (globeView.lat < -90 || globeView.lat > 90 || globeView.lng < -180 || globeView.lng > 180) {
    throw new Error(
      `Regional profile "${id}" has an out-of-range globeView [${globeView.lat}, ${globeView.lng}].`,
    );
  }
  if (globeView.altitude <= 0) {
    throw new Error(
      `Regional profile "${id}" has globeView.altitude ${globeView.altitude}; the camera must be above the surface.`,
    );
  }
  if (extent.south >= extent.north || extent.west >= extent.east) {
    throw new Error(`Regional profile "${id}" has an empty extent.`);
  }
  if (!initialViewContainsExtent(profile)) {
    throw new Error(
      `Regional profile "${id}" opens at [${lat}, ${lng}], which is outside the region it claims to prioritise.`,
    );
  }
}

for (const profile of Object.values(REGIONAL_PRIORITY_PROFILES)) {
  validateRegionalPriorityProfile(profile);
}

/* -------------------------------------------------------------------------- */
/* Product defaults                                                           */
/* -------------------------------------------------------------------------- */

/**
 * These live here rather than in `map-scale.ts` because they are a product
 * preference, while `map-scale` is the physical band model. Keeping the band
 * model free of product opinion is what lets a second profile be added
 * without touching it, and avoids an import cycle.
 */
const ACTIVE = activeRegionalPriorityProfile();

export const MAP_DEFAULT_CENTER: readonly [number, number] = ACTIVE.mapCenter;
export const MAP_DEFAULT_ZOOM = ACTIVE.mapZoom;
export const MAP_DEFAULT_BAND: MapScaleBand = scaleBandForZoom(ACTIVE.mapZoom);
export const GLOBE_DEFAULT_VIEW = ACTIVE.globeView;
