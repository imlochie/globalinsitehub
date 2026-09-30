import type { MaritimeCoverage, VesselRecord } from "@workspace/api-zod";
import {
  aisText,
  courseOverGround,
  epochMillis,
  finite,
  imoNumber,
  isValidCoordinates,
  mmsiString,
  navigationalStatus,
  navigationalStatusLabel,
  shipType,
  shipTypeLabel,
  speedOverGround,
  trueHeading,
} from "./ais";
import { createMemoryCachedVesselProvider } from "./memory-cache";

/**
 * Fintraffic / Digitraffic marine AIS.
 *
 * Licence: CC BY 4.0. Distribution and commercial use are permitted provided
 * the source is credited, the licence is linked and modifications are stated.
 * No account, key or contribution is required, so this provider costs nothing
 * to run and has no path to becoming paid.
 *
 * Documented limitations, restated in the coverage note rather than hidden:
 * Class A transponders only, all fishing vessels (type 30) are filtered out by
 * Fintraffic before publication, and several ship-type codes are coarsened to
 * their group. Coverage is Finnish waterways and the surrounding Baltic
 * reception area — it is not global and must never be presented as global.
 */
const PROVIDER_ID = "digitraffic";
const PROVIDER_NAME = "Fintraffic Digitraffic marine AIS";
const LOCATIONS_URL = "https://meri.digitraffic.fi/api/ais/v1/locations";
const VESSELS_URL = "https://meri.digitraffic.fi/api/ais/v1/vessels";
const CATALOGUE_URL = "https://www.digitraffic.fi/en/marine-traffic/";
const ATTRIBUTION = "Source: Fintraffic / digitraffic.fi, license CC 4.0 BY";
const LICENCE = "CC BY 4.0";
const LICENCE_URL = "https://creativecommons.org/licenses/by/4.0/";
const REQUEST_TIMEOUT_MS = 15_000;
const MAX_RESPONSE_BYTES = 24 * 1024 * 1024;
/** Identifies this client to Fintraffic, as their terms of service request. */
const DIGITRAFFIC_USER = "Signalwatch/global-layer-engine";

export const digitrafficCoverage: MaritimeCoverage = {
  scope: "regional",
  regions: ["Finnish waterways and the surrounding Baltic Sea reception area"],
  note:
    "Fintraffic publishes Class A AIS only. Fishing vessels (ship type 30) are " +
    "removed at source and some ship-type codes are coarsened to their group. " +
    "No vessels outside the Finnish reception area are included.",
};

type Json = Record<string, unknown>;

function asRecord(value: unknown): Json | null {
  return value !== null && typeof value === "object" && !Array.isArray(value)
    ? (value as Json)
    : null;
}

async function fetchJson(url: string): Promise<unknown> {
  const response = await fetch(url, {
    headers: {
      accept: "application/json",
      "digitraffic-user": DIGITRAFFIC_USER,
    },
    signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
  });
  if (!response.ok) {
    throw new Error(`${url} responded ${response.status}`);
  }
  const length = Number(response.headers.get("content-length") ?? "0");
  if (Number.isFinite(length) && length > MAX_RESPONSE_BYTES) {
    throw new Error(`${url} response exceeds the ${MAX_RESPONSE_BYTES} byte bound`);
  }
  return response.json();
}

type VesselMetadata = {
  name: string | null;
  callSign: string | null;
  imo: string | null;
  shipType: number | null;
  destination: string | null;
  draughtMetres: number | null;
};

