STATUS: RESEARCH — NOT AN ADMISSION

This document records provider research only. Its findings do not authorize
implementation, provider registration, credential use, ingestion, rendering,
or redistribution. An explicit provider/capability admission is required
before implementation.

---

# C4 — Australian weather source admission research

Status: **research only.** No provider admitted, no code written, no registry
change, no adapter. Every candidate below is a finding, not a decision.

Research date: **2 October 2026**. All licence statements were fetched live
on that date except where marked otherwise; terms change and must be
re-checked before any implementation.

Scope note: this document answers *may we*, not *can we*. Technical
retrievability appears nowhere in the verdicts.

---

## 0. The one-paragraph answer

An Australia-first weather stack **can** be built at $0 and stay
source-compliant, but **not** the way the United States one was. The single
most important finding is that **Australian radar imagery has no compliant
$0 path at all**: BOM is the only national radar operator, its real-time
radar is a paid subscription product requiring a data licence agreement, and
the only other "radar API" in the country returns rainfall numbers rather
than imagery. Everything *else* — observations, fields, satellite, warnings —
has at least one credible compliant option. So the honest plan is an
Australian weather layer that is strong on fields, observations, satellite
and warnings, and **explicitly says it has no Australian radar source**,
exactly as it already says for the Pacific.

A second finding is load-bearing and easy to miss: **several of the free
tiers are free only for non-commercial use.** The $0 Australian stack is
viable while Signalwatch is a personal, non-commercial tool. It would need
re-licensing if it ever carried subscriptions or advertising.

---

## 1. Bureau of Meteorology — reconfirmed

Sources fetched 2 Oct 2026: `bom.gov.au/copyright`,
`bom.gov.au/resources/data-services`.

### 1.1 The general copyright position

> "Unless we state otherwise, you can download, copy and use our content for
> personal use, or use within your organisation. **You must not supply it to
> any other person or use it for any commercial purpose.**"

> "we do not allow you to use automated or manual techniques to **hack,
> scrape or otherwise extract material** from our site."

> If unauthorised use is suspected, BOM may "immediately end your access" and
> "stop you from accessing our site, **including by blocking an IP address**",
> without notice.

CC BY applies **only where BOM explicitly states it on the page**. Absence of
a stated licence means the restrictive default above, not permission.

### 1.2 Radar specifically — treated separately, as instructed

> "Some of our content – such as **radar images**, high-resolution maps, and
> other specialised data – may be subject to a **data licence agreement**.
> This content is not covered by general media attribution guidelines. **You
> need a data licence agreement to: access the material; reproduce or publish
> it in any form.**"

And from Data services, real-time data — explicitly including **radar data**,
satellite data and forecast grids — is a **paid subscription** for registered
users. The current agreement is published as
`bureau-of-meteorology-data-licence-agreement-october-2026.pdf`.

### 1.3 Per-capability classification

| BOM capability | Classification | Evidence |
|---|---|---|
| Radar imagery | **PAID + licence required** | Data licence agreement explicitly named for radar images; real-time radar is a paid subscription |
| Real-time weather data | **PAID** | "Extensive datasets are available through paid subscription services" |
| Satellite imagery (Himawari-8/9) | **PAID / charges apply** | Listed under "Spatial and advanced data"; charges page referenced |
| Observations (text products) | **Free with restrictions** | "Some forecast, warning and observation text products are free. **These are not for commercial use.**" |
| Warnings (text products) | **Free with restrictions** | Same clause as above |
| Forecast / model grids | **PAID** | "weather forecast grids" listed under paid real-time data |
| ACCESS-G open data | **Unclear — currently suspended** | See §5.3; BOM open-data delivery reported temporarily suspended during a platform upgrade |
| Public anon FTP products | **Free with restrictions** | Non-commercial, no scraping, subject to the general copyright default |
| `api.weather.bom.gov.au` | **EXCLUDED** | Undocumented internal endpoint; BOM has refused its use (prior finding, unchanged) |
| Climate archive | **Largely free to download** | "Much of this information is available free for immediate download" |
| Water data | **Free** | Stated free access |

### 1.4 Verdict

**EXCLUDE for ingestion. REFERENCE ONLY.**

