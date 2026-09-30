import assert from "node:assert/strict";
import { once } from "node:events";
import type { AddressInfo } from "node:net";
import express from "express";
import "pino-http";
import { test } from "node:test";
import { representativeLocation } from "../src/public-event-providers/geometry";
import {
  parseQldTrafficEvents,
  qldtrafficApiKey,
  qldtrafficCoverage,
} from "../src/public-event-providers/qldtraffic";
import {
  fetchTfnswSnapshot,
  parseTfnswHazards,
  readTfnswApiKey,
  tfnswCoverage,
} from "../src/public-event-providers/tfnsw";
import { derivePublicEventCoverage } from "../src/public-event-providers/registry";
import type { PublicEventProviderSnapshot } from "../src/public-event-providers/types";
import { createMonitoringPublicEventsRouter } from "../src/routes/public-events";

const RECEIVED_AT = new Date("2026-09-30T04:00:00.000Z");

/** Shaped after QLDTraffic API specification v1.10 §4.1. */
const qldPayload = {
  type: "FeatureCollection",
  features: [
    {
      type: "Feature",
      geometry: {
        type: "GeometryCollection",
        geometries: [
          {
            type: "LineString",
            coordinates: [
              [153.0, -27.34],
              [153.02, -27.34],
            ],
          },
          {
            type: "LineString",
            coordinates: [
              [153.02, -27.36],
              [153.0, -27.36],
            ],
          },
        ],
      },
      properties: {
        id: 155,
        status: "Published",
        published: "2026-09-29T12:19:00+10:00",
        source: {
          source_name: "EPS",
          provided_by: "Department of Transport and Main Roads",
          provided_by_url: "https://www.tmr.qld.gov.au/",
        },
        url: "http://api.qldtraffic.qld.gov.au/v1/events/155",
        event_type: "Flooding",
        event_subtype: "N/A",
        event_due_to: "Heavy rainfall",
        impact: {
          direction: "Southbound",
          towards: "Station",
          impact_type: "Road closed",
          impact_subtype: null,
          delay: "No delays expected",
        },
        duration: {
          start: "2026-09-29T12:13:00+10:00",
          end: "2026-10-02T12:18:00+10:00",
        },
        event_priority: "Low",
        description: "Road closed due to flooding",
        advice: "Use alternative route",
        road_summary: {
          road_name: "Kuringgai Parkway",
          locality: "Fitzgibbon",
          postcode: "4018",
          local_government_area: "BRISBANE CITY",
          district: "Metropolitan",
        },
        last_updated: "2026-09-29T13:37:19.448257+10:00",
        web_link: "https://qldtraffic.qld.gov.au/event/155",
      },
    },
    {
      // A single published Point must not be marked as derived.
      type: "Feature",
      geometry: {
        type: "GeometryCollection",
        geometries: [{ type: "Point", coordinates: [145.77, -16.92] }],
      },
      properties: {
        id: 156,
        event_type: "Crash",
        status: "Published",
        road_summary: { road_name: "Captain Cook Highway" },
      },
    },
    {
      // Unusable geometry: dropped rather than placed at a guessed point.
      type: "Feature",
      geometry: { type: "GeometryCollection", geometries: [] },
      properties: { id: 157, event_type: "Hazard" },
    },
  ],
};

/** Shaped after the TfNSW Live Traffic hazards GeoJSON. */
const tfnswPayload = {
  type: "FeatureCollection",
  features: [
    {
      type: "Feature",
      id: "nsw-1001",
      geometry: { type: "Point", coordinates: [151.2093, -33.8688] },
      properties: {
        displayName: "Incident",
        mainCategory: "Incident",
        subCategoryA: "Crash",
        headline: "Two vehicles involved in a crash",
        adviceA: "Exercise caution",
        isMajor: true,
        ended: false,
        created: 1790000000,
        lastUpdated: 1790003600,
        webLinkUrl: "https://www.livetraffic.com/incident/1001",
        sourceName: "Transport Management Centre",
        roads: [
          {
            mainStreet: "Parramatta Road",
            suburb: "Camperdown",
            region: "Sydney",
            county: "Cumberland",
          },
        ],
      },
    },
  ],
};

