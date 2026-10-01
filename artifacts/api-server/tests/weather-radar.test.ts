import assert from "node:assert/strict";
import { once } from "node:events";
import type { AddressInfo } from "node:net";
import express from "express";
import "pino-http";
import { test } from "node:test";
import {
  ATTRIBUTION,
  buildRadarProduct,
  COVERAGE,
  NWS_RADAR_IMAGERY,
  PUBLISHED_ENVELOPE,
  NWS_RADAR_WMS_LAYER,
  REFRESH_INTERVAL_MS,
  STALE_AFTER_MS,
} from "../src/weather-sources/nws-radar";
import { deriveWeatherCoverage } from "../src/weather-sources/registry";
import type { SpatialProduct } from "../src/weather-sources/types";
import {
  capabilitiesPublishLayer,
  latestInstantFromDimension,
  readTimeDimension,
} from "../src/weather-sources/wms-capabilities";
import { createMonitoringWeatherRouter } from "../src/routes/weather";

const NOW = new Date("2026-10-01T13:10:00.000Z");

/**
 * Shaped after the real GetCapabilities document captured from the NWS
 * event-driven radar WMS service on 2026-10-01 and recorded in
 * docs/research/providers/nws-radar-wms-admission.md. Trimmed to the elements
 * Signalwatch actually reads; no live request is made by this suite.
 */
const capabilitiesXml = `<?xml version="1.0" encoding="UTF-8"?>
<WMS_Capabilities version="1.3.0" xmlns="http://www.opengis.net/wms">
  <Service><Name>WMS</Name><Title>radar_base_reflectivity_time</Title></Service>
  <Capability>
    <Layer>
      <Title>radar_radar_base_reflectivity_time</Title>
      <CRS>CRS:84</CRS>
      <CRS>EPSG:4326</CRS>
      <CRS>EPSG:3857</CRS>
      <EX_GeographicBoundingBox>
        <westBoundLongitude>-176.000000</westBoundLongitude>
        <eastBoundLongitude>150.004790</eastBoundLongitude>
        <southBoundLatitude>8.995680</southBoundLatitude>
        <northBoundLatitude>72.000000</northBoundLatitude>
      </EX_GeographicBoundingBox>
      <Layer queryable="1">
        <Name>radar_base_reflectivity_time</Name>
        <Title>radar_base_reflectivity_time</Title>
        <Dimension name="time" units="ISO8601" default="2026-10-01T13:06:59.0Z" nearestValue="0">2026-10-01T11:14:16.0Z/2026-10-01T13:06:59.0Z/PT1S</Dimension>
      </Layer>
    </Layer>
  </Capability>
</WMS_Capabilities>`;

async function withRouter(
  loader: () => Promise<SpatialProduct[]>,
  run: (baseUrl: string) => Promise<void>,
) {
  const app = express();
  app.use((req, _res, next) => {
    (req as unknown as { log: unknown }).log = {
      warn() {},
      info() {},
      error() {},
    };
    next();
  });
  app.use(createMonitoringWeatherRouter(loader));
  const server = app.listen(0);
  await once(server, "listening");
  const { port } = server.address() as AddressInfo;
  try {
    await run(`http://127.0.0.1:${port}`);
  } finally {
    server.close();
    await once(server, "close");
  }
}

/* -------------------------------------------------------------------------- */
/* Capabilities parsing                                                       */
/* -------------------------------------------------------------------------- */

test("the frame's valid time is read from the service, not assumed", () => {
  const { latest, raw } = readTimeDimension(capabilitiesXml);
  assert.ok(latest);
  // The service's own `default` is the frame it serves when no time
  // parameter is supplied, which is exactly the request Signalwatch makes.
  assert.equal(latest.toISOString(), "2026-10-01T13:06:59.000Z");
  assert.ok(raw?.includes("2026-10-01T11:14:16.0Z"));
});

