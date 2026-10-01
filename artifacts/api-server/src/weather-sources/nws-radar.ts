/**
 * NOAA/NWS MRMS base reflectivity — the only admitted weather imagery source.
 *
 * Every NOAA-specific fact lives in this file: endpoint, layer name, CRS,
 * format, time behaviour, bounds, cadence and attribution. Nothing downstream
 * — not the route, not the hook, not the map — contains a NOAA condition.
 * Swapping in a different imagery provider means adding a sibling module.
 *
 * Admission: docs/research/providers/nws-radar-wms-admission.md (ADOPT,
 * both conditions closed 2026-10-01). The six binding constraints recorded
 * there are implemented as follows:
 *
 *   1. Display NOAA's unaltered rendering  -> the browser requests GetMap and
 *      draws exactly what NOAA returns. Signalwatch never recolours,
 *      reclassifies or composites it.
 *   2. EPSG:3857, never rely on 4326 axis order -> IMAGERY_CRS below.
 *   3. Show the frame's valid time, distinct from receipt time ->
 *      sourceTimestamp vs ingestionTimestamp.
 *   4. Refresh no faster than 10 minutes -> REFRESH_INTERVAL_MS, and the
 *      capabilities read is cached for the same interval.
 *   5. Describe coverage exactly; outside it report "no source", never
 *      "no precipitation" -> COVERAGE.note and COVERAGE.bounds.
 *   6. Attribute NOAA/NWS, never imply endorsement -> ATTRIBUTION, verbatim
 *      from the service's own copyrightText.
 */

import { describeProviderFailure, providerFetch } from "../lib/provider-fetch";
import type { SpatialCoverage, SpatialImageryService, SpatialProduct } from "./types";
import { capabilitiesPublishLayer, readTimeDimension } from "./wms-capabilities";

export const NWS_RADAR_PRODUCT_ID = "nws-radar-base-reflectivity";
export const NWS_RADAR_PROVIDER_ID = "noaa-nws-radar";
export const NWS_RADAR_LAYER_ID = "weather";

/** WMS endpoint for the event-driven radar ImageServer. */
export const NWS_RADAR_WMS_ENDPOINT =
  "https://mapservices.weather.noaa.gov/eventdriven/services/radar/radar_base_reflectivity_time/ImageServer/WMSServer";

/** WMS layer name, confirmed live in the GetCapabilities document. */
export const NWS_RADAR_WMS_LAYER = "radar_base_reflectivity_time";

export const NWS_RADAR_CAPABILITIES_URL = `${NWS_RADAR_WMS_ENDPOINT}?request=GetCapabilities&service=WMS`;

/**
 * NOAA's metadata contradicts itself: the ImageServer description says
 * "Update Frequency: Every 5 minutes" while its own Time Information
 * paragraph says the four-hour window is "updated approximately every ten
 * minutes". The admission record resolved this by taking the SLOWER figure.
 *
 * This is a terms constraint, not a performance preference. The NWS Public
 * Notice of Appropriate Use defines requesting faster than the data refreshes
 * as abuse, and reserves the right to block IP addresses or query types.
 */
export const REFRESH_INTERVAL_MS = 600_000;

/** Three missed cycles. Past this the frame is labelled stale, not hidden. */
export const STALE_AFTER_MS = 1_800_000;

/** Verbatim `copyrightText` from the ImageServer metadata. */
export const ATTRIBUTION =
  "National Oceanic and Atmospheric Administration, NOAA, National Weather Service, NWS";

/**
 * EPSG:3857, chosen so WMS 1.3.0's reversed axis order for EPSG:4326
 * (BBOX = miny,minx,maxy,maxx) can never apply. The service advertises
 * CRS:84, EPSG:4326 and EPSG:3857; 3857 is also the map's native CRS.
 */
const IMAGERY_CRS = "EPSG:3857";

/**
 * The provider's own geographic bounding box, kept for provenance.
 *
 * It is NOT used as the render clip. The service's regions are disjoint and
 * far apart — Guam sits near +145 and the Caribbean near -65 — so the plain
 * min/max envelope spans 326 degrees of longitude and sweeps in Europe,
 * Africa and Asia. Requesting tiles there would return transparent pixels,
 * which on a map is indistinguishable from "no precipitation". See
 * COVERAGE_AREAS.
 */
export const PUBLISHED_ENVELOPE = {
  west: -176,
  south: 8.9956,
  east: 150.00479,
  north: 72,
} as const;

/**
 * Render clip: one box per region the provider names.
 *
 * Each box is drawn generously around its region so nothing NOAA publishes
 * is hidden, while the vast areas between the regions — open Pacific,
 * Atlantic, Eurasia, Africa, South America — are never requested at all.
 * Every box sits inside PUBLISHED_ENVELOPE, so this narrows the provider's
 * claim and never widens it.
 *
 * Note what is NOT here: Canada. An older NOAA MapServer description claimed
 * Canadian coverage; this service's own metadata does not, so Signalwatch
 * does not claim it either. The CONUS box reaches 51N, which includes the
 * border strip the mosaic genuinely renders, not a claim of Canadian
 * coverage.
 */
export const COVERAGE_AREAS = [
  { name: "Continental United States", west: -127, south: 23, east: -64, north: 51 },
  { name: "Alaska", west: -176, south: 50, east: -128, north: 72 },
  { name: "Hawaii", west: -162, south: 17, east: -153, north: 24 },
  {
    name: "Caribbean (Puerto Rico and the U.S. Virgin Islands)",
    west: -69,
    south: 16,
    east: -63,
    north: 20,
  },
  { name: "Guam", west: 143, south: 12, east: 150.00479, north: 21 },
];

