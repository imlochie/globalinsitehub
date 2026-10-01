import type { CameraRecord } from "@workspace/api-zod";
import {
  describeProviderFailure,
  providerFetch,
} from "../lib/provider-fetch";
import { createMemoryCachedCameraProvider } from "./memory-cache";
import { classifyViewCapability } from "./view-capability";

/**
 * Fintraffic Digitraffic road weather cameras (Finland).
 *
 * Migrated from the OSIRIS `cctv/finland.ts` adapter, which supplied the
 * endpoint knowledge. Everything about how the request is made and how the
 * record is classified is Signalwatch's.
 *
 * Why this provider cleared admission first:
 *
 *  - **Licence already verified by Signalwatch.** CC BY 4.0, established in
 *    `research/maritime-provider-decision.md` for the Digitraffic marine AIS
 *    feed. Same provider, same terms.
 *  - **Documented current-image URL.** Digitraffic's road traffic
 *    documentation states the response "contains weather camera information
 *    and URL for the camera image", giving the worked example that preset
 *    `C1451601` is at `https://weathercam.digitraffic.fi/C1451601.jpg`. That
 *    published guarantee is what earns `live-image` under invariant 4 — not
 *    the fact that the URL ends in `.jpg`.
 *  - **Documented refresh cadence.** "Weather camera images are updated
 *    approximately about every 10 minutes."
 *  - **Documented per-camera availability.** The docs instruct clients to
 *    check the camera `state` and `collectionStatus` fields and the preset
 *    `inCollection` field "to make sure the camera or preset is in
 *    collection". This is the first registered provider that publishes a
 *    per-camera out-of-service signal, so it is the first that can legitimately
 *    produce `viewCapability: "unavailable"` rather than that state being
 *    unreachable.
 *  - **Honest identification is the documented interface.** Digitraffic asks
 *    callers to send a `Digitraffic-User` header. OSIRIS reached this provider
 *    through spoofed headers; Signalwatch identifies itself instead.
 *
 * No account, no API key, no cost.
 */
const PROVIDER_ID = "digitraffic-weathercam";
const PROVIDER_NAME = "Fintraffic Digitraffic road weather cameras";
const STATIONS_URL = "https://tie.digitraffic.fi/api/weathercam/v1/stations";
const IMAGE_ORIGIN = "https://weathercam.digitraffic.fi";
const CATALOGUE_URL = "https://www.digitraffic.fi/en/road-traffic/";
const ATTRIBUTION =
  "Source: Fintraffic / digitraffic.fi, license CC 4.0 BY";
/** Documented: "images are updated approximately about every 10 minutes". */
const IMAGE_UPDATE_RATE_MS = 10 * 60 * 1000;
/** Digitraffic asks callers to identify themselves with this header. */
const DIGITRAFFIC_USER = "Signalwatch/globalinsitehub";

function asRecord(value: unknown): Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

