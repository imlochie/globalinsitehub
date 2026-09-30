# [Project name]

_Replace the heading above with the project's name, and this line with one sentence describing what this app does for users._

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
- Planned layers (aircraft, maritime, satellites, natural hazards, weather,
  infrastructure) are registered as `status: "planned"` with no providers. Aircraft stays
  unimplemented until provider terms are confirmed (`research/`).

## Product

_Describe the high-level user-facing capabilities of this app once they exist._

## User preferences

_Populate as you build — explicit user instructions worth remembering across sessions._

## Gotchas

- Signalwatch's Vite config requires `PORT` and `BASE_PATH` env vars, also for `vite build`.
- Adding a layer: definition → adapter/normalizer → layer source → (optional) panel and
  inspector body. See `artifacts/signalwatch/docs/global-layer-engine.md`.
- `tests/layer-registry.test.tsx` fails the build if shared surfaces reintroduce
  hard-coded camera/event branching.

## Pointers

- See the `pnpm-workspace` skill for workspace structure, TypeScript setup, and package details
