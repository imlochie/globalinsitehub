# C5 — admission gate / implementation readiness review

Status: **review only.** No production code, generated code, registry
definition, UI, API contract, dependency, credential or provider adapter was
modified. No credential obtained. No provider API polled. No site scraped.

Reviewed at `6a55164`. Date: 2 October 2026.

This document does not admit anything. It establishes what *would* have to be
true before the C4-approved Australian capabilities could be implemented
without breaking the existing admission model.

---

## A. Current repository state

| Commit | Content |
|---|---|
| `917a039` | Weather surface renderer on the physical globe |
| `5324cb2` | Arena OS connector, mobile-first, visual identity directives |
| `a5cd632` | C3 closed — provider-owned CRS authority, geography tests, failure semantics, WebGL containment |
| `6a55164` | C4 Australian weather admission research (documentation only) |

Gates at this commit: typecheck 0 errors · API 118/118 · frontend 226/226 ·
API build · frontend build · `verify:desktop` · `verify:pwa` ·
`verify:radar` "Contract held". `main.rs` untouched.

### What already exists and is reusable

- `LayerKind` = `observation | imagery | field`; `LayerCapabilities` with the
  C3 split (`globe` means markers for observation layers, surface for spatial
  layers; `inspector` and `sampling` rejected for spatial).
- `SpatialProduct` carrying `providerId`, `providerName`, `sourceUrl`,
  `licence`, `attribution`, `coverage.areas`, three separate timestamps,
  `refreshIntervalMs`, `staleAfterMs`, `availability`, `message`.
- `SpatialAvailability` already includes **`unconfigured`** — "admitted but
  not configured in this deployment".
- `SpatialImageryService.supportedCrs` — provider-advertised projections
  (added at `a5cd632`).
- `SpatialFieldDescriptor` — **declared, design-only, no implementation.**
- Weather panel already iterates `products.map(...)` and already renders
  `{attribution} ({licence})` per product.
- A **working credential precedent**: `readTfnswApiKey(env)` returns null when
  absent, and the provider reports `status: "unconfigured"` with an
  explanatory message rather than erroring.
- Single-flight metadata cache in `weather-sources/registry.ts`.
- Service worker is self-destroying; `verify-pwa.mjs` enforces that the only
  runtime route is network-only API and that **no caching route may capture
  provider imagery**.

---

## B. C4 decisions actually supported by the research

Restated at the precision the research supports — nothing promoted.

| Provider | Capability | Disposition | What the research actually established |
|---|---|---|---|
| BOM | Radar imagery | **EXCLUDE / REFERENCE ONLY** | Paid subscription + data licence agreement, quoted verbatim |
| BOM | Satellite, grids, real-time | **EXCLUDE / REFERENCE ONLY** | Paid real-time data service |
| BOM | Free text products | **RESEARCH** | Free but non-commercial; "must not supply to any other person" unresolved against redistribution |
| DPIRD | WA station observations | **ADOPT WITH CONDITIONS** | CC BY 3.0 AU; non-transferable key; direct server calls |
| DPIRD | Rainfall accumulation ("Radar API") | **ADOPT WITH CONDITIONS**, as **derived field / observation** | Point-query numeric rainfall, not reflectivity |
| SILO | National historical climate | **ADOPT WITH CONDITIONS** | CC BY 4.0; **daily, to yesterday** |
| Open-Meteo | Forecast / model fields | **ADOPT WITH CONDITIONS** | CC BY 4.0; free tier non-commercial; published numeric limits |
| Himawari-9 (NOAA/AWS) | Satellite imagery | **RESEARCH** | Licence favourable; netCDF processing chain unproven |
| State CAP-AU | Warnings | **RESEARCH** | Only ACT licence confirmed; NSW SES integrity condition |
| AGCD | Historical grid | **RESEARCH** | CC BY-**NC**; historical |

Three things the research did **not** establish, and which must not be
assumed:

