import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { test } from "node:test";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { Router } from "wouter";
import { GlobalLayerControl } from "../src/components/global-layer-control";
import { GlobalObservationInspector } from "../src/components/global-observation-inspector";
import {
  createLayerRegistry,
  layerCountries,
  layerRegistry,
  plannedLayerDefinitions,
  type LayerDefinition,
} from "../src/lib/layer-registry";
import { cameraLayerPanel } from "../src/components/layer-panels/camera-layer-panel";
import {
  clearLayerSelection,
  findObservation,
  layerSample,
  observationKey,
  selectEnabledLayerObservations,
  selectLayerObservations,
  selectRenderableObservations,
  selectedIdForLayer,
  type BaseObservation,
  type LayerProviderAdapter,
} from "../src/lib/global-layers";
import { observationMarkerStyle } from "../src/lib/observation-style";

/* -------------------------------------------------------------------------- */
/* A synthetic layer, defined entirely inside the test environment.           */
/* -------------------------------------------------------------------------- */

type BuoyRecord = {
  buoyId: string;
  name: string;
  operator: string;
  lat: number;
  lon: number;
  readingAt: string;
  page: string;
};

type BuoyObservation = BaseObservation<"test-buoys", "buoy">;

const buoyLayerDefinition: LayerDefinition = {
  id: "test-buoys",
  label: "Test buoys",
  description: "Synthetic layer registered only by the regression suite.",
  status: "operational",
  category: "environment",
  observationKind: "buoy",
  enabledByDefault: true,
  capabilities: {
    map: true,
    globe: true,
    inspector: true,
    search: false,
    providerFiltering: true,
  },
  display: {
    markerColor: "#a78bfa",
    markerStrokeColor: "#ede9fe",
    markerTextColor: "#ddd6fe",
    markerClassName: "size-2 border-violet-100 bg-violet-300",
    legendLabel: "Test buoy",
    iconKey: "not-a-real-icon-key",
  },
  providers: [
    {
      id: "test-buoy-net",
      name: "Test Buoy Network",
      countries: ["AU"],
      attribution: "Synthetic fixture network",
      catalogueUrl: "https://buoys.example.test/catalogue",
    },
    {
      id: "test-buoy-alt",
      name: "Alternate Buoy Network",
      countries: ["AU"],
      attribution: "Synthetic fixture network (alternate)",
      catalogueUrl: "https://alt-buoys.example.test/catalogue",
    },
  ],
  sampling: { kind: "provider-balanced", maxMarkers: 4 },
};

const buoyAdapter: LayerProviderAdapter<BuoyRecord, BuoyObservation> = {
  layerId: "test-buoys",
  providerId: (record) => record.operator,
  normalize: (record) => ({
    layerId: "test-buoys",
    kind: "buoy",
    id: record.buoyId,
    key: observationKey("test-buoys", record.buoyId),
    latitude: record.lat,
    longitude: record.lon,
    label: record.name,
    observedAt: record.readingAt,
    detail: null,
    providerId: record.operator,
    providerName: record.operator,
    sourceUrl: record.page,
    attribution: "Synthetic fixture network",
    catalogueUrl: "https://buoys.example.test/catalogue",
    providerStatus: null,
  }),
};

const buoyRecord = (
  id: string,
  operator = "test-buoy-net",
): BuoyRecord => ({
  buoyId: id,
  name: `Buoy ${id}`,
  operator,
  lat: -30.1,
  lon: 152.4,
  readingAt: "2026-09-30T00:00:00.000Z",
  page: `https://buoys.example.test/${id}`,
});

const buoyObservation = (id: string, operator?: string): BuoyObservation => {
  const observation = buoyAdapter.normalize(buoyRecord(id, operator));
  assert.ok(observation);
  return observation;
};

/* -------------------------------------------------------------------------- */
/* Registry integrity                                                         */
/* -------------------------------------------------------------------------- */

