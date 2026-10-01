# Signalwatch

Signalwatch is a public-source situational-awareness workspace: it ingests openly
published records (traffic-camera catalogues, public news/event briefings), normalizes
them into one observation model, and lets an analyst inspect them on a globe, a 2D map
and a shared record inspector with provenance intact.

## Run & Operate

- `pnpm --filter @workspace/api-server run dev` — run the API server (port 5000)
- `pnpm run typecheck` — full typecheck across all packages
- `pnpm run build` — typecheck + build all packages
- `pnpm --filter @workspace/api-spec run codegen` — regenerate API hooks and Zod schemas from the OpenAPI spec
- `pnpm --filter @workspace/db run push` — push DB schema changes (dev only)
- Required env: `DATABASE_URL` — Postgres connection string

## Stack

- pnpm workspaces, Node.js 24, TypeScript 5.9
- API: Express 5
- DB: PostgreSQL + Drizzle ORM
- Validation: Zod (`zod/v4`), `drizzle-zod`
- API codegen: Orval (from OpenAPI spec)
- Build: esbuild (CJS bundle)

## Where things live

- `artifacts/signalwatch` — Signalwatch workspace UI (Vite + React)
  - `src/lib/layer-registry.ts` — **source of truth for every operational/planned layer**
  - `src/lib/global-layers.ts` — normalized observation model, provider adapters, generic selection/sampling
  - `src/hooks/layer-sources/*` — per-layer data bindings (queries + normalization)
  - `src/components/layer-panels/*`, `src/components/observation-details/*` — optional per-layer presentation
  - `docs/global-layer-engine.md` — **Global Layer Engine architecture and how to add a layer**
- `artifacts/api-server` — Express API, including the camera provider adapters
- `lib/api-spec/openapi.yaml` — API contract; `pnpm --filter @workspace/api-spec run codegen` regenerates the client
- `research/` — provider research and evidence (aircraft providers remain unresolved)
- `docs/research/source-admission-standard.md` — **how a data source becomes part
  of Signalwatch.** Five invariants: technical accessibility is not permission;
  another project's implementation is not upstream authorisation; a disguised or
  proxied request is not acceptable provenance; capability is earned from the
  documented provider contract; unknown stays unknown. Includes the admission
  test, the access/registration/cost vocabulary, standing prohibitions, and the
  ADOPT / ADOPT WITH CONDITIONS / RESEARCH / DEFER / EXCLUDE statuses. Read this
  before adding any provider.
- `research/future-concepts.md` — **idea vault**: captured product concepts that are
  explicitly *not* implemented. Nothing there has a `layerRegistry` entry, provider,
  endpoint or marker. A concept only becomes a layer after passing the provider gate
  (source legitimacy, licence, feasibility, freshness, coverage, $0 recurring cost,
  and a privacy/safety review where relevant). Currently holds Registry / Civic
  Assets, Conflict-Affected Camera Coverage (research-only) and Traffic Intelligence
  (restricted — number-plate recognition, plate databases and cross-camera vehicle
  tracking are prohibited, not deferred). Backlog statuses are IDEA / RESEARCHING /
  CONDITIONAL / READY / IMPLEMENTED / BLOCKED; `OPERATIONAL` is reserved for real
  verified layers.

## Architecture decisions

- The Global Layer Engine is registry-driven: layers are described once in
  `src/lib/layer-registry.ts` (label, status, capabilities, providers, sampling) and
  shared state/controls/globe/map/inspector consume that metadata. Shared code must not
  branch on literal layer ids such as `"cameras"` or `"public-events"`.
- Static layer definitions and runtime layer state are separate: definitions carry no
  mutable state; `GlobalLayerProvider` holds enablement, filters and the shared selection.
- Observations share one base shape (identity, coordinates, provenance, freshness,
  attribution) plus a layer-specific specialisation; provider provenance is never
  flattened away to simplify types.
- Data acquisition follows layer enablement — a disabled layer starts no queries.
- **`status: "operational"` is a statement about sources, not about runtime health.**
  It means Signalwatch has at least one legitimate free source capable of supplying
  the layer in the current deployment. It does *not* mean every registered provider
  is configured and healthy. A layer with two providers stays operational when one is
  down or unconfigured — the other still serves its region, and the failing provider
  is named as `unavailable` beside the layer instead of the layer being hidden.
  Runtime health lives in `LayerFetchStatus` and in per-provider API status.
- Layer coverage is part of the registry: each provider declares
  `coverage: { scope: "global" | "regional" | "local", regions, note }` and
  `layerCoverage()` derives the layer's coverage from its providers. Deriving never
  upgrades the scope — one regional provider makes the whole layer regional.
- Planned layers (aircraft, satellites, natural hazards, weather, infrastructure) are
  registered as `status: "planned"` with no providers. Aircraft stays unimplemented
  until a provider Signalwatch can use indefinitely without payment is confirmed
  (`research/aircraft-provider-decision.md`).

## Product

- `/` — workspace: globe view of live public-source observations plus illustrative sector
  markers, global layer controls, and the shared observation inspector.
- `/map` — detailed Leaflet map with event and camera lists, sharing the same layer
  state, selection and inspector as the workspace.
- `/monitoring`, `/sources` — briefing and source-availability views.
- Operational layers today: public cameras (Queensland TMR, Transport for NSW,
  OpenTrafficCamMap), public events (civic incidents), natural hazards, and maritime.
  Camera catalogue entries are listings only — Signalwatch never probes or proxies an
  individual feed, and catalogue status is always shown separately from feed
  reachability.
- Public events is **operational with regional coverage at $0 recurring cost**. It is
  geolocated civic reporting — incidents, crashes, closures, roadworks,
  flooding-affected roads and major events — aggregated server-side at
  `GET /api/monitoring/public-events`:
  - QLDTraffic / Queensland TMR (CC BY 4.0 AU) — Queensland roads. **No account**:
    the API specification publishes a public key for unregistered developers, which
    is used by default and can be overridden with `QLDTRAFFIC_API_KEY`. That public
    key is globally rate limited (100 req/min shared), so a 429 is possible and is
    reported honestly.
  - Transport for NSW Live Traffic (CC BY 4.0) — NSW roads. Requires a free Open Data
    Hub account and `TFNSW_API_KEY`. Without it the provider reports `unconfigured`
    and contributes nothing; Queensland data is unaffected.
  The layer's meaning is broader than its current providers — other free civic sources
  can join without changing what it means. Categories are always the category the
  authority assigned: a road closed by flooding is a civic incident, **not** a natural
  hazard, and nothing is reclassified from wording. The source's own priority label is
  shown as theirs and is never turned into a severity score or compared across
  providers. Many road events are multi-segment geometries with no single published
  coordinate; those markers are **derived representative points** and say so. Current
  conditions only — this is not a historical archive. Coverage is regional: empty space
  outside Queensland and NSW means Signalwatch has no civic source there.
- Natural hazards is **operational with global reach at $0 recurring cost**. Two free
  public-sector hazard feeds are aggregated server-side at
  `GET /api/monitoring/hazards`:
  - USGS Earthquake Hazards Program (U.S. public domain, no key) — worldwide
    earthquakes, magnitude 2.5 and above, past 24 hours.
  - NASA EONET v3 (NASA ESDIS open data, no key) — worldwide curated open natural
    events such as wildfires, volcanoes, storms and sea/lake ice.
  Both feeds share the same upstream cache as the briefing, so the layer adds no
  extra provider polling. Reach is global but completeness is bounded and the UI says
  so: an area with no markers means these two sources reported nothing there, not that
  nothing is happening. A hazard type is always the category the source assigned and is
  never inferred from a headline. Magnitudes always keep the scale they were measured
  on; Signalwatch never computes a severity score and never ranks or fuses hazards
  across sources. The source observation time and the Signalwatch receipt time are kept
  separate. EONET records carry NASA's own disclaimer that they are approximations and
  not official as to spatial or temporal extent. If a source fails it is reported as
  unavailable — never as "no hazards".
- The public briefing (news RSS) is a reporting surface in its own right and no longer
  feeds any map layer; briefing records carry an explicit `sourceKind` provenance field.
  See `research/public-events-provider-decision.md`.
- Aircraft, satellites, weather and infrastructure are registered as
  planned layers with no data source connected.

## User preferences

- Keep the product honest: no fabricated data, provider health or freshness; planned
  layers must never be presented as operational.
- Aircraft stays unimplemented until provider terms/rights are confirmed (`research/`).
- **$0 recurring provider cost is an architectural invariant.** No paid accounts, no
  usage billing, no free tiers that become paid at real workload, no architectures
  that depend on a future paid upgrade. **Free government-data accounts are permitted
  where they are required to access an explicitly licensed public-data source** (e.g.
  Transport for NSW Open Data, CC BY 4.0). This narrow exception exists to serve the
  $0 rule, not to weaken it.
- **$0 recurring provider cost is an architectural invariant.** No subscriptions, no
  pay-per-request APIs, no usage billing, no free tiers that become paid at real
  workload. A provider that cannot be used indefinitely without payment leaves its
  layer `planned`.
- Prefer small, focused commits (refactor / test / docs separated).

## Gotchas

- Signalwatch's Vite config requires `PORT` and `BASE_PATH` env vars, also for `vite build`.
- Adding a layer: definition → adapter/normalizer → layer source → (optional) panel and
  inspector body. See `artifacts/signalwatch/docs/global-layer-engine.md`.
- `tests/layer-registry.test.tsx` fails the build if shared surfaces reintroduce
  hard-coded camera/event branching.

## Pointers

- See the `pnpm-workspace` skill for workspace structure, TypeScript setup, and package details
