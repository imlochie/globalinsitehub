import assert from "node:assert/strict";
import { test } from "node:test";
import { classifyViewCapability } from "../src/camera-providers/view-capability";
import { parseQldTrafficCameras } from "../src/camera-providers/qldtraffic-cameras";

/* -------------------------------------------------------------------------- */
/* Classification never invents a viewing mechanism                           */
/* -------------------------------------------------------------------------- */

test("a camera with no documented viewing mechanism stays catalogue-only", () => {
  const result = classifyViewCapability({
    documentedAs: "unknown",
    url: "https://example.test/cameras/42",
  });
  assert.equal(result.viewCapability, "catalogue-only");
  assert.equal(result.mediaUrl, null);
  assert.equal(result.mediaType, null);
});

test("a provider-documented current image becomes live-image", () => {
  const result = classifyViewCapability({
    documentedAs: "current-image",
    url: "https://qldtraffic.qld.gov.au/images/cam-5.jpg",
  });
  assert.equal(result.viewCapability, "live-image");
  assert.equal(result.mediaType, "image");
  assert.equal(result.mediaUrl, "https://qldtraffic.qld.gov.au/images/cam-5.jpg");
});

test("a declared media URL a browser can play becomes video-stream", () => {
  const result = classifyViewCapability({
    documentedAs: "media",
    url: "https://example.test/live/stream.m3u8",
  });
  assert.equal(result.viewCapability, "video-stream");
  assert.equal(result.mediaType, "hls");
});

test("a declared media URL no browser can play is not a stream", () => {
  for (const url of [
    "rtsp://example.test/live/1",
    "https://example.test/camera/page",
  ]) {
    const result = classifyViewCapability({ documentedAs: "media", url });
    assert.notEqual(result.viewCapability, "video-stream");
    assert.equal(result.mediaUrl, null);
  }
});

test("a provider viewing page becomes external-viewer, never a stream", () => {
  const result = classifyViewCapability({
    documentedAs: "viewing-page",
    url: null,
    viewingPageUrl: "https://qldtraffic.qld.gov.au/",
  });
  assert.equal(result.viewCapability, "external-viewer");
  assert.equal(result.mediaUrl, null);
  assert.equal(result.mediaType, "webpage");
});

test("missing or malformed URLs never become playable", () => {
  for (const url of [null, "", "not-a-url", "javascript:alert(1)"]) {
    const result = classifyViewCapability({ documentedAs: "current-image", url });
    assert.equal(result.viewCapability, "catalogue-only", String(url));
    assert.equal(result.mediaUrl, null);
  }
});

test("insecure media URLs are upgraded rather than left as mixed content", () => {
  const result = classifyViewCapability({
    documentedAs: "current-image",
    url: "http://qldtraffic.qld.gov.au/images/cam-5.jpg",
  });
  assert.equal(result.mediaUrl?.startsWith("https://"), true);
});

/* -------------------------------------------------------------------------- */
/* QLDTraffic camera parsing                                                  */
/* -------------------------------------------------------------------------- */

/** Shaped after QLDTraffic API specification v1.10 §4.4. */
const webcamPayload = {
  type: "FeatureCollection",
  features: [
    {
      type: "Feature",
      geometry: { type: "Point", coordinates: [151.9763031, -27.56567955] },
      properties: {
        id: 5,
        url: "http://api.qldtraffic.qld.gov.au/v1/webcams/5",
        description: "Toowoomba - Down the Range - East",
        direction: "East",
        district: "Darling Downs",
        locality: "Toowoomba City",
        postcode: "4350",
        image_url: "http://qldtraffic.qld.gov.au/images/toowoomba_range-east.jpg",
      },
    },
    {
      // No image_url: a location, not a viewable camera.
      type: "Feature",
      geometry: { type: "Point", coordinates: [153.02, -27.47] },
      properties: { id: 9, description: "Brisbane - no imagery published" },
    },
  ],
};

test("QLDTraffic cameras with a documented image become live-image", () => {
  const cameras = parseQldTrafficCameras(webcamPayload, "webcam");
  assert.equal(cameras.length, 2);

  const viewable = cameras.find((camera) =>
    camera.displayName.includes("Toowoomba"),
  );
  assert.ok(viewable);
  assert.equal(viewable.viewCapability, "live-image");
  assert.equal(viewable.mediaType, "image");
  assert.equal(viewable.mediaUrl?.startsWith("https://"), true);
  assert.equal(viewable.countryCode, "AU");
  assert.equal(viewable.region, "Queensland");
  assert.equal(viewable.locality, "Toowoomba City");
  // Provenance survives.
  assert.match(viewable.attribution, /Queensland/);
  assert.equal(viewable.feedStatus, "not-probed");
});

