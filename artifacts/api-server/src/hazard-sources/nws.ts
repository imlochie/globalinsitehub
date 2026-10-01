import type { HazardRecord, HazardSourceCoverage } from "./types";

/**
 * NOAA / National Weather Service active alerts.
 *
 * Migrated from the OSIRIS `api/weather/route.ts` route, which supplied the
 * endpoint. Everything else is Signalwatch's.
 *
 * Admission evidence, from the NWS API documentation
 * (<https://www.weather.gov/documentation/services-web-api>):
 *
 *  - **Licence / cost.** "All of the information presented via the API is
 *    intended to be open data, free to use for any purpose. As a public
 *    service of the United States Government, we do not charge any fees for
 *    the usage of this service."
 *  - **Access.** No key, no account. "A User Agent is required to identify
 *    your application… If you include contact information (website or email),
 *    we can contact you if your string is associated to a security event."
 *    Signalwatch's `providerFetch` sends exactly that, including the project
 *    URL — this provider is the clearest case for honest identification being
 *    the documented interface rather than an obstacle.
 *  - **Rate limits.** Deliberately unpublished: "The rate limit is not public
 *    information, but allows a generous amount for typical use… Proxies are
 *    more likely to reach the limit, whereas requests directly from clients
 *    are not likely." Signalwatch makes one server-side request per cache
 *    window, which is typical use, and a 429 is surfaced honestly.
 *  - **Format.** GeoJSON by default.
 *
 * Continuity note: the documentation states the User-Agent requirement "will
 * be replaced with an API key in the future". Recorded as a known future gate,
 * as with ADSB.lol.
 *
 * Coverage is the United States and its territories. It must never be
 * presented as global.
 */
const SOURCE_ID = "noaa-nws";
const SOURCE_NAME = "NOAA National Weather Service alerts";
export const NWS_ALERTS_URL =
  "https://api.weather.gov/alerts/active?status=actual&message_type=alert";
const ATTRIBUTION = "Source: NOAA / National Weather Service";
const LICENCE = "U.S. public domain (NOAA/NWS open data)";
const LICENCE_URL = "https://www.weather.gov/documentation/services-web-api";
const CATALOGUE_URL = "https://www.weather.gov/documentation/services-web-alerts";

export const nwsCoverage: HazardSourceCoverage = {
  scope: "regional",
  regions: ["United States and its territories"],
  note:
    "Active National Weather Service alerts for the United States and its " +
    "territories. No coverage elsewhere — an absence of alerts outside the US " +
    "means this source does not observe there, not that conditions are calm.",
};

export const nwsSource = {
  id: SOURCE_ID,
  name: SOURCE_NAME,
  attribution: ATTRIBUTION,
  licence: LICENCE,
  licenceUrl: LICENCE_URL,
  catalogueUrl: CATALOGUE_URL,
  coverage: nwsCoverage,
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

function date(value: unknown): Date | null {
  const raw = text(value);
  if (!raw) return null;
  const parsed = new Date(raw);
  return Number.isFinite(parsed.getTime()) ? parsed : null;
}

function isValidCoordinates(lat: number | null, lon: number | null): boolean {
  return (
    lat !== null && lon !== null &&
    lat >= -90 && lat <= 90 && lon >= -180 && lon <= 180
  );
}

/**
 * Mean of every coordinate pair in an alert geometry.
 *
 * NWS alert geometry is a Polygon or MultiPolygon covering the warned area.
 * Signalwatch renders points, so a representative centre is derived and the
 * record says so. Many alerts are zone-based and carry `geometry: null`; those
 * cannot be placed and are dropped rather than pinned to a guessed location.
 */
export function alertCentre(
  geometry: unknown,
): { latitude: number; longitude: number } | null {
  const root = asRecord(geometry);
  const points: Array<[number, number]> = [];
  const walk = (value: unknown, depth: number): void => {
    if (!Array.isArray(value) || depth > 6) return;
    const longitude = finite(value[0]);
    const latitude = finite(value[1]);
    if (value.length >= 2 && longitude !== null && latitude !== null) {
      points.push([longitude, latitude]);
      return;
    }
    for (const child of value) walk(child, depth + 1);
  };
  walk(root.coordinates, 0);
  if (points.length === 0) return null;

  const longitude =
    points.reduce((total, point) => total + point[0], 0) / points.length;
  const latitude =
    points.reduce((total, point) => total + point[1], 0) / points.length;
  return isValidCoordinates(latitude, longitude)
    ? { latitude, longitude }
    : null;
}

export function parseNwsAlerts(
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

    const id = text(feature.id) ?? text(properties.id);
    if (id === null || seen.has(id)) continue;

    // Zone-based alerts have no geometry. They cannot be placed honestly.
    const centre = alertCentre(feature.geometry);
    if (centre === null) continue;

    // `event` is the NWS-assigned category ("Tornado Warning", "Flood
    // Watch"). Never inferred from the headline text.
    const event = text(properties.event);
    if (event === null) continue;

    const onset = date(properties.onset) ?? date(properties.effective);
    const sent = date(properties.sent);
    const observedAt = onset ?? sent;
    if (observedAt === null) continue;
    seen.add(id);

    const expires = date(properties.expires) ?? date(properties.ends);
    const areaDesc = text(properties.areaDesc);

    records.push({
      id: `${SOURCE_ID}:${id}`,
      source: SOURCE_ID,
      hazardType: event,
      title: text(properties.headline) ?? event,
      latitude: centre.latitude,
      longitude: centre.longitude,
      // When NWS says the hazard begins, never the time Signalwatch fetched it.
      occurredAt: observedAt,
      updatedAt: date(properties.sent),
      receivedAt,
      // NWS publishes an expiry, so open/closed is a source-declared state.
      activityStatus:
        expires !== null && expires.getTime() <= receivedAt.getTime()
          ? "closed"
          : "open",
      magnitudeValue: null,
      magnitudeUnit: null,
      magnitudeDescription: null,
      depthKm: null,
      // CAP review/status field, e.g. "Actual".
      reviewStatus: text(properties.status),
      // The NWS CAP severity, carried verbatim. Not a Signalwatch score and
      // never compared against an earthquake magnitude.
      sourceSeverity: text(properties.severity),
      place: areaDesc,
      description: [
        text(properties.description),
        "Position is the centre of the warned area polygon, not a precise point.",
      ]
        .filter((part): part is string => Boolean(part))
        .join(" "),
      sourceUrl: text(properties["@id"]) ?? "https://api.weather.gov/alerts/active",
      attribution: ATTRIBUTION,
      licence: LICENCE,
    });
  }

  return records;
}