export function parseVesselMetadata(payload: unknown): Map<string, VesselMetadata> {
  const metadata = new Map<string, VesselMetadata>();
  if (!Array.isArray(payload)) return metadata;
  for (const entry of payload) {
    const record = asRecord(entry);
    if (!record) continue;
    const mmsi = mmsiString(record.mmsi);
    if (!mmsi) continue;
    // Digitraffic publishes draught in decimetres; 0 means "not supplied".
    const draughtDecimetres = finite(record.draught);
    metadata.set(mmsi, {
      name: aisText(record.name),
      callSign: aisText(record.callSign),
      imo: imoNumber(record.imo),
      shipType: shipType(record.shipType),
      destination: aisText(record.destination),
      draughtMetres:
        draughtDecimetres !== null && draughtDecimetres > 0
          ? draughtDecimetres / 10
          : null,
    });
  }
  return metadata;
}

export function parseVesselLocations(
  payload: unknown,
  metadata: Map<string, VesselMetadata>,
  receivedAt: Date,
): VesselRecord[] {
  const root = asRecord(payload);
  const features = root?.features;
  if (!Array.isArray(features)) return [];

  const vessels: VesselRecord[] = [];
  const seen = new Set<string>();

  for (const feature of features) {
    const featureRecord = asRecord(feature);
    if (!featureRecord) continue;
    const properties = asRecord(featureRecord.properties) ?? {};
    const geometry = asRecord(featureRecord.geometry);
    const coordinates = geometry?.coordinates;
    if (!Array.isArray(coordinates) || coordinates.length < 2) continue;

    const longitude = finite(coordinates[0]);
    const latitude = finite(coordinates[1]);
    if (!isValidCoordinates(latitude, longitude)) continue;

    const mmsi = mmsiString(properties.mmsi ?? featureRecord.mmsi);
    if (!mmsi || seen.has(mmsi)) continue;
    seen.add(mmsi);

    const details = metadata.get(mmsi);
    const statusCode = navigationalStatus(properties.navStat);
    const typeCode = details?.shipType ?? null;

    vessels.push({
      id: `${PROVIDER_ID}:${mmsi}`,
      provider: PROVIDER_ID,
      mmsi,
      imo: details?.imo ?? null,
      callSign: details?.callSign ?? null,
      name: details?.name ?? null,
      shipType: typeCode,
      shipTypeLabel: shipTypeLabel(typeCode),
      latitude: latitude as number,
      longitude: longitude as number,
      courseOverGround: courseOverGround(properties.cog),
      heading: trueHeading(properties.heading),
      speedOverGround: speedOverGround(properties.sog),
      navigationalStatus: statusCode,
      navigationalStatusLabel: navigationalStatusLabel(statusCode),
      destination: details?.destination ?? null,
      draughtMetres: details?.draughtMetres ?? null,
      // timestampExternal is Fintraffic's own record of when the position was
      // reported. It is kept distinct from receivedAt, which is ours.
      positionTimestamp: epochMillis(properties.timestampExternal),
      receivedAt,
      sourceUrl: LOCATIONS_URL,
      attribution: ATTRIBUTION,
      licence: LICENCE,
    });
  }

  return vessels;
}

export const digitrafficProvider = createMemoryCachedVesselProvider({
  id: PROVIDER_ID,
  name: PROVIDER_NAME,
  attribution: ATTRIBUTION,
  licence: LICENCE,
  licenceUrl: LICENCE_URL,
  catalogueUrl: CATALOGUE_URL,
  coverage: digitrafficCoverage,
  availableMessage:
    "Fintraffic Digitraffic AIS positions loaded. Coverage is Finnish waterways only.",
  async load() {
    const receivedAt = new Date();
    const [locations, vessels] = await Promise.all([
      fetchJson(LOCATIONS_URL),
      // Vessel metadata is a nice-to-have: a position without a name is still a
      // real position, so a metadata failure must not discard the fleet.
      fetchJson(VESSELS_URL).catch(() => []),
    ]);
    return parseVesselLocations(locations, parseVesselMetadata(vessels), receivedAt);
  },
  describeFailure(error) {
    const reason = error instanceof Error ? error.message : "unknown error";
    return `Fintraffic Digitraffic AIS could not be reached (${reason}). No Finnish vessel positions are being claimed.`;
  },
});