test("a QLDTraffic camera without image_url is not presented as viewable", () => {
  const cameras = parseQldTrafficCameras(webcamPayload, "webcam");
  const catalogueOnly = cameras.find((camera) =>
    camera.displayName.includes("no imagery"),
  );
  assert.ok(catalogueOnly);
  assert.equal(catalogueOnly.viewCapability, "catalogue-only");
  assert.equal(catalogueOnly.mediaUrl, null);
  assert.equal(catalogueOnly.streamKind, "unknown");
});

test("webcam and floodcam ids never collide", () => {
  const webcams = parseQldTrafficCameras(webcamPayload, "webcam");
  const floodcams = parseQldTrafficCameras(webcamPayload, "floodcam");
  const overlap = webcams
    .map((camera) => camera.id)
    .filter((id) => floodcams.some((camera) => camera.id === id));
  assert.deepEqual(overlap, []);
});

test("malformed QLDTraffic payloads yield no cameras instead of throwing", () => {
  assert.deepEqual(parseQldTrafficCameras(null, "webcam"), []);
  assert.deepEqual(parseQldTrafficCameras({ features: {} }, "webcam"), []);
  assert.deepEqual(
    parseQldTrafficCameras(
      { features: [{ geometry: { coordinates: [999, 91] }, properties: { id: 1 } }] },
      "webcam",
    ),
    [],
  );
});

test("no provider fabricates a media URL", async () => {
  const { readFile } = await import("node:fs/promises");
  for (const file of [
    "qldtraffic-cameras.ts",
    "queensland-tmr.ts",
    "transport-for-nsw.ts",
    "opentrafficcammap.ts",
  ]) {
    const source = await readFile(
      new URL(`../src/camera-providers/${file}`, import.meta.url),
      "utf8",
    );
    const code = source
      .replace(/\/\*[\s\S]*?\*\//g, "")
      .replace(/^\s*\/\/.*$/gm, "");
    // Media URLs must come from provider fields, never be assembled.
    assert.doesNotMatch(
      code,
      /mediaUrl:\s*`/,
      `${file} builds a media URL from a template`,
    );
  }
});

/* -------------------------------------------------------------------------- */
/* Compatibility and route contract                                           */
/* -------------------------------------------------------------------------- */

test("'unavailable' is never synthesised from absent provider data", async () => {
  const { readFile } = await import("node:fs/promises");
  const classifier = await readFile(
    new URL("../src/camera-providers/view-capability.ts", import.meta.url),
    "utf8",
  );
  const code = classifier
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/^\s*\/\/.*$/gm, "");
  // No provider publishes a per-camera out-of-service signal, so claiming one
  // would be inventing provider state. The UI still renders it if it appears.
  assert.doesNotMatch(code, /viewCapability:\s*"unavailable"/);

  for (const file of [
    "qldtraffic-cameras.ts",
    "queensland-tmr.ts",
    "transport-for-nsw.ts",
    "opentrafficcammap.ts",
  ]) {
    const source = await readFile(
      new URL(`../src/camera-providers/${file}`, import.meta.url),
      "utf8",
    );
    const providerCode = source
      .replace(/\/\*[\s\S]*?\*\//g, "")
      .replace(/^\s*\/\/.*$/gm, "");
    assert.doesNotMatch(
      providerCode,
      /viewCapability:\s*"unavailable"/,
      `${file} fabricates an unavailable state`,
    );
  }
});

test("every classification result is a valid capability", () => {
  const valid = new Set([
    "catalogue-only",
    "live-image",
    "video-stream",
    "external-viewer",
    "unavailable",
  ]);
  const cases = [
    { documentedAs: "unknown" as const, url: null },
    { documentedAs: "unknown" as const, url: "https://a.test/x" },
    { documentedAs: "current-image" as const, url: "https://a.test/x.jpg" },
    { documentedAs: "current-image" as const, url: "bad" },
    { documentedAs: "media" as const, url: "https://a.test/s.m3u8" },
    { documentedAs: "media" as const, url: "rtsp://a.test/s" },
    { documentedAs: "viewing-page" as const, url: "https://a.test/page" },
    { documentedAs: "viewing-page" as const, url: null },
  ];
  for (const input of cases) {
    const result = classifyViewCapability(input);
    assert.ok(valid.has(result.viewCapability), JSON.stringify(input));
    // A capability without media must never carry a media URL, and vice versa.
    if (result.viewCapability === "catalogue-only") {
      assert.equal(result.mediaUrl, null);
    }
    if (result.mediaUrl !== null) {
      assert.ok(
        result.viewCapability === "live-image" ||
          result.viewCapability === "video-stream",
      );
    }
  }
});