export const COVERAGE: SpatialCoverage = {
  scope: "regional",
  regions: COVERAGE_AREAS.map((area) => area.name),
  note:
    "NOAA publishes this radar mosaic for the continental United States, Alaska, " +
    "Hawaii, the Caribbean and Guam only. Outside that area Signalwatch has no " +
    "radar source, which is not the same as no precipitation: nothing is observed " +
    "there, so nothing can be reported.",
  areas: COVERAGE_AREAS,
};

const IMAGERY: SpatialImageryService = {
  protocol: "wms",
  endpoint: NWS_RADAR_WMS_ENDPOINT,
  layer: NWS_RADAR_WMS_LAYER,
  version: "1.3.0",
  crs: IMAGERY_CRS,
  format: "image/png",
  transparent: true,
  // The service is time-enabled over a four-hour moving window. Signalwatch
  // omits the parameter, which the provider documents as "serve the most
  // recent image" — the correct default for a live radar layer. The parameter
  // name is published so a future frame selector does not have to guess it.
  timeParameter: "time",
  opacity: 0.68,
};

const BASE = {
  id: NWS_RADAR_PRODUCT_ID,
  layerId: NWS_RADAR_LAYER_ID,
  kind: "imagery" as const,
  providerId: NWS_RADAR_PROVIDER_ID,
  providerName: "NOAA / National Weather Service",
  productName: "Radar base reflectivity (MRMS)",
  productDescription:
    "Multi-Radar/Multi-Sensor composite base reflectivity from the WSR-88D network. " +
    "This is an observation of what the radars detected, not a forecast and not a " +
    "precipitation rate.",
  attribution: ATTRIBUTION,
  sourceUrl: "https://radar.weather.gov/",
  licence: "U.S. public domain (NOAA/NWS)",
  coverage: COVERAGE,
  refreshIntervalMs: REFRESH_INTERVAL_MS,
  staleAfterMs: STALE_AFTER_MS,
  // MRMS base reflectivity is an observation: there is no model run and no
  // forecast valid time. Leaving these null is a statement, not an omission.
  validTime: null,
  runTime: null,
  field: null,
};

export type CapabilitiesOutcome =
  | { ok: true; xml: string }
  | { ok: false; reason: string };

/** Fetches the capabilities document. Never retries a declined request. */
export async function fetchRadarCapabilities(): Promise<CapabilitiesOutcome> {
  try {
    const response = await providerFetch(NWS_RADAR_CAPABILITIES_URL, {
      accept: "text/xml",
      timeoutMs: 9_000,
    });
    if (!response.ok) {
      return {
        ok: false,
        reason: describeProviderFailure(response.status, "NOAA/NWS radar"),
      };
    }
    return { ok: true, xml: await response.text() };
  } catch (error) {
    return {
      ok: false,
      reason:
        error instanceof Error
          ? `NOAA/NWS radar could not be reached: ${error.message}.`
          : "NOAA/NWS radar could not be reached.",
    };
  }
}

/**
 * Builds the radar product from a capabilities outcome.
 *
 * Pure apart from its inputs, so the full matrix — healthy, stale, withdrawn
 * layer, unreadable time dimension, provider failure — is testable without
 * touching the network.
 */
export function buildRadarProduct(
  outcome: CapabilitiesOutcome,
  now: Date,
): SpatialProduct {
  if (!outcome.ok) {
    // The provider is down, so no imagery is offered at all. Rendering tiles
    // we cannot describe would put an undated surface on the map.
    return {
      ...BASE,
      sourceTimestamp: null,
      ingestionTimestamp: now,
      availability: "unavailable",
      message: outcome.reason,
      imagery: null,
    };
  }

  if (!capabilitiesPublishLayer(outcome.xml, NWS_RADAR_WMS_LAYER)) {
    return {
      ...BASE,
      sourceTimestamp: null,
      ingestionTimestamp: now,
      availability: "unavailable",
      message:
        `NOAA/NWS answered but no longer publishes the "${NWS_RADAR_WMS_LAYER}" layer. ` +
        "Signalwatch will not request imagery it cannot describe.",
      imagery: null,
    };
  }

  const { latest } = readTimeDimension(outcome.xml);
  if (!latest) {
    // The service is up and the layer exists, so the imagery is still
    // honest to draw — but it is labelled as undated rather than given a
    // fabricated timestamp.
    return {
      ...BASE,
      sourceTimestamp: null,
      ingestionTimestamp: now,
      availability: "covered",
      message:
        "NOAA/NWS is serving radar imagery but did not publish a readable frame time. " +
        "The map shows the provider's most recent frame; its exact valid time is unknown.",
      imagery: IMAGERY,
    };
  }

  const ageMs = now.getTime() - latest.getTime();
  const stale = ageMs > STALE_AFTER_MS;
  return {
    ...BASE,
    sourceTimestamp: latest,
    ingestionTimestamp: now,
    availability: stale ? "stale" : "covered",
    message: stale
      ? `NOAA/NWS last published a radar frame ${Math.round(ageMs / 60_000)} minutes ago, ` +
        "which is older than the expected 10-minute update cycle. The frame shown is that old one."
      : "NOAA/NWS radar mosaic is current.",
    imagery: IMAGERY,
  };
}

/** Test seam: the exact imagery descriptor the adapter publishes. */
export const NWS_RADAR_IMAGERY = IMAGERY;