test("an interval dimension resolves to its end, never past it", () => {
  const latest = latestInstantFromDimension(
    "2026-10-01T11:14:16.0Z/2026-10-01T13:06:59.0Z/PT1S",
  );
  assert.equal(latest?.toISOString(), "2026-10-01T13:06:59.000Z");
});

test("a comma-separated dimension resolves to its newest entry", () => {
  const latest = latestInstantFromDimension(
    "2026-10-01T12:00:00Z,2026-10-01T12:30:00Z,2026-10-01T12:10:00Z",
  );
  assert.equal(latest?.toISOString(), "2026-10-01T12:30:00.000Z");
});

test("an unreadable capabilities document yields no timestamp rather than a guess", () => {
  assert.deepEqual(readTimeDimension("<WMS_Capabilities/>"), {
    latest: null,
    raw: null,
  });
  assert.equal(latestInstantFromDimension("not-a-date"), null);
});

test("the admitted layer name is verified against the document", () => {
  assert.equal(capabilitiesPublishLayer(capabilitiesXml, NWS_RADAR_WMS_LAYER), true);
  assert.equal(capabilitiesPublishLayer(capabilitiesXml, "radar_something_else"), false);
});

/* -------------------------------------------------------------------------- */
/* Product construction                                                       */
/* -------------------------------------------------------------------------- */

test("a healthy service yields a covered radar product with full provenance", () => {
  const product = buildRadarProduct({ ok: true, xml: capabilitiesXml }, NOW);

  assert.equal(product.id, "nws-radar-base-reflectivity");
  assert.equal(product.layerId, "weather");
  assert.equal(product.kind, "imagery");
  assert.equal(product.availability, "covered");
  assert.equal(product.providerId, "noaa-nws-radar");
  // Attribution is the provider's own copyrightText, reproduced verbatim.
  assert.equal(product.attribution, ATTRIBUTION);
  assert.equal(product.licence, "U.S. public domain (NOAA/NWS)");
  assert.equal(product.sourceUrl, "https://radar.weather.gov/");
});

test("source time, ingestion time and model time stay three separate facts", () => {
  const product = buildRadarProduct({ ok: true, xml: capabilitiesXml }, NOW);

  assert.equal(product.sourceTimestamp?.toISOString(), "2026-10-01T13:06:59.000Z");
  assert.equal(product.ingestionTimestamp.toISOString(), NOW.toISOString());
  assert.notEqual(
    product.sourceTimestamp?.toISOString(),
    product.ingestionTimestamp.toISOString(),
  );
  // MRMS base reflectivity is an observation. Nulls here are a statement
  // that no forecast and no model run are involved.
  assert.equal(product.validTime, null);
  assert.equal(product.runTime, null);
});

test("the imagery descriptor requests EPSG:3857, avoiding the 1.3.0 axis trap", () => {
  const product = buildRadarProduct({ ok: true, xml: capabilitiesXml }, NOW);
  assert.ok(product.imagery);
  assert.equal(product.imagery.protocol, "wms");
  assert.equal(product.imagery.version, "1.3.0");
  // WMS 1.3.0 reverses axis order for EPSG:4326; 3857 is requested so the
  // question never arises.
  assert.equal(product.imagery.crs, "EPSG:3857");
  // The projections NOAA advertises in its own GetCapabilities, recorded so
  // a renderer needing a different frame can check rather than assume. CRS:84
  // is the longitude-first geographic option, which is what lets the globe
  // request an equirectangular texture without the EPSG:4326 axis reversal.
  assert.deepEqual(product.imagery.supportedCrs, [
    "CRS:84",
    "EPSG:4326",
    "EPSG:3857",
  ]);
  // Whatever the map requests must itself be advertised by the provider.
  assert.ok(product.imagery.supportedCrs.includes(product.imagery.crs));
  assert.equal(product.imagery.format, "image/png");
  assert.equal(product.imagery.transparent, true);
  assert.equal(product.imagery.layer, NWS_RADAR_WMS_LAYER);
  assert.ok(product.imagery.endpoint.endsWith("/WMSServer"));
  // Published so a future frame selector need not guess the parameter name,
  // even though Signalwatch currently omits it to get the latest frame.
  assert.equal(product.imagery.timeParameter, "time");
});

