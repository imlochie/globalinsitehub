# Signalwatch — future concepts backlog

**Nothing in this file is implemented, and nothing here is a layer.**

This is an idea vault. It exists so that interesting product directions are
preserved in the architecture record without quietly becoming operational
features. A concept in this file has **no** entry in `layerRegistry`, no
provider module, no endpoint, no marker, and no generated client type.

Last updated 2026-09-30.

---

## How a concept leaves this file

A concept only becomes a Signalwatch operational layer after passing the same
provider gate every existing layer passed:

```text
source legitimacy
+ licence / public-use rights
+ technical feasibility
+ freshness
+ coverage
+ $0 recurring-cost requirement
+ privacy / safety review where relevant
```

Until every applicable line is satisfied with first-party evidence, the concept
stays here. "The endpoint responds" is not feasibility, and "it's open data" is
not a licence.

### Status vocabulary

| Status | Meaning |
| --- | --- |
| `IDEA` | Captured. No research done yet. |
| `RESEARCHING` | Actively being investigated; no provider selected. |
| `CONDITIONAL` | A path exists but depends on an unresolved condition. |
| `READY` | Gate passed with evidence; safe to schedule implementation. |
| `IMPLEMENTED` | Shipped as a real layer, with tests and documentation. |
| `BLOCKED` | A specific, recorded obstacle prevents progress. |

`OPERATIONAL` is deliberately **not** in this vocabulary. It is reserved for
`LayerDefinition.status` and is only ever earned by a verified provider
implementation.

### Backlog at a glance

| # | Concept | Prospective layer name | Status |
| --- | --- | --- | --- |
| 1 | Local registry / civic assets | `Registry / Civic Assets` | `IDEA` |
| 2 | Conflict-affected camera coverage | *(research output only)* | `IDEA` — research-only |
| 3 | Vehicle / traffic intelligence | `Traffic Intelligence` | `IDEA` — restricted, gated |

---

## Concept 1 — Local Registry / Civic Assets

**Status:** `IDEA`
**Prospective layer name:** `Registry / Civic Assets`

### Working idea

> Explore whether Signalwatch can map publicly registered assets or entities
> within a city or region.

**"Registered" is deliberately undefined.** Pinning the meaning now would
prematurely narrow the concept to whichever dataset happened to be examined
first. The definition is an output of the research, not an input to it.

The genuinely interesting idea here is not another live feed. It is a
**registry-of-registries**: a way to describe, compare and present many
heterogeneous public registers through one honest model. That is an
architectural question before it is a data question.

### Categories that might qualify (none selected)

- registered aircraft
- registered vessels
- public infrastructure
- licensed businesses
- public facilities
- road / traffic assets
- other legally published registries

### Research questions

1. What public registries actually exist, per jurisdiction?
2. What geographic precision does each provide — point, parcel, street,
   suburb, postcode, or none at all?
3. Is each genuinely open data, with redistribution rights, or merely
   *viewable*?
4. May individual records be displayed publicly, and at what granularity?
5. Is the register current, periodically snapshotted, or historical?
6. **What does "registered" mean in that specific dataset?** Licensed? Owned?
   Approved? Inspected? Merely listed? These are not interchangeable.
7. Can multiple registries be combined without creating misleading composite
   records — and if identity cannot be reconciled across registers, is keeping
   them separate the honest answer?

### Known risks to address before this becomes a layer

- **Precision inflation.** Many registers publish an address, not a coordinate.
  Geocoding an address produces a *derived* point, and the existing rule
  applies: derived locations must be flagged, never presented as surveyed.
- **Staleness presented as currency.** A register updated annually must never
  render like a live feed.
- **Personal information.** Some registers (e.g. business or vessel
  registration) contain names and addresses of individuals. A privacy review is
  required before any such register is displayed, even where publication is
  lawful.
- **Semantic collision.** "Registered" meaning different things in different
  registers is exactly the kind of fusion the project has repeatedly refused.

### Explicitly not decided

No registry, jurisdiction, provider or schema has been selected.

---

## Concept 2 — Conflict-Affected Camera Coverage

**Status:** `IDEA` — **research-only**
**Prospective layer name:** none. This concept's output is a research record,
not necessarily a map layer.

### Working idea

> Understand where publicly documented camera infrastructure exists in
> countries or regions affected by armed conflict.

The intent is **situational-awareness research about public camera coverage**
— i.e. understanding what the public record says about where documented camera
infrastructure exists, and how reliable that record is. It is a question about
*public-source metadata and provenance*.

### Hard boundaries

This concept must not produce, and Signalwatch must not implement:

