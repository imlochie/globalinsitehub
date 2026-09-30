import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { test } from "node:test";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import type {
  CameraProviderStatus,
  CameraRecord,
} from "@workspace/api-client-react";
import { GlobalLayerControl } from "../src/components/global-layer-control";
import {
  cameraProviderIdsForFilter,
  clearLayerSelection,
  createCameraLayerProviderAdapter,
  isValidCoordinates,
  layerSample,
  normalizeCameraRecord,
  normalizePublicEvent,
  selectEnabledLayerObservations,
  selectRenderableObservations,
} from "../src/lib/global-layers";
import { cameraLayerPanel } from "../src/components/layer-panels/camera-layer-panel";
import { publicEventLayerPanel } from "../src/components/layer-panels/public-event-layer-panel";
import { CameraList } from "../src/components/camera-list";
import { eventPoint, type BriefingEvent } from "../src/lib/monitoring";
import { sampleUpdates, sectors } from "../src/lib/sectors";

const cameraRecord = (
  id: string,
  provider = "qld-tmr",
  overrides: Partial<CameraRecord> = {},
): CameraRecord => ({
  id,
  provider,
  displayName: `${provider} camera ${id}`,
  description: `View ${id}`,
  country: provider === "opentrafficcammap" ? "United States" : "Australia",
  countryCode: provider === "opentrafficcammap" ? "US" : "AU",
  region:
    provider === "qld-tmr"
      ? "Queensland"
      : provider === "transport-for-nsw"
        ? "New South Wales"
        : "California",
  subregion: "Metro",
  district: null,
  locality: "Central",
  postcode: "4000",
  latitude: -27.47,
  longitude: 153.02,
  direction: "North",
  sourceUrl: `https://feeds.example.test/${provider}/${id}.jpg`,
  encoding: null,
  format: "JPEG",
  imageUpdateRateMs: null,
  streamKind: "snapshot",
  feedStatus: "not-probed",
  publicAccess: "catalogue-listed",
  attribution: `${provider} attribution`,
  catalogueUrl: `https://catalogues.example.test/${provider}`,
  ...overrides,
});

const providerStatus = (
  id: string,
  status: CameraProviderStatus["status"] = "available",
): CameraProviderStatus => ({
  id,
  name: `${id} catalogue`,
  attribution: `${id} attribution`,
  catalogueUrl: `https://catalogues.example.test/${id}`,
  status,
  feedReachability: "not-probed",
  cameraCount: 1,
  checkedAt: "2026-09-30T00:00:00.000Z",
  lastSuccessfulFetchAt: "2026-09-29T00:00:00.000Z",
  message: "Fixture catalogue state",
});

const eventRecord = (
  id: string,
  latitude: number | null = -33.87,
  longitude: number | null = 151.2,
): BriefingEvent => ({
  id,
  title: `Event ${id}`,
  category: "public",
  source: "Fixture News",
  sourceKind: "news",
  url: `https://news.example.test/${id}`,
  occurredAt: "2026-09-30T00:00:00.000Z",
  latitude,
  longitude,
  magnitude: null,
  detail: "Fixture event",
});

test("country/provider controls request only supported catalogues", () => {
  assert.deepEqual(cameraProviderIdsForFilter("AU", "all"), [
    "qld-tmr",
    "transport-for-nsw",
  ]);
  assert.deepEqual(cameraProviderIdsForFilter("AU", "qld-tmr"), ["qld-tmr"]);
  assert.deepEqual(cameraProviderIdsForFilter("AU", "transport-for-nsw"), [
    "transport-for-nsw",
  ]);
  assert.deepEqual(cameraProviderIdsForFilter("US", "all"), [
    "opentrafficcammap",
  ]);
  assert.deepEqual(cameraProviderIdsForFilter("US", "opentrafficcammap"), [
    "opentrafficcammap",
  ]);
  assert.deepEqual(cameraProviderIdsForFilter("US", "qld-tmr"), []);
});

test("layer toggles filter only their own records and clear only their selection", () => {
  const camera = normalizeCameraRecord(
    cameraRecord("qld-1"),
    [providerStatus("qld-tmr")],
  );
  const event = normalizePublicEvent(eventRecord("evt-1"));
  assert.ok(camera);
  assert.ok(event);

  const both = [camera, event];
  assert.deepEqual(
    selectEnabledLayerObservations(both, {
      cameras: false,
      "public-events": true,
    }).map((item) => item.layerId),
    ["public-events"],
  );
  assert.deepEqual(
    selectEnabledLayerObservations(both, {
      cameras: true,
      "public-events": false,
    }).map((item) => item.layerId),
    ["cameras"],
  );
  assert.deepEqual(
    selectEnabledLayerObservations(both, {
      cameras: false,
      "public-events": false,
    }),
    [],
  );

  const cameraSelection = { layerId: "cameras" as const, id: "qld-1" };
  const eventSelection = { layerId: "public-events" as const, id: "evt-1" };
  assert.equal(clearLayerSelection(cameraSelection, "cameras"), null);
  assert.deepEqual(clearLayerSelection(eventSelection, "cameras"), eventSelection);
  assert.equal(clearLayerSelection(eventSelection, "public-events"), null);
  assert.deepEqual(clearLayerSelection(cameraSelection, "public-events"), cameraSelection);
});

