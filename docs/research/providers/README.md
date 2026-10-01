# Provider records — document class index

Two different kinds of document live in this directory, and they carry very
different authority. This index exists so the distinction survives a glance
at the directory listing, not just a careful read of a file.

**An admission record authorizes. A research corpus does not.**

Every file also states its own status in its own first lines; where this
index and a document disagree, the document is authoritative and this index
is stale.

---

## Admission records

A provider and capability have been assessed against documented provider
semantics and a decision recorded. The `Status` line inside each file is the
operative one — note that two of these are conditional and their conditions
are **not** met, which means no adapter may be written for them.

| Document | Provider / capability | Status |
|---|---|---|
| `nws-radar-wms-admission.md` | NOAA/NWS radar base reflectivity (WMS) | **ADOPT** — implemented, awaiting operational sign-off |
| `hk-td-traffic-snapshots-admission.md` | Hong Kong TD traffic snapshot images | **ADOPT** — implemented |
| `nasa-firms-admission.md` | NASA FIRMS active fire | **ADOPT** — keyless bulk download path |
| `openaq-admission.md` | OpenAQ air quality | **ADOPT WITH CONDITIONS** — no code |
| `adsblol-aircraft-admission.md` | ADSB.lol aircraft | **ADOPT WITH CONDITIONS** — conditions **not met**; operator inquiry **not sent** |
| `rijkswaterstaat-cameras-exclusion.md` | Rijkswaterstaat cameras | **EXCLUDE for ingestion** |

## Verification records

Evidence that an admitted provider behaves as its admission claimed. Not an
admission in itself.

| Document | Covers |
|---|---|
| `nws-radar-operational-verification.md` | NOAA radar — admitted and implemented, **awaiting operator sign-off**; Windows checks A–H pending |

## Research corpora — NOT admissions

Findings only. These do not authorize implementation, provider registration,
credential use, ingestion, rendering or redistribution. An explicit
provider/capability admission is required first, and a disposition recorded
here is a research outcome, not permission.

| Document | Covers |
|---|---|
| `australian-weather-admission-research.md` | C4 — Australian weather sources. BOM, DPIRD, SILO, Open-Meteo, Himawari-9, state CAP-AU, AGCD |

Related, outside this directory:

- `../c5-readiness-review.md` — implementation readiness review. Also **not**
  an admission.

---

## The rule this index encodes

`ADOPT WITH CONDITIONS` is not `ADOPT`. `RESEARCH` is not `ADOPT`. `UNKNOWN`
is not permission. A research document does not become code by default, and
a disposition recorded during research does not become an admission by
being convenient.

The chain, in full:

```
provider documentation / advertised capability
  → admission decision
  → normalized provider capability
  → renderer / application may consume it
```

It is never inverted. A renderer preference, a convenient endpoint, observed
behaviour, undocumented compatibility, or a successful HTTP request does not
establish a provider capability.
