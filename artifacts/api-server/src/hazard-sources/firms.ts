import { providerFetch } from "../lib/provider-fetch";
import type { HazardRecord, HazardSourceCoverage } from "./types";

/**
 * NASA FIRMS active fire detections (VIIRS 375 m, NOAA-20).
 *
 * Migrated from the OSIRIS `api/fires/route.ts` route, which supplied the
 * bulk-download approach. Admission record:
 * `docs/research/providers/nasa-firms-admission.md`.
 *
 * Two findings shaped this adapter and neither came from OSIRIS:
 *
 *  - **No key is needed.** FIRMS has a keyed, quota-metered Area API *and* a
 *    keyless bulk download published on its Active Fire Data page. Signalwatch
 *    uses the keyless path, so no NASA account is involved.
 *  - **OSIRIS's product is being retired.** It pulls Suomi NPP; FIRMS warns
 *    that Suomi NPP delivery ceases 2026-11-01 and directs users to NOAA-20
 *    and NOAA-21. This adapter uses NOAA-20.
 *
 * Observation semantics, stated plainly because they are easy to overstate:
 * each row is a **thermal anomaly detection pixel**, not a confirmed fire,
 * and the satellite samples by overpass. A fire between overpasses, or under
 * cloud, is not detected. FIRMS' own `confidence` value is carried verbatim
 * and never relabelled as a severity.
 */
const SOURCE_ID = "nasa-firms";
const SOURCE_NAME = "NASA FIRMS active fire detections";
/** NOAA-20 VIIRS 375 m, global, last 24 hours. Keyless bulk product. */
export const FIRMS_FEED_URL =
  "https://firms.modaps.eosdis.nasa.gov/data/active_fire/noaa-20-viirs-c2/csv/J1_VIIRS_C2_Global_24h.csv";
const ATTRIBUTION = "Source: NASA FIRMS (LANCE / EOSDIS)";
const LICENCE = "NASA EOSDIS open data (generally not copyrighted)";
const LICENCE_URL =
  "https://www.earthdata.nasa.gov/engage/open-data-services-software-policies/data-use-guidance";
const CATALOGUE_URL = "https://firms.modaps.eosdis.nasa.gov/active_fire/";

/**
 * A global 24-hour VIIRS file can hold tens of thousands of detections.
 * The set is bounded and the cap is disclosed in the source message rather
 * than silently truncating.
 */
export const FIRMS_MAX_DETECTIONS = 2000;

/**
 * Bulk artefacts are regenerated on satellite-overpass timescales, so the
 * 60-second window used for the query-style hazard feeds would re-transfer
 * megabytes for no new data.
 */
export const FIRMS_CACHE_TTL_MS = 15 * 60_000;

export const firmsCoverage: HazardSourceCoverage = {
  scope: "global",
  regions: ["Worldwide"],
  note:
    "Worldwide satellite fire detections from VIIRS 375 m (NOAA-20) over the past " +
    "24 hours. Coverage is sampled by satellite overpass, not continuous: a fire " +
    "between overpasses or under cloud is not detected, so an area with no " +
    "detections is not necessarily an area without fire. Each record is a thermal " +
    "anomaly detection, not a confirmed fire.",
};

export const firmsSource = {
  id: SOURCE_ID,
  name: SOURCE_NAME,
  attribution: ATTRIBUTION,
  licence: LICENCE,
  licenceUrl: LICENCE_URL,
  catalogueUrl: CATALOGUE_URL,
  coverage: firmsCoverage,
} as const;

function finite(value: string | undefined): number | null {
  if (value === undefined) return null;
  const parsed = Number(value.trim());
  return Number.isFinite(parsed) ? parsed : null;
}

function isValidCoordinates(lat: number | null, lon: number | null): boolean {
  return (
    lat !== null && lon !== null &&
    lat >= -90 && lat <= 90 && lon >= -180 && lon <= 180
  );
}

/**
 * FIRMS acquisition time arrives as a date plus an `HHMM` UTC clock string
 * (e.g. `2026-09-30` + `0142`), which has to be assembled rather than parsed.
 */
export function firmsAcquiredAt(
  acqDate: string | undefined,
  acqTime: string | undefined,
): Date | null {
  if (!acqDate) return null;
  const clock = (acqTime ?? "0").trim().padStart(4, "0");
  if (!/^\d{4}$/.test(clock)) return null;
  const parsed = new Date(
    `${acqDate.trim()}T${clock.slice(0, 2)}:${clock.slice(2)}:00Z`,
  );
  return Number.isFinite(parsed.getTime()) ? parsed : null;
}

