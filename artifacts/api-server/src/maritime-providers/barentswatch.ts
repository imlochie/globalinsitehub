import type { MaritimeCoverage, VesselRecord } from "@workspace/api-zod";
import {
  aisText,
  courseOverGround,
  finite,
  imoNumber,
  isoDate,
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
 * Kystverket / BarentsWatch live AIS.
 *
 * Licence: NLOD 2.0 (Norwegian Licence for Open Government Data). Access is
 * free of charge and free of usage billing, but it does require a free
 * BarentsWatch account and an API client, whose OAuth2 client credentials are
 * read from the environment. No credentials are bundled, and none are invented:
 * when they are absent this provider reports `unavailable` with an explicit
 * message. It never returns placeholder vessels.
 *
 * Coverage is the Norwegian economic zone plus the Svalbard and Jan Mayen
 * protection zones, from terrestrial receivers, Equinor offshore installations
 * and Norwegian AIS satellites. Fishing vessels under 15 m and leisure or
 * sailing vessels under 45 m are excluded at source.
 */
const PROVIDER_ID = "barentswatch";
const PROVIDER_NAME = "Kystverket / BarentsWatch live AIS";
const TOKEN_URL = "https://id.barentswatch.no/connect/token";
const LATEST_URL = "https://live.ais.barentswatch.no/v1/latest/combined?modelType=Full";
const CATALOGUE_URL = "https://developer.barentswatch.no/docs/AIS/live-ais-api/";
const ATTRIBUTION =
  "Contains data from Kystverket / BarentsWatch, licensed under NLOD 2.0";
const LICENCE = "NLOD 2.0";
const LICENCE_URL = "https://data.norge.no/nlod/en/2.0/";
const REQUEST_TIMEOUT_MS = 20_000;
/** Refresh the token a minute before it expires. */
const TOKEN_SKEW_MS = 60_000;

export const barentswatchCoverage: MaritimeCoverage = {
  scope: "regional",
  regions: [
    "Norwegian economic zone",
    "Svalbard fisheries protection zone",
    "Jan Mayen protection zone",
  ],
  note:
    "Kystverket's open AIS excludes fishing vessels under 15 metres and leisure " +
    "or sailing vessels under 45 metres, and carries nothing older than 14 days. " +
    "Positions come from terrestrial, offshore and Norwegian satellite receivers.",
};

type Credentials = { clientId: string; clientSecret: string };

export function readCredentials(
  env: NodeJS.ProcessEnv = process.env,
): Credentials | null {
  const clientId = env.BARENTSWATCH_CLIENT_ID?.trim();
  const clientSecret = env.BARENTSWATCH_CLIENT_SECRET?.trim();
  if (!clientId || !clientSecret) return null;
  return { clientId, clientSecret };
}

let token: { value: string; expiresAt: number } | undefined;

async function accessToken(credentials: Credentials): Promise<string> {
  if (token && token.expiresAt > Date.now()) return token.value;

  const response = await fetch(TOKEN_URL, {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: credentials.clientId,
      client_secret: credentials.clientSecret,
      scope: "ais",
      grant_type: "client_credentials",
    }),
    signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
  });
  if (!response.ok) {
    throw new Error(`token endpoint responded ${response.status}`);
  }
  const payload = (await response.json()) as {
    access_token?: unknown;
    expires_in?: unknown;
  };
  const value = typeof payload.access_token === "string" ? payload.access_token : null;
  if (!value) throw new Error("token endpoint returned no access_token");
  const expiresInSeconds = finite(payload.expires_in) ?? 3600;
  token = {
    value,
    expiresAt: Date.now() + Math.max(expiresInSeconds * 1000 - TOKEN_SKEW_MS, 30_000),
  };
  return value;
}