function text(value: unknown): string | null {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function finite(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function isValidCoordinates(lat: number | null, lon: number | null): boolean {
  return (
    lat !== null && lon !== null &&
    lat >= -90 && lat <= 90 && lon >= -180 && lon <= 180
  );
}

/**
 * Preset ids are documented in the form `C` + 7 digits (e.g. `C1451601`).
 * Validating the shape keeps an unexpected upstream value from steering the
 * image URL off the documented origin or out of its path.
 */
const PRESET_ID = /^C\d{7}$/;

function presetImageUrl(presetId: string, published: string | null): string | null {
  // Prefer the URL the provider published for this preset.
  if (published !== null) {
    try {
      const url = new URL(published);
      if (url.protocol === "http:") url.protocol = "https:";
      if (url.origin !== IMAGE_ORIGIN) return null;
      return url.toString();
    } catch {
      return null;
    }
  }
  // Fall back to the pattern Digitraffic documents, and only that pattern.
  return PRESET_ID.test(presetId) ? `${IMAGE_ORIGIN}/${presetId}.jpg` : null;
}

/**
 * True when the provider says this camera and preset are currently collecting.
 * Anything else is reported as `unavailable` rather than silently dropped, so
 * a camera that exists but is off-service stays visible and honest.
 */
function isCollecting(
  stationProperties: Record<string, unknown>,
  preset: Record<string, unknown>,
): boolean {
  const collectionStatus = text(stationProperties.collectionStatus);
  const state = text(stationProperties.state);
  const inCollection = preset.inCollection;

  if (collectionStatus !== null && collectionStatus.toUpperCase() !== "GATHERING") {
    return false;
  }
  if (state !== null && state.toUpperCase() !== "OK" && state.toUpperCase() !== "GATHERING") {
    return false;
  }
  if (inCollection === false) return false;
  return true;
}

export function parseDigitrafficWeathercams(payload: unknown): CameraRecord[] {
  const features = asRecord(payload).features;
  if (!Array.isArray(features)) return [];

  const cameras: CameraRecord[] = [];
  const seen = new Set<string>();

  for (const entry of features) {
    const feature = asRecord(entry);
    const properties = asRecord(feature.properties);
    const coordinates = asRecord(feature.geometry).coordinates;
    if (!Array.isArray(coordinates) || coordinates.length < 2) continue;

    const longitude = finite(coordinates[0]);
    const latitude = finite(coordinates[1]);
    if (!isValidCoordinates(latitude, longitude)) continue;

    const stationId = text(feature.id) ?? text(properties.id);
    const presets = Array.isArray(properties.presets) ? properties.presets : [];
    if (stationId === null || presets.length === 0) continue;

    const stationName =
      text(properties.name) ?? text(properties.presentationName) ?? stationId;

    for (const presetEntry of presets) {
      const preset = asRecord(presetEntry);
      const presetId = text(preset.id);
      if (presetId === null) continue;

      const id = `${PROVIDER_ID}-${presetId}`;
      if (seen.has(id)) continue;
      seen.add(id);

      const collecting = isCollecting(properties, preset);
      const imageUrl = collecting
        ? presetImageUrl(presetId, text(preset.imageUrl))
        : null;

      const classification = collecting
        ? classifyViewCapability({
            documentedAs: imageUrl !== null ? "current-image" : "unknown",
            url: imageUrl,
          })
        : {
            // The provider says this camera is not collecting. That is a
            // published availability signal, not an absence of data.
            viewCapability: "unavailable" as const,
            mediaUrl: null,
            mediaType: null,
            viewUrl: null,
          };

      const presetName = text(preset.presentationName) ?? text(preset.nameOnDevice);

      cameras.push({
        id,
        provider: PROVIDER_ID,
        displayName: presetName ? `${stationName} — ${presetName}` : stationName,
        description:
          "Road weather camera published by Fintraffic Digitraffic. Each preset is a fixed view from its station.",
        country: "Finland",
        countryCode: "FI",
        region: text(properties.province) ?? null,
        subregion: text(properties.municipality) ?? null,
        district: null,
        locality: text(properties.municipality) ?? null,
        postcode: null,
        latitude: latitude as number,
        longitude: longitude as number,
        // The per-preset `direction` Digitraffic exposes is road-register
        // relative, not a compass bearing, so it is not reported as one.
        direction: null,
        sourceUrl: classification.mediaUrl ?? `${STATIONS_URL}/${stationId}`,
        encoding: classification.mediaUrl !== null ? "JPEG" : null,
        format: classification.mediaUrl !== null ? "IMAGE" : null,
        imageUpdateRateMs:
          classification.viewCapability === "live-image"
            ? IMAGE_UPDATE_RATE_MS
            : null,
        streamKind:
          classification.viewCapability === "live-image" ? "image" : "unknown",
        viewCapability: classification.viewCapability,
        mediaUrl: classification.mediaUrl,
        mediaType: classification.mediaType,
        viewUrl: classification.viewUrl,
        feedStatus: "not-probed",
        publicAccess: "catalogue-listed",
        attribution: ATTRIBUTION,
        catalogueUrl: CATALOGUE_URL,
      } as CameraRecord);
    }
  }

  return cameras;
}

export const digitrafficWeathercamProvider = createMemoryCachedCameraProvider({
  id: PROVIDER_ID,
  name: PROVIDER_NAME,
  attribution: ATTRIBUTION,
  catalogueUrl: CATALOGUE_URL,
  availableMessage:
    "Fintraffic Digitraffic weather camera catalogue is available. Images are published by the provider and loaded directly by the client; Signalwatch never proxies them.",
  describeFailure: () =>
    "The Fintraffic Digitraffic weather camera catalogue could not be loaded; no camera imagery was requested.",
  async load() {
    const response = await providerFetch(STATIONS_URL, {
      headers: {
        // Digitraffic asks callers to identify themselves. Signalwatch does.
        "Digitraffic-User": DIGITRAFFIC_USER,
        "accept-encoding": "gzip",
      },
    });
    if (!response.ok) {
      throw new Error(describeProviderFailure(response.status, PROVIDER_NAME));
    }
    return { cameras: parseDigitrafficWeathercams(await response.json()) };
  },
});
