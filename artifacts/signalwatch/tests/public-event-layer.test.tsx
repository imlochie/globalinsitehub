import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { test } from "node:test";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { Router } from "wouter";
import type {
  PublicEventProviderStatus,
  PublicEventRecord,
} from "@workspace/api-client-react";
import { GlobalLayerControl } from "../src/components/global-layer-control";
import { GlobalObservationInspector } from "../src/components/global-observation-inspector";
import { publicEventLayerPanel } from "../src/components/layer-panels/public-event-layer-panel";
import {
  isPublicEventObservation,
  normalizePublicEventRecord,
  observationKey,
  type PublicEventObservation,
} from "../src/lib/global-layers";
import {
  layerCoverage,
  layerRegistry,
  publicEventLayerDefinition,
} from "../src/lib/layer-registry";

const RECEIVED_AT = "2026-09-30T04:00:00.000Z";

const record = (
  id: string,
  provider = "qldtraffic",
  overrides: Record<string, unknown> = {},
): PublicEventRecord =>
  ({
    id: `${provider}:${id}`,
    provider,
    eventType: "Flooding",
    eventSubtype: null,
    eventDueTo: "Heavy rainfall",
    title: "Flooding — Kuringgai Parkway",
    description: "Road closed due to flooding",
    advice: "Use alternative route",
    latitude: -27.35,
    longitude: 153.01,
    locationDerived: true,
    locationNote:
      "Representative point averaged from 2 geometries describing the affected road segments, not a single published coordinate.",
    sourcePriority: "Low",
    status: "Published",
    impact: {
      direction: "Southbound",
      towards: null,
      impactType: "Road closed",
      impactSubtype: null,
      delay: "No delays expected",
    },
    roadSummary: {
      roadName: "Kuringgai Parkway",
      locality: "Fitzgibbon",
      postcode: "4018",
      localGovernmentArea: "BRISBANE CITY",
      district: "Metropolitan",
    },
    publishedAt: "2026-09-29T02:19:00.000Z",
    lastUpdatedAt: "2026-09-29T03:37:19.000Z",
    startedAt: null,
    endsAt: null,
    receivedAt: RECEIVED_AT,
    sourceUrl: "https://qldtraffic.qld.gov.au/event/155",
    suppliedBy: "Department of Transport and Main Roads",
    attribution:
      "State of Queensland (Department of Transport and Main Roads), QLDTraffic",
    licence: "CC BY 4.0 AU",
    ...overrides,
  }) as unknown as PublicEventRecord;

const providerStatus = (
  id: string,
  status: "available" | "unavailable" | "unconfigured" = "available",
): PublicEventProviderStatus =>
  ({
    id,
    name: id === "tfnsw" ? "Transport for NSW Live Traffic" : "QLDTraffic (Queensland TMR)",
    attribution: `${id} attribution`,
    licence: "CC BY 4.0",
    licenceUrl: "https://creativecommons.org/licenses/by/4.0/",
    catalogueUrl: "https://example.test/docs",
    status,
    coverage: {
      scope: "regional",
      regions: [id === "tfnsw" ? "New South Wales road network" : "Queensland road network"],
      note: `${id} coverage note`,
    },
    eventCount: 1,
    checkedAt: RECEIVED_AT,
    message:
      status === "unconfigured"
        ? "No TFNSW_API_KEY is configured, so New South Wales road events are not retrieved."
        : `${id} message`,
  }) as unknown as PublicEventProviderStatus;

/* -------------------------------------------------------------------------- */
/* Registry                                                                   */
/* -------------------------------------------------------------------------- */

test("public events is provider-backed and regional, never global", () => {
  const definition = layerRegistry.require("public-events");
  assert.equal(definition, publicEventLayerDefinition);
  assert.equal(definition.status, "operational");
  assert.equal(definition.observationKind, "public-event");
  assert.deepEqual(
    definition.providers.map((provider) => provider.id),
    ["qldtraffic", "tfnsw"],
  );
  const coverage = layerCoverage(definition);
  assert.equal(coverage.scope, "regional");
  assert.match(coverage.note, /not that no incidents are occurring/i);
  assert.match(coverage.note, /current conditions only/i);
  assert.doesNotMatch(coverage.note, /\bglobal\b/i);
});

test("public events and natural hazards are visually distinguishable", () => {
  const events = layerRegistry.require("public-events");
  const hazards = layerRegistry.require("natural-hazards");
  assert.notEqual(events.display.markerColor, hazards.display.markerColor);
});

/* -------------------------------------------------------------------------- */
/* Normalization                                                              */
/* -------------------------------------------------------------------------- */

test("a civic incident keeps its source category, priority and provenance", () => {
  const observation = normalizePublicEventRecord(record("155"), [
    providerStatus("qldtraffic"),
  ]);
  assert.ok(observation);
  assert.equal(observation.layerId, "public-events");
  assert.equal(observation.kind, "public-event");
  assert.equal(observation.id, "qldtraffic:155");
  assert.equal(
    observation.key,
    observationKey("public-events", "qldtraffic:155"),
  );
  // Source-assigned category survives verbatim; "Flooding" does not make this
  // a natural hazard.
  assert.equal(observation.eventType, "Flooding");
  assert.equal(observation.sourcePriority, "Low");
  assert.equal(observation.providerId, "qldtraffic");
  assert.equal(observation.record.suppliedBy, "Department of Transport and Main Roads");
  assert.ok(isPublicEventObservation(observation));
});

