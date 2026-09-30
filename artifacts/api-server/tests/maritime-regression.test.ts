import assert from "node:assert/strict";
import { once } from "node:events";
import type { AddressInfo } from "node:net";
import express from "express";
import "pino-http";
import { test } from "node:test";
import type { MaritimeProviderStatus, VesselRecord } from "@workspace/api-zod";
import {
  navigationalStatusLabel,
  shipTypeLabel,
  speedOverGround,
  courseOverGround,
  trueHeading,
  imoNumber,
  mmsiString,
} from "../src/maritime-providers/ais";
import {
  parseVesselLocations,
  parseVesselMetadata,
  digitrafficCoverage,
} from "../src/maritime-providers/digitraffic";
import {
  barentswatchCoverage,
  parseLatestPositions,
  readCredentials,
} from "../src/maritime-providers/barentswatch";
import { createMemoryCachedVesselProvider } from "../src/maritime-providers/memory-cache";
import {
  deriveCoverage,
  getMaritimeProviderSnapshots,
} from "../src/maritime-providers/registry";
import type { VesselProviderAdapter, VesselProviderSnapshot } from "../src/maritime-providers/types";
import { createMonitoringMaritimeRouter } from "../src/routes/maritime";

const vessel = (
  id: string,
  provider: string,
  overrides: Partial<VesselRecord> = {},
): VesselRecord => ({
  id,
  provider,
  mmsi: id,
  imo: null,
  callSign: null,
  name: `Vessel ${id}`,
  shipType: 70,
  shipTypeLabel: "Cargo",
  latitude: 60.1,
  longitude: 24.9,
  courseOverGround: 120,
  heading: 118,
  speedOverGround: 9.4,
  navigationalStatus: 0,
  navigationalStatusLabel: "Under way using engine",
  destination: "HELSINKI",
  draughtMetres: 6.1,
  positionTimestamp: new Date(),
  receivedAt: new Date(),
  sourceUrl: "https://example.test/feed",
  attribution: `${provider} attribution`,
  licence: "CC BY 4.0",
  ...overrides,
});

const providerStatus = (
  id: string,
  status: MaritimeProviderStatus["status"],
  vesselCount: number,
): MaritimeProviderStatus => ({
  id,
  name: `${id} feed`,
  attribution: `${id} attribution`,
  licence: "CC BY 4.0",
  licenceUrl: "https://example.test/licence",
  catalogueUrl: "https://example.test/docs",
  status,
  coverage: { scope: "regional", regions: [`${id} region`], note: `${id} note` },
  vesselCount,
  checkedAt: new Date(),
  lastSuccessfulFetchAt: status === "available" ? new Date() : null,
  message: `${id} message`,
});

