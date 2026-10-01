# OSIRIS → Signalwatch Migration

Migration plan and running record. Target: **OSIRIS breadth, Signalwatch
discipline.**

- OSIRIS upstream audited at `d972d9af5c6f45aebf6d60b8a60f229a8abbe2f1` (MIT)
- Signalwatch baseline: `751fd59`
- Governed by `docs/research/source-admission-standard.md`
- Companion inventory: `docs/research/osiris-source-audit.md`
- Code provenance ledger: `docs/research/osiris-code-provenance.md`

**Branch deviation, recorded:** the brief asks for a dedicated migration
branch. This session is pinned to `arena/01a0f054-globalinsitehub` and cannot
create one. Work proceeds on the pinned branch in reviewable per-batch
commits; no history is rewritten and `main` is untouched.

---

## Current Signalwatch architecture

```
UI (React/Vite, Tauri desktop + PWA)
  └ layer registry        artifacts/signalwatch/src/lib/layer-registry.ts
  └ observation model     artifacts/signalwatch/src/lib/global-layers.ts
  └ layer sources         artifacts/signalwatch/src/hooks/layer-sources/*
  └ inspector/panels      components/observation-details/*, layer-panels/*
API (Express, bundled as a Tauri sidecar)
  └ routes                cameras · public-events · hazards · maritime · briefing
  └ provider adapters     camera-providers/ · public-event-providers/
                          hazard-sources/ · maritime-providers/
Contract                  lib/api-spec/openapi.yaml → orval → api-zod, api-client-react
```

Operational layers: `cameras`, `public-events`, `natural-hazards`,
`maritime`. Planned: `aircraft`, `satellites`, `weather`, `infrastructure`.

## Current OSIRIS architecture

Next.js app. 71 API route groups, 88 `src/lib` modules, 47 CCTV adapter files
plus three providers inline in `cctv/route.ts`. No provider-admission concept,
no capability model, no licence metadata on records, no per-provider coverage
derivation. Full inventory in `osiris-source-audit.md`.

## What OSIRIS already solves

- **Endpoint discovery at scale.** ~43 camera providers and ~30 non-camera
  domains, each with a working request shape and response parser.
- **Provider-specific quirks** — charset handling, projection conversion,
  partner-host filtering, redirect behaviour.