Unchanged from the earlier finding, now reconfirmed against current pages.
BOM remains legitimate as a **Reference Provider** — Signalwatch may link a
user to `bom.gov.au` or to a radar page as a research destination, which is
the architecture already defined for reference sources. It may not fetch,
cache, re-serve or embed BOM radar.

The free text products are a *narrow* possibility: non-commercial use of
anon-FTP warning and observation text is permitted by the stated terms. But
"must not supply it to any other person" sits very awkwardly with any
redistribution, and the no-scraping clause means only the designated FTP
product paths could be used, never page extraction. **Marked RESEARCH, not
ADOPT**, and not needed if the state CAP feeds in §3.2 prove cleaner.

---

## 2. DPIRD — Western Australia

Sources: `dpird.wa.gov.au/online-tools/apis/`,
`dpird.wa.gov.au/online-tools/apis/api-terms-and-conditions/` (fetched
2 Oct 2026), `catalogue.data.wa.gov.au` dataset DPIRD-075.

### 2.1 What exists

Three APIs behind one free gateway: **Weather**, **Radar**, **Science**.

- Weather API — `https://api.agric.wa.gov.au/v2/weather/openapi/`
  Almost **300 automatic weather stations**, state-wide WA. Each station
  samples **every minute**; uploads to the central database **roughly every
  six minutes**. Air temperature, humidity, rainfall, wind speed and
  direction, solar radiation; derived evaporation and evapotranspiration.
  Summaries at 15-minute, 30-minute, hourly, daily, monthly, yearly.
- Radar API — `https://api.agric.wa.gov.au/v2/radar/openapi/`
  DPIRD radars at **Geraldton, Albany, Esperance, Newdegate, Kalgoorlie,
  South Doodlakine, Perth (Serpentine) and Watheroo**.
- Science API — `https://api.agric.wa.gov.au/v2/science/openapi/`

### 2.2 The Radar API is not radar imagery

This matters more than anything else in this section, and it is exactly the
trap the brief warned about for Open-Meteo.

DPIRD's Radar API returns **rainfall accumulations derived from radar**:
rainfall since 9am, current-hour, month-to-date, year-to-date, and daily,
monthly and yearly summaries **for the closest radar to a supplied
coordinate**. It is a point-query numeric product, not a reflectivity raster.

So in the taxonomy of §4, DPIRD's "Radar API" is a **derived field /
observation**, **not radar imagery**. Classifying it as a radar imagery
source because of its name would be the same error as classifying Open-Meteo
as radar because it reports precipitation.

Whether DPIRD publishes any reflectivity image product at all: **UNKNOWN**,
not established from the documentation read. Must be resolved from the
OpenAPI specification before any implementation.

### 2.3 Licence and credential

Data licence: **CC BY 3.0 AU**
(`https://creativecommons.org/licenses/by/3.0/au/deed.en`), granted
"fee-free and royalty free".

Credential terms, quoted because they determine the architecture:

> "The API Key is provided free of charge but is **non-transferable** and
> must only be used by the individual or entity to which the API Key has been
> issued."

> "If the API User permits or facilitates any other person or party to access
> or use the API Key … that use will constitute a **breach**."

> "the API User's rights to the Data is **strictly limited to making direct
> server calls to the API (using the API Key)** for the Data and to provide a
> link to the DPIRD Website to End Users"

> "If the API User is issued with a DPIRD user account, then it may implement
> the API on its website or application and **distribute all Data accessible
> via the API to its End Users**."

> "if any Data is removed from the DPIRD Website or is no longer able to be
> viewed by an API User or End User, then the API User **must also remove that
> Data from its website**"

> "All API Users must **reproduce the above licence (and its link) as part of
> its own terms and conditions**"

Registration requires a **Nominated User** with legitimate contact details.
DPIRD reserves the right to monitor use and terminate the key.

### 2.4 Which credential architecture is compliant

**User-supplied credential.** Not operator-supplied, and definitely not
bundled.

