import assert from "node:assert/strict";
import { test } from "node:test";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { Router } from "wouter";
import type { CameraRecord } from "@workspace/api-client-react";
import { GlobalObservationInspector } from "../src/components/global-observation-inspector";
import { normalizeCameraRecord } from "../src/lib/global-layers";

const camera = (overrides: Partial<CameraRecord> = {}): CameraRecord =>
  ({
    id: "qldtraffic-cameras-abc",
    provider: "qldtraffic-cameras",
    displayName: "Toowoomba - Down the Range - East",
    description: "Traffic camera published by QLDTraffic.",
    country: "Australia",
    countryCode: "AU",
    region: "Queensland",
    subregion: "Darling Downs",
    district: "Darling Downs",
    locality: "Toowoomba City",
    postcode: "4350",
    latitude: -27.56567955,
    longitude: 151.9763031,
    direction: "East",
    sourceUrl: "https://qldtraffic.qld.gov.au/images/cam-5.jpg",
    encoding: "JPEG",
    format: "IMAGE",
    imageUpdateRateMs: 900000,
    streamKind: "image",
    viewCapability: "live-image",
    mediaUrl: "https://qldtraffic.qld.gov.au/images/cam-5.jpg",
    mediaType: "image",
    viewUrl: "https://qldtraffic.qld.gov.au/",
    feedStatus: "not-probed",
    publicAccess: "catalogue-listed",
    attribution:
      "State of Queensland (Department of Transport and Main Roads), QLDTraffic",
    catalogueUrl: "https://www.data.qld.gov.au/dataset/131940",
    ...overrides,
  }) as unknown as CameraRecord;

function render(record: CameraRecord): string {
  const observation = normalizeCameraRecord(record, []);
  assert.ok(observation);
  return renderToStaticMarkup(
    <Router ssrPath="/">
      <GlobalObservationInspector observation={observation} onClear={() => {}} />
    </Router>,
  );
}

test("a live-image camera offers a view action and shows the image", () => {
  const markup = render(camera());
  assert.match(markup, /link-camera-view-image/);
  assert.match(markup, /View live image/);
  assert.match(markup, /camera-live-image/);
  assert.doesNotMatch(markup, /text-camera-catalogue-only/);
});

test("a catalogue-only camera gets no play affordance", () => {
  const markup = render(
    camera({
      viewCapability: "catalogue-only",
      mediaUrl: null,
      mediaType: null,
      viewUrl: null,
      streamKind: "unknown",
    } as Partial<CameraRecord>),
  );
  assert.match(markup, /text-camera-catalogue-only/);
  assert.match(markup, /Catalogue only/);
  assert.doesNotMatch(markup, /link-camera-view-image/);
  assert.doesNotMatch(markup, /link-camera-watch-live/);
  assert.doesNotMatch(markup, /camera-live-image/);
});

test("a video-stream camera offers a watch action", () => {
  const markup = render(
    camera({
      viewCapability: "video-stream",
      mediaUrl: "https://example.test/live/stream.m3u8",
      mediaType: "hls",
    } as Partial<CameraRecord>),
  );
  assert.match(markup, /link-camera-watch-live/);
  assert.match(markup, /Watch live/);
  // A stream is not rendered as a still image.
  assert.doesNotMatch(markup, /camera-live-image/);
});

test("an external-viewer camera opens the provider page", () => {
  const markup = render(
    camera({
      viewCapability: "external-viewer",
      mediaUrl: null,
      mediaType: "webpage",
      viewUrl: "https://qldtraffic.qld.gov.au/",
    } as Partial<CameraRecord>),
  );
  assert.match(markup, /link-camera-open-viewer/);
  assert.match(markup, /Open camera/);
  assert.match(markup, /qldtraffic\.qld\.gov\.au/);
  assert.doesNotMatch(markup, /camera-live-image/);
});

test("a missing media URL never becomes playable", () => {
  const markup = render(
    camera({
      viewCapability: "live-image",
      mediaUrl: null,
      mediaType: null,
    } as Partial<CameraRecord>),
  );
  assert.doesNotMatch(markup, /camera-live-image/);
  assert.doesNotMatch(markup, /link-camera-view-image/);
});

test("provider attribution survives into the inspector", () => {
  const markup = render(camera());
  assert.match(markup, /Department of Transport and Main Roads/);
  assert.match(markup, /not a continuous stream/);
});

test("an unavailable camera says so and offers no play action", () => {
  const markup = render(
    camera({
      viewCapability: "unavailable",
      mediaUrl: null,
      mediaType: null,
    } as Partial<CameraRecord>),
  );
  assert.match(markup, /text-camera-catalogue-only/);
  assert.match(markup, /Unavailable/);
  assert.doesNotMatch(markup, /link-camera-view-image/);
  assert.doesNotMatch(markup, /link-camera-watch-live/);
  assert.doesNotMatch(markup, /camera-live-image/);
});

test("every capability renders exactly one primary action", () => {
  const actions = [
    "link-camera-view-image",
    "link-camera-watch-live",
    "link-camera-open-viewer",
    "text-camera-catalogue-only",
  ];
  const cases: Array<[string, Partial<CameraRecord>]> = [
    ["live-image", { viewCapability: "live-image" } as Partial<CameraRecord>],
    [
      "video-stream",
      {
        viewCapability: "video-stream",
        mediaUrl: "https://example.test/s.m3u8",
        mediaType: "hls",
      } as Partial<CameraRecord>,
    ],
    [
      "external-viewer",
      {
        viewCapability: "external-viewer",
        mediaUrl: null,
        mediaType: "webpage",
      } as Partial<CameraRecord>,
    ],
    [
      "catalogue-only",
      {
        viewCapability: "catalogue-only",
        mediaUrl: null,
        mediaType: null,
      } as Partial<CameraRecord>,
    ],
    [
      "unavailable",
      {
        viewCapability: "unavailable",
        mediaUrl: null,
        mediaType: null,
      } as Partial<CameraRecord>,
    ],
  ];

  for (const [label, overrides] of cases) {
    const markup = render(camera(overrides));
    const present = actions.filter((action) => markup.includes(action));
    assert.equal(
      present.length,
      1,
      `${label} rendered ${present.length} primary actions: ${present.join(", ")}`,
    );
  }
});