- Whether DPIRD publishes any reflectivity **image** product — `UNKNOWN`.
- DPIRD rate limits — `UNKNOWN`.
- SILO fair-use numeric limits — `UNKNOWN`.

---

## C. Proposed implementation boundary for C5

**In scope, if approved:**

1. DPIRD WA station observations — user-supplied credential only.
2. DPIRD rainfall accumulation — classified and labelled as a derived field.
3. Open-Meteo modelled fields for Australia — labelled as model output.
4. The Australian radar-absence presentation (see §G).

**Deliberately out of scope for C5**, even though C4 marked them
ADOPT WITH CONDITIONS:

5. **SILO.** Admitted, but it is daily historical data and Signalwatch has no
   historical-context surface to put it in. Implementing it now would force
   either a misleading placement beside live data or an invented UI. It
   should follow a deliberate "historical context" capability, not lead it.

**Recommended reduction:** C5 should probably be *smaller still* — DPIRD
observations plus the radar-absence presentation only, with Open-Meteo fields
as C5b. The reason is in §D.1: fields require a renderer that does not exist,
which is a much larger change than adding a provider.

---

## D. Required architectural changes

These are prerequisites, not implementation. Each is a real gap found by
inspection.

### D.1 Field rendering does not exist — the largest gap

`SpatialFieldDescriptor` is explicitly "DESIGN ONLY in this batch. No GRIB2
decoder, no GFS ingestion and no field provider exists."

There is **no field renderer** on the 2D map and **none on the globe**. The
C3 surface renderer projects *imagery* — a WMS texture on a lat/lng patch. A
numeric field is not that: it needs a value→colour mapping, a legend, unit
handling, and a decision about whether it is drawn as a raster, isolines or
particles.

Implication: "add Open-Meteo" is not a provider task. It is a **new render
pipeline** plus a provider. That is C5-sized on its own.

### D.2 Cache TTL is global, not per-product

```
const CACHE_TTL_MS = REFRESH_INTERVAL_MS;   // NOAA's 10 minutes
```

One TTL governs every loader. Cadences differ sharply: DPIRD uploads roughly
every 6 minutes, Open-Meteo models run 4×/day, SILO is daily. A single TTL
would either over-request the slow providers or under-refresh the fast ones —
and over-requesting is an appropriate-use problem, not merely waste.

`SpatialProduct.refreshIntervalMs` **already exists per product**, so the fix
is to drive expiry from it rather than from a module constant. Required
before a second provider with a different cadence is added.

### D.3 The data path changes, and so does the retention obligation

| | NOAA radar (today) | DPIRD (proposed) |
|---|---|---|
| What the API server fetches | capabilities metadata | **the observation values** |
| What is cached server-side | metadata only | **provider data** |
| What the browser fetches from the provider | the imagery, directly | nothing |
| Retention obligation | none asserted | **upstream removal must propagate** |

This is a category change. Today Signalwatch can truthfully say it never
caches provider content — only metadata. DPIRD's terms *require* direct
server calls, so the values must pass through and be cached, and DPIRD's
removal clause makes that cache a **lease, not a store**.

Nothing in the codebase currently expresses "this cached provider data must
be dropped when upstream withdraws it". That concept has to be designed —
minimally, a short TTL with no stale-serving fallback, so withdrawal
propagates within one cycle. **A stale-while-revalidate strategy would be
non-compliant here**, which is worth stating because it is the usual instinct.

### D.4 Layer kind and product kind are not reconciled

- Registry: the `weather` layer is `kind: "imagery"`.
- API: `SpatialProduct.kind` is `"imagery" | "field"`.
- **Nothing validates one against the other** (searched; no such check).

So a field product could already be returned under an imagery layer with no
error. Before fields are added, a decision is needed:

- **(a)** separate layers — e.g. `weather-radar` (imagery) and
  `weather-fields` (field); clean kinds, more layers; or
- **(b)** allow a layer to host multiple product kinds, and make the layer's
  `kind` describe its *primary* class.

