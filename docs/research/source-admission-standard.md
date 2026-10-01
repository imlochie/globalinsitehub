# Signalwatch source-admission standard

**This is a permanent architectural standard, not a research note.** It
governs how any data source becomes part of Signalwatch.

It exists because the OSIRIS audit produced the same failure mode repeatedly:
a source that is technically reachable, described as "open", and already in
use by someone else — yet not actually licensed for what Signalwatch would do
with it.

Established 2026-09-30, from the QLDTraffic camera work, the OSIRIS audit
(`osiris-source-audit.md`) and the aircraft provider admission
(`aircraft-provider-admission.md`).

---

## The five invariants

### 1. Technical accessibility is not permission

An endpoint that returns 200 has told you nothing about whether you may use,
cache, display or redistribute what it returned.

*Evidence this matters:* ADSB.fi serves its public API without a key and
advertises "open and unfiltered access to worldwide air traffic data", while
its own documentation restricts use to "personal, non-commercial use only".

### 2. Another project's implementation is not upstream authorisation

That a third-party repository consumes a provider is a lead for research, never
evidence of permission. Other projects may have terms you don't, may be
operating outside the terms, or may simply not have checked.

*Evidence this matters:* OSIRIS consumes `opendata.adsb.fi/api/v2` directly,
against that provider's written restriction.

### 3. A disguised or proxied request is not acceptable provenance

If a source only yields data to a client that misrepresents itself, the
provider has not consented to automated access, and the retrieval proves
nothing except that the control was evaded.

*Evidence this matters:* OSIRIS's `stealthFetch` rotates fake browser
User-Agents and fabricates a residential IP injected as `X-Forwarded-For` and
`X-Real-IP` to "distribute API requests". Every provider it reaches that way
must be re-verified with an honest, self-identifying request before adoption.

Signalwatch does the opposite by design: the Digitraffic adapter sends an
identifying `Digitraffic-User` header because the provider asks to be able to
identify its callers.

**Corollary — the evasion test.** If an adapter stops working when it
identifies itself honestly, that is a rejection signal, not a bug to fix.

### 4. Capability is earned from the documented provider contract

What Signalwatch claims a source *is* must come from what the provider
documents, never from what an adapter can technically retrieve or infer.

*Evidence this matters:* QLDTraffic earns `live-image` because specification
v1.10 §4.5 defines `image_url` as "the most current web camera image (JPEG
format)". A URL that merely ends in `.jpg` earns nothing.

This is why `viewCapability` is provider-declared via `documentedAs` rather
than sniffed, and why `catalogue-only` is the default.

### 5. Unknown stays unknown

Licence, rate limits, retention rights and redistribution rights are
**unknown** until read in a primary source. An empty cell marked *unresolved*
is a correct answer. A plausible guess is a liability.

*Evidence this matters:* ADSB.lol publishes no rate limit at all. The honest
record says so, and that gap is what blocks implementation — not a guessed
"probably one request per second".

---

## The admission test

A source is admitted only when each line is answered from a primary source.

```
identity          who operates it, and which exact API surface
access            key? account? feeder? IP restriction? production-use terms
cost              $0 indefinitely, or a tier that becomes paid at real workload
licence           copyright, database rights, share-alike, attribution wording
rights            public display, caching, retention, redistribution, commercial
limits            documented rate limits and acceptable polling
semantics         what the fields actually mean; observation vs receipt time
coverage          real extent, and the honest phrasing for it
provenance        upstream of the upstream; any extra attribution it drags in
privacy/safety    provider restrictions, and Signalwatch's own posture
```

### Access vocabulary

"Public" is too coarse. Record access as its components, because they have
different consequences:

```
access:        none | published_key | issued_key | account | feeder | ip_allowlist
registration:  none | free_account | approved_application | contact_required
cost:          none | free_tier_capped | paid
```

Worked examples already in the codebase:

| Provider | access | registration | cost |
| --- | --- | --- | --- |
| USGS | none | none | none |
| NASA EONET | none | none | none |
| QLDTraffic | published_key | none | none |
| Transport for NSW | issued_key | free_account | none |
| BarentsWatch | issued_key | free_account | none |
| ADSB.lol | none (today) | contact_required for production | none |

Collapsing any of those into "public" would lose the thing that actually
decides admissibility.

### Credential distribution check

Signalwatch's desktop package **bundles the API server and ships it to end
users**. A credential placed in configuration therefore travels to every
user's machine.

So for any keyed provider, ask before cost:

> Is the credential transferable, and is it bound to an individual?

If it is non-transferable, **one design is ruled out and the provider usually
is not**: never bundle a key in the distributed package. The resolutions, in
the order to prefer them:

1. **User-supplied credential.** The operator or desktop user registers their
   own key and configures it; the provider reports `unconfigured` when absent
   and every other provider is unaffected. This honours "one individual, one
   key" rather than circumventing it, and it is the established Signalwatch
   pattern (`TFNSW_API_KEY`, `BARENTSWATCH_CLIENT_ID`).
2. **Hosted-only deployment**, where the credential stays with one operator.
   Accept consciously that the source is then absent from the desktop
   package — a coverage inconsistency, not a feature.
3. **Exclude**, only when neither works.

OpenAQ is the worked example, and a cautionary one: it was first recorded here
as EXCLUDE on the assumption that bundling was the only way to supply a key.
That was wrong, and the correction is the reason this check now lists
resolutions rather than a verdict. A provider that looks architecturally
incompatible deserves the same evidence standard as one that looks
convenient.

### Statuses

```
ADOPT                  all material questions answered and compatible
ADOPT WITH CONDITIONS  viable once a specific documented condition is met
RESEARCH               promising; one or more material questions unresolved
DEFER                  usable but not worth it yet
EXCLUDE                incompatible with cost, licence, safety or architecture
```

`ADOPT WITH CONDITIONS` does **not** authorise implementation. The conditions
must be satisfied and recorded first.

---

## Standing prohibitions

Independent of any individual source:

- No active scanning, probing, credential discovery or exploitation.
- No circumventing authentication, rate limits or access controls — including
  by header spoofing, IP rotation or scraping a UI to avoid a documented API
  limit.
- No proxying provider media through infrastructure Signalwatch pays for, or
  through a third party's.
- No paid APIs, usage-based billing, or free tiers that become paid at real
  workload.
- No runtime dependency on another aggregator in place of the upstream source.
- No presenting static reference data as live observation.

---

## What admission produces

Every admitted source keeps, per record:

```
provider · source URL · licence and attribution · coverage
observation type · observation time vs receipt time · availability state
```

And per layer: coverage derived from the providers that actually answered,
honest degradation when one fails, and no invented severity, confidence or
ranking that fuses provider-native classifications.

---

## Where the records live

```
docs/research/source-admission-standard.md     this document
docs/research/<domain>-provider-admission.md   per-domain investigation
docs/research/<domain>-provider-matrix.md      per-domain matrix
docs/research/providers/<provider>-*.md        per-provider decision record
research/*.md                                  earlier records, same standard
```
