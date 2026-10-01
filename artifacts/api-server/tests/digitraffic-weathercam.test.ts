import assert from "node:assert/strict";
import { test } from "node:test";
import { parseDigitrafficWeathercams } from "../src/camera-providers/digitraffic-weathercam";
import {
  SIGNALWATCH_USER_AGENT,
  describeProviderFailure,
} from "../src/lib/provider-fetch";

/**
 * Shaped after the documented Digitraffic weathercam v1 station response:
 * GeoJSON features whose properties carry `presets`, plus the `state` /
 * `collectionStatus` / `inCollection` fields the documentation tells clients
 * to check before treating a preset as in collection.
 */
const payload = {
  type: "FeatureCollection",
  features: [
    {
      type: "Feature",
      id: "C01451",
      geometry: { type: "Point", coordinates: [24.9384, 60.1699] },
      properties: {
        id: "C01451",
        name: "Helsinki keskusta",
        municipality: "Helsinki",
        province: "Uusimaa",
        state: "OK",
        collectionStatus: "GATHERING",
        presets: [
          {
            id: "C1451601",
            presentationName: "Pohjoiseen",
            inCollection: true,
            imageUrl: "http://weathercam.digitraffic.fi/C1451601.jpg",
          },
          {
            // In collection but no published URL: the documented id pattern
            // is the only sanctioned fallback.
            id: "C1451602",
            presentationName: "Etelään",
            inCollection: true,
          },
          {
            // Provider says this preset is not collecting.
            id: "C1451603",
            presentationName: "Tienpinta",
            inCollection: false,
            imageUrl: "https://weathercam.digitraffic.fi/C1451603.jpg",
          },
        ],
      },
    },
    {
      // Whole station out of service.
      type: "Feature",
      id: "C09999",
      geometry: { type: "Point", coordinates: [25.7, 62.2] },
      properties: {
        id: "C09999",
        name: "Jyväskylä",
        state: "OK",
        collectionStatus: "REMOVED_PERMANENTLY",
        presets: [{ id: "C0999901", inCollection: true }],
      },
    },
  ],
};

test("a collecting preset with a published image becomes live-image", () => {
  const cameras = parseDigitrafficWeathercams(payload);
  const camera = cameras.find((entry) => entry.id.endsWith("C1451601"));
  assert.ok(camera);
  assert.equal(camera.viewCapability, "live-image");
  assert.equal(camera.mediaType, "image");
  // http is upgraded; a webview blocks mixed content.
  assert.equal(camera.mediaUrl, "https://weathercam.digitraffic.fi/C1451601.jpg");
  assert.equal(camera.countryCode, "FI");
  assert.equal(camera.locality, "Helsinki");
  // Documented cadence, not a guess.
  assert.equal(camera.imageUpdateRateMs, 10 * 60 * 1000);
  assert.match(camera.attribution, /Fintraffic/);
});

test("the documented id pattern is the only sanctioned URL fallback", () => {
  const cameras = parseDigitrafficWeathercams(payload);
  const camera = cameras.find((entry) => entry.id.endsWith("C1451602"));
  assert.ok(camera);
  assert.equal(camera.mediaUrl, "https://weathercam.digitraffic.fi/C1451602.jpg");

  // An id that does not match the documented shape yields no media URL.
  const bogus = parseDigitrafficWeathercams({
    features: [
      {
        id: "X1",
        geometry: { coordinates: [25, 62] },
        properties: {
          id: "X1",
          collectionStatus: "GATHERING",
          presets: [{ id: "../../evil", inCollection: true }],
        },
      },
    ],
  });
  assert.equal(bogus[0]?.mediaUrl, null);
  assert.equal(bogus[0]?.viewCapability, "catalogue-only");
});

test("a published URL off the documented origin is refused", () => {
  const cameras = parseDigitrafficWeathercams({
    features: [
      {
        id: "C02",
        geometry: { coordinates: [25, 62] },
        properties: {
          id: "C02",
          collectionStatus: "GATHERING",
          presets: [
            {
              id: "C0200001",
              inCollection: true,
              imageUrl: "https://attacker.test/C0200001.jpg",
            },
          ],
        },
      },
    ],
  });
  assert.equal(cameras[0]?.mediaUrl, null);
  assert.equal(cameras[0]?.viewCapability, "catalogue-only");
});

test("provider-published out-of-service becomes unavailable, not a dropped record", () => {
  const cameras = parseDigitrafficWeathercams(payload);

  const presetOff = cameras.find((entry) => entry.id.endsWith("C1451603"));
  assert.ok(presetOff, "a non-collecting preset must still be catalogued");
  assert.equal(presetOff.viewCapability, "unavailable");
  assert.equal(presetOff.mediaUrl, null);

  const stationOff = cameras.find((entry) => entry.id.endsWith("C0999901"));
  assert.ok(stationOff, "a removed station's presets must still be catalogued");
  assert.equal(stationOff.viewCapability, "unavailable");
  assert.equal(stationOff.mediaUrl, null);
});

test("road-register direction is never reported as a compass bearing", () => {
  const cameras = parseDigitrafficWeathercams(payload);
  for (const camera of cameras) assert.equal(camera.direction, null);
});

test("malformed payloads yield no cameras instead of throwing", () => {
  assert.deepEqual(parseDigitrafficWeathercams(null), []);
  assert.deepEqual(parseDigitrafficWeathercams({ features: {} }), []);
  assert.deepEqual(
    parseDigitrafficWeathercams({
      features: [{ geometry: { coordinates: [999, 91] }, properties: { presets: [{ id: "C0000001" }] } }],
    }),
    [],
  );
});

/* -------------------------------------------------------------------------- */
/* The honest fetch abstraction                                               */
/* -------------------------------------------------------------------------- */

test("the provider fetch identifies Signalwatch and spoofs nothing", async () => {
  const { readFile } = await import("node:fs/promises");
  const source = await readFile(
    new URL("../src/lib/provider-fetch.ts", import.meta.url),
    "utf8",
  );
  const code = source
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/^\s*\/\/.*$/gm, "");

  assert.match(SIGNALWATCH_USER_AGENT, /^Signalwatch\//);
  // None of the evasion mechanisms may ever appear here.
  for (const banned of [
    "X-Forwarded-For",
    "X-Real-IP",
    "Mozilla/",
    "randomUA",
    "generateResidentialIP",
  ]) {
    assert.ok(!code.includes(banned), `provider fetch must not use ${banned}`);
  }
});

test("a declined request is reported, never retried behind a new identity", () => {
  assert.match(describeProviderFailure(403, "Test"), /declined/);
  assert.match(
    describeProviderFailure(403, "Test"),
    /does not retry behind a different identity/,
  );
  assert.match(describeProviderFailure(429, "Test"), /rate limiting/);
});

test("the weathercam adapter identifies itself to Digitraffic", async () => {
  const { readFile } = await import("node:fs/promises");
  const source = await readFile(
    new URL("../src/camera-providers/digitraffic-weathercam.ts", import.meta.url),
    "utf8",
  );
  assert.match(source, /"Digitraffic-User"/);
  assert.match(source, /providerFetch\(/);
  // The OSIRIS original used a spoofing fetch; the migration must not carry it.
  assert.ok(!source.includes("stealthFetch"));
});