The reasoning is forced by two clauses read together. The key is
non-transferable and must only be used by the entity it was issued to; and
rights are limited to **direct server calls** using that key. Signalwatch's
API server runs **locally on the user's own machine** — it is the user's own
deployment. So the natural and compliant reading is that **each user
registers as their own API User**, supplies their own key to their own local
server, and makes direct server calls with it. That satisfies
non-transferability, satisfies "direct server calls", and never shares a key.

An operator-supplied key would only be compliant for a *hosted* Signalwatch
where the operator is genuinely the API User distributing to End Users —
which the terms do expressly permit. But Signalwatch has no hosted
deployment and a $0 constraint that argues against one, so this is recorded
as a theoretical alternative, not a plan.

**A bundled shared credential is prohibited outright** and must never be
shipped.

Two further obligations would bind any implementation:

1. **The withdrawal duty.** If DPIRD removes data, Signalwatch must remove it
   too. That constrains caching: a long-lived cache of DPIRD data would need
   an invalidation path, which argues for short TTLs only.
2. **The licence-reproduction duty.** Signalwatch would have to reproduce
   CC BY 3.0 AU and its link in its own terms — a product obligation, not
   just an attribution string in a corner of the map.

### 2.5 Open questions — all UNKNOWN

Rate limits (no published numeric limit found); whether a reflectivity image
product exists; freshness guarantees; whether the ~6-minute upload cadence is
contractual or incidental; whether the Science API carries different terms.

### 2.6 Verdict

**ADOPT WITH CONDITIONS** for WA station observations and radar-derived
rainfall. Conditions: user-supplied key only; no bundled credential;
server-side calls only; short cache TTL with an invalidation path; CC BY 3.0
AU reproduced in Signalwatch's terms; coverage honestly stated as **Western
Australia only**.

---

## 3. Other Australian sources

### 3.1 SILO — Queensland Government, Long Paddock

Sources: `longpaddock.qld.gov.au/silo/`, `/silo/about/`,
`registry.opendata.aws/silo/`.

- **National coverage**, 1889 to yesterday, **18,700+ stations**.
- Licence: **CC BY 4.0**, stated plainly and repeatedly. "SILO products are
  provided free of charge to the public for use under the Creative Commons
  Attribution 4.0 license."
- Built from **BOM observational data** — so SILO is, in effect, a
  compliantly re-licensed path to BOM observations. That is a significant
  finding: the data BOM restricts on its own site is available nationally
  under CC BY 4.0 through a Queensland Government product.
- Gridded daily surfaces (NetCDF, GeoTIFF) on AWS Open Data:
  `s3://silo-open-data`, region **ap-southeast-2**, **no AWS account
  required** (`--no-sign-request`).
- Point data via API; requires an **email address** as the identifier.
- Fair-use limits apply but **are not numerically specified** — UNKNOWN.
- Scheduled unavailability Wednesday and Thursday, 11:00–13:00 Brisbane.

**The decisive limitation: SILO is daily, "to yesterday".** It is a climate
and historical product, not a live weather feed. It cannot serve a
situational-awareness "what is happening now" layer. It is excellent for
**historical field** and context, and useless for live conditions.

**Verdict: ADOPT WITH CONDITIONS** — as a *historical/derived field* source
only. Must never be presented as current conditions.

### 3.2 State emergency warning feeds (CAP-AU)

Australia has no single national warnings feed. Each state runs its own
agency. Observed structure:

| Jurisdiction | Transport | Endpoint (unverified) | Licence |
|---|---|---|---|
| NSW RFS | EDXL-DE envelope, CAP-AU 1.0 | UNKNOWN | UNKNOWN |
| QLD Fire Department | EDXL-DE / CAP-AU 1.0 | UNKNOWN | UNKNOWN |
| DFES Emergency WA | EDXL-DE / CAP-AU 1.0 | `api.emergency.wa.gov.au/v1/capau` | UNKNOWN |
| TasALERT | EDXL-DE / CAP-AU 1.0 | `alert.tas.gov.au/data/cap-au.xml` | UNKNOWN |
| Victoria | GeoJSON | UNKNOWN | UNKNOWN |
| ACT ESA | CAP (incidents) + GeoRSS | `data.esa.act.gov.au/feeds/esa-cap-incidents.xml` | **CC BY 4.0** (stated) |
| SA, NT | No CAP published | — | — |
| NSW SES | API by request | contact `warnings.capability@ses.nsw.gov.au` | Restriction stated |