test("registry is the authoritative description of every layer", () => {
  const cameras = layerRegistry.require("cameras");
  assert.equal(cameras.status, "operational");
  assert.equal(cameras.observationKind, "camera");
  assert.equal(cameras.enabledByDefault, true);
  assert.equal(cameras.capabilities.providerFiltering, true);
  assert.equal(cameras.capabilities.search, true);
  assert.deepEqual(
    cameras.providers.map((provider) => provider.id),
    [
      "qld-tmr",
      "transport-for-nsw",
      "opentrafficcammap",
      "qldtraffic-cameras",
      "digitraffic-weathercam",
      "hk-td-traffic-snapshots",
    ],
  );
  assert.deepEqual(
    cameras.providers
      .filter((provider) => provider.countries.includes("AU"))
      .map((provider) => provider.id),
    ["qld-tmr", "transport-for-nsw", "qldtraffic-cameras"],
  );
  assert.equal(cameras.sampling?.kind, "provider-balanced");
  assert.equal(cameras.sampling?.maxMarkers, 180);

  const events = layerRegistry.require("public-events");
  assert.equal(events.status, "operational");
  assert.equal(events.observationKind, "public-event");
  // Public events is now supplied by named civic providers, so it filters by
  // provider and carries its own sampling cap like the other real layers.
  assert.equal(events.capabilities.providerFiltering, true);
  assert.deepEqual(
    events.providers.map((provider) => provider.id),
    ["qldtraffic", "tfnsw"],
  );
  assert.equal(events.coverage?.scope, "regional");
  assert.equal(events.sampling?.kind, "provider-balanced");

  // Planned layers stay planned: no providers, not enabled, not operational.
  const planned = layerRegistry.planned();
  assert.deepEqual(
    planned.map((definition) => definition.id),
    plannedLayerDefinitions.map((definition) => definition.id),
  );
  assert.ok(planned.some((definition) => definition.id === "aircraft"));
  for (const definition of planned) {
    assert.equal(definition.providers.length, 0);
    assert.equal(definition.enabledByDefault, false);
    assert.equal(definition.capabilities.map, false);
    assert.equal(definition.capabilities.globe, false);
  }

  // Operational/planned membership comes from one place, not parallel arrays.
  assert.deepEqual(
    [...layerRegistry.operational(), ...layerRegistry.planned()].map(
      (definition) => definition.id,
    ),
    layerRegistry.definitions.map((definition) => definition.id),
  );
  assert.deepEqual(layerRegistry.defaultEnablement(), {
    cameras: true,
    "public-events": true,
    aircraft: false,
    maritime: false,
    satellites: false,
    "natural-hazards": false,
    weather: false,
    infrastructure: false,
  });
  assert.equal(layerRegistry.has("test-buoys"), false);
  assert.throws(() => layerRegistry.require("test-buoys"));
});

/* -------------------------------------------------------------------------- */
/* Generic selection                                                          */
/* -------------------------------------------------------------------------- */

test("selection, filtering and clearing work purely on layer identity", () => {
  const buoy = buoyObservation("b-1");
  const other: BaseObservation = {
    ...buoyObservation("x-1"),
    layerId: "some-other-layer",
    key: observationKey("some-other-layer", "x-1"),
  };
  const observations: BaseObservation[] = [buoy, other];

  assert.deepEqual(
    selectEnabledLayerObservations(observations, {
      "test-buoys": true,
      "some-other-layer": false,
    }).map((observation) => observation.id),
    ["b-1"],
  );
  assert.deepEqual(
    selectEnabledLayerObservations(observations, {}).length,
    0,
  );
  assert.deepEqual(
    selectLayerObservations(observations, "test-buoys").map(
      (observation) => observation.id,
    ),
    ["b-1"],
  );

  const identity = { layerId: "test-buoys", id: "b-1" };
  assert.equal(findObservation(observations, identity)?.key, buoy.key);
  assert.equal(findObservation(observations, null), null);
  assert.equal(
    findObservation(observations, { layerId: "test-buoys", id: "missing" }),
    null,
  );
  assert.equal(selectedIdForLayer(identity, "test-buoys"), "b-1");
  assert.equal(selectedIdForLayer(identity, "cameras"), null);
  assert.equal(clearLayerSelection(identity, "test-buoys"), null);
  assert.deepEqual(clearLayerSelection(identity, "cameras"), identity);
});