test("the polling cadence is the slower of NOAA's two contradictory figures", () => {
  // NOAA states both "every 5 minutes" and "approximately every ten
  // minutes". The admission record resolved this by taking the slower one,
  // because the NWS appropriate-use notice treats over-polling as abuse.
  assert.equal(REFRESH_INTERVAL_MS, 600_000);
  assert.equal(STALE_AFTER_MS, 1_800_000);
  const product = buildRadarProduct({ ok: true, xml: capabilitiesXml }, NOW);
  assert.equal(product.refreshIntervalMs, 600_000);
});

test("coverage names the observed regions and excludes Canada", () => {
  const product = buildRadarProduct({ ok: true, xml: capabilitiesXml }, NOW);
  assert.equal(product.coverage.scope, "regional");
  assert.deepEqual(product.coverage.regions, [
    "Continental United States",
    "Alaska",
    "Hawaii",
    "Caribbean (Puerto Rico and the U.S. Virgin Islands)",
    "Guam",
  ]);
  // An older NOAA MapServer description claimed Canadian coverage; this
  // service's own metadata does not, so Signalwatch does not claim it.
  assert.ok(!JSON.stringify(product.coverage).includes("Canada"));
});

test("coverage is a list of per-region boxes, not the provider's min/max envelope", () => {
  // The published envelope spans -176..150 longitude because Guam and the
  // Caribbean sit at opposite ends of the Pacific. Using it as the render
  // clip would request tiles over Europe, Africa and Asia, where the service
  // returns transparent pixels that look exactly like "no precipitation".
  assert.equal(PUBLISHED_ENVELOPE.west, -176);
  assert.equal(PUBLISHED_ENVELOPE.east, 150.00479);

  assert.equal(COVERAGE.areas.length, 5);
  assert.deepEqual(
    COVERAGE.areas.map((area) => area.name),
    COVERAGE.regions,
  );
  // Every clip box narrows the provider's claim; none widens it.
  for (const area of COVERAGE.areas) {
    assert.ok(area.west >= PUBLISHED_ENVELOPE.west);
    assert.ok(area.east <= PUBLISHED_ENVELOPE.east);
    assert.ok(area.south >= PUBLISHED_ENVELOPE.south);
    assert.ok(area.north <= PUBLISHED_ENVELOPE.north);
  }
  // Nothing covers central Europe.
  assert.ok(
    COVERAGE.areas.every(
      (area) => !(area.west <= 20 && area.east >= 10 && area.south <= 55 && area.north >= 45),
    ),
  );
});

test("the coverage note says there is no source, never that there is no rain", () => {
  const note = COVERAGE.note.toLowerCase();
  assert.ok(note.includes("no radar source"));
  assert.ok(note.includes("not the same as no precipitation"));
});

test("a frame older than the stale threshold is reported stale, not hidden", () => {
  const late = new Date("2026-10-01T14:00:00.000Z"); // 53 min after the frame
  const product = buildRadarProduct({ ok: true, xml: capabilitiesXml }, late);
  assert.equal(product.availability, "stale");
  // Still drawable: it is real data, labelled as old.
  assert.ok(product.imagery);
  assert.match(product.message, /older than the expected 10-minute update cycle/);
});

test("a provider failure yields unavailable with no imagery at all", () => {
  const product = buildRadarProduct(
    { ok: false, reason: "NOAA/NWS radar declined the request (HTTP 403)." },
    NOW,
  );
  assert.equal(product.availability, "unavailable");
  assert.equal(product.imagery, null);
  assert.equal(product.sourceTimestamp, null);
  assert.match(product.message, /HTTP 403/);
});

test("a withdrawn layer is unavailable rather than silently blank", () => {
  const withoutLayer = capabilitiesXml.replace(
    "<Name>radar_base_reflectivity_time</Name>",
    "<Name>radar_renamed_product</Name>",
  );
  const product = buildRadarProduct({ ok: true, xml: withoutLayer }, NOW);
  assert.equal(product.availability, "unavailable");
  assert.equal(product.imagery, null);
  assert.match(product.message, /no longer publishes/);
});

