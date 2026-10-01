# Camera provider admission — government programmes from the OSIRIS audit

Research record. **Nothing implemented.** Researched 2026-09-30 against
Signalwatch `e2140ad`, under `source-admission-standard.md`.

## Scope

The OSIRIS audit found three large government camera programmes implemented
*inline* in `cctv/route.ts` rather than as adapter files, which an
adapter-file listing had missed:

- **TfL JamCams** (London)
- **WSDOT** (Washington State)
- **Caltrans** (California)

All three are fetched by OSIRIS through `stealthFetch`, so **invariant 3
applies**: their accessibility under an honest, self-identifying request is
unverified, and OSIRIS's success with them is not evidence of permission.

These are the camera half of Batch A — a controlled test of whether the
admission framework that cleared QLDTraffic works across other providers.

---

## Status of this pass: incomplete, and deliberately so

**No primary-source terms were obtained for any of the three.** Recorded under
invariant 5 rather than filled with plausible text.

| Provider | Primary source attempted | Outcome |
| --- | --- | --- |
| TfL | `tfl.gov.uk/corporate/terms-and-conditions/transport-data-service` | **Not readable** — the page returns a cookie-consent interstitial (166 chunks of consent copy, no terms text) |
| WSDOT | not yet attempted directly | — |
| Caltrans | not yet attempted directly | — |

What follows is therefore **leads and secondary evidence**, clearly labelled.
None of it is sufficient to admit a provider.

---

## TfL JamCams

### Endpoint (from OSIRIS source, verified in the tree)

```
GET https://api.tfl.gov.uk/Place/Type/JamCam
image: property value, else
       https://s3-eu-west-1.amazonaws.com/jamcams.tfl.gov.uk/<camId>.jpg
```

A documented-looking image URL pattern is what would make this `live-image`
rather than `catalogue-only` — **but only if TfL's own documentation says the
URL returns a current image**, exactly as QLDTraffic §4.5 does. That has not
been read.

### Secondary evidence (not sufficient to admit)

Consistently across independent secondary sources:

- Terms are **a modified Open Government Licence**, with additional
  conditions.
- **Registration is required**, and TfL asks for accurate information about
  intended use before granting access.
- There are **call limits**.
- There is a **prohibition on passing products off as official TfL products**.
- Required attribution wording is **"Powered by TfL Open Data"**.
- One case study notes that, because of the registration and intended-use
  conditions, the data "does not conform to the open definition" despite being
  called open data.

Sources consulted (secondary): TransportAPI credits page; ODImpact TfL case
study; a third-party component library's credits page. These agree with each
other, which raises confidence but does not substitute for the terms page.

### Access classification (provisional)

```
access:       issued_key
registration: free_account  (with declared intended use)
cost:         none  (call limits apply)
```

Under the amended account rule — free government-data accounts permitted where
required by an explicitly licensed public-data source — TfL plausibly
qualifies, in the same way Transport for NSW did. Registration would be a
product-owner action.

### Decision

**RESEARCH.** Blocked on reading the actual terms page. Specifically needed:

1. The exact licence text and its deviations from OGL.
2. The documented call limit.
3. Whether the JamCam image URL is documented by TfL as a current image.
4. Whether public display inside a distributed desktop application is within
   the grant, and whether the "no passing off" condition imposes UI wording
   beyond "Powered by TfL Open Data".

---

## WSDOT

### Endpoint (from OSIRIS source, verified in the tree)

```
GET https://data.wsdot.wa.gov/log/public/cameras.json
image: cam.ImageURL
```

### Secondary evidence (not sufficient to admit)

A third-party project's public pull request, doing comparable diligence,
reports that:

- WSDOT layer metadata marks the feed for **"low volume"** use.
- A **keyed WSDOT Traveler Information API** serves the same population for
  higher-volume use.
- The catalogue mixes WSDOT's own camera hosts with **~70 partner cameras**
  (Oregon DOT, City of Seattle, lodges, airports) whose own terms apply.

That last point is the most useful thing in this pass and generalises well: a
government camera catalogue can contain third-party cameras that the
publishing authority does not license. **Any WSDOT adapter would have to
restrict itself to WSDOT's own image hosts and skip partner entries**, or it
would silently redistribute cameras under terms nobody checked.

This is a third-party claim about WSDOT's metadata, not WSDOT's own statement.

### Decision

**RESEARCH.** Needed: WSDOT's own terms/disclaimer text; what "low volume"
means numerically; whether the keyed Traveler Information API is the intended
path for an application like Signalwatch; and confirmation of the
partner-camera boundary from WSDOT rather than from a third party.

---

## Caltrans

### Endpoint (from OSIRIS source, verified in the tree)

```
GET https://caltrans-gis.dot.ca.gov/arcgis/rest/services/CHhighway/CCTV/
    FeatureServer/0/query?where=1=1&outFields=*&f=json
```

### Evidence

None obtained in this pass beyond the endpoint. ArcGIS FeatureServer services
commonly carry service-level metadata including a licence/terms field; that
has not been read.

### Decision

**RESEARCH.** Needed: the ArcGIS service metadata licence field, Caltrans'
data terms, whether the service exposes a current-image URL at all (the
endpoint returns features, and whether an image URL is among the attributes is
unverified), and rate expectations.

---

## Cross-provider findings

- All three are fetched by OSIRIS via spoofed headers, so for all three the
  first engineering question is **"does it serve an honest client?"**, not
  "can we parse it?".
- Two of the three (TfL, WSDOT) show the same pattern already seen with
  TfNSW: a free government programme with registration and/or volume
  conditions. That is the shape the amended account rule was written for.
- WSDOT introduces a new general hazard worth carrying into every future
  camera adapter: **catalogues that contain other operators' cameras**.
  Provider attribution must follow the *camera*, not the catalogue.
- None of the three can currently be classified above `catalogue-only`,
  because none has a provider-documented current-image guarantee on file.

---

## Decision record

| Provider | Status | Blocking question | Next primary source |
| --- | --- | --- | --- |
| TfL JamCams | RESEARCH | Terms page unreadable via the research tooling | `tfl.gov.uk/corporate/terms-and-conditions/transport-data-service` |
| WSDOT | RESEARCH | No WSDOT-authored terms read; "low volume" undefined | WSDOT traveler-information terms / `data.wsdot.wa.gov` metadata |
| Caltrans | RESEARCH | No terms or image semantics established | Caltrans ArcGIS service metadata; Caltrans data terms |

No provider in this pass reaches ADOPT or ADOPT WITH CONDITIONS, so **no
implementation plan is produced** and no adapter may be written.

---

## Recommended next step

Read the three primary sources above. The TfL page needs a client that can get
past a cookie interstitial, which the research tooling here could not — so it
may need to be fetched manually and the relevant clauses pasted into this
record.

Until then the camera catalogue stays as it is. The QLDTraffic provider
remains the only camera source with a provider-documented current-image
guarantee, and that is the standard the others have to meet.
