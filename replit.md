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
  OpenTrafficCamMap), public events/news, and maritime. Camera catalogue entries are listings only —
  Signalwatch never probes or proxies an individual feed, and catalogue status is always
  shown separately from feed reachability.
- Maritime is **operational with regional coverage at $0 recurring cost**. Two free,
  openly licensed government AIS feeds are aggregated server-side at
  `GET /api/monitoring/maritime`:
  - Fintraffic / Digitraffic (CC BY 4.0, no account) — Finnish waterways. Class A only;
    fishing vessels are removed at source.
  - Kystverket / BarentsWatch (NLOD 2.0, free account + OAuth2 client credentials in
    `BARENTSWATCH_CLIENT_ID` / `BARENTSWATCH_CLIENT_SECRET`) — Norwegian EEZ, Svalbard
    and Jan Mayen; excludes fishing vessels under 15 m and leisure craft under 45 m.
    Without credentials the provider reports `unavailable` and shows no vessels.
  Maritime must never be described as global. Empty sea outside those regions means
  Signalwatch has no maritime source there, not that no vessels are present. AIS is
  self-reported: identity, type and destination are claims by the vessel, and no
  purpose, cargo or affiliation is ever inferred. Vessel freshness is movement aware
  (under way: fresh ≤10 min, removed after 30 min; stationary: fresh ≤1 h, removed
  after 6 h); the provider position time and the Signalwatch receipt time are kept
  separate and never conflated. Attribution and licence travel with every record.
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
- Because USGS and NASA EONET records are hazard-source records, the **public-events
  map layer** no longer renders them (they are excluded by stable provider id prefix,
  never by wording). The written briefing still lists them. The remaining public-event
  sources are news RSS feeds, which carry no coordinates, so the public-events map layer
  currently has no mappable records of its own — this is stated honestly rather than
  fixed by double-rendering hazards. See `research/natural-hazards-source-decision.md`.
- Aircraft, satellites, weather and infrastructure are registered as
  planned layers with no data source connected.

## User preferences

- Keep the product honest: no fabricated data, provider health or freshness; planned
  layers must never be presented as operational.
- Aircraft stays unimplemented until provider terms/rights are confirmed (`research/`).
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
