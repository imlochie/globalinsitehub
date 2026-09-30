import type { HazardRecord, HazardSourceCoverage } from "./types";

/**
 * USGS Earthquake Hazards Program — GeoJSON summary feed.
 *
 * Licence: USGS-authored data is in the U.S. public domain and may be used
 * freely; USGS asks only to be credited as the source. No key, no account, no
 * quota, so there is no path from this feed to a bill.
 *
 * Documented field semantics used here (GeoJSON Summary Format):
 *   properties.time    epoch ms of the earthquake origin time (not fetch time)
 *   properties.updated epoch ms the record was last revised by USGS
 *   properties.mag     magnitude, with magType naming the scale used
 *   properties.status  "automatic" | "reviewed" | "deleted" — review state
 *   properties.place   human-readable location description
 *   geometry.coordinates [longitude, latitude, depth-in-km]
 *
 * The magnitude scale is carried as its own field rather than being folded
 * into a single invented "severity" number: an Mww 5.1 and an ml 5.1 are not
 * interchangeable, and USGS does not publish a common severity index.
 */
const SOURCE_ID = "usgs";
const SOURCE_NAME = "USGS Earthquake Hazards Program";
const ATTRIBUTION = "Credit: U.S. Geological Survey";
const LICENCE = "U.S. public domain (USGS)";
const LICENCE_URL =
  "https://www.usgs.gov/information-policies-and-instructions/copyrights-and-credits";
const CATALOGUE_URL =
  "https://earthquake.usgs.gov/earthquakes/feed/v1.0/geojson.php";

export const usgsCoverage: HazardSourceCoverage = {
  scope: "global",
  regions: ["Worldwide"],
  note:
    "Worldwide earthquakes of magnitude 2.5 and above from the past 24 hours. " +
    "Smaller earthquakes exist and are not included, and detection completeness " +
    "varies with local network density.",
};

export const usgsSource = {
  id: SOURCE_ID,
  name: SOURCE_NAME,
  attribution: ATTRIBUTION,
  licence: LICENCE,
  licenceUrl: LICENCE_URL,
  catalogueUrl: CATALOGUE_URL,
  coverage: usgsCoverage,
} as const;

function asRecord(value: unknown): Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

function finite(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function text(value: unknown): string | null {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function httpUrl(value: unknown): string | null {
  if (typeof value !== "string") return null;
  try {
    const url = new URL(value);
    return url.protocol === "https:" || url.protocol === "http:"
      ? url.toString()
      : null;
  } catch {
    return null;
  }
}

function isValidCoordinates(lat: number | null, lon: number | null): boolean {
  return (
    lat !== null &&
    lon !== null &&
    lat >= -90 &&
    lat <= 90 &&
    lon >= -180 &&
    lon <= 180
  );
}

export function parseUsgsEarthquakes(
  payload: unknown,
  receivedAt: Date,
): HazardRecord[] {
  const features = asRecord(payload).features;
  if (!Array.isArray(features)) return [];

  const records: HazardRecord[] = [];
  const seen = new Set<string>();

  for (const entry of features) {
    const feature = asRecord(entry);
    const properties = asRecord(feature.properties);
    const coordinates = asRecord(feature.geometry).coordinates;
    if (!Array.isArray(coordinates) || coordinates.length < 2) continue;

    const longitude = finite(coordinates[0]);
    const latitude = finite(coordinates[1]);
    if (!isValidCoordinates(latitude, longitude)) continue;

    const id = text(feature.id);
    const occurredAtMs = finite(properties.time);
    if (!id || occurredAtMs === null || seen.has(id)) continue;
    seen.add(id);

    const occurredAt = new Date(occurredAtMs);
    if (!Number.isFinite(occurredAt.getTime())) continue;
    const updatedMs = finite(properties.updated);

    records.push({
      id: `${SOURCE_ID}:${id}`,
      source: SOURCE_ID,
      // USGS publishes only earthquakes in this feed; the type is read from
      // the record rather than assumed.
      hazardType: text(properties.type) ?? "earthquake",
      title: text(properties.title) ?? "Earthquake",
      latitude: latitude as number,
      longitude: longitude as number,
      // Origin time reported by USGS, never the time Signalwatch fetched it.
      occurredAt,
      updatedAt:
        updatedMs !== null && Number.isFinite(new Date(updatedMs).getTime())
          ? new Date(updatedMs)
          : null,
      receivedAt,
      // EONET-style open/closed state does not exist for a seismic event: an
      // earthquake is a point in time, so no activity status is claimed.
      activityStatus: null,
      magnitudeValue: finite(properties.mag),
      magnitudeUnit: text(properties.magType),
      magnitudeDescription: null,
      depthKm: finite(coordinates[2]),
      reviewStatus: text(properties.status),
      place: text(properties.place),
      description: null,
      sourceUrl:
        httpUrl(properties.url) ?? "https://earthquake.usgs.gov/earthquakes/",
      attribution: ATTRIBUTION,
      licence: LICENCE,
    });
  }

  return records;
}