/* -------------------------------------------------------------------------- */
/* Generic registration                                                       */
/* -------------------------------------------------------------------------- */

test("a synthetic layer flows through normalization, sampling and rendering", () => {
  const registry = layerRegistry.with(buoyLayerDefinition);
  assert.equal(registry.has("test-buoys"), true);
  // Registration is immutable: the production registry is untouched.
  assert.equal(layerRegistry.has("test-buoys"), false);

  const observations = [
    ...Array.from({ length: 6 }, (_, index) =>
      buoyObservation(`net-${index}`, "test-buoy-net"),
    ),
    ...Array.from({ length: 3 }, (_, index) =>
      buoyObservation(`alt-${index}`, "test-buoy-alt"),
    ),
  ];

  // The layer's registered sampling strategy is applied without any
  // production code knowing about buoys.
  const sample = selectRenderableObservations(observations, null, registry);
  const summary = layerSample(sample.samples, "test-buoys");
  assert.equal(summary?.label, "Test buoys");
  assert.equal(summary?.total, 9);
  assert.equal(summary?.shown, 4);
  assert.equal(summary?.omitted, 5);
  assert.equal(
    sample.observations.filter(
      (observation) => observation.providerId === "test-buoy-alt",
    ).length,
    2,
  );
  assert.equal(
    sample.observations.some((observation) => observation.id === "net-5"),
    false,
  );
  // Selected record is retained even though sampling would have dropped it.
  const selectedSample = selectRenderableObservations(
    observations,
    { layerId: "test-buoys", id: "net-5" },
    registry,
  );
  assert.ok(
    selectedSample.observations.some(
      (observation) => observation.id === "net-5",
    ),
  );
  assert.equal(selectedSample.observations.length, 4);

  // Marker presentation is registry-derived.
  const style = observationMarkerStyle(observations[0]!, registry);
  assert.equal(style.markerColor, "#a78bfa");
  assert.equal(style.legendLabel, "Test buoy");
  assert.match(style.tooltip, /Buoy net-0 · Test buoy · test-buoy-net/);

  // Unregistered layers degrade safely instead of throwing.
  const unknownStyle = observationMarkerStyle(observations[0]!);
  assert.equal(unknownStyle.markerColor, "#94a3b8");

  // The shared inspector renders the layer with no bespoke production wiring.
  const inspectorMarkup = renderToStaticMarkup(
    <Router ssrPath="/">
      <GlobalObservationInspector
        observation={observations[0]!}
        onClear={() => {}}
        registry={registry}
      />
    </Router>,
  );
  assert.match(inspectorMarkup, /Test buoys record/);
  assert.match(inspectorMarkup, /Buoy net-0/);
  assert.match(inspectorMarkup, /data-testid="generic-observation-details"/);
  assert.match(
    inspectorMarkup,
    /href="https:\/\/buoys\.example\.test\/net-0"/,
  );

  // The shared control renders the layer row from the definition alone.
  const controlMarkup = renderToStaticMarkup(
    <GlobalLayerControl
      registry={registry}
      layers={[
        {
          definition: buoyLayerDefinition,
          enabled: true,
          onEnabledChange: () => {},
          status: { label: "Source status: available", tone: "good" },
        },
      ]}
    />,
  );
  assert.match(controlMarkup, /data-testid="layer-row-test-buoys"/);
  assert.match(controlMarkup, /data-testid="toggle-global-layer-test-buoys"/);
  assert.match(controlMarkup, /Synthetic layer registered only by/);
  assert.match(controlMarkup, /data-testid="row-planned-layer-aircraft"/);
  // No aircraft provider exists: aircraft is still only a planned row.
  assert.doesNotMatch(controlMarkup, /toggle-global-layer-aircraft/);
});

/* -------------------------------------------------------------------------- */
/* Architecture guards                                                        */
/* -------------------------------------------------------------------------- */

const sharedSourceFiles = [
  "../src/components/global-layer-control.tsx",
  "../src/components/global-observation-inspector.tsx",
  "../src/components/satellite-sector-globe.tsx",
  "../src/components/interactive-sector-globe.tsx",
];

