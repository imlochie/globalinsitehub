import type { HazardRecord, HazardSourceCoverage } from "./types";

/**
 * NASA EONET (Earth Observatory Natural Event Tracker), API v3.
 *
 * Licence: NASA ESDIS content is generally not copyrighted and NASA asks to be
 * acknowledged as the source; mission data defaults to CC0 where not otherwise
 * marked. No key, no account, no quota.
 *
 * NASA's own disclaimer is carried through to the UI and must not be softened:
 * EONET metadata is "intended to be used for visualization and general
 * information purposes only and should not be construed as 'official' with
 * regards to spatial or temporal extent"; the representations are
 * "approximations at best".
 *
 * Documented field semantics used here:
 *   categories[].title  the event category as EONET classifies it
 *   geometry[].date     date/time paired with that geometry (often 00:00Z)
 *   geometry[].magnitudeValue/magnitudeUnit  magnitude for that observation
 *   geometry[].coordinates  GeoJSON Point or Polygon
 *   closed              null while the event is open; a date once it ended
 */
const SOURCE_ID = "nasa-eonet";
const SOURCE_NAME = "NASA EONET";
const ATTRIBUTION = "Source: NASA Earth Observatory Natural Event Tracker (EONET)";
const LICENCE = "NASA ESDIS open data (generally not copyrighted)";
const LICENCE_URL =
  "https://www.earthdata.nasa.gov/engage/open-data-services-software-policies/data-use-guidance";
const CATALOGUE_URL = "https://eonet.gsfc.nasa.gov/docs/v3";

/** NASA's disclaimer, surfaced verbatim in the layer and the inspector. */
export const EONET_DISCLAIMER =
  "NASA states EONET records are for visualization and general information " +
  "only, are not official as to spatial or temporal extent, and are " +
  "approximations at best.";

export const eonetCoverage: HazardSourceCoverage = {
  scope: "global",
  regions: ["Worldwide"],
  note:
    "Worldwide curated natural events that are currently open. EONET is a " +
    "curated tracker, not an exhaustive hazard census, and this request is " +
    "bounded to the 60 most recent open events.",
};

export const eonetSource = {
  id: SOURCE_ID,
  name: SOURCE_NAME,
  attribution: ATTRIBUTION,
  licence: LICENCE,
  licenceUrl: LICENCE_URL,
  catalogueUrl: CATALOGUE_URL,
  coverage: eonetCoverage,
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

/**
 * Resolves a representative point for an EONET geometry.
 *
 * Point geometries are used directly. For a Polygon the arithmetic mean of the
 * ring's vertices is used and the record is marked as approximate — EONET's own
 * disclaimer already says extents are approximate, so a single marker is a
 * deliberate simplification rather than a claim of precision. No attempt is
 * made to synthesise an extent Signalwatch cannot render.
 */
export function representativePoint(
  geometry: Record<string, unknown>,
): { latitude: number; longitude: number; approximate: boolean } | null {
  const coordinates = geometry.coordinates;
  const type = text(geometry.type);

  if (type === "Point" && Array.isArray(coordinates)) {
    const longitude = finite(coordinates[0]);
    const latitude = finite(coordinates[1]);
    if (!isValidCoordinates(latitude, longitude)) return null;
    return {
      latitude: latitude as number,
      longitude: longitude as number,
      approximate: false,
    };
  }

  // Collect every [lon, lat] pair at any nesting depth (Polygon / MultiPolygon).
  const points: Array<[number, number]> = [];
  const walk = (value: unknown, depth: number) => {
    if (!Array.isArray(value) || depth > 6) return;
    const longitude = finite(value[0]);
    const latitude = finite(value[1]);
    if (value.length >= 2 && longitude !== null && latitude !== null) {
      points.push([longitude, latitude]);
      return;
    }
    for (const child of value) walk(child, depth + 1);
  };
  walk(coordinates, 0);
  if (points.length === 0) return null;

  const longitude =
    points.reduce((total, point) => total + point[0], 0) / points.length;
  const latitude =
    points.reduce((total, point) => total + point[1], 0) / points.length;
  if (!isValidCoordinates(latitude, longitude)) return null;
  return { latitude, longitude, approximate: true };
}

export function parseEonetEvents(
  payload: unknown,
  receivedAt: Date,
): HazardRecord[] {
  const events = asRecord(payload).events;
  if (!Array.isArray(events)) return [];

  const records: HazardRecord[] = [];
  const seen = new Set<string>();

  for (const entry of events) {
    const event = asRecord(entry);
    const id = text(event.id);
    const title = text(event.title);
    if (!id || !title || seen.has(id)) continue;

    const geometries = Array.isArray(event.geometry)
      ? event.geometry.map(asRecord)
      : [];
    // The latest geometry is the most recent observation of the event.
    const latest = geometries.at(-1);
    if (!latest) continue;
    const point = representativePoint(latest);
    if (!point) continue;

    const occurredAt = new Date(text(latest.date) ?? "");
    if (!Number.isFinite(occurredAt.getTime())) continue;
    seen.add(id);

    const categories = Array.isArray(event.categories)
      ? event.categories.map(asRecord)
      : [];
    const closed = text(event.closed);
    const sources = Array.isArray(event.sources)
      ? event.sources.map(asRecord)
      : [];

    const description = text(event.description);
    const approximateNote = point.approximate
      ? "Position is the centre of an EONET area geometry, not a precise point."
      : null;

    records.push({
      id: `${SOURCE_ID}:${id}`,
      source: SOURCE_ID,
      // Category comes from EONET's own classification, never from the title.
      hazardType: text(categories[0]?.title) ?? "Natural event",
      title,
      latitude: point.latitude,
      longitude: point.longitude,
      occurredAt,
      updatedAt: null,
      receivedAt,
      // EONET documents `closed`: null means still open.
      activityStatus: closed ? "closed" : "open",
      // EONET v3 publishes magnitude on the geometry entry; older/other
      // shapes carry it on the event, so the geometry wins and the event is
      // only a fallback. The unit is always kept with the value.
      magnitudeValue: finite(latest.magnitudeValue) ?? finite(event.magnitudeValue),
      magnitudeUnit: text(latest.magnitudeUnit) ?? text(event.magnitudeUnit),
      magnitudeDescription:
        text(latest.magnitudeDescription) ?? text(event.magnitudeDescription),
      depthKm: null,
      reviewStatus: null,
      sourceSeverity: null,
      place: null,
      description: [description, approximateNote]
        .filter((part): part is string => Boolean(part))
        .join(" ") || null,
      sourceUrl:
        httpUrl(sources[0]?.url) ??
        httpUrl(event.link) ??
        "https://eonet.gsfc.nasa.gov/",
      attribution: ATTRIBUTION,
      licence: LICENCE,
    });
  }

  return records;
}
