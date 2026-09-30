import type { PublicEventLocation } from "./types";

/**
 * Representative-point derivation for civic incident geometries.
 *
 * A QLDTraffic road event is a GeometryCollection whose geometries are
 * typically LineStrings covering several non-contiguous affected segments.
 * There is no single published coordinate for such an event, so one has to be
 * derived — and the result is always flagged `derived: true` so the UI can say
 * the marker is a representative location rather than a surveyed point.
 *
 * Rules:
 *  - A lone Point is used as-is and is NOT marked derived.
 *  - Otherwise the mean of every coordinate pair in the geometry is used.
 *  - No extent, radius or bounding shape is synthesised: Signalwatch cannot
 *    render one honestly, and inventing a spread would imply precision the
 *    source never published.
 */
export function isValidCoordinates(
  latitude: number | null,
  longitude: number | null,
): boolean {
  return (
    latitude !== null &&
    longitude !== null &&
    Number.isFinite(latitude) &&
    Number.isFinite(longitude) &&
    latitude >= -90 &&
    latitude <= 90 &&
    longitude >= -180 &&
    longitude <= 180
  );
}

function finite(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function asRecord(value: unknown): Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

/** Collects every [longitude, latitude] pair at any nesting depth. */
function collectPositions(
  value: unknown,
  depth = 0,
  out: Array<[number, number]> = [],
): Array<[number, number]> {
  if (!Array.isArray(value) || depth > 8) return out;
  const longitude = finite(value[0]);
  const latitude = finite(value[1]);
  if (value.length >= 2 && longitude !== null && latitude !== null) {
    out.push([longitude, latitude]);
    return out;
  }
  for (const child of value) collectPositions(child, depth + 1, out);
  return out;
}

export function representativeLocation(
  geometry: unknown,
): PublicEventLocation | null {
  const root = asRecord(geometry);
  const type = typeof root.type === "string" ? root.type : null;

  if (type === "Point") {
    const coordinates = root.coordinates;
    if (Array.isArray(coordinates)) {
      const longitude = finite(coordinates[0]);
      const latitude = finite(coordinates[1]);
      if (isValidCoordinates(latitude, longitude)) {
        return {
          latitude: latitude as number,
          longitude: longitude as number,
          derived: false,
          derivedFrom: null,
        };
      }
    }
    return null;
  }

  const geometries =
    type === "GeometryCollection" && Array.isArray(root.geometries)
      ? root.geometries
      : null;

  // A GeometryCollection holding exactly one Point is still a published point.
  if (geometries && geometries.length === 1) {
    const only = asRecord(geometries[0]);
    if (only.type === "Point") {
      const single = representativeLocation(only);
      if (single) return single;
    }
  }

  const positions = geometries
    ? geometries.flatMap((entry) =>
        collectPositions(asRecord(entry).coordinates),
      )
    : collectPositions(root.coordinates);

  if (positions.length === 0) return null;

  const longitude =
    positions.reduce((total, position) => total + position[0], 0) /
    positions.length;
  const latitude =
    positions.reduce((total, position) => total + position[1], 0) /
    positions.length;
  if (!isValidCoordinates(latitude, longitude)) return null;

  const shape = geometries
    ? `${geometries.length} geometr${geometries.length === 1 ? "y" : "ies"}`
    : (type ?? "geometry");

  return {
    latitude,
    longitude,
    derived: true,
    derivedFrom: shape,
  };
}
