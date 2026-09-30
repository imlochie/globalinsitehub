# Global Layer Engine

Developer documentation for Signalwatch's layer architecture.

## Pipeline

```text
Layer Registry        src/lib/layer-registry.ts
      ↓
Layer Definitions     (static facts: label, status, capabilities, providers, sampling)
      ↓
Provider Adapters     src/lib/global-layers.ts, src/hooks/layer-sources/*
      ↓
Normalized Observations (BaseObservation + layer specialisation)
      ↓
Shared Layer State    src/components/global-layer-provider.tsx
      ↓
Shared Controls       src/components/global-layer-control.tsx (+ src/components/layer-panels/*)
      ↓
Shared Map / Globe    src/components/interactive-sector-globe.tsx, satellite-sector-globe.tsx, map-panel.tsx
      ↓
Shared Inspector      src/components/global-observation-inspector.tsx (+ src/components/observation-details/*)
```

## Why the refactor happened

Before this change the engine had a generic-looking `LayerProviderAdapter<TRecord, TObservation>`
but the rest of the system was written against two literal layer ids. Camera/event
coupling existed in `OperationalLayerId`, the `GlobalObservation` union,
`selectEnabledLayerObservations({ cameras, publicEvents })`, `selectGlobeObservations`
(camera-only sampling, `cameraOmitted` in its result), `GlobalLayerProvider`
(`camerasEnabled` / `publicEventsEnabled` state and their setters), `useGlobalLayerData`,
`GlobalLayerControl` (fixed `cameras` + `publicEvents` props and a private
`plannedLayers` array that could drift from the layer definitions), the globe
renderers (`observation.kind === "camera" ? cyan : amber`) and the inspector
(`isCamera ? CameraDetails : EventDetails`). Adding a layer therefore meant editing
ten files rather than registering one.

## What the registry owns

`layerRegistry` (`src/lib/layer-registry.ts`) is the only source of truth for which
layers exist and what they are. Nothing else may keep a parallel list of
operational/planned layers.

A `LayerDefinition` contains:

| Field | Meaning |
| --- | --- |
| `id` | Layer id used by observations, enablement state and selection identity |
| `label`, `description` | Copy rendered by shared UI |
| `status` | `operational` (has a real source) or `planned` (no feed implemented or probed) |
| `category` | Grouping hint (`imagery`, `reporting`, `movement`, `environment`, `infrastructure`) |
| `observationKind` | Discriminant produced by the layer's normalizer |
| `enabledByDefault` | Seeds `registry.defaultEnablement()` |
| `capabilities` | `map`, `globe`, `inspector`, `search`, `providerFiltering` — shared UI branches on these instead of on layer ids |
| `display` | Marker colour/stroke/text, fallback marker classes, legend label, optional tooltip note, icon key |
| `providers` | Static provider definitions (id, name, countries, attribution, catalogue URL). Empty for planned layers |
| `sampling` | Optional bounded-rendering strategy (`provider-balanced` + `maxMarkers`) |

The registry is immutable. `registry.with(...definitions)` returns a new registry,
which is how the regression suite registers a synthetic layer without touching
production code.

## Definition vs runtime state

- `LayerDefinition` — static, no React, no mutable fields.
- `GlobalLayerProvider` — runtime state only: `enabledLayers` (keyed by layer id),
  per-layer filter slices (currently `cameraFilters`), and the shared
  `selectedObservation` identity. Disabling a layer clears a selection that belongs
  to it, generically.
- Layer sources — per-render data for the enabled layers.

## Provider adapters and normalization

```ts
type LayerProviderAdapter<TRecord, TObservation extends BaseObservation> = {
  layerId: TObservation["layerId"];
  providerId(record: TRecord): string;
  normalize(record: TRecord): TObservation | null;
};
```

`normalize` returns `null` for records that cannot be placed (missing or invalid
coordinates). Every observation carries the shared base fields:

`layerId`, `kind`, `id`, `key` (`layerId:id`), `latitude`, `longitude`, `label`,
`observedAt`, `detail`, and the provenance block: `providerId`, `providerName`,
`sourceUrl`, `attribution`, `catalogueUrl`, `providerStatus`. Layer observations add
their own fields plus the original `record`, so provenance is never flattened away.

A layer source (`src/hooks/layer-sources/*`) binds runtime state to queries:

```ts
useXLayerSource({ enabled, state }) -> {
  layerId, enabled, observations, status: { isLoading, isFetching, hasError, isUnavailable }, refetch
}
```

Data acquisition follows enablement: a disabled layer does not start its queries
(this is why `useBriefing` now takes `{ enabled }`).

## Adding a future layer

1. Add a `LayerDefinition` to `src/lib/layer-registry.ts` (or flip an existing
   planned definition to `operational` and fill in its providers/capabilities).
