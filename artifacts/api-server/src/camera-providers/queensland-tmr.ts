import { createHash } from "node:crypto";
import type { CameraRecord } from "@workspace/api-zod";
import {
  createMemoryCachedCameraProvider,
} from "./memory-cache";

const PROVIDER_ID = "qld-tmr";
const PROVIDER_NAME = "Queensland TMR Traffic Cameras";
const LAYER_URL =
  "https://spatial-gis.information.qld.gov.au/arcgis/rest/services/Transportation/StateRoadInformation/MapServer/4";
const QUERY_URL = `${LAYER_URL}/query`;
const ATTRIBUTION =
  "Queensland Department of Transport and Main Roads, State controlled roads traffic cameras (CC BY 3.0).";
const MAX_CATALOGUE_BYTES = 8 * 1024 * 1024;
const REQUEST_TIMEOUT_MS = 12_000;

function asRecord(value: unknown): Record<string, unknown> | null {
  return value !== null &&
    typeof value === "object" &&
    !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

function text(value: unknown): string | null {
  return typeof value === "string" && value.trim()
    ? value.trim()
    : null;
}

function finiteNumber(value: unknown): number | null {
  const number =
    typeof value === "number"
      ? value
      : typeof value === "string" && value.trim()
        ? Number(value)
        : Number.NaN;
  return Number.isFinite(number) ? number : null;
}

function httpUrl(value: unknown): string | null {
  if (typeof value !== "string") return null;
  try {
    const url = new URL(value);
    if (
      (url.protocol !== "http:" && url.protocol !== "https:") ||
      url.username ||
      url.password
    ) {
      return null;
    }
    url.hash = "";
    return url.toString();
  } catch {
    return null;
  }
}

function idFor(cameraId: unknown, sourceUrl: string): string {
  const providerCameraId =
    typeof cameraId === "number" && Number.isFinite(cameraId)
      ? String(cameraId)
      : text(cameraId);
  if (providerCameraId) return `${PROVIDER_ID}-${providerCameraId}`;
  const digest = createHash("sha256")
    .update(`${PROVIDER_ID}\n${sourceUrl}`)
    .digest("hex")
    .slice(0, 24);
  return `${PROVIDER_ID}-${digest}`;
}

function normalizeFeature(value: unknown): CameraRecord | null {
  const feature = asRecord(value);
  const properties = asRecord(feature?.properties);
  const geometry = asRecord(feature?.geometry);
  const coordinates = Array.isArray(geometry?.coordinates)
    ? geometry.coordinates
    : [];
  if (!properties) return null;

  const latitude = finiteNumber(coordinates[1]);
  const longitude = finiteNumber(coordinates[0]);
  if (
    latitude === null ||
    longitude === null ||
    latitude < -90 ||
    latitude > 90 ||
    longitude < -180 ||
    longitude > 180 ||
    (latitude === 0 && longitude === 0)
  ) {
    return null;
  }

  const sourceUrl = httpUrl(properties.image_url);
  if (!sourceUrl) return null;

  const description = text(properties.description);
  const district = text(properties.district);
  const locality = text(properties.locality);
  const postcodeValue = properties.postcode;
  const postcode =
    typeof postcodeValue === "number" && Number.isFinite(postcodeValue)
      ? String(Math.trunc(postcodeValue))
      : text(postcodeValue);

  return {
    id: idFor(properties.camera_id, sourceUrl),
    provider: PROVIDER_ID,
    displayName:
      description ?? `Queensland traffic camera ${String(properties.camera_id ?? "")}`.trim(),
    description,
    country: "Australia",
    countryCode: "AU",
    region: "Queensland",
    subregion: locality ?? district,
    district,
    locality,
    postcode,
    latitude,
    longitude,
    direction: text(properties.direction),
    sourceUrl,
    encoding: null,
    format: "JPEG",
    imageUpdateRateMs: null,
    streamKind: "snapshot",
    feedStatus: "not-probed",
    publicAccess: "catalogue-listed",
    attribution: ATTRIBUTION,
    catalogueUrl: LAYER_URL,
  };
}

export function parseQueenslandTmrCatalogue(value: unknown): CameraRecord[] {
  const root = asRecord(value);
  if (!root || !Array.isArray(root.features)) {
    throw new Error("Queensland ArcGIS response is not a GeoJSON feature collection");
  }

  const records = new Map<string, CameraRecord>();
  for (const feature of root.features) {
    const camera = normalizeFeature(feature);
    if (camera && !records.has(camera.sourceUrl)) {
      records.set(camera.sourceUrl, camera);
    }
  }
  return [...records.values()].sort(
    (a, b) =>
      (a.locality ?? "").localeCompare(b.locality ?? "") ||
      a.displayName.localeCompare(b.displayName) ||
      a.id.localeCompare(b.id),
  );
}

export const queenslandTmrProvider = createMemoryCachedCameraProvider({
  id: PROVIDER_ID,
  name: PROVIDER_NAME,
  attribution: ATTRIBUTION,
  catalogueUrl: LAYER_URL,
  availableMessage:
    "Queensland TMR camera catalogue is available. Snapshot URLs are listed directly; image reachability is not checked or proxied.",
  describeFailure: () =>
    "The Queensland ArcGIS camera catalogue could not be loaded; image URLs were not requested.",
  async load(etag) {
    const url = new URL(QUERY_URL);
    url.search = new URLSearchParams({
      where: "1=1",
      outFields: "*",
      returnGeometry: "true",
      resultRecordCount: "2000",
      f: "geojson",
    }).toString();
    const headers: Record<string, string> = {
      Accept: "application/geo+json, application/json",
    };
    if (etag) headers["If-None-Match"] = etag;

    const response = await fetch(url, {
      headers,
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
    });
    if (response.status === 304) {
      return {
        notModified: true,
        etag: response.headers.get("etag") ?? undefined,
      };
    }
    if (!response.ok) {
      throw new Error(`Queensland ArcGIS returned HTTP ${response.status}`);
    }

    const body = await response.text();
    if (new TextEncoder().encode(body).byteLength > MAX_CATALOGUE_BYTES) {
      throw new Error("Queensland ArcGIS response exceeded the size limit");
    }
    return {
      cameras: parseQueenslandTmrCatalogue(JSON.parse(body) as unknown),
      etag: response.headers.get("etag") ?? undefined,
    };
  },
});