Two recorded constraints:

- **ACT ESA** states its News Alerts and Current Incidents feeds are
  **CC BY 4.0**, attribution to the ACT Emergency Services Agency.
- **NSW SES** states warnings "must always be **republished in full without
  any form of alteration**", and directs organisations to contact the
  Warnings Team for direct API access. That is a redistribution-integrity
  condition, and it is incompatible with summarising or re-styling a warning
  — relevant because Signalwatch's house style trims provider text.

Severity uses the **Australian Warning System** tiers — Emergency Warning /
Watch and Act / Advice — which is a national scheme carried inside the CAP
payload rather than CAP's own `<severity>` field.

**Important sourcing caveat.** The endpoint list above was assembled partly
from a third-party open-source project's release notes, not from each
agency's own documentation. It is a **lead list**, not evidence of
permission. Every one of these needs its own licence page read before
admission.

**Verdict: RESEARCH.** Technically promising, legally unresolved, and
fragmented across eight jurisdictions. ACT is the only one with a confirmed
licence.

### 3.3 AGCD / AWAP — Australian Gridded Climate Data

BOM metadata catalogue records the AGCD snapshot grids as **CC BY-NC 4.0** —
Attribution **Non-Commercial**. Distributed via NCI THREDDS.

Note the licence is *different* from CC BY: non-commercial is a licence
restriction here, not merely a terms-of-service tier.

**Verdict: RESEARCH**, historical field only, non-commercial.

### 3.4 Himawari-9 — satellite imagery

Carried forward from earlier research, unchanged: available through
**NOAA / AWS Open Data**, freely distributable with attribution. Full-disk
coverage includes Australia. The obstacle is format, not licence — L1b
netCDF requires processing into displayable imagery, so it is a lead with
real engineering cost rather than a drop-in layer.

BOM also sells Himawari-derived products, but that is BOM's value-add; the
underlying JMA data via NOAA/AWS is a separate and more permissive path.

**Verdict: RESEARCH** — and the strongest candidate for *national-scale
Australian weather imagery*, since radar is closed.

### 3.5 Other leads not pursued

State environmental monitoring networks, agricultural networks beyond DPIRD,
and marine/ocean products were not researched in this pass. Recorded as
**not researched**, not as absent.

---

## 4. Weather product taxonomy

The brief's rule — one source's licence never covers all its products — is
applied here. Each cell is a separate admission question.

| Source | Observation | Radar imagery | Satellite imagery | Forecast field | Historical field | Warning | Derived field |
|---|---|---|---|---|---|---|---|
| BOM | free, non-commercial (text) | **paid + licence** | paid | paid grids | largely free | free, non-commercial (text) | paid |
| DPIRD | CC BY 3.0 AU, key | **none published** (UNKNOWN) | — | — | CC BY 3.0 AU | — | CC BY 3.0 AU (rainfall) |
| SILO | CC BY 4.0, daily only | — | — | — | **CC BY 4.0** | — | CC BY 4.0 |
| Open-Meteo | — | **none** | — | **CC BY 4.0, non-comm free tier** | CC BY 4.0 (reanalysis) | — | CC BY 4.0 |
| State CAP feeds | — | — | — | — | — | **UNKNOWN / ACT CC BY 4.0** | — |
| Himawari via AWS | — | — | **free + attribution** | — | — | — | — |
| AGCD | — | — | — | — | CC BY-NC 4.0 | — | — |

The empty radar-imagery column is the finding of this checkpoint.

---

## 5. Open-Meteo

Sources: `open-meteo.com/en/terms`, `/en/licence`, `/en/docs/bom-api`
(fetched 2 Oct 2026).

### 5.1 Licence and limits

- API data under **CC BY 4.0**.
- Free tier is **non-commercial only**, and Open-Meteo defines the boundary
  explicitly. Non-commercial includes private/non-profit sites and apps with
  **no subscriptions and no advertising**, personal home automation, public
  research, education. Commercial includes "operating websites or apps that
  have subscriptions or display advertisements" and "integrating our service
  into commercial products".