(a) fits the existing capability model better, because `capabilities` are
declared per layer and a field surface and an imagery surface will not want
identical capabilities. (b) matches the user-facing idea of one "Weather"
layer. This is a genuine design decision and should be made explicitly, not
discovered during implementation.

### D.5 Credential surface — exists for servers, absent for the product

`readTfnswApiKey` reads `process.env.TFNSW_API_KEY`. The Tauri shell spawns
the sidecar with `PORT`, `NODE_ENV`, `HOST` and **no `env_clear()`**, so the
child inherits the parent environment and a user-set `DPIRD_API_KEY` would
reach it.

That is technically sufficient and practically poor: "set a system
environment variable before launching the app" is not a credential surface
for a desktop product. There is no settings UI, no key entry, no storage, and
no way to tell the user whether their key is working beyond the
`unconfigured` message.

See §F for the mobile case, which is worse.

### D.6 Licence reproduction is a product surface, not a label

The panel renders `{attribution} ({licence})` per product — good, and enough
for CC BY attribution.

DPIRD additionally requires that the API User "**reproduce the above licence
(and its link) as part of its own terms and conditions**". Signalwatch has no
terms-and-conditions surface at all. That is a new product artefact, not a
string in a map corner.

---

## E. Provider-by-provider implementation prerequisites

### DPIRD (WA observations + rainfall accumulation)

1. Read the OpenAPI specs at `api.agric.wa.gov.au/v2/weather/openapi/` and
   `/v2/radar/openapi/` to establish: whether any image product exists, rate
   limits, field names, units, freshness semantics, error shapes.
2. Decide the taxonomy placement. Station observations are **observations**
   (point records with coordinates) — which would make DPIRD a provider for
   an *observation* layer, not the spatial weather layer. Rainfall
   accumulation is a **derived field**. These may belong in different places.
3. Per-user credential design (§F).
4. Per-product cache TTL (§D.2) and the retention policy (§D.3).
5. CC BY 3.0 AU reproduction in a terms surface (§D.6).
6. Coverage must be declared as **Western Australia only**, with the same
   discipline as NOAA's five areas — never widened to "Australia".

### Open-Meteo (modelled fields)

1. Field render pipeline (§D.1) — the dominant cost.
2. Model provenance must be carried and displayed: model id, run time,
   resolution, forecast horizon. `SpatialFieldDescriptor` already has
   `modelId`, `runId`, `resolutionDegrees`, `unit`, `missingValue`.
3. Request budget tied to model run cadence, not to UI events — the same
   discipline `imageryRenderSignature` and `globeImagerySignature` already
   enforce for imagery.
4. **No ACCESS-G dependency.** C4 recorded BOM open-data delivery as
   temporarily suspended. If ACCESS-G is used at all it must be one model
   among several, degrading to a global model rather than failing.
5. Attribution must be the specific required link, not a plain string.
6. Non-commercial boundary recorded as a product-level condition (§F).

### SILO — deferred, see §C.5.

---

## F. Credential and licensing implications

### F.1 The mobile problem is structural, not cosmetic

DPIRD grants rights "strictly limited to making **direct server calls** to
the API using the API Key", and the key is non-transferable.

- **Desktop (Tauri):** the sidecar is the user's own local server, running on
  their machine, using their own key. Compliant.
- **Browser PWA / phone:** there is no local server. The frontend reaches an
  API origin via `window.__SIGNALWATCH_API_BASE__` or `VITE_API_BASE_URL`. On
  a phone that origin would have to be **hosted**, and a hosted Signalwatch
  calling DPIRD would be making calls with *somebody's* key on behalf of many
  users — which is either a shared operator credential (**forbidden by this
  instruction**) or an unacceptable key-forwarding arrangement.

**Conclusion: DPIRD cannot be a phone capability under the current
architecture and the current terms.** It is desktop-only.