test("normalized camera identity and provenance survive map, list, and filter use", () => {
  const record = cameraRecord("nsw-42", "transport-for-nsw");
  const provider = providerStatus("transport-for-nsw");
  const adapter = createCameraLayerProviderAdapter([provider]);
  const fromMap = adapter.normalize(record);
  const fromList = adapter.normalize({ ...record });
  const fromFilteredCatalogue = normalizeCameraRecord(record, [provider]);

  assert.ok(fromMap);
  assert.ok(fromList);
  assert.ok(fromFilteredCatalogue);
  assert.equal(fromMap.kind, "camera");
  assert.equal(fromMap.layerId, "cameras");
  assert.equal(fromMap.id, record.id);
  assert.equal(fromMap.key, "cameras:nsw-42");
  assert.equal(fromMap.id, fromList.id);
  assert.equal(fromMap.key, fromFilteredCatalogue.key);
  assert.equal(fromMap.record, record);
  assert.equal(fromMap.providerId, record.provider);
  assert.equal(fromMap.attribution, record.attribution);
  assert.equal(fromMap.sourceUrl, record.sourceUrl);
  assert.equal(fromMap.catalogueUrl, record.catalogueUrl);
  assert.equal(fromMap.providerStatus?.status, "available");
  // Camera provider health carries the camera-specific feed reachability field.
  assert.equal(
    fromMap.providerStatus && "feedReachability" in fromMap.providerStatus
      ? fromMap.providerStatus.feedReachability
      : null,
    "not-probed",
  );
  assert.equal(fromMap.record.feedStatus, "not-probed");

  const event = eventRecord("incident-7");
  const fromGlobe = normalizePublicEvent(event);
  const fromFilteredList = normalizePublicEvent({ ...event });
  assert.ok(fromGlobe);
  assert.ok(fromFilteredList);
  assert.equal(fromGlobe.key, "public-events:incident-7");
  assert.equal(fromGlobe.id, fromFilteredList.id);
  assert.equal(fromGlobe.providerName, event.source);
  assert.equal(fromGlobe.sourceUrl, event.url);
});

test("globe camera sample is capped, provider-balanced, non-destructive, and selection-aware", () => {
  const cameras = [
    ...Array.from({ length: 240 }, (_, index) =>
      normalizeCameraRecord(
        cameraRecord(`a-${index}`, "qld-tmr"),
        [providerStatus("qld-tmr")],
      ),
    ),
    ...Array.from({ length: 60 }, (_, index) =>
      normalizeCameraRecord(
        cameraRecord(`b-${index}`, "transport-for-nsw"),
        [providerStatus("transport-for-nsw")],
      ),
    ),
  ].filter((item) => item !== null);
  const events = Array.from({ length: 205 }, (_, index) =>
    normalizePublicEvent(eventRecord(`event-${index}`)),
  ).filter((item) => item !== null);
  const sourceIds = cameras.map((item) => item.id);

  const normalSample = selectRenderableObservations(
    [...cameras, ...events],
    null,
  );
  const cameraSample = normalSample.observations.filter(
    (item) => item.kind === "camera",
  );
  assert.equal(cameraSample.length, 180);
  assert.ok(cameraSample.length <= 180);
  assert.equal(layerSample(normalSample.samples, "cameras")?.total, 300);
  assert.equal(layerSample(normalSample.samples, "cameras")?.shown, 180);
  assert.equal(layerSample(normalSample.samples, "cameras")?.omitted, 120);
  assert.equal(layerSample(normalSample.samples, "public-events")?.omitted, 0);
  assert.equal(
    cameraSample.filter((item) => item.providerId === "qld-tmr").length,
    120,
  );
  assert.equal(
    cameraSample.filter((item) => item.providerId === "transport-for-nsw")
      .length,
    60,
  );
  assert.equal(
    normalSample.observations.filter((item) => item.kind === "public-event")
      .length,
    205,
  );
  assert.deepEqual(cameras.map((item) => item.id), sourceIds);

  const selectedId = "a-239";
  const selectedSample = selectRenderableObservations([...cameras, ...events], {
    layerId: "cameras",
    id: selectedId,
  });
  assert.ok(
    selectedSample.observations.some(
      (item) => item.kind === "camera" && item.id === selectedId,
    ),
  );
  assert.equal(
    selectRenderableObservations([...cameras, ...events], null).observations.some(
      (item) => item.kind === "camera" && item.id === selectedId,
    ),
    false,
  );
  assert.deepEqual(cameras.map((item) => item.id), sourceIds);
});