- **Regional loading and catalogue merging** (`camera-catalog.ts`: "partial
  retries must add cameras, not erase previously loaded regions").
- **Bounded concurrency** across many provider fetches (`fetch-pool.ts`).

## What Signalwatch already solves

- **Source admission** — five binding invariants and a documented test.
- **Capability classification** — provider-declared `documentedAs`, with
  `catalogue-only` as the default.
- **Provenance per record** — provider, source URL, licence, attribution.
- **Freshness semantics** — observation time kept distinct from receipt time.
- **Derived coverage** — computed from providers that actually answered, with
  honest degradation when one fails.
- **Generic layer engine** — registry, sampling, selection, inspector, with
  guards that shared surfaces never branch on a layer id.
- **Packaging** — Tauri desktop with a bundled API sidecar, and a PWA.

## KEEP

- Endpoint knowledge and response shapes for government open-data providers.
- Parser logic where it matches the documented contract.
- The regional-merge rule from `camera-catalog.ts`.
- Bounded-concurrency fetching, when the provider count justifies it.

## ADAPT

- Every adapter whose upstream is usable but whose implementation uses
  `stealthFetch` — re-verified against an honest client, then rewritten onto
  `providerFetch`.
- Stream/image classification: OSIRIS infers; Signalwatch requires the
  provider to declare. Adapters move behind `classifyViewCapability`.
- Records gain licence, attribution, capability and freshness fields.

## REPLACE

- `stealthFetch` → `artifacts/api-server/src/lib/provider-fetch.ts`.
- OSIRIS-proxied sources (`osirisai.live`) → the upstream provider, or drop.
- Inferred stream type → provider-documented `documentedAs`.

## DROP

- `stealthFetch` and every evasion technique it implements.
- `osirisai.live`-routed adapters — third-party runtime dependency.
- AISStream maritime — excluded by prior product decision.
- Hard-coded `PORTS` table and the static "13 conflict zones" — reference data
  presented as live observation.
- SkylineWebcams, YouTube live-page resolution, anonymous `streamlock.net`
  hosts — no redistribution right.
- `scanner`, `osint/sweep`, `osint/shodan`, `osint/fingerprint`,
  `osint/leaks`, `osint/hudsonrock` — active reconnaissance.
- Crypto/markets routes — outside the product; several are paid-tiered.

## Existing Signalwatch work that must survive

Non-negotiable, verified green after every batch:

- The four operational layers and their provider decision records.
- The capability model and its tests.
- `sourceKind` provenance; entry-path normalization; the desktop sidecar,
  loopback binding, path normalization and self-destroying service worker.
- The $0 invariant and the safety boundary.

## Migration risks

| Risk | Mitigation |
| --- | --- |
| Importing a provider OSIRIS only reached by spoofing | Invariant 3 entry condition: re-verify with an honest client first |
| Catalogue-wide permission applied to partner-owned cameras | Camera-level provenance; admit per camera |
| Polling storm from many new providers | Per-provider cache TTL and failure isolation, as today |
| Coverage language inflating with provider count | Coverage derived from providers that answered, never declared |
| Losing track of what came from where | `osiris-code-provenance.md` ledger |
| Breadth outrunning admission | Batches gated on evidence, not convenience |

## Proposed target architecture

```
UI  (Signalwatch, unchanged — must not know an adapter came from OSIRIS)
 ↓  layer registry + generic observation engine
 ↓  Signalwatch observation API (OpenAPI → generated client)
 ↓  provider adapter interface  (+ classifyViewCapability, providerFetch)
 ↓  OSIRIS-derived adapters  ·  native Signalwatch adapters
 ↓  public upstream providers
```

## Migration sequence

| Batch | Content | Status |
| --- | --- | --- |
| 0 | Architecture + inventory | **done** (`3151af3`, `46d00a2`, this document) |
| 1 | One clean OSIRIS-derived provider + the honest fetch abstraction | **done** — Digitraffic weathercams |
| 2 | Camera corpus migration | blocked — TfL/WSDOT/Caltrans all RESEARCH, no primary terms. **Batch 2 was spent on NOAA/NWS alerts instead**, which cleared admission outright |
| 3 | Environmental / hazard sources | **partly done** — NOAA/NWS alerts migrated in Batch 2; NASA FIRMS still pending a MAP_KEY decision |
| 4 | Aircraft | blocked — ADSB.lol ADOPT WITH CONDITIONS, operator contact outstanding |
| 5 | Maritime / infrastructure / space / news | after 2–3 |

---

## Batch 1 — Fintraffic Digitraffic road weather cameras

**Chosen on evidence, not convenience.** It was the only OSIRIS camera source
whose licence Signalwatch had *already verified independently*, and the only
one with a provider-documented current-image guarantee on file.

| Admission line | Finding |
| --- | --- |
| Licence | CC BY 4.0, verified in `research/maritime-provider-decision.md` for the same provider's AIS feed |
| Access | none — no key, no account |
| Cost | $0 |
| Capability evidence | Digitraffic documents that the response "contains weather camera information and URL for the camera image", with the worked example `C1451601` → `https://weathercam.digitraffic.fi/C1451601.jpg` |
| Freshness | documented: "images are updated approximately about every 10 minutes" |
| Availability | documented: clients should check camera `state`/`collectionStatus` and preset `inCollection` |
| Identification | Digitraffic asks for a `Digitraffic-User` header; Signalwatch sends one |

### What this batch proves

1. An OSIRIS-derived adapter can sit under the Signalwatch provider interface
   with the frontend unaware of its origin.
2. `stealthFetch` is replaceable by honest identification without losing the
   provider — the OSIRIS original used spoofed headers for this exact source.
3. **`unavailable` is now reachable from real provider data.** It was a dead
   enum member; Digitraffic is the first registered provider publishing a
   per-camera out-of-service signal, so a camera that exists but is not
   collecting stays catalogued and honestly labelled instead of vanishing.

### Deliberately not done in Batch 1

- No image proxying — the client loads `weathercam.digitraffic.fi` directly.
- No history ingestion, though a 24-hour history endpoint exists.
- No compass bearing: Digitraffic's per-preset `direction` is road-register
  relative, not a heading, so `direction` is reported as `null` rather than
  converted into something it is not.
