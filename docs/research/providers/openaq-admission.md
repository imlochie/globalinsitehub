# OpenAQ — air quality provider admission record

**Status: ADOPT WITH CONDITIONS.** Researched 2026-09-30, revised the same day
against Signalwatch `1869107`, under `source-admission-standard.md`.

> **Correction of record.** An earlier revision of this file recorded
> **EXCLUDE**, reasoning that OpenAQ's non-transferable individual API key was
> incompatible with a desktop package that ships the API server to end users.
> That reasoning assumed the only way to supply a key is to bundle one in the
> installer. It is not. A **user-supplied** key is both compliant with
> OpenAQ's "one individual, one key" rule and already an established
> Signalwatch pattern (`TFNSW_API_KEY`, `BARENTSWATCH_CLIENT_ID`). The
> EXCLUDE was wrong and is withdrawn.

---

## 1. Two access paths, and they serve different purposes

| | Hosted v3 API | Open Data on AWS archive |
| --- | --- | --- |
| Endpoint | `api.openaq.org/v3` | `s3://openaq-data-archive`, also `https://openaq-data-archive.s3.amazonaws.com/` |
| Credential | **individual API key + account** | **none** — "AWS CLI Access (No AWS account required)", `--no-sign-request` |
| Content | current and historical measurements, locations, licences | daily gzipped CSVs per location |
| Layout | query API | `records/csv.gz/locationid={id}/year={y}/month={m}/location-{id}-{date}.csv.gz` |
| Latency | near real-time | daily files |
| Licence | per-source, exposed via API | "Varies, depends on data provider" |

**The archive does not replace the API for Signalwatch's use.** It is
partitioned *by location id*, so consuming it requires already knowing which
locations exist — discovery lives in the API. And it is a daily archive, not a
current-conditions feed. A live air-quality layer needs the hosted API; the
archive is a historical resource.

Worth recording anyway: it is a genuinely keyless, account-free bulk path, and
if Signalwatch ever wants historical air quality rather than current readings,
it avoids the credential question entirely.

*Evidence:* <https://registry.opendata.aws/openaq/>,
<https://docs.openaq.org/aws/about>, <https://docs.openaq.org/aws/quick-start>.

## 2. Access and cost

Verbatim, <https://docs.openaq.org/about/terms>:

> "For programmatic access to data on the OpenAQ Platform … users must
> register for an API key and account."
>
> "An individual is permitted to register for only one API key. An entity may
> have more than one user, and thus more than one API key, but may not use
> multiple accounts to over-consume our services."
>
> "Unauthorized use of your API key, including transfer to another user, is
> prohibited."

Free tier, <https://docs.openaq.org/using-the-api/rate-limits>:

| General use | Custom use |
| --- | --- |
| **Free** | Contact for pricing |
| **60 / minute, 2,000 / hour** | Higher limits |

Rate limits are "scoped to the user API key". The API returns
`x-ratelimit-limit`, `-used`, `-remaining`, `-reset` headers and a 429 on
exceed.

**Cost assessment:** Signalwatch polls server-side on a cache window, so a
single deployment makes a handful of requests per hour against a 2,000/hour
allowance. That is comfortably inside the free tier and does not trend toward
the paid tier with user growth, because users share one cached server-side
fetch rather than each calling OpenAQ. The $0 invariant holds.

## 3. The credential model, correctly understood

The key is personal and non-transferable. That rules out exactly one design —
**baking a key into the distributed installer** — and permits the one
Signalwatch already uses everywhere else:

```
OPENAQ_API_KEY absent   → provider reports `unconfigured`, contributes nothing,
                          every other provider unaffected
OPENAQ_API_KEY present  → the operator or desktop user supplies their own key,
                          registered to themselves
```

That is "one individual, one key" honoured, not circumvented. Signalwatch
never holds, ships or transfers a credential.

## 4. Per-source licensing — and the unusually good news

OpenAQ disclaims that its availability implies permission:

> "we provide no assurance that the data provided may be used free of any
> third-party claims… OpenAQ users must therefore review and comply with any
> terms published by data providers."

This is the WSDOT partner-camera hazard at the scale of hundreds of agencies.
**But OpenAQ exposes licence metadata as a first-class API resource**, which
no other provider in this project does. `GET /v3/licenses/{id}` returns:

```
id · name · commercialUseAllowed · attributionRequired
shareAlikeRequired · modificationAllowed · redistributionAllowed · sourceUrl
```

— <https://docs.openaq.org/resources/licenses>

That is, almost exactly, Signalwatch's own admission test expressed as data.
It makes per-location admission *programmatic* rather than aspirational: the
adapter can admit only locations whose licence permits what Signalwatch does,
and attach the correct per-location attribution and licence to each record
instead of one blanket claim.

This is the first provider where the per-source hazard is solvable in code
rather than by reading hundreds of terms pages.

## 5. The clause that still needs a human

> "utilizing our official, hosted API implementation to develop products or
> services that **substantially duplicate or directly compete with OpenAQ's
> core offerings** is prohibited."

OpenAQ operates OpenAQ Explorer, a map-based air quality browser. Signalwatch
is a multi-domain situational-awareness product in which air quality would be
one layer among cameras, vessels, hazards and civic incidents.

A reasonable reading is that an air-quality *layer* inside a broader product
is complementary rather than duplicative — the terms themselves ask users to
"do so in a manner that complements rather than replicates our primary
services". But that judgement belongs to OpenAQ, not to us, and the penalty
for getting it wrong is suspension.

**Unresolved. Must be settled with OpenAQ before shipping.**

## 6. Decision

**ADOPT WITH CONDITIONS.** Conditions, in order:

1. **Confirm the "substantially duplicate" position with OpenAQ**, describing
   the intended use plainly: one air-quality layer inside a multi-domain
   monitoring product, server-side cached, attributed. *Product-owner action.*
2. **User-supplied credential only.** `OPENAQ_API_KEY`, `unconfigured` when
   absent, never bundled, following the TfNSW pattern exactly.
3. **Admit per location from the licence metadata.** Consume `/v3/licenses`,
   and carry per-location licence, source attribution *and* OpenAQ
   attribution on every record. Exclude locations whose licence does not
   permit Signalwatch's use.
4. **Respect the documented limits** — 60/minute, 2,000/hour — and honour the
   considerate-use clause by not polling when the layer is disabled, which the
   existing layer-source enablement model already does.

No code until condition 1 is answered.

## 7. What this record changed about the standard

The credential distribution check added alongside the earlier EXCLUDE was
correct to exist but stated too narrowly: it offered only "hosted-only or
exclude". It now carries the third and usually correct resolution —
**user-supplied credentials** — with OpenAQ as the worked example of a
provider that looks incompatible and is not.