This does not violate the mobile-first constraint, but it must be handled the
way that constraint requires: the phone experience must **degrade honestly**
to `unconfigured` — "DPIRD observations require your own API key and a local
Signalwatch instance" — and must never be broken, hidden, or silently empty.
The existing `unconfigured` availability state and the TfNSW message pattern
are exactly the right vehicle.

### F.2 Non-commercial is a product-level condition

Open-Meteo's free tier is non-commercial only; BOM's free text products are
"not for commercial use"; AGCD is CC BY-NC. The $0 Australian stack holds
only while Signalwatch has no subscriptions and no advertising.

This should be recorded as a standing product condition, not as a comment in
a provider file, because it constrains the *product*, not the integration.

### F.3 Credential ownership rules for any C5 implementation

- Per-user credential ownership. No bundled key. No shared operator key. No
  key committed, defaulted, or embedded in a build.
- The key must never reach the browser; it is used server-side only.
- Absent key ⇒ `unconfigured`, with a message naming what is missing and
  stating that other providers are unaffected. Never an error, never silence.
- Revocation path: the user must be able to remove the key and have the data
  disappear.

---

## G. Provenance and UI requirements

These are preservation requirements, not new features.

1. **Australia must state the radar absence.** With no admitted Australian
   radar source, the Australian presentation must say *"No radar source
   here"*, exactly as the Pacific does today. The canonical wording already
   exists and ends *"…and that is not a report that conditions are clear."*
2. **Evidence classes must stay visually and textually distinct:**

   | Class | Example | Must read as |
   |---|---|---|
   | Instrument observation | NOAA radar | measured |
   | Derived field | DPIRD rainfall accumulation | computed from instruments |
   | Modelled field | Open-Meteo precipitation | predicted |
   | Historical climate | SILO | past, not now |
   | Warning | state CAP | an authority's statement |

3. **The specific prohibited outcome:** Open-Meteo precipitation rendered
   over Australia in a way a user could mistake for radar. No radar-like
   colour ramp, no "radar" label, no placement in a radar slot, no silent
   substitution when radar is absent. A modelled field must carry its model
   id and run time where the user can see them.
4. The three-axis badge rule (`admitted` / `reachable` / `active`) continues
   to apply; collapsing any pair produces a specific lie.
5. 2D and globe may differ by projection but must not disagree on source,
   timestamp, coverage, frame or attribution — the C3 invariant extends to
   any new product.

---

## H. Cache and data-retention implications

| Provider | Server-side cache | Retention constraint |
|---|---|---|
| NOAA radar | metadata only | none asserted; imagery never cached, browser-direct |
| DPIRD | **data values** | **upstream removal must propagate**; short TTL, no stale-serving |
| Open-Meteo | data values | CC BY 4.0 permits caching; budget tied to run cadence |
| SILO | data values | CC BY 4.0 permits caching; daily cadence |

Two standing constraints that must not be weakened:

- The service worker must continue to cache **no** provider content;
  `verify-pwa.mjs` enforces this and must keep passing.
- The single-flight pattern must be preserved so N clients cause at most one
  upstream request per cycle.

---

## I. Mobile and PWA implications

1. DPIRD is **desktop-only** (§F.1) and must degrade to `unconfigured` on
   phones, not break.
2. A field renderer must not become a WebGL dependency. The C3 containment
   result — weather cannot become a dependency of the non-WebGL path — has to
   hold for fields too, including a 2D fallback.
3. Field data is heavier than imagery metadata. Payload size, request
   frequency and battery-conscious refresh all apply, per the mobile-first
   constraint.
4. No background polling may be assumed alive; state must be reconstructable
   on resume without a catch-up stampede against a provider.

---

## J. Unresolved questions that could materially change the implementation