/** Minimal CSV reader: FIRMS emits plain comma-separated rows, no quoting. */
function parseCsv(body: string): Array<Record<string, string>> {
  const lines = body.split(/\r?\n/).filter((line) => line.trim().length > 0);
  if (lines.length < 2) return [];
  const header = lines[0]!.split(",").map((cell) => cell.trim());
  return lines.slice(1).map((line) => {
    const cells = line.split(",");
    const row: Record<string, string> = {};
    header.forEach((name, index) => {
      row[name] = (cells[index] ?? "").trim();
    });
    return row;
  });
}

export function parseFirmsDetections(
  body: string,
  receivedAt: Date,
  limit: number = FIRMS_MAX_DETECTIONS,
): HazardRecord[] {
  const rows = parseCsv(body);
  const records: HazardRecord[] = [];
  const seen = new Set<string>();

  for (const row of rows) {
    if (records.length >= limit) break;

    const latitude = finite(row.latitude);
    const longitude = finite(row.longitude);
    if (!isValidCoordinates(latitude, longitude)) continue;

    const acquiredAt = firmsAcquiredAt(row.acq_date, row.acq_time);
    if (acquiredAt === null) continue;

    // FIRMS rows carry no id, so identity is composed from the fields that
    // make a detection unique: where, when and which satellite saw it.
    const satellite = row.satellite || "NOAA-20";
    const id = `${satellite}:${row.latitude}:${row.longitude}:${row.acq_date}:${row.acq_time}`;
    if (seen.has(id)) continue;
    seen.add(id);

    const frp = finite(row.frp);
    const confidence = row.confidence ? row.confidence.trim() : null;
    const dayNight = row.daynight ? row.daynight.trim() : null;

    records.push({
      id: `${SOURCE_ID}:${id}`,
      source: SOURCE_ID,
      // FIRMS classifies these as thermal anomalies / active fire detections.
      // Calling them "wildfire" would assert more than the product does.
      hazardType: "Active fire detection",
      title: `Fire detection — ${satellite}`,
      latitude: latitude as number,
      longitude: longitude as number,
      // Satellite acquisition time, never the time Signalwatch fetched it.
      occurredAt: acquiredAt,
      updatedAt: null,
      receivedAt,
      // A detection is an instantaneous observation, not an event with a
      // lifecycle, so no open/closed state is claimed.
      activityStatus: null,
      // Fire Radiative Power is the one genuine measurement in the row.
      magnitudeValue: frp,
      magnitudeUnit: frp !== null ? "MW (fire radiative power)" : null,
      magnitudeDescription: null,
      depthKm: null,
      reviewStatus: null,
      // FIRMS' own confidence value, verbatim. Not a Signalwatch score.
      sourceSeverity: confidence,
      place: null,
      description: [
        `Thermal anomaly detected by ${satellite}${dayNight === "N" ? " at night" : dayNight === "D" ? " during the day" : ""}.`,
        "This is a satellite detection, not a confirmed fire.",
      ].join(" "),
      sourceUrl: CATALOGUE_URL,
      attribution: ATTRIBUTION,
      licence: LICENCE,
    });
  }

  return records;
}

type FirmsCache = { value: HazardRecord[]; expiresAt: number };
let cached: FirmsCache | undefined;
let inFlight: Promise<HazardRecord[]> | undefined;

/** Test seam. */
export function resetFirmsCache(): void {
  cached = undefined;
  inFlight = undefined;
}

/**
 * Fetches the bulk product on its own slower cadence, independent of the
 * shared 60-second hazard feed cache.
 */
export async function getFirmsDetections(
  receivedAt: Date,
): Promise<HazardRecord[]> {
  if (cached && cached.expiresAt > Date.now()) return cached.value;
  if (!inFlight) {
    inFlight = (async () => {
      const response = await providerFetch(FIRMS_FEED_URL, {
        accept: "text/csv",
        timeoutMs: 20_000,
      });
      if (!response.ok) {
        throw new Error(`upstream returned HTTP ${response.status}`);
      }
      return parseFirmsDetections(await response.text(), receivedAt);
    })()
      .then((value) => {
        cached = { value, expiresAt: Date.now() + FIRMS_CACHE_TTL_MS };
        return value;
      })
      .finally(() => {
        inFlight = undefined;
      });
  }
  return inFlight;
}