- targeting support of any kind
- military or paramilitary surveillance workflows
- live identification of sensitive facilities
- tactical recommendations
- camera exploitation, or any circumvention of access controls
- instructions for accessing restricted, private or non-public feeds

These are not deferred features. They are out of scope permanently.

### Potential future output shape

```text
Camera coverage
Public / documented
Country / region
Provider
Source type
Last documented availability
```

Note the granularity: **country / region**, provider, and source type. This is
catalogue-level metadata about the public record, not a site-level inventory.

### Guiding constraint

Do not expose sensitive or operationally useful targeting detail beyond what is
necessary for legitimate public-source cataloguing. Where the honest answer to
"should this be shown at this precision?" is unclear, it is not shown.

### Research questions

1. What public, documented sources describe camera infrastructure in these
   regions, and who publishes them?
2. What is the provenance and age of each claim — is "documented" the same as
   "currently existing"?
3. Which sources are legitimately public, and which merely leaked or scraped?
   (The latter are not usable.)
4. Is aggregate, region-level reporting sufficient to serve the legitimate
   research purpose without site-level detail?
5. Does displaying this information create foreseeable harm that outweighs its
   informational value? If yes, it stays a research record and never becomes a
   layer.

### Relationship to the existing cameras layer

Unrelated and must stay unrelated. The operational `cameras` layer is a
catalogue of public traffic cameras published by transport authorities in
Australia and via OpenTrafficCamMap. It is not modified, extended or
repurposed by this concept.

---

## Concept 3 — Vehicle / Traffic Intelligence

**Status:** `IDEA` — **restricted concept, requires a separate privacy/safety
and data-rights gate before any development**
**Prospective layer name:** `Traffic Intelligence`

Deliberately **not** named "Number Plate Identification". The name states what
the concept may legitimately become, not the capability that prompted it.

### Working idea

> Explore what useful traffic intelligence can be derived from public camera
> systems without turning Signalwatch into a persistent vehicle-identification
> system.

### Prohibited — not deferred, prohibited

Signalwatch must not build:

- automated number-plate recognition (ANPR/ALPR) or plate OCR
- plate databases
- persistent plate histories
- cross-camera vehicle tracking
- identity matching
- person or vehicle dossiers

A system that can follow a specific vehicle across cameras over time is a
surveillance system. That is not what this product is, and no amount of
incremental feature work should be allowed to arrive there by accident.

### Potentially acceptable future directions

- vehicle counts
- vehicle-class distributions (e.g. car / truck / bus)
- congestion estimation
- traffic-flow analysis
- anonymized vehicle movement statistics
- detecting *whether a feed supports plate visibility*, as a metadata property,
  **without extracting plates**

The distinguishing test: does the output describe **traffic**, or does it
describe **a vehicle**? Aggregate, non-identifying, non-persistent measures
describe traffic. Anything that can be re-linked to one vehicle or person does
not.

### Additional considerations recorded now

- **Aggregates can still re-identify.** A "count" at a lightly trafficked rural
  camera can be effectively identifying. Any aggregation scheme needs a minimum
  cell size and a retention limit, decided before implementation.
- **Derived data may exceed the source licence.** A camera licence permitting
  display does not automatically permit computer-vision analysis or derived-data
  publication. That is a distinct rights question per provider.
- **Signalwatch does not currently proxy camera imagery at all** — the cameras
  layer is a catalogue and never probes or proxies an individual feed. Any
  analysis concept would require changing that posture, which is itself a
  significant architectural and cost decision, not a detail.
- **$0 invariant still applies.** Inference at scale implies compute cost.
  A concept that only works with paid inference fails the existing
  cost constraint.

### Gate

Any future implementation requires a **separate privacy/safety and data-rights
review**, passed and recorded, *before* development begins — in addition to the
standard provider gate.

---

## Cross-cutting rules for everything in this file

These concepts do **not** automatically become entries in `layerRegistry`.
Specifically, while a concept lives here:

- no `LayerDefinition` is registered, not even as `planned`
- no provider module, endpoint, OpenAPI schema or generated client type exists
- no mock providers, fake markers or placeholder live feeds are added
- no accounts are created, no services purchased, no paid APIs introduced
- existing operational layers are not altered
- Aircraft and Maritime statuses are unchanged
- number-plate recognition is not implemented
- conflict-zone surveillance functionality is not built

The purpose of this file is to preserve ideas in the project architecture so
they can be researched properly later — and to make sure the step from
*interesting idea* to *shipped capability* stays a deliberate, reviewed
decision rather than a gradual drift.