- Free limits: **600 calls/minute, 5,000/hour, 10,000/day, 300,000/month.**
- No API key required for the free tier.
- Attribution is **mandatory and specific**: a link next to any location
  Open-Meteo data are displayed, e.g.
  `<a href="https://open-meteo.com/">Weather data by Open-Meteo.com</a>`.
- "We reserve the right to block applications and IP addresses that misuse
  our service without prior notice."
- Source code AGPLv3; governing law Switzerland.

Redistribution and caching are permitted by CC BY 4.0 — share and adapt in
any medium — subject to attribution. That is materially more permissive than
BOM.

### 5.2 Is it a radar source?

**No.** Explicitly not, and this must not be fudged. Open-Meteo serves
**modelled fields**, including precipitation variables. A modelled
precipitation field and a radar reflectivity observation are different
products with different epistemic status: one is what a model predicts, the
other is what an instrument measured. Presenting Open-Meteo precipitation as
radar would be a provenance lie of exactly the kind the project's rules
exist to prevent.

Open-Meteo is a candidate for the **field** layers — temperature, wind,
precipitation, pressure, cloud — and for nothing else.

### 5.3 Model source for Australia, and a live operational caveat

Open-Meteo exposes BOM's **ACCESS-G**: global, **0.15° (~15 km)**, hourly
steps, **10-day** horizon, four runs daily at 00/06/12/18 UTC.

**But Open-Meteo's own BOM documentation currently states that BOM
"is upgrading its key platforms and services. During this process,
open-data delivery has been temporarily suspended."**

So the ACCESS-G endpoint is, as of this research date, **not reliably
available**. This is an operational fact with a design consequence: an
Australian field layer must not be architected around ACCESS-G alone.
Open-Meteo also carries ECMWF, NOAA NCEP, DWD, Météo-France, JMA, MET
Norway, CMC and others, all of which cover Australia globally, so the field
capability survives ACCESS-G's absence at coarser resolution.

### 5.4 Verdict

**ADOPT WITH CONDITIONS** as a *field* provider for Australia.
Conditions: non-commercial use only; the specific link attribution rendered
wherever data appear; request budget kept well inside the published limits
and matched to model update cadence, not to UI events; model identity, run
time and resolution surfaced rather than hidden; **never labelled radar**;
no architectural dependence on ACCESS-G while BOM open data is suspended.

---

## 6. Comparison matrix

Deliberately unordered. No "best" source is nominated.