test("an unreadable frame time still draws, but admits the time is unknown", () => {
  const withoutTime = capabilitiesXml.replace(
    /<Dimension[\s\S]*?<\/Dimension>/,
    "",
  );
  const product = buildRadarProduct({ ok: true, xml: withoutTime }, NOW);
  assert.equal(product.availability, "covered");
  assert.equal(product.sourceTimestamp, null);
  assert.deepEqual(product.imagery, NWS_RADAR_IMAGERY);
  assert.match(product.message, /exact valid time is unknown/);
});

/* -------------------------------------------------------------------------- */
/* Layer coverage derivation                                                  */
/* -------------------------------------------------------------------------- */

test("layer coverage derived from a regional product never claims global reach", () => {
  const product = buildRadarProduct({ ok: true, xml: capabilitiesXml }, NOW);
  const coverage = deriveWeatherCoverage([product]);
  assert.equal(coverage.scope, "regional");
  // Areas are concatenated, never merged into an envelope.
  assert.deepEqual(coverage.areas, COVERAGE.areas);
  assert.match(coverage.note, /no weather source/);
});

test("no products yields an explicit unconfigured statement, not a global default", () => {
  const coverage = deriveWeatherCoverage([]);
  assert.equal(coverage.scope, "local");
  assert.deepEqual(coverage.areas, []);
  assert.match(coverage.note, /No weather product is configured/);
});

/* -------------------------------------------------------------------------- */
/* Route                                                                      */
/* -------------------------------------------------------------------------- */

test("GET /monitoring/weather returns products with coverage and provenance", async () => {
  const product = buildRadarProduct({ ok: true, xml: capabilitiesXml }, NOW);
  await withRouter(
    async () => [product],
    async (baseUrl) => {
      const response = await fetch(`${baseUrl}/monitoring/weather`);
      assert.equal(response.status, 200);
      const body = (await response.json()) as {
        coverage: { scope: string; areas: unknown[] };
        products: Array<Record<string, unknown>>;
      };
      assert.equal(body.coverage.scope, "regional");
      assert.equal(body.products.length, 1);
      const [first] = body.products;
      assert.equal(first.id, "nws-radar-base-reflectivity");
      assert.equal(first.kind, "imagery");
      assert.equal(first.availability, "covered");
      assert.equal(first.sourceTimestamp, "2026-10-01T13:06:59.000Z");
      // Declared for the next batch, and explicitly empty in this one.
      assert.equal(first.field, null);
    },
  );
});

test("an unavailable provider is reported, never omitted from the response", async () => {
  const product = buildRadarProduct(
    { ok: false, reason: "NOAA/NWS radar could not be reached: timeout." },
    NOW,
  );
  await withRouter(
    async () => [product],
    async (baseUrl) => {
      const response = await fetch(`${baseUrl}/monitoring/weather`);
      const body = (await response.json()) as {
        products: Array<Record<string, unknown>>;
      };
      // Dropping it would make "no radar" indistinguishable from "no rain".
      assert.equal(body.products.length, 1);
      assert.equal(body.products[0].availability, "unavailable");
      assert.equal(body.products[0].imagery, null);
    },
  );
});

test("the weather response carries no record list, limit or pagination", async () => {
  const product = buildRadarProduct({ ok: true, xml: capabilitiesXml }, NOW);
  await withRouter(
    async () => [product],
    async (baseUrl) => {
      const response = await fetch(`${baseUrl}/monitoring/weather`);
      const body = (await response.json()) as Record<string, unknown>;
      // A surface is not an enumerable list of records; the observation
      // route's limit/matchedCount vocabulary must not leak into it.
      assert.equal(body.limit, undefined);
      assert.equal(body.matchedCount, undefined);
      assert.equal(body.returnedCount, undefined);
      assert.ok(Array.isArray(body.products));
    },
  );
});
