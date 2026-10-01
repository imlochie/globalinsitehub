import assert from "node:assert/strict";
import { once } from "node:events";
import type { AddressInfo } from "node:net";
import express from "express";
import "pino-http";
import { test } from "node:test";
import type {
  CameraProviderStatus,
  CameraRecord,
} from "@workspace/api-zod";
import { createMemoryCachedCameraProvider } from "../src/camera-providers/memory-cache";
import { parseOpenTrafficCamMapCatalogue } from "../src/camera-providers/opentrafficcammap";
import { parseQueenslandTmrCatalogue } from "../src/camera-providers/queensland-tmr";
import { parseTransportForNswCatalogue } from "../src/camera-providers/transport-for-nsw";
import type { CameraProviderSnapshot } from "../src/camera-providers/types";
import { createMonitoringCamerasRouter } from "../src/routes/cameras";

const camera = (
  id: string,
  provider: string,
  country: string,
  countryCode: string,
  displayName: string,
  overrides: Partial<CameraRecord> = {},
): CameraRecord => ({
  id,
  provider,
  displayName,
  description: `${displayName} description`,
  country,
  countryCode,
  region: country === "Australia" ? "Queensland" : "California",
  subregion: "Central",
  district: null,
  locality: "South Bank",
  postcode: countryCode === "AU" ? "4101" : "94102",
  latitude: countryCode === "AU" ? -27.48 : 37.77,
  longitude: countryCode === "AU" ? 153.02 : -122.42,
  direction: "North",
  sourceUrl: `https://feeds.example.test/${provider}/${id}.jpg`,
  encoding: null,
  format: "JPEG",
  imageUpdateRateMs: null,
  streamKind: "snapshot",
  viewCapability: "catalogue-only",
  mediaUrl: null,
  mediaType: null,
  viewUrl: null,
  feedStatus: "not-probed",
  publicAccess: "catalogue-listed",
  attribution: `${provider} attribution`,
  catalogueUrl: `https://catalogues.example.test/${provider}`,
  ...overrides,
});

const provider = (
  id: string,
  status: CameraProviderStatus["status"],
  cameraCount: number,
): CameraProviderStatus => ({
  id,
  name: `${id} catalogue`,
  attribution: `${id} attribution`,
  catalogueUrl: `https://catalogues.example.test/${id}`,
  status,
  feedReachability: "not-probed",
  cameraCount,
  checkedAt: new Date("2026-09-30T00:00:00.000Z"),
  lastSuccessfulFetchAt:
    status === "unavailable" ? null : new Date("2026-09-29T00:00:00.000Z"),
  message: `${status} fixture`,
});

const qldCamera = camera(
  "qld-1",
  "qld-tmr",
  "Australia",
  "AU",
  "Brisbane Riverside",
  { locality: "Brisbane", postcode: "4000" },
);
const nswCamera = camera(
  "nsw-1",
  "transport-for-nsw",
  "Australia",
  "AU",
  "Sydney Harbour",
  {
    region: "New South Wales",
    locality: "Sydney",
    postcode: "2000",
  },
);
const usCamera = camera(
  "otcm-1",
  "opentrafficcammap",
  "United States",
  "US",
  "San Francisco Seabreeze",
  { region: "California", locality: "San Francisco" },
);

function snapshot(
  providerId: string,
  status: CameraProviderStatus["status"],
  cameras: CameraRecord[],
): CameraProviderSnapshot {
  return {
    provider: provider(providerId, status, cameras.length),
    cameras,
  };
}