| # | Question | Why it matters |
|---|---|---|
| 1 | Does DPIRD publish any reflectivity **image** product? | Would change DPIRD from field-only to a possible WA imagery source, altering the whole Australian radar story |
| 2 | DPIRD rate limits | Determines cache TTL and whether per-user keys are even workable at scale |
| 3 | Are DPIRD station observations **observations** or a spatial product? | Decides whether DPIRD joins an observation layer or the spatial weather layer — different pipelines entirely |
| 4 | Layer-kind decision (§D.4) — separate layers or multi-kind layer? | Shapes the registry, the panels and the capability declarations |
| 5 | Is Signalwatch definitively non-commercial? | Open-Meteo free tier and BOM text products both depend on it |
| 6 | How does a desktop user actually enter a credential? | No settings surface exists; env var is not a product answer |
| 7 | SILO fair-use numeric limits | Unknown; affects any future historical capability |
| 8 | Has BOM open-data delivery resumed? | Determines whether ACCESS-G is available at all |

Questions 1, 3, 4 and 6 are **blocking**: each would change the shape of the
code, not just its parameters.

---

## K. Explicitly excluded work

- BOM radar, satellite, forecast grids, real-time services — no ingestion, no
  proxy, no scraping, no workaround of licence, access, rate-limit or
  anti-scraping restrictions.
- Any visually similar substitute that could be mistaken for BOM radar.
- Any fallback that conceals the absence of Australian radar.
- Hosted or shared credential architecture of any kind.
- Himawari-9, state CAP-AU warnings, AGCD, BOM free text products — all
  remain RESEARCH.
- Paid services of any kind.
- Promotion of any `RESEARCH` or `UNKNOWN` finding to `ADOPT`.

---

## L. Proposed implementation sequence for C5

Ordered so each step is independently verifiable and nothing depends on an
unresolved question.

| Step | Work | Gated on |
|---|---|---|
| **C5.0** | Resolve blocking questions 1, 3, 4, 6 (§J). Documentation only. | — |
| **C5.1** | Per-product cache TTL from `refreshIntervalMs`; retention/withdrawal policy expressed in code. No new provider. | — |
| **C5.2** | Credential surface: per-user key entry, storage, `unconfigured` reporting, revocation. No provider. | Q6 |
| **C5.3** | DPIRD provider: observations + rainfall accumulation, WA-only coverage, CC BY 3.0 AU, desktop-only with honest mobile degradation. | C5.1, C5.2, Q1, Q2, Q3 |
| **C5.4** | Australian radar-absence presentation verified by acceptance test. | C5.3 |
| **C5.5** | Terms surface reproducing CC BY 3.0 AU. | C5.3 |
| **C5b.1** | Field render pipeline — value→colour, legend, units, 2D + globe, non-WebGL fallback. No provider. | Q4 |
| **C5b.2** | Open-Meteo fields with model provenance displayed; never radar-like. | C5b.1, Q5 |
| **C6** | SILO historical context, once a historical surface exists. | — |

C5.1 and C5.2 are the honest starting point: both are prerequisites, neither
admits a provider, and both are verifiable on their own.

---

## M. Approval required before any code is written

No code may be written on the strength of this review. The following are
needed explicitly, and separately:

1. **Per-provider, per-capability admission decisions.** "ADOPT WITH
   CONDITIONS" in C4 is a research disposition, not an admission. Required
   for: DPIRD observations; DPIRD rainfall accumulation; Open-Meteo fields.
   Each is a separate decision.
2. **Answers to the four blocking questions** (§J 1, 3, 4, 6), or explicit
   authorisation to resolve them as documentation-only research first.
3. **A decision on the C5 scope reduction** proposed in §C — whether C5 is
   DPIRD-only with Open-Meteo deferred to C5b.
4. **Confirmation of the non-commercial position** (§F.2), since two
   providers depend on it.
5. **Acceptance that DPIRD is desktop-only** under current terms (§F.1), with
   honest mobile degradation rather than a hosted workaround.

Nothing in C4 or this review authorises implementation. The research document
does not become code by default.

**STOP. Awaiting explicit implementation approval.**