function snapshot(
  id: string,
  name: string,
  status: "available" | "unavailable" | "unconfigured",
  regions: string[],
): PublicEventProviderSnapshot {
  return {
    events: [],
    provider: {
      id,
      name,
      attribution: `${id} attribution`,
      licence: "CC BY 4.0",
      licenceUrl: "https://creativecommons.org/licenses/by/4.0/",
      catalogueUrl: "https://example.test/docs",
      status,
      coverage: { scope: "regional", regions, note: `${id} note` },
      eventCount: 0,
      checkedAt: RECEIVED_AT,
      message: `${id} message`,
    },
  };
}

async function withRouter(
  loader: () => Promise<PublicEventProviderSnapshot[]>,
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
  app.use(createMonitoringPublicEventsRouter(loader));
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
/* Geometry: derived locations are labelled, never presented as surveyed       */
/* -------------------------------------------------------------------------- */

test("a multi-segment GeometryCollection yields a flagged derived point", () => {
  const location = representativeLocation(
    qldPayload.features[0].geometry as unknown,
  );
  assert.ok(location);
  assert.equal(location.derived, true);
  assert.match(String(location.derivedFrom), /2 geometries/);
  // Mean of the four supplied vertices.
  assert.ok(Math.abs(location.latitude - -27.35) < 1e-9);
  assert.ok(Math.abs(location.longitude - 153.01) < 1e-9);
});

test("a single published Point is used as-is and is not marked derived", () => {
  const location = representativeLocation({
    type: "GeometryCollection",
    geometries: [{ type: "Point", coordinates: [145.77, -16.92] }],
  });
  assert.ok(location);
  assert.equal(location.derived, false);
  assert.equal(location.derivedFrom, null);
  assert.equal(location.latitude, -16.92);
});

test("unusable geometry yields no location instead of a guess", () => {
  assert.equal(representativeLocation({ type: "GeometryCollection", geometries: [] }), null);
  assert.equal(representativeLocation(null), null);
  assert.equal(
    representativeLocation({ type: "Point", coordinates: [999, 91] }),
    null,
  );
});

/* -------------------------------------------------------------------------- */
/* QLDTraffic normalization                                                   */
/* -------------------------------------------------------------------------- */

test("QLDTraffic records keep source category, priority and timestamps", () => {
  const records = parseQldTrafficEvents(qldPayload, RECEIVED_AT);
  assert.equal(records.length, 2);

  const flooding = records.find((record) => record.id === "qldtraffic:155");
  assert.ok(flooding);
  // The source classified this as Flooding; it stays a civic incident and is
  // NOT promoted into the natural-hazards layer because of the word.
  assert.equal(flooding.eventType, "Flooding");
  assert.equal(flooding.provider, "qldtraffic");
  assert.equal(flooding.eventDueTo, "Heavy rainfall");
  assert.equal(flooding.sourcePriority, "Low");
  assert.equal(flooding.impact?.impactType, "Road closed");
  assert.equal(flooding.roadSummary?.localGovernmentArea, "BRISBANE CITY");
  assert.equal(flooding.suppliedBy, "Department of Transport and Main Roads");
  assert.equal(flooding.locationDerived, true);
  assert.match(String(flooding.locationNote), /not a single published coordinate/);
  assert.equal(flooding.attribution.includes("Queensland"), true);
});

test("the literal subtype placeholder N/A becomes null, not a displayed value", () => {
  const [flooding] = parseQldTrafficEvents(qldPayload, RECEIVED_AT);
  assert.equal(flooding.eventSubtype, null);
});

test("source times stay distinct from the Signalwatch receipt time", () => {
  const [flooding] = parseQldTrafficEvents(qldPayload, RECEIVED_AT);
  assert.equal(flooding.receivedAt.getTime(), RECEIVED_AT.getTime());
  assert.ok(flooding.publishedAt);
  assert.notEqual(flooding.publishedAt.getTime(), flooding.receivedAt.getTime());
  assert.ok(flooding.lastUpdatedAt);
});

test("insecure provider links are upgraded rather than rendered as mixed content", () => {
  const records = parseQldTrafficEvents(
    {
      features: [
        {
          geometry: { type: "Point", coordinates: [153, -27] },
          properties: {
            id: 900,
            event_type: "Hazard",
            url: "http://api.qldtraffic.qld.gov.au/v1/events/900",
          },
        },
      ],
    },
    RECEIVED_AT,
  );
  assert.equal(records[0].sourceUrl.startsWith("https://"), true);
});

test("malformed QLDTraffic payloads yield no records instead of throwing", () => {
  assert.deepEqual(parseQldTrafficEvents(null, RECEIVED_AT), []);
  assert.deepEqual(parseQldTrafficEvents({ features: {} }, RECEIVED_AT), []);
});

test("the documented public key is used when no override is configured", () => {
  assert.equal(qldtrafficApiKey({}), "3e83add325cbb69ac4d8e5bf433d770b");
  assert.equal(qldtrafficApiKey({ QLDTRAFFIC_API_KEY: "own-key" }), "own-key");
});

/* -------------------------------------------------------------------------- */
/* TfNSW: credential gating                                                   */
/* -------------------------------------------------------------------------- */

test("a missing NSW key is unconfigured, not a failure and not fake data", async () => {
  assert.equal(readTfnswApiKey({}), null);

  const snapshotResult = await fetchTfnswSnapshot(RECEIVED_AT, {});
  assert.equal(snapshotResult.provider.status, "unconfigured");
  assert.equal(snapshotResult.events.length, 0);
  assert.equal(snapshotResult.provider.eventCount, 0);
  assert.match(snapshotResult.provider.message, /TFNSW_API_KEY/);
  assert.match(snapshotResult.provider.message, /other providers are unaffected/i);
  // Never described as "no incidents in NSW".
  assert.doesNotMatch(snapshotResult.provider.message, /no incidents/i);
});

test("TfNSW records normalize with source category and its own major flag", () => {
  const records = parseTfnswHazards(tfnswPayload, RECEIVED_AT);
  assert.equal(records.length, 1);
  const [incident] = records;
  assert.equal(incident.id, "tfnsw:nsw-1001");
  assert.equal(incident.provider, "tfnsw");
  assert.equal(incident.eventType, "Incident");
  assert.equal(incident.eventSubtype, "Crash");
  assert.equal(incident.sourcePriority, "Major");
  assert.equal(incident.locationDerived, false);
  assert.equal(incident.roadSummary?.roadName, "Parramatta Road");
  assert.equal(incident.attribution, "Transport for NSW");
  // Epoch seconds are interpreted, not passed through as 1970.
  assert.equal(incident.publishedAt?.getUTCFullYear(), 2026);
});

/* -------------------------------------------------------------------------- */
/* Coverage and provider independence                                          */
/* -------------------------------------------------------------------------- */

test("coverage counts only providers actually supplying data", () => {
  const derived = derivePublicEventCoverage([
    snapshot("qldtraffic", "QLDTraffic", "available", ["Queensland road network"]),
    snapshot("tfnsw", "TfNSW", "unconfigured", ["New South Wales road network"]),
  ]);
  assert.equal(derived.scope, "regional");
  assert.deepEqual(derived.regions, ["Queensland road network"]);
  assert.doesNotMatch(derived.note, /New South Wales/);

  const none = derivePublicEventCoverage([
    snapshot("qldtraffic", "QLDTraffic", "unavailable", ["Queensland road network"]),
    snapshot("tfnsw", "TfNSW", "unconfigured", ["New South Wales road network"]),
  ]);
  assert.deepEqual(none.regions, []);
  assert.match(none.note, /no coverage can be claimed/i);
});

test("neither provider is ever described as global or national", () => {
  for (const coverage of [qldtrafficCoverage, tfnswCoverage]) {
    assert.equal(coverage.scope, "regional");
    assert.doesNotMatch(coverage.note, /\bglobal\b/i);
    assert.doesNotMatch(coverage.note, /\bnational\b/i);
    assert.match(coverage.note, /current conditions only/i);
  }
});

test("an unconfigured NSW provider never suppresses healthy Queensland data", async () => {
  const snapshots: PublicEventProviderSnapshot[] = [
    {
      ...snapshot("qldtraffic", "QLDTraffic", "available", [
        "Queensland road network",
      ]),
      events: parseQldTrafficEvents(qldPayload, RECEIVED_AT),
    },
    snapshot("tfnsw", "TfNSW", "unconfigured", ["New South Wales road network"]),
  ];

  await withRouter(
    async () => snapshots,
    async (baseUrl) => {
      const response = await fetch(`${baseUrl}/monitoring/public-events`);
      assert.equal(response.status, 200);
      const body = (await response.json()) as {
        events: Array<{ provider: string }>;
        providers: Array<{ id: string; status: string }>;
        coverage: { scope: string; regions: string[] };
      };
      assert.equal(body.events.length, 2);
      assert.ok(body.events.every((event) => event.provider === "qldtraffic"));
      // NSW remains listed so the gap is visible rather than silently missing.
      assert.equal(
        body.providers.find((provider) => provider.id === "tfnsw")?.status,
        "unconfigured",
      );
      assert.deepEqual(body.coverage.regions, ["Queensland road network"]);
    },
  );
});

test("the route bounds responses and scopes provider filtering", async () => {
  const snapshots: PublicEventProviderSnapshot[] = [
    {
      ...snapshot("qldtraffic", "QLDTraffic", "available", [
        "Queensland road network",
      ]),
      events: parseQldTrafficEvents(qldPayload, RECEIVED_AT),
    },
    {
      ...snapshot("tfnsw", "TfNSW", "available", [
        "New South Wales road network",
      ]),
      events: parseTfnswHazards(tfnswPayload, RECEIVED_AT),
    },
  ];

  await withRouter(
    async () => snapshots,
    async (baseUrl) => {
      const limited = await fetch(
        `${baseUrl}/monitoring/public-events?limit=1`,
      );
      const limitedBody = (await limited.json()) as {
        matchedCount: number;
        returnedCount: number;
      };
      assert.equal(limitedBody.returnedCount, 1);
      assert.equal(limitedBody.matchedCount, 3);

      const scoped = await fetch(
        `${baseUrl}/monitoring/public-events?provider=tfnsw`,
      );
      const scopedBody = (await scoped.json()) as {
        events: Array<{ provider: string }>;
        providers: Array<{ id: string }>;
      };
      assert.ok(scopedBody.events.every((event) => event.provider === "tfnsw"));
      assert.deepEqual(
        scopedBody.providers.map((provider) => provider.id),
        ["tfnsw"],
      );
    },
  );
});

test("no provider module reclassifies records by keyword", async () => {
  const { readFile } = await import("node:fs/promises");
  for (const file of ["qldtraffic.ts", "tfnsw.ts"]) {
    const source = await readFile(
      new URL(`../src/public-event-providers/${file}`, import.meta.url),
      "utf8",
    );
    const code = source
      .replace(/\/\*[\s\S]*?\*\//g, "")
      .replace(/^\s*\/\/.*$/gm, "");
    // Categories come from the payload, never from matching words in text.
    assert.doesNotMatch(code, /includes\(\s*["'](flood|fire|crash|storm)/i);
    assert.doesNotMatch(code, /hazardType/);
  }
});

/* -------------------------------------------------------------------------- */
/* Bind address (desktop sidecar safety)                                      */
/* -------------------------------------------------------------------------- */

test("the server honours HOST so the desktop sidecar stays on loopback", async () => {
  const { readFile } = await import("node:fs/promises");
  const entry = await readFile(
    new URL("../src/index.ts", import.meta.url),
    "utf8",
  );

  // Express binds every interface when no host is passed. The packaged desktop
  // app sets HOST=127.0.0.1 so its bundled API is not published to the local
  // network; that only works if the host argument is actually supplied.
  assert.match(
    entry,
    /app\.listen\(\s*port\s*,\s*host\s*,/,
    "app.listen must receive an explicit host argument",
  );
  assert.match(
    entry,
    /process\.env\["HOST"\]/,
    "the bind address must be configurable via HOST",
  );
  assert.match(
    entry,
    /\|\|\s*"0\.0\.0\.0"/,
    "server deployments must keep binding all interfaces by default",
  );
});