test("camera HTTP route validates, filters and bounds fixture responses", async () => {
  const snapshots = [
    snapshot("qld-tmr", "available", [qldCamera]),
    snapshot("transport-for-nsw", "stale", [nswCamera]),
    snapshot("opentrafficcammap", "available", [usCamera]),
  ];
  const app = express();
  app.use((req, _res, next) => {
    Object.defineProperty(req, "log", {
      configurable: true,
      value: { warn() {} },
    });
    next();
  });
  app.use(createMonitoringCamerasRouter(async () => snapshots));
  const server = app.listen(0, "127.0.0.1");
  await once(server, "listening");
  const address = server.address() as AddressInfo;
  const baseUrl = `http://127.0.0.1:${address.port}/monitoring/cameras`;

  try {
    const australia = await fetch(`${baseUrl}?country=AU`);
    const australiaBody = (await australia.json()) as {
      cameras: CameraRecord[];
      providers: CameraProviderStatus[];
    };
    assert.deepEqual(
      australiaBody.cameras.map((item) => item.provider).sort(),
      ["qld-tmr", "transport-for-nsw"],
    );

    const unitedStates = await fetch(`${baseUrl}?country=United%20States`);
    const unitedStatesBody = (await unitedStates.json()) as {
      cameras: CameraRecord[];
    };
    assert.deepEqual(
      unitedStatesBody.cameras.map((item) => item.provider),
      ["opentrafficcammap"],
    );

    for (const providerId of [
      "qld-tmr",
      "transport-for-nsw",
      "opentrafficcammap",
    ]) {
      const response = await fetch(`${baseUrl}?provider=${providerId}`);
      const body = (await response.json()) as { cameras: CameraRecord[] };
      assert.ok(body.cameras.length > 0);
      assert.ok(body.cameras.every((item) => item.provider === providerId));
    }

    const search = await fetch(`${baseUrl}?q=seabreeze`);
    const searchBody = (await search.json()) as { cameras: CameraRecord[] };
    assert.deepEqual(
      searchBody.cameras.map((item) => item.id),
      ["otcm-1"],
    );
    const noResults = await fetch(`${baseUrl}?q=not-in-this-catalogue`);
    const noResultsBody = (await noResults.json()) as {
      matchedCount: number;
      returnedCount: number;
      cameras: CameraRecord[];
    };
    assert.equal(noResultsBody.matchedCount, 0);
    assert.equal(noResultsBody.returnedCount, 0);
    assert.deepEqual(noResultsBody.cameras, []);

    const limited = await fetch(`${baseUrl}?limit=1`);
    const limitedBody = (await limited.json()) as {
      matchedCount: number;
      returnedCount: number;
      limit: number;
      cameras: CameraRecord[];
      providers: CameraProviderStatus[];
    };
    assert.equal(limitedBody.matchedCount, 3);
    assert.equal(limitedBody.returnedCount, 1);
    assert.equal(limitedBody.limit, 1);

    const maxLimit = await fetch(`${baseUrl}?limit=250`);
    assert.equal(maxLimit.status, 200);
    const maxBody = (await maxLimit.json()) as { limit: number };
    assert.equal(maxBody.limit, 250);

    for (const invalidQuery of ["?limit=251", "?limit=0", "?limit=not-a-number"]) {
      const response = await fetch(`${baseUrl}${invalidQuery}`);
      assert.equal(response.status, 400, invalidQuery);
    }

    assert.deepEqual(
      limitedBody.providers.map((item) => item.status),
      ["available", "stale", "available"],
    );
    assert.equal(limitedBody.cameras[0]?.feedStatus, "not-probed");
    assert.equal(
      limitedBody.providers.find((item) => item.id === "transport-for-nsw")
        ?.feedReachability,
      "not-probed",
    );
  } finally {
    await new Promise<void>((resolve, reject) => {
      server.close((error) => (error ? reject(error) : resolve()));
    });
  }
});

test("provider cache distinguishes stale cached data from first-load unavailability", async () => {
  let loadCount = 0;
  const cachedProvider = createMemoryCachedCameraProvider({
    id: "qld-tmr",
    name: "Queensland fixture provider",
    attribution: "Queensland fixture attribution",
    catalogueUrl: "https://catalogues.example.test/qld",
    availableMessage: "Fixture catalogue available",
    describeFailure: () => "Fixture refresh failure",
    cacheTtlMs: 0,
    retryTtlMs: 0,
    async load() {
      loadCount += 1;
      if (loadCount === 1) return { cameras: [qldCamera] };
      throw new Error("fixture refresh failed");
    },
  });
  const first = await cachedProvider.getSnapshot();
  const stale = await cachedProvider.getSnapshot();
  assert.equal(first.provider.status, "available");
  assert.equal(stale.provider.status, "stale");
  assert.deepEqual(stale.cameras, [qldCamera]);
  assert.equal(stale.provider.lastSuccessfulFetchAt?.toISOString(), first.provider.checkedAt.toISOString());
  assert.equal(stale.provider.feedReachability, "not-probed");

  const unavailableProvider = createMemoryCachedCameraProvider({
    id: "opentrafficcammap",
    name: "OpenTrafficCamMap fixture provider",
    attribution: "OpenTrafficCamMap fixture attribution",
    catalogueUrl: "https://catalogues.example.test/otcm",
    availableMessage: "Fixture catalogue available",
    describeFailure: () => "Fixture initial failure",
    retryTtlMs: 0,
    async load() {
      throw new Error("fixture first-load failure");
    },
  });
  const unavailable = await unavailableProvider.getSnapshot();
  assert.equal(unavailable.provider.status, "unavailable");
  assert.equal(unavailable.cameras.length, 0);
  assert.equal(unavailable.provider.lastSuccessfulFetchAt, null);
  assert.equal(unavailable.provider.feedReachability, "not-probed");
});