2. Add observation type + `normalize` + adapter in `src/lib/global-layers.ts`.
3. Add a layer source in `src/hooks/layer-sources/` and call it once in
   `useGlobalLayerData` (sources are invoked in a fixed order so React hook rules
   hold; everything after that point is generic).
4. Optional: a control panel builder in `src/components/layer-panels/` if the layer
   needs bespoke filters/metrics, and an inspector body in
   `src/components/observation-details/`. Without them the layer still renders:
   the control row is built from the definition, and the inspector falls back to
   `GenericObservationDetails`.

Globe/map rendering, sampling, legends, selection, enablement and the inspector
shell require no changes.

## Current layer status

Operational:

- `cameras` — Queensland TMR, Transport for NSW, OpenTrafficCamMap. Catalogue
  records only; Signalwatch does not probe or proxy individual feeds.
- `public-events` — geolocated records from the public briefing.
- `maritime` — vessel positions from two free, openly licensed government AIS
  feeds. **Regional coverage, deliberately.**

Planned (no feed implemented, nothing probed, no provider registered):

- `aircraft`, `satellites`, `natural-hazards`, `weather`, `infrastructure`.

### Maritime: regional by construction

| Provider | Licence | Access | Covers |
| --- | --- | --- | --- |
| `digitraffic` (Fintraffic) | CC BY 4.0 | none — no key, no account | Finnish waterways; Class A only; fishing vessels removed at source |
| `barentswatch` (Kystverket) | NLOD 2.0 | free account → API client → OAuth2 client credentials (`BARENTSWATCH_CLIENT_ID`/`_SECRET`) | Norwegian EEZ, Svalbard, Jan Mayen; no fishing <15 m, no leisure <45 m |

Boundaries:

- Each provider is a separate adapter under
  `artifacts/api-server/src/maritime-providers/`, wrapped by
  `createMemoryCachedVesselProvider`. One provider failing yields `unavailable`
  for *that* provider only; the other keeps serving its region.
- Aggregation, filtering and bounding happen in
  `artifacts/api-server/src/routes/maritime.ts`. The browser never contacts an
  AIS provider, so no credential reaches the client.
- Coverage travels with the response (`coverage.scope` / `regions` / `note`) and
  per provider, so the UI states the limitation instead of implying empty oceans.
- Freshness is movement aware: a vessel under way is fresh for 10 minutes and
  removed after 30; a moored, anchored or aground vessel is fresh for an hour and
  removed after six. A record with no provider position time is never presented as
  live. `observedAt` is the provider's position time; `receivedAt` is ours. They
  are never interchanged.
- AIS is self-reported. `shipTypeLabel` and `navigationalStatusLabel` restate the
  codes ITU-R M.1371 defines; documented not-available sentinels (course 360,
  speed 102.3/102.4, heading 511, IMO 0) become `null` rather than values, and
  missing fields are omitted rather than shown as "Unknown" or 0.
- Attribution and licence are carried on every record and rendered in the
  inspector and the layer panel.

**Cost:** both feeds are free of subscriptions, per-request charges and usage
billing. That is a constraint, not an accident — see `replit.md`.

### Adding another free regional AIS source

1. Confirm the licence explicitly permits redistribution/display, and that access
   is free indefinitely (no metered tier, no contribution requirement you cannot
   meet). Record the evidence in `research/`.
2. Add an adapter in `artifacts/api-server/src/maritime-providers/` that returns
   `VesselRecord[]`, reusing the helpers in `ais.ts` for sentinels and labels,
   wrapped in `createMemoryCachedVesselProvider` with its own `coverage`.
3. Register it in `maritime-providers/registry.ts`. Coverage, provider health and
   the route contract update themselves; `deriveCoverage()` folds the new region in.
4. Add the matching `LayerProviderDefinition` (with `coverage` and `licence`) to
   `maritimeLayerDefinition` in `src/lib/layer-registry.ts`.
5. No UI change is required: the panel lists providers and the inspector reads
   provenance generically.

Aircraft remains gated on provider confirmation (see `research/`), so no aircraft
provider or adapter exists.

## Tests

`tests/layer-registry.test.tsx` covers registry integrity, generic
selection/filtering, a synthetic `test-buoys` layer flowing through normalization,
sampling, marker styling, the shared inspector and the shared control, plus two
guards: shared surfaces must not compare against literal layer ids/kinds, and
public-event fetching must follow layer enablement.
`tests/global-layers.test.tsx` keeps the existing camera/event regression coverage.
`tests/maritime-layer.test.tsx` covers the maritime registry entry and its coverage
metadata, vessel normalization (identity, provenance, rejected coordinates, absent
optionals), the movement-aware freshness model, provider isolation, the generic
sampling/inspector/control path and guards that shared surfaces never branch on
`"maritime"` or `"vessel"` and that the browser never calls a provider directly.
`artifacts/api-server/tests/maritime-regression.test.ts` covers AIS sentinel
handling, both provider parsers, cache ageing, provider isolation, coverage
derivation and the route contract.