| Provider | Capability | Geographic coverage | Resolution | Cadence | Access | Credential scope | Licence | Redistribution | Commercial use | Caching | Attribution | Rate limit | Status | Reason |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| BOM | Radar imagery | National | UNKNOWN | ~6–10 min | Paid subscription | Operator contract | Data Licence Agreement | No | Licensed only | Licensed only | Required | UNKNOWN | **EXCLUDE** (ingestion) / **REFERENCE ONLY** | Radar explicitly requires a paid data licence agreement |
| BOM | Warnings / obs text | National | Text products | Varies | Anon FTP | None | Site copyright | "must not supply to any other person" | **No** | UNKNOWN | Required | Unspecified; IP blocking possible | **RESEARCH** | Free but non-commercial and redistribution-hostile |
| DPIRD | Station observations | **WA only** | ~300 stations | 1-min sample, ~6-min upload | Free API | **User-supplied key, non-transferable** | CC BY 3.0 AU | **Yes, to End Users** | Not restricted by licence | Yes, with withdrawal duty | Required + licence reproduction | UNKNOWN | **ADOPT WITH CONDITIONS** | Clean CC BY licence; key must never be bundled |
| DPIRD | Radar-derived rainfall | **WA only**, 8 radars | Point query | Hourly / since-9am / MTD / YTD | Free API | Same key | CC BY 3.0 AU | Yes | Not restricted | Yes | Required | UNKNOWN | **ADOPT WITH CONDITIONS** | Numeric rainfall, **not** imagery |
| SILO | Historical / gridded field | **National** | Station + gridded surfaces | **Daily, to yesterday** | Free API + AWS S3 | Email address | **CC BY 4.0** | Yes | Yes | Yes | Required | Fair use, **unspecified** | **ADOPT WITH CONDITIONS** | Not live; historical only |
| Open-Meteo | Forecast / field | Global incl. AU | ACCESS-G 0.15°; others vary | Hourly; 4 runs/day | Free, no key | None | **CC BY 4.0** | Yes | **Free tier non-commercial only** | Yes | Required, with link | 600/min · 5k/hr · 10k/day · 300k/mo | **ADOPT WITH CONDITIONS** | Fields only; never radar; ACCESS-G suspended |
| Himawari-9 (NOAA/AWS) | Satellite imagery | Full disk incl. AU | ~0.5–2 km | ~10 min | Free, open S3 | None | Free + attribution | Yes | Yes | Yes | Required | None published | **RESEARCH** | Licence favourable; L1b netCDF processing cost unresolved |
| ACT ESA | Warnings / incidents | ACT | Point incidents | 60 s (incidents) | Free feed | None | **CC BY 4.0** | Yes | Yes | Yes | Required | UNKNOWN | **RESEARCH** | Licence confirmed; product fit unverified |
| NSW RFS / QFD / DFES WA / TasALERT | Warnings | Per state | CAP-AU 1.0 | Event-driven | Free feed | UNKNOWN | **UNKNOWN** | UNKNOWN | UNKNOWN | UNKNOWN | UNKNOWN | UNKNOWN | **RESEARCH** | Endpoints from a third-party list; no licence read |
| NSW SES | Warnings | NSW | CAP | Event-driven | By request | Contact required | Stated restriction | **Full and unaltered only** | UNKNOWN | UNKNOWN | Required | UNKNOWN | **RESEARCH** | Integrity condition conflicts with summarising |
| Victoria | Warnings | VIC | GeoJSON | Event-driven | Free feed | UNKNOWN | UNKNOWN | UNKNOWN | UNKNOWN | UNKNOWN | UNKNOWN | UNKNOWN | **RESEARCH** | Not examined |
| AGCD / AWAP | Historical field | National | Gridded | Snapshot | NCI THREDDS | UNKNOWN | **CC BY-NC 4.0** | Yes, non-comm | **No** | Yes | Required | UNKNOWN | **RESEARCH** | Non-commercial licence, historical only |

---

## 7. Target architecture — capability by capability

Mapping the intended Weather tree onto what the research actually supports.

| Capability | Candidate | $0 compliant path today? |
|---|---|---|
| **Radar imagery** | — | **NO. Unsolved.** |
| Satellite imagery | Himawari-9 via NOAA/AWS | Likely, with processing work |
| Temperature field | Open-Meteo | Yes, non-commercial |
| Wind field | Open-Meteo | Yes, non-commercial |
| Precipitation field | Open-Meteo | Yes, non-commercial — **never labelled radar** |
| Pressure field | Open-Meteo | Yes, non-commercial |
| Cloud field | Open-Meteo | Yes, non-commercial |
| Warnings | State CAP-AU feeds | Unresolved; ACT confirmed only |
| Station observations (WA) | DPIRD | Yes, user-supplied key |
| Station observations (national) | SILO | Historical only, not live |

The existing `SpatialFieldDescriptor` type — declared but unimplemented —
is the right home for the Open-Meteo products, and this research does not
change that decision.

---

## 8. Provider-admission question set

`UNKNOWN` is used wherever the documentation read did not establish an
answer. No permission is inferred anywhere.