function asRecord(value: unknown): Record<string, unknown> | null {
  return value !== null && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

export function parseLatestPositions(
  payload: unknown,
  receivedAt: Date,
): VesselRecord[] {
  if (!Array.isArray(payload)) return [];
  const vessels: VesselRecord[] = [];
  const seen = new Set<string>();

  for (const entry of payload) {
    const record = asRecord(entry);
    if (!record) continue;
    // The API can answer as plain objects or as GeoJSON features.
    const properties = asRecord(record.properties) ?? record;
    const geometry = asRecord(record.geometry);
    const coordinates = Array.isArray(geometry?.coordinates)
      ? (geometry.coordinates as unknown[])
      : null;

    const longitude = coordinates
      ? finite(coordinates[0])
      : finite(properties.longitude);
    const latitude = coordinates ? finite(coordinates[1]) : finite(properties.latitude);
    if (!isValidCoordinates(latitude, longitude)) continue;

    const mmsi = mmsiString(properties.mmsi);
    if (!mmsi || seen.has(mmsi)) continue;
    seen.add(mmsi);

    const statusCode = navigationalStatus(properties.navigationalStatus);
    const typeCode = shipType(properties.shipType);
    // BarentsWatch reports draught in decimetres, like the raw AIS field.
    const draughtDecimetres = finite(properties.draught);

    vessels.push({
      id: `${PROVIDER_ID}:${mmsi}`,
      provider: PROVIDER_ID,
      mmsi,
      imo: imoNumber(properties.imoNumber),
      callSign: aisText(properties.callSign),
      name: aisText(properties.name),
      shipType: typeCode,
      shipTypeLabel: shipTypeLabel(typeCode),
      latitude: latitude as number,
      longitude: longitude as number,
      courseOverGround: courseOverGround(properties.courseOverGround),
      heading: trueHeading(properties.trueHeading),
      speedOverGround: speedOverGround(properties.speedOverGround),
      navigationalStatus: statusCode,
      navigationalStatusLabel: navigationalStatusLabel(statusCode),
      destination: aisText(properties.destination),
      draughtMetres:
        draughtDecimetres !== null && draughtDecimetres > 0
          ? draughtDecimetres / 10
          : null,
      // msgtime is the provider's own position time; receivedAt stays ours.
      positionTimestamp: isoDate(properties.msgtime),
      receivedAt,
      sourceUrl: CATALOGUE_URL,
      attribution: ATTRIBUTION,
      licence: LICENCE,
    });
  }

  return vessels;
}

export const barentswatchProvider = createMemoryCachedVesselProvider({
  id: PROVIDER_ID,
  name: PROVIDER_NAME,
  attribution: ATTRIBUTION,
  licence: LICENCE,
  licenceUrl: LICENCE_URL,
  catalogueUrl: CATALOGUE_URL,
  coverage: barentswatchCoverage,
  availableMessage:
    "Kystverket / BarentsWatch AIS positions loaded. Coverage is Norwegian waters only.",
  async load() {
    const credentials = readCredentials();
    if (!credentials) {
      throw new Error(
        "BARENTSWATCH_CLIENT_ID and BARENTSWATCH_CLIENT_SECRET are not configured",
      );
    }
    const receivedAt = new Date();
    const response = await fetch(LATEST_URL, {
      headers: {
        accept: "application/json",
        authorization: `Bearer ${await accessToken(credentials)}`,
      },
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
    });
    if (!response.ok) {
      // A rejected token is worth discarding so the next attempt re-authenticates.
      if (response.status === 401) token = undefined;
      throw new Error(`live AIS responded ${response.status}`);
    }
    return parseLatestPositions(await response.json(), receivedAt);
  },
  describeFailure(error) {
    const reason = error instanceof Error ? error.message : "unknown error";
    if (reason.includes("BARENTSWATCH_CLIENT_ID")) {
      return "Norwegian AIS is not configured on this deployment. BarentsWatch access is free but requires a BarentsWatch API client; set BARENTSWATCH_CLIENT_ID and BARENTSWATCH_CLIENT_SECRET to enable it.";
    }
    return `Kystverket / BarentsWatch AIS could not be reached (${reason}). No Norwegian vessel positions are being claimed.`;
  },
});