test("the authority's time is used, never the Signalwatch receipt time", () => {
  const observation = normalizePublicEventRecord(record("155"), []);
  assert.ok(observation);
  assert.equal(observation.observedAt, "2026-09-29T03:37:19.000Z");
  assert.equal(observation.receivedAt, RECEIVED_AT);
  assert.notEqual(observation.observedAt, observation.receivedAt);
});

test("records without usable coordinates are dropped", () => {
  assert.equal(
    normalizePublicEventRecord(record("a", "qldtraffic", { latitude: 95 }), []),
    null,
  );
  assert.equal(
    normalizePublicEventRecord(
      record("b", "qldtraffic", { longitude: 1000 }),
      [],
    ),
    null,
  );
});

test("records from different providers stay distinct", () => {
  const observations = [
    record("1", "qldtraffic"),
    record("1", "tfnsw"),
  ]
    .map((entry) =>
      normalizePublicEventRecord(entry, [
        providerStatus("qldtraffic"),
        providerStatus("tfnsw"),
      ]),
    )
    .filter((entry): entry is PublicEventObservation => entry !== null);
  assert.equal(observations.length, 2);
  assert.notEqual(observations[0].key, observations[1].key);
});

/* -------------------------------------------------------------------------- */
/* Presentation                                                               */
/* -------------------------------------------------------------------------- */

test("an unconfigured provider reads as configuration, not as no incidents", () => {
  const panel = publicEventLayerPanel({
    enabled: true,
    onEnabledChange: () => {},
    provider: "all",
    onProviderChange: () => {},
    search: "",
    onSearchChange: () => {},
    providers: [providerStatus("qldtraffic"), providerStatus("tfnsw", "unconfigured")],
    matchedCount: 12,
    returnedCount: 12,
    isLoading: false,
    isFetching: false,
    hasError: false,
    isUnavailable: false,
    isTruncated: false,
  });

  assert.equal(panel.status.tone, "warn");
  assert.match(panel.status.label, /not configured/i);
  assert.doesNotMatch(panel.status.label, /no incidents/i);

  const markup = renderToStaticMarkup(
    <Router ssrPath="/">
      <GlobalLayerControl layers={[panel]} />
    </Router>,
  );
  assert.match(markup, /row-public-event-provider-qldtraffic/);
  assert.match(markup, /row-public-event-provider-tfnsw/);
  assert.match(markup, /TFNSW_API_KEY/);
});

test("all providers healthy reads as available", () => {
  const panel = publicEventLayerPanel({
    enabled: true,
    onEnabledChange: () => {},
    provider: "all",
    onProviderChange: () => {},
    search: "",
    onSearchChange: () => {},
    providers: [providerStatus("qldtraffic"), providerStatus("tfnsw")],
    matchedCount: 5,
    returnedCount: 5,
    isLoading: false,
    isFetching: false,
    hasError: false,
    isUnavailable: false,
    isTruncated: false,
  });
  assert.equal(panel.status.tone, "good");
});

test("a derived location is disclosed in the inspector", () => {
  const observation = normalizePublicEventRecord(record("155"), [
    providerStatus("qldtraffic"),
  ]);
  assert.ok(observation);

  const markup = renderToStaticMarkup(
    <Router ssrPath="/">
      <GlobalObservationInspector observation={observation} onClear={() => {}} />
    </Router>,
  );
  assert.match(markup, /text-public-event-derived-location/);
  assert.match(markup, /not a single published coordinate/);
  assert.match(markup, /Representative coordinates/);
  assert.match(markup, /Source priority: Low/);
  assert.match(markup, /Use alternative route/);
  // The authority's priority is never relabelled as a severity score.
  assert.doesNotMatch(markup, /severity/i);
});

test("a published point is not described as representative", () => {
  const observation = normalizePublicEventRecord(
    record("156", "qldtraffic", {
      locationDerived: false,
      locationNote: null,
    }),
    [providerStatus("qldtraffic")],
  );
  assert.ok(observation);
  const markup = renderToStaticMarkup(
    <Router ssrPath="/">
      <GlobalObservationInspector observation={observation} onClear={() => {}} />
    </Router>,
  );
  assert.doesNotMatch(markup, /text-public-event-derived-location/);
  assert.doesNotMatch(markup, /Representative coordinates/);
});

/* -------------------------------------------------------------------------- */
/* Shared-surface purity                                                      */
/* -------------------------------------------------------------------------- */

const sharedSourceFiles = [
  "../src/components/global-layer-control.tsx",
  "../src/components/global-observation-inspector.tsx",
  "../src/components/satellite-sector-globe.tsx",
  "../src/components/interactive-sector-globe.tsx",
  "../src/hooks/use-global-layer-data.ts",
  "../src/lib/observation-style.ts",
];

test("shared surfaces never branch on the public-events layer", async () => {
  for (const file of sharedSourceFiles) {
    const source = await readFile(new URL(file, import.meta.url), "utf8");
    assert.doesNotMatch(
      source,
      /(===|!==)\s*["'](public-event)["']/,
      `${file} compares against the public-event observation kind`,
    );
  }
});