test("only source-coordinate events normalize to distinct spatial records", () => {
  const located = normalizePublicEvent(eventRecord("located"));
  const headlineOnly = normalizePublicEvent(eventRecord("headline", null, null));
  const invalidLocation = normalizePublicEvent(eventRecord("invalid", 95, 0));
  assert.ok(located);
  assert.equal(headlineOnly, null);
  assert.equal(invalidLocation, null);
  assert.equal(eventPoint(null, null), null);
  assert.equal(located.kind, "public-event");
  assert.equal(located.layerId, "public-events");
  assert.equal(located.sourceUrl, "https://news.example.test/located");

  assert.equal(isValidCoordinates(90, 180), true);
  assert.equal(isValidCoordinates(-91, 0), false);
  assert.equal(isValidCoordinates(0, 181), false);
  assert.equal(
    normalizeCameraRecord(
      cameraRecord("bad-coordinate", "qld-tmr", { latitude: Number.NaN }),
      [],
    ),
    null,
  );
});

test("workspace and /map share one layer provider and the same data hook", async () => {
  const appSource = await readFile(new URL("../src/App.tsx", import.meta.url), "utf8");
  const workspaceSource = await readFile(
    new URL("../src/pages/sectors.tsx", import.meta.url),
    "utf8",
  );
  const mapSource = await readFile(
    new URL("../src/pages/event-map.tsx", import.meta.url),
    "utf8",
  );

  assert.match(
    appSource,
    /<GlobalLayerProvider>[\s\S]*<WouterRouter[\s\S]*<Router \/>[\s\S]*<\/WouterRouter>[\s\S]*<\/GlobalLayerProvider>/,
  );
  assert.match(appSource, /<Route path="\/" component={WorkspaceSectorEntry} \/>/);
  assert.match(appSource, /<Route path="\/map" component={EventMapPage} \/>/);
  assert.match(workspaceSource, /useGlobalLayerData/);
  assert.match(mapSource, /useGlobalLayerData/);
});

test("operational versus illustrative status stays explicit in workspace data and controls", () => {
  assert.equal(sectors.find((sector) => sector.id === "cameras")?.status, "connected");
  assert.ok(
    sectors
      .filter((sector) => sector.id !== "cameras")
      .every((sector) => sector.status === "preview"),
  );
  assert.ok(sampleUpdates.length > 0);
  assert.ok(sampleUpdates.every((update) => update.mode === "simulated"));

  const staleProvider = providerStatus("qld-tmr", "stale");
  const markup = renderToStaticMarkup(
    <GlobalLayerControl
      layers={[
        cameraLayerPanel({
          enabled: true,
          onEnabledChange: () => {},
          country: "AU",
          onCountryChange: () => {},
          provider: "all",
          onProviderChange: () => {},
          search: "",
          onSearchChange: () => {},
          providers: [staleProvider],
          requestedProviderIds: ["qld-tmr"],
          matchedCount: 0,
          returnedCount: 0,
          isLoading: false,
          isFetching: false,
          hasError: true,
          isUnavailable: false,
          isTruncated: false,
        }),
        publicEventLayerPanel({
          enabled: true,
          onEnabledChange: () => {},
          isLoading: false,
          isError: false,
          locatedCount: 0,
          recordCount: 0,
          headlineCount: 0,
          sourcesOnline: 0,
          sourceCount: 0,
        }),
      ]}
    />,
  );
  assert.match(markup, /data-testid="toggle-global-layer-cameras"/);
  assert.match(markup, /data-testid="toggle-global-layer-public-events"/);
  assert.match(markup, /data-testid="row-planned-layer-aircraft"/);
  assert.match(markup, /aria-disabled="true"/);
  assert.match(markup, /Catalogue stale/);
  assert.match(markup, /Feed status: not probed/);
});

test("camera list reports empty searches and keeps partial provider data selectable", () => {
  const staleProvider = providerStatus("qld-tmr", "stale");
  const sharedProps = {
    cameras: [] as CameraRecord[],
    providers: [staleProvider],
    requestedProviderIds: ["qld-tmr"],
    selectedCameraId: null,
    onSelectCamera: () => {},
    isLoading: false,
    hasError: false,
    isUnavailable: false,
    isTruncated: false,
    matchedCount: 0,
    onRetry: () => {},
  };
  const emptyMarkup = renderToStaticMarkup(<CameraList {...sharedProps} />);
  assert.match(emptyMarkup, /data-testid="empty-camera-catalogue"/);
  assert.match(emptyMarkup, /No matching cameras/);

  const availableCamera = cameraRecord("qld-1");
  const partialMarkup = renderToStaticMarkup(
    <CameraList
      {...sharedProps}
      cameras={[availableCamera]}
      hasError
      matchedCount={1}
      selectedCameraId="qld-1"
    />,
  );
  assert.match(partialMarkup, /data-testid="status-camera-partial-error"/);
  assert.match(partialMarkup, /data-testid="camera-card-qld-1"/);
  assert.match(partialMarkup, /aria-pressed="true"/);
  assert.match(partialMarkup, /href="https:\/\/feeds\.example\.test\/qld-tmr\/qld-1\.jpg"/);
  assert.doesNotMatch(partialMarkup, /data-testid="status-camera-error"/);
});