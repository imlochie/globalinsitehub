import assert from "node:assert/strict";
import { once } from "node:events";
import type { AddressInfo } from "node:net";
import express from "express";
import "pino-http";
import { test } from "node:test";
import { parseUsgsEarthquakes, usgsCoverage } from "../src/hazard-sources/usgs";
import {
  parseEonetEvents,
  representativePoint,
} from "../src/hazard-sources/eonet";
import {
  deriveHazardCoverage,
  isHazardSourcedEventId,
} from "../src/hazard-sources/registry";
import type { HazardSourceSnapshot } from "../src/hazard-sources/types";
import { createMonitoringHazardsRouter } from "../src/routes/hazards";

const RECEIVED_AT = new Date("2026-09-30T04:00:00.000Z");

/** Shaped after the documented USGS GeoJSON summary format. */
const usgsPayload = {
  type: "FeatureCollection",
  metadata: { generated: 1759200000000 },
  features: [
    {
      type: "Feature",
      id: "us7000abcd",
      properties: {
        mag: 5.1,
        place: "112 km SSE of Kokopo, Papua New Guinea",
        time: 1759190000000,
        updated: 1759190600000,
        url: "https://earthquake.usgs.gov/earthquakes/eventpage/us7000abcd",
        magType: "mww",
        status: "reviewed",
        tsunami: 0,
        type: "earthquake",
        title: "M 5.1 - 112 km SSE of Kokopo, Papua New Guinea",
      },
      geometry: { type: "Point", coordinates: [152.4, -5.1, 63.2] },
    },
    {
      // Unusable coordinates: must be dropped, not clamped or guessed.
      type: "Feature",
      id: "us7000bad1",
      properties: { mag: 3, time: 1759190000000, type: "earthquake" },
      geometry: { type: "Point", coordinates: [999, 91, 10] },
    },
    {
      // No origin time: cannot be timed honestly, so it is dropped.
      type: "Feature",
      id: "us7000bad2",
      properties: { mag: 3, type: "earthquake" },
      geometry: { type: "Point", coordinates: [10, 10, 10] },
    },
  ],
};

/** Shaped after the documented EONET v3 event format. */
const eonetPayload = {
  title: "EONET Events",
  events: [
    {
      id: "EONET_6789",
      title: "Wildfire - Northern Territory, Australia",
      description: "Active fire perimeter.",
      link: "https://eonet.gsfc.nasa.gov/api/v3/events/EONET_6789",
      closed: null,
      categories: [{ id: "wildfires", title: "Wildfires" }],
      sources: [
        { id: "PDC", url: "https://reports.pdc.org/hazard/12345" },
      ],
      geometry: [
        {
          magnitudeValue: 1200,
          magnitudeUnit: "acres",
          date: "2026-09-28T00:00:00Z",
          type: "Point",
          coordinates: [133.4, -14.2],
        },
        {
          magnitudeValue: 2400,
          magnitudeUnit: "acres",
          date: "2026-09-29T00:00:00Z",
          type: "Point",
          coordinates: [133.6, -14.3],
        },
      ],
    },
    {
      id: "EONET_9999",
      title: "Iceberg B-52",
      closed: "2026-09-20T00:00:00Z",
      categories: [{ id: "seaLakeIce", title: "Sea and Lake Ice" }],
      sources: [],
      geometry: [
        {
          date: "2026-09-19T00:00:00Z",
          type: "Polygon",
          coordinates: [
            [
              [-60, -66],
              [-58, -66],
              [-58, -64],
              [-60, -64],
              [-60, -66],
            ],
          ],
        },
      ],
    },
  ],
};

function snapshot(
  id: string,
  status: "available" | "unavailable",
  scope: "global" | "regional",
  hazardCount: number,
): HazardSourceSnapshot {
  return {
    hazards: [],
    source: {
      id,
      name: `${id} source`,
      attribution: `${id} attribution`,
      licence: "test licence",
      licenceUrl: "https://example.test/licence",
      catalogueUrl: "https://example.test/docs",
      status,
      coverage: { scope, regions: [`${id} region`], note: `${id} note` },
      hazardCount,
      checkedAt: RECEIVED_AT,
      message: `${id} message`,
    },
  };
}

async function withRouter(
  loader: () => Promise<HazardSourceSnapshot[]>,
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
  app.use(createMonitoringHazardsRouter(loader));
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
/* Normalization                                                              */
/* -------------------------------------------------------------------------- */

test("USGS records keep provider identity, depth, scale and review state", () => {
  const records = parseUsgsEarthquakes(usgsPayload, RECEIVED_AT);
  assert.equal(records.length, 1);
  const [record] = records;
  assert.equal(record.id, "usgs:us7000abcd");
  assert.equal(record.source, "usgs");
  assert.equal(record.hazardType, "earthquake");
  assert.equal(record.magnitudeValue, 5.1);
  // The scale travels with the number; it is never flattened into a score.
  assert.equal(record.magnitudeUnit, "mww");
  assert.equal(record.depthKm, 63.2);
  assert.equal(record.reviewStatus, "reviewed");
  assert.equal(record.latitude, -5.1);
  assert.equal(record.longitude, 152.4);
  assert.equal(record.occurredAt.toISOString(), "2025-09-29T23:53:20.000Z");
  assert.equal(record.attribution, "Credit: U.S. Geological Survey");
});

test("USGS observation time is the origin time, never the receipt time", () => {
  const [record] = parseUsgsEarthquakes(usgsPayload, RECEIVED_AT);
  assert.notEqual(record.occurredAt.getTime(), record.receivedAt.getTime());
  assert.equal(record.receivedAt.getTime(), RECEIVED_AT.getTime());
});

test("records without usable coordinates or times are dropped, not repaired", () => {
  const ids = parseUsgsEarthquakes(usgsPayload, RECEIVED_AT).map((r) => r.id);
  assert.ok(!ids.includes("usgs:us7000bad1"));
  assert.ok(!ids.includes("usgs:us7000bad2"));
});

test("EONET uses the latest geometry and the source-declared open/closed state", () => {
  const records = parseEonetEvents(eonetPayload, RECEIVED_AT);
  assert.equal(records.length, 2);
  const wildfire = records.find((r) => r.id === "nasa-eonet:EONET_6789");
  assert.ok(wildfire);
  assert.equal(wildfire.hazardType, "Wildfires");
  assert.equal(wildfire.activityStatus, "open");
  assert.equal(wildfire.longitude, 133.6);
  assert.equal(wildfire.occurredAt.toISOString(), "2026-09-29T00:00:00.000Z");
  // Magnitude keeps its unit: 2400 acres is not comparable to a magnitude 5.1.
  assert.equal(wildfire.magnitudeValue, 2400);
  assert.equal(wildfire.magnitudeUnit, "acres");

  const iceberg = records.find((r) => r.id === "nasa-eonet:EONET_9999");
  assert.ok(iceberg);
  assert.equal(iceberg.activityStatus, "closed");
});

test("hazard type comes from the source category, never from the title", () => {
  const [record] = parseEonetEvents(
    {
      events: [
        {
          id: "EONET_1",
          // A title that mentions an earthquake under a Volcanoes category.
          title: "Earthquake swarm near volcano",
          categories: [{ id: "volcanoes", title: "Volcanoes" }],
          geometry: [
            { date: "2026-09-29T00:00:00Z", type: "Point", coordinates: [1, 2] },
          ],
        },
      ],
    },
    RECEIVED_AT,
  );
  assert.equal(record.hazardType, "Volcanoes");
});

test("polygon geometries resolve to a marked approximate centre", () => {
  const point = representativePoint({
    type: "Polygon",
    coordinates: [
      [
        [-60, -66],
        [-58, -66],
        [-58, -64],
        [-60, -64],
        [-60, -66],
      ],
    ],
  });
  assert.ok(point);
  assert.equal(point.approximate, true);
  assert.ok(point.latitude > -66 && point.latitude < -64);

  const records = parseEonetEvents(eonetPayload, RECEIVED_AT);
  const iceberg = records.find((r) => r.id === "nasa-eonet:EONET_9999");
  assert.match(String(iceberg?.description), /not a precise point/);
});

test("repeated provider ids are deduplicated by identity, not by title", () => {
  const duplicated = {
    features: [...usgsPayload.features, usgsPayload.features[0]],
  };
  assert.equal(parseUsgsEarthquakes(duplicated, RECEIVED_AT).length, 1);
});

test("malformed payloads yield no records instead of throwing", () => {
  assert.deepEqual(parseUsgsEarthquakes(null, RECEIVED_AT), []);
  assert.deepEqual(parseEonetEvents("nope", RECEIVED_AT), []);
  assert.deepEqual(parseUsgsEarthquakes({ features: {} }, RECEIVED_AT), []);
});

/* -------------------------------------------------------------------------- */
/* Coverage and source independence                                           */
/* -------------------------------------------------------------------------- */

test("coverage is derived from the sources that actually answered", () => {
  assert.equal(
    deriveHazardCoverage([
      snapshot("usgs", "available", "global", 3),
      snapshot("nasa-eonet", "unavailable", "global", 0),
    ]).scope,
    "global",
  );

  const none = deriveHazardCoverage([
    snapshot("usgs", "unavailable", "global", 0),
    snapshot("nasa-eonet", "unavailable", "global", 0),
  ]);
  // With nothing reachable the layer claims no coverage at all rather than
  // implying a quiet world.
  assert.equal(none.scope, "local");
  assert.deepEqual(none.regions, []);
  assert.match(none.note, /no coverage can be claimed/i);
});

test("USGS declares global reach with an explicit completeness limit", () => {
  assert.equal(usgsCoverage.scope, "global");
  assert.match(usgsCoverage.note, /magnitude 2\.5/i);
});

test("one source failing leaves the other source's hazards intact", async () => {
  const usgsRecords = parseUsgsEarthquakes(usgsPayload, RECEIVED_AT);
  const snapshots: HazardSourceSnapshot[] = [
    { ...snapshot("usgs", "available", "global", 1), hazards: usgsRecords },
    snapshot("nasa-eonet", "unavailable", "global", 0),
  ];

  await withRouter(
    async () => snapshots,
    async (baseUrl) => {
      const response = await fetch(`${baseUrl}/monitoring/hazards`);
      assert.equal(response.status, 200);
      const body = (await response.json()) as {
        hazards: Array<{ id: string; source: string }>;
        sources: Array<{ id: string; status: string }>;
        coverage: { scope: string };
      };
      assert.equal(body.hazards.length, 1);
      assert.equal(body.hazards[0].source, "usgs");
      // The failing source is still listed, so the gap is visible.
      assert.equal(
        body.sources.find((source) => source.id === "nasa-eonet")?.status,
        "unavailable",
      );
      assert.equal(body.coverage.scope, "global");
    },
  );
});

test("source filtering scopes hazards, sources and coverage together", async () => {
  const snapshots: HazardSourceSnapshot[] = [
    {
      ...snapshot("usgs", "available", "global", 1),
      hazards: parseUsgsEarthquakes(usgsPayload, RECEIVED_AT),
    },
    {
      ...snapshot("nasa-eonet", "available", "global", 2),
      hazards: parseEonetEvents(eonetPayload, RECEIVED_AT),
    },
  ];

  await withRouter(
    async () => snapshots,
    async (baseUrl) => {
      const response = await fetch(
        `${baseUrl}/monitoring/hazards?source=nasa-eonet`,
      );
      const body = (await response.json()) as {
        hazards: Array<{ source: string }>;
        sources: Array<{ id: string }>;
      };
      assert.ok(body.hazards.length > 0);
      assert.ok(body.hazards.every((hazard) => hazard.source === "nasa-eonet"));
      assert.deepEqual(
        body.sources.map((source) => source.id),
        ["nasa-eonet"],
      );
    },
  );
});

test("responses stay bounded by the requested limit", async () => {
  const snapshots: HazardSourceSnapshot[] = [
    {
      ...snapshot("nasa-eonet", "available", "global", 2),
      hazards: parseEonetEvents(eonetPayload, RECEIVED_AT),
    },
  ];
  await withRouter(
    async () => snapshots,
    async (baseUrl) => {
      const response = await fetch(`${baseUrl}/monitoring/hazards?limit=1`);
      const body = (await response.json()) as {
        matchedCount: number;
        returnedCount: number;
        hazards: unknown[];
      };
      assert.equal(body.hazards.length, 1);
      assert.equal(body.returnedCount, 1);
      assert.equal(body.matchedCount, 2);
    },
  );
});

test("hazard-sourced briefing ids are recognised by provider prefix only", () => {
  assert.equal(isHazardSourcedEventId("usgs-us7000abcd"), true);
  assert.equal(isHazardSourcedEventId("eonet-EONET_6789"), true);
  // A news item merely mentioning an earthquake stays a public event.
  assert.equal(isHazardSourcedEventId("abc-news-earthquake-story"), false);
});