| # | Question | BOM (radar) | DPIRD | SILO | Open-Meteo | Himawari/AWS | State CAP |
|---|---|---|---|---|---|---|---|
| 1 | May Signalwatch fetch it? | No, without licence | Yes, with own key | Yes | Yes | Yes | UNKNOWN |
| 2 | May Signalwatch display it? | No | Yes | Yes | Yes | Yes | UNKNOWN |
| 3 | May it redistribute data/imagery? | No | Yes, to End Users | Yes | Yes | Yes | UNKNOWN (NSW SES: unaltered only) |
| 4 | May it cache it? | No | Yes, **withdrawal duty applies** | Yes | Yes | Yes | UNKNOWN |
| 5 | May it be used in a public application? | No | Yes | Yes | Yes, non-commercial | Yes | UNKNOWN |
| 6 | Is commercial use permitted? | Licensed only | Not restricted by CC BY 3.0 AU | Yes | **No** on free tier | Yes | UNKNOWN |
| 7 | Is attribution required? | Yes | Yes + licence reproduction | Yes | Yes, with link | Yes | Yes (ACT) |
| 8 | Is a credential required? | Yes, contract | **Yes, API key** | Email for point data | No | No | UNKNOWN |
| 9 | Can the credential be user-supplied? | n/a | **Yes — and must be** | Yes | n/a | n/a | UNKNOWN |
| 10 | Geographic limits? | National | **WA only** | National | Global | Full disk | Per jurisdiction |
| 11 | Rate limits? | UNKNOWN | **UNKNOWN** | Fair use, unspecified | Published numerically | None published | UNKNOWN |
| 12 | Does the licence cover media or only metadata? | Media explicitly licensed-only | Data; imagery existence UNKNOWN | Data and grids | Data | **Imagery included** | UNKNOWN |

---

## 9. Stop condition

### 9.1 Unsolved Australian weather capabilities

1. **Radar imagery — wholly unsolved at $0.** BOM holds the national radar
   network and gates real-time radar behind a paid data licence agreement.
   No alternative Australian radar imagery provider was found. DPIRD's
   similarly named API is numeric rainfall, WA-only.
2. **Live national station observations.** DPIRD is live but WA-only; SILO is
   national but a day behind. Nothing found is both.
3. **National warnings as a single feed.** Eight jurisdictions, no national
   aggregator, one confirmed licence.

### 9.2 Technically promising, legally unresolved

- **State CAP-AU feeds** — a coherent national standard with real endpoints,
  but licences unread for every jurisdiction except ACT, and NSW SES carries
  an integrity condition that conflicts with Signalwatch's presentation
  style.
- **Himawari-9 via NOAA/AWS** — the licence looks favourable and it is the
  only credible route to national-scale Australian weather imagery, but the
  L1b netCDF processing chain is unproven here.
- **BOM free text products** — permitted for non-commercial use, yet the
  "must not supply it to any other person" clause makes redistribution
  doubtful. Needs a careful reading of the anon-FTP product terms
  specifically, as distinct from the general site copyright.
- **AGCD** — clean CC BY-NC licence, but non-commercial and historical.

### 9.3 Can an Australia-first weather stack stay $0 and compliant?

**Yes, with two honest caveats.**

**It can.** Fields (Open-Meteo, CC BY 4.0), historical context (SILO,
CC BY 4.0), WA observations (DPIRD, CC BY 3.0 AU), and probably satellite
(Himawari via AWS) together form a real Australian weather capability with
no paid dependency and no scraping.

**Caveat one — there will be no Australian radar.** Not at $0, not without a
BOM data licence agreement. The architecture must treat this as a permanent
documented absence, and the UI must say *"no radar source here"* over
Australia with the same discipline it already applies to the Pacific. The
temptation this creates is precise and must be named: Open-Meteo's
precipitation field will be available over Australia, and it would be very
easy to colour it like radar and let users assume. That would be a
provenance lie. A modelled precipitation field must be labelled as a model,
with its run time and resolution visible.

**Caveat two — "non-commercial" is doing real work.** The Open-Meteo free
tier and BOM's free text products are both restricted to non-commercial use,
and AGCD is CC BY-NC. The $0 stack therefore holds only while Signalwatch
has no subscriptions and no advertising. If that ever changes, Open-Meteo
requires a paid plan and the BOM text products become unusable. This should
be recorded as a standing condition on the product, not just on the layer.

### 9.4 What is explicitly not done

No provider implemented. No adapter, no registry change, no UI change, no
type change. No credential obtained or requested. No endpoint polled beyond
reading public documentation pages. The five admitted NOAA coverage areas are
untouched and still exclude Australia.

### 9.5 Recommended next research, if approved

In order of ratio of value to unresolved risk: the DPIRD OpenAPI
specifications (to settle the imagery question and rate limits); the eight
state warning feed licences; the Himawari L1b processing chain; and the BOM
anon-FTP product terms as distinct from site copyright.

**STOP. Awaiting explicit implementation approval.**