test("Queensland TMR parser normalizes coordinates, provenance, stable IDs, and rejects malformed entries", () => {
  const sourceUrl = "https://images.example.test/qld-1.jpg#snapshot";
  const records = parseQueenslandTmrCatalogue({
    features: [
      {
        properties: {
          camera_id: 22,
          image_url: sourceUrl,
          description: "Brisbane Riverside",
          locality: "Brisbane",
          district: "Metro",
          postcode: 4000,
          direction: "North",
        },
        geometry: { coordinates: [153.02, -27.48] },
      },
      {
        properties: {
          camera_id: 99,
          image_url: "https://images.example.test/qld-1.jpg",
          description: "Duplicate source",
        },
        geometry: { coordinates: [150, -25] },
      },
      {
        properties: { camera_id: 23, image_url: "https://images.example.test/zero.jpg" },
        geometry: { coordinates: [0, 0] },
      },
      {
        properties: { camera_id: 24, image_url: "javascript:alert(1)" },
        geometry: { coordinates: [153, -27] },
      },
    ],
  });
  assert.equal(records.length, 1);
  assert.equal(records[0]?.id, "qld-tmr-22");
  assert.equal(records[0]?.sourceUrl, "https://images.example.test/qld-1.jpg");
  assert.equal(records[0]?.latitude, -27.48);
  assert.equal(records[0]?.longitude, 153.02);
  assert.equal(records[0]?.locality, "Brisbane");
  assert.equal(records[0]?.postcode, "4000");
  assert.equal(records[0]?.attribution.includes("Queensland"), true);
  assert.equal(records[0]?.feedStatus, "not-probed");
  assert.deepEqual(
    parseQueenslandTmrCatalogue({
      features: [
        {
          properties: { camera_id: 22, image_url: sourceUrl },
          geometry: { coordinates: [153.02, -27.48] },
        },
      ],
    }).map((item) => item.id),
    ["qld-tmr-22"],
  );
});

test("Transport for NSW parser validates rights, metadata, stable IDs, and malformed records", () => {
  const sourceUrl = "https://images.example.test/nsw-1.jpg#current";
  const catalogue = {
    rights: {
      copyright: "Transport for NSW",
      licence: "https://creativecommons.org/licenses/by/4.0/",
    },
    features: [
      {
        id: "fallback-id",
        properties: {
          camera_id: "NSW 1",
          image_url: sourceUrl,
          title: "Sydney Harbour",
          view: "Northbound",
          suburb: "Sydney",
          district: "Sydney",
          postcode: "2000",
          latitude: "-33.86",
          longitude: "151.21",
        },
      },
      {
        properties: {
          camera_id: "duplicate",
          image_url: "https://images.example.test/nsw-1.jpg",
          latitude: -33.86,
          longitude: 151.21,
        },
      },
      {
        properties: {
          camera_id: "bad-coordinate",
          image_url: "https://images.example.test/bad.jpg",
          latitude: 95,
          longitude: 151,
        },
      },
      {
        properties: {
          camera_id: "bad-url",
          image_url: "file:///tmp/camera.jpg",
          latitude: -33,
          longitude: 151,
        },
      },
    ],
  };
  const records = parseTransportForNswCatalogue(catalogue);
  assert.equal(records.length, 1);
  assert.equal(records[0]?.id, "transport-for-nsw-NSW-1");
  assert.equal(records[0]?.sourceUrl, "https://images.example.test/nsw-1.jpg");
  assert.equal(records[0]?.region, "New South Wales");
  assert.equal(records[0]?.locality, "Sydney");
  assert.equal(records[0]?.latitude, -33.86);
  assert.equal(records[0]?.longitude, 151.21);
  assert.equal(records[0]?.attribution.includes("Transport for NSW"), true);
  assert.equal(records[0]?.feedStatus, "not-probed");
  assert.throws(
    () =>
      parseTransportForNswCatalogue({
        features: [],
        rights: { copyright: "Unknown", licence: "https://example.test/licence" },
      }),
    /rights metadata/,
  );
});

test("OpenTrafficCamMap parser deduplicates to richer metadata and rejects malformed records", () => {
  const catalogue = {
    California: {
      "San Francisco": [
        {
          description: null,
          url: "https://images.example.test/sf.jpg#view",
          latitude: 37.77,
          longitude: -122.42,
        },
        {
          description: "Bay bridge approach",
          url: "https://images.example.test/sf.jpg",
          latitude: "37.77",
          longitude: "-122.42",
          encoding: "MJPEG",
          format: "JPEG image",
          updateRate: 5000,
          direction: "East",
        },
        {
          description: "Invalid coordinates",
          url: "https://images.example.test/outside.jpg",
          latitude: 120,
          longitude: -122,
        },
        {
          description: "Invalid URL",
          url: "javascript:alert(1)",
          latitude: 37,
          longitude: -122,
        },
      ],
    },
  };
  const records = parseOpenTrafficCamMapCatalogue(catalogue);
  const recordsAgain = parseOpenTrafficCamMapCatalogue(catalogue);
  assert.equal(records.length, 1);
  assert.equal(records[0]?.id, recordsAgain[0]?.id);
  assert.match(records[0]?.id ?? "", /^otcm-usa-/);
  assert.equal(records[0]?.sourceUrl, "https://images.example.test/sf.jpg");
  assert.equal(records[0]?.description, "Bay bridge approach");
  assert.equal(records[0]?.region, "California");
  assert.equal(records[0]?.subregion, "San Francisco");
  assert.equal(records[0]?.encoding, "MJPEG");
  assert.equal(records[0]?.attribution.includes("OpenTrafficCamMap"), true);
  assert.equal(records[0]?.feedStatus, "not-probed");
});