async function withRouter(
  loader: () => Promise<VesselProviderSnapshot[]>,
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
  app.use(createMonitoringMaritimeRouter(loader));
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
/* AIS sentinel handling                                                      */
/* -------------------------------------------------------------------------- */

test("documented AIS not-available sentinels become null, never values", () => {
  assert.equal(courseOverGround(360), null);
  assert.equal(courseOverGround(189.8), 189.8);
  assert.equal(speedOverGround(102.3), null);
  assert.equal(speedOverGround(102.4), null);
  assert.equal(speedOverGround(0), 0);
  assert.equal(trueHeading(511), null);
  assert.equal(trueHeading(172), 172);
  assert.equal(imoNumber(0), null);
  assert.equal(imoNumber(9762663), "9762663");
});

test("MMSI stays a string and rejects rubbish", () => {
  assert.equal(mmsiString(230008800), "230008800");
  assert.equal(mmsiString("not-an-mmsi"), null);
});

test("only codes the AIS standard defines are labelled", () => {
  assert.equal(shipTypeLabel(70), "Cargo");
  assert.equal(shipTypeLabel(35), "Military operations");
  assert.equal(shipTypeLabel(0), null);
  assert.equal(navigationalStatusLabel(5), "Moored");
  // 9, 10 and 13 are reserved: no invented label.
  assert.equal(navigationalStatusLabel(9), null);
});

/* -------------------------------------------------------------------------- */
/* Provider normalization                                                     */
/* -------------------------------------------------------------------------- */

test("Digitraffic locations normalize with metadata merged by MMSI", () => {
  const receivedAt = new Date("2026-09-30T05:00:00.000Z");
  const metadata = parseVesselMetadata([
    {
      mmsi: 230008800,
      name: "TEST VESSEL",
      callSign: "OJTT",
      imo: 9195652,
      shipType: 70,
      destination: "HELSINKI",
      draught: 36,
    },
  ]);
  const vessels = parseVesselLocations(
    {
      type: "FeatureCollection",
      features: [
        {
          mmsi: 230008800,
          geometry: { type: "Point", coordinates: [21.463788, 61.594072] },
          properties: {
            mmsi: 230008800,
            sog: 0,
            cog: 360,
            navStat: 5,
            heading: 511,
            timestampExternal: 1790746229898,
          },
        },
        // Unusable coordinates must be rejected outright.
        {
          mmsi: 230008801,
          geometry: { type: "Point", coordinates: [999, 999] },
          properties: { mmsi: 230008801 },
        },
      ],
    },
    metadata,
    receivedAt,
  );

  assert.equal(vessels.length, 1);
  const [record] = vessels;
  assert.equal(record!.id, "digitraffic:230008800");
  assert.equal(record!.mmsi, "230008800");
  assert.equal(record!.name, "TEST VESSEL");
  assert.equal(record!.imo, "9195652");
  assert.equal(record!.draughtMetres, 3.6);
  assert.equal(record!.courseOverGround, null);
  assert.equal(record!.heading, null);
  assert.equal(record!.navigationalStatusLabel, "Moored");
  assert.equal(record!.attribution.includes("Fintraffic"), true);
  assert.equal(record!.receivedAt, receivedAt);
  assert.notEqual(record!.positionTimestamp, receivedAt);
});

test("BarentsWatch latest positions normalize and keep provider position time", () => {
  const receivedAt = new Date("2026-09-30T05:00:00.000Z");
  const vessels = parseLatestPositions(
    [
      {
        mmsi: 257011940,
        name: "BALDER",
        msgtime: "2026-09-30T04:58:25+00:00",
        latitude: 69.543985,
        longitude: 17.769428,
        courseOverGround: 356.7,
        speedOverGround: 0,
        trueHeading: null,
        navigationalStatus: 1,
        shipType: 33,
        callSign: "LH4258",
        imoNumber: null,
        destination: null,
        draught: 80,
      },
    ],
    receivedAt,
  );
  assert.equal(vessels.length, 1);
  const [record] = vessels;
  assert.equal(record!.id, "barentswatch:257011940");
  assert.equal(record!.heading, null);
  assert.equal(record!.imo, null);
  assert.equal(record!.destination, null);
  assert.equal(record!.draughtMetres, 8);
  assert.equal(record!.licence, "NLOD 2.0");
  assert.equal(
    record!.positionTimestamp?.toISOString(),
    new Date("2026-09-30T04:58:25+00:00").toISOString(),
  );
});

test("BarentsWatch stays unconfigured rather than inventing credentials", () => {
  assert.equal(readCredentials({} as NodeJS.ProcessEnv), null);
  assert.deepEqual(
    readCredentials({
      BARENTSWATCH_CLIENT_ID: "id",
      BARENTSWATCH_CLIENT_SECRET: "secret",
    } as NodeJS.ProcessEnv),
    { clientId: "id", clientSecret: "secret" },
  );
});

/* -------------------------------------------------------------------------- */
/* Cache, freshness and provider isolation                                    */
/* -------------------------------------------------------------------------- */

test("a failing feed reports unavailable, and stale data ages out entirely", async () => {
  let mode: "ok" | "fail" = "ok";
  const provider = createMemoryCachedVesselProvider({
    id: "test",
    name: "Test feed",
    attribution: "test",
    licence: "CC BY 4.0",
    licenceUrl: "https://example.test/licence",
    catalogueUrl: "https://example.test/docs",
    coverage: { scope: "regional", regions: ["Test water"], note: "test" },
    availableMessage: "ok",
    cacheTtlMs: 0,
    retryTtlMs: 0,
    maxRecordAgeMs: 1_000,
    async load() {
      if (mode === "fail") throw new Error("feed down");
      return [
        vessel("111111111", "test", {
          receivedAt: new Date(Date.now() - 10_000),
        }),
      ];
    },
    describeFailure: (error) => `failed: ${String(error)}`,
  });

  const healthy = await provider.getSnapshot();
  assert.equal(healthy.provider.status, "available");

  mode = "fail";
  const failed = await provider.getSnapshot();
  // The cached record is older than maxRecordAgeMs, so it is dropped rather
  // than replayed as a current position.
  assert.equal(failed.vessels.length, 0);
  assert.equal(failed.provider.status, "unavailable");
  assert.equal(failed.provider.vesselCount, 0);
});

test("one provider failing leaves the other usable", async () => {
  const good: VesselProviderAdapter = {
    id: "good",
    name: "Good feed",
    attribution: "good",
    licence: "CC BY 4.0",
    licenceUrl: "https://example.test/licence",
    catalogueUrl: "https://example.test/docs",
    coverage: { scope: "regional", regions: ["Good water"], note: "good" },
    async getSnapshot() {
      return {
        vessels: [vessel("111111111", "good")],
        provider: providerStatus("good", "available", 1),
      };
    },
  };
  const bad: VesselProviderAdapter = {
    ...good,
    id: "bad",
    name: "Bad feed",
    coverage: { scope: "regional", regions: ["Bad water"], note: "bad" },
    async getSnapshot(): Promise<VesselProviderSnapshot> {
      throw new Error("down");
    },
  };

  const snapshots = await getMaritimeProviderSnapshots([good, bad]);
  assert.equal(snapshots.length, 2);
  assert.equal(snapshots[0]!.vessels.length, 1);
  assert.equal(snapshots[1]!.vessels.length, 0);
  assert.equal(snapshots[1]!.provider.status, "unavailable");
  // The failed provider still declares the region it would have covered.
  assert.deepEqual(snapshots[1]!.provider.coverage.regions, ["Bad water"]);
});

/* -------------------------------------------------------------------------- */
/* Coverage                                                                   */
/* -------------------------------------------------------------------------- */

test("registered coverage is regional and names real regions", () => {
  assert.equal(digitrafficCoverage.scope, "regional");
  assert.equal(barentswatchCoverage.scope, "regional");
  const coverage = deriveCoverage([
    { coverage: digitrafficCoverage },
    { coverage: barentswatchCoverage },
  ]);
  assert.equal(coverage.scope, "regional");
  assert.equal(coverage.regions.length > 1, true);
  assert.match(coverage.note, /not evidence that no vessels are present/);
});

test("no registered source is ever described as global", () => {
  assert.equal(deriveCoverage([]).scope, "local");
  assert.match(deriveCoverage([]).note, /No maritime source is registered/);
});

/* -------------------------------------------------------------------------- */
/* Route                                                                      */
/* -------------------------------------------------------------------------- */

test("the maritime route bounds, filters and reports coverage", async () => {
  await withRouter(
    async () => [
      {
        vessels: [
          vessel("111111111", "digitraffic", { name: "AURORA" }),
          vessel("222222222", "digitraffic", { name: "BOREALIS" }),
        ],
        provider: providerStatus("digitraffic", "available", 2),
      },
      {
        vessels: [vessel("333333333", "barentswatch", { name: "NORDLYS" })],
        provider: providerStatus("barentswatch", "stale", 1),
      },
    ],
    async (baseUrl) => {
      const all = await fetch(`${baseUrl}/monitoring/maritime`);
      assert.equal(all.status, 200);
      const body = (await all.json()) as {
        vessels: VesselRecord[];
        providers: MaritimeProviderStatus[];
        coverage: { scope: string; regions: string[] };
        matchedCount: number;
        returnedCount: number;
      };
      assert.equal(body.vessels.length, 3);
      assert.equal(body.providers.length, 2);
      assert.equal(body.coverage.scope, "regional");
      assert.notEqual(body.coverage.regions.length, 0);

      const limited = await fetch(`${baseUrl}/monitoring/maritime?limit=1`);
      const limitedBody = (await limited.json()) as {
        vessels: VesselRecord[];
        matchedCount: number;
        returnedCount: number;
      };
      assert.equal(limitedBody.vessels.length, 1);
      assert.equal(limitedBody.matchedCount, 3);
      assert.equal(limitedBody.returnedCount, 1);

      const searched = await fetch(`${baseUrl}/monitoring/maritime?q=nordlys`);
      const searchedBody = (await searched.json()) as { vessels: VesselRecord[] };
      assert.equal(searchedBody.vessels.length, 1);
      assert.equal(searchedBody.vessels[0]!.name, "NORDLYS");

      const scoped = await fetch(
        `${baseUrl}/monitoring/maritime?provider=digitraffic`,
      );
      const scopedBody = (await scoped.json()) as { vessels: VesselRecord[] };
      assert.equal(scopedBody.vessels.length, 2);

      const rejected = await fetch(`${baseUrl}/monitoring/maritime?limit=9000`);
      assert.equal(rejected.status, 400);
    },
  );
});

test("every feed down is reported honestly, not as empty water", async () => {
  await withRouter(
    async () => [
      { vessels: [], provider: providerStatus("digitraffic", "unavailable", 0) },
      { vessels: [], provider: providerStatus("barentswatch", "unavailable", 0) },
    ],
    async (baseUrl) => {
      const response = await fetch(`${baseUrl}/monitoring/maritime`);
      const body = (await response.json()) as {
        vessels: VesselRecord[];
        providers: MaritimeProviderStatus[];
      };
      assert.equal(body.vessels.length, 0);
      assert.equal(
        body.providers.every((provider) => provider.status === "unavailable"),
        true,
      );
    },
  );
});