test("shared surfaces do not branch on individual layer ids", async () => {
  for (const file of sharedSourceFiles) {
    const source = await readFile(new URL(file, import.meta.url), "utf8");
    assert.doesNotMatch(
      source,
      /(===|!==)\s*["'](cameras|public-events)["']/,
      `${file} compares against a hard-coded layer id`,
    );
    assert.doesNotMatch(
      source,
      /(===|!==)\s*["'](camera|public-event)["']/,
      `${file} compares against a hard-coded observation kind`,
    );
  }
});

test("public-event acquisition follows layer enablement", async () => {
  const source = await readFile(
    new URL("../src/hooks/layer-sources/public-event-layer-source.ts", import.meta.url),
    "utf8",
  );
  assert.match(source, /usePublicEventFeed\(\{\s*enabled,/);

  const feed = await readFile(
    new URL("../src/hooks/use-public-event-feed.ts", import.meta.url),
    "utf8",
  );
  assert.match(feed, /enabled,/);
  assert.match(feed, /refetchInterval: enabled \? QUERY_REFETCH_MS : false/);
  // The browser only ever talks to the Signalwatch API.
  assert.doesNotMatch(feed, /qldtraffic\.qld\.gov\.au/);
  assert.doesNotMatch(feed, /transport\.nsw\.gov\.au/);

  const hook = await readFile(
    new URL("../src/hooks/use-global-layer-data.ts", import.meta.url),
    "utf8",
  );
  assert.match(
    hook,
    /usePublicEventLayerSource\(\{\s*enabled: layerState\.isLayerEnabled\("public-events"\)/,
  );
  assert.match(
    hook,
    /useCameraLayerSource\(\{\s*enabled: layerState\.isLayerEnabled\("cameras"\)/,
  );
});

test("a registered layer can be resolved by capability", () => {
  const registry = createLayerRegistry([
    layerRegistry.require("cameras"),
    layerRegistry.require("public-events"),
    buoyLayerDefinition,
  ]);
  assert.deepEqual(
    registry.withCapability("globe").map((definition) => definition.id),
    ["cameras", "public-events", "test-buoys"],
  );
  assert.deepEqual(
    registry.withCapability("providerFiltering").map((definition) => definition.id),
    ["cameras", "public-events", "test-buoys"],
  );
  assert.deepEqual(registry.planned(), []);
});

test("the camera country selector is derived from the registry, not hard-coded", () => {
  // Regression guard. The Digitraffic road weather cameras were registered as
  // a camera provider but could not be reached in the UI, because the country
  // selector was a hard-coded Australia/United States pair. Registering an
  // admitted provider must be enough to make it selectable.
  const cameras = layerRegistry.require("cameras");
  const declared = [
    ...new Set(cameras.providers.flatMap((provider) => provider.countries)),
  ].sort();
  assert.deepEqual(
    layerCountries(cameras)
      .map((entry) => entry.code)
      .sort(),
    declared,
  );
  assert.ok(declared.includes("FI"));
  assert.ok(declared.includes("HK"));

  // Every declared country is rendered as an option, and each is labelled.
  const panel = cameraLayerPanel({
    enabled: true,
    onEnabledChange: () => {},
    country: "HK",
    onCountryChange: () => {},
    provider: "all",
    onProviderChange: () => {},
    search: "",
    onSearchChange: () => {},
    providers: [],
    requestedProviderIds: [],
    matchedCount: 0,
    returnedCount: 0,
    isLoading: false,
    isFetching: false,
    hasError: false,
    isUnavailable: false,
    isTruncated: false,
  });
  const markup = renderToStaticMarkup(
    React.createElement(Router, null, panel.controls),
  );
  for (const country of layerCountries(cameras)) {
    assert.ok(
      markup.includes(`value="${country.code}"`),
      `missing country option ${country.code}`,
    );
  }
  assert.ok(markup.includes("Hong Kong SAR"));
  // The provider list follows the selected country.
  assert.ok(markup.includes("Hong Kong Transport Department traffic snapshots"));
  assert.ok(markup.includes("All Hong Kong SAR providers"));
});
