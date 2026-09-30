# Public Events — geolocated source research (Phase K)

Status: **RESEARCH COMPLETE, AWAITING A PRODUCT DECISION.** Nothing implemented.
Recorded 2026-09-30.

---

## 1. Why this phase exists

Phase J established that the `public-events` map layer had been rendering USGS
and NASA EONET records — hazard-source data wearing a news badge. Those records
now belong to Natural Hazards.

What remains behind `public-events` is four news RSS feeds (ABC, BBC, Sky,
Al Jazeera). **RSS headlines carry no coordinates.** So the layer has an
operational source and zero mappable records.

This phase asks one question: *is there a source that supplies real public
reporting, with genuine coordinates, free, publicly displayable, fetchable
server-side, with honest provenance?*

Per standing rules: no source is adopted because its endpoint responds, and
permission is established before architecture.

---

## 2. Candidate audit

### 2.1 ReliefWeb (UN OCHA) — **REJECTED**

Initially the most attractive candidate: curated humanitarian reporting from an
official UN source, with country and disaster tagging.

Two independent blockers, both first-party:

**(a) The site terms forbid what Signalwatch would do.**
`reliefweb.int/terms-conditions`:

> ReliefWeb grants permission to Users to visit the Space and to download and
> copy the information, documents and materials … **for the User's personal,
> non-commercial use, without any right to resell or redistribute them or to
> compile or create derivative works therefrom** …

Signalwatch would be redistributing and creating a derivative work (a map
layer), publicly. That is outside the granted permission. The API terms
reinforce it: content "is contributed by information partners and may contain
copyrighted material owned by the original source. You should respect the
intellectual property rights of the original source."

Note the trap this avoids: the API page says "Anyone can use the ReliefWeb API"
and "There are no fees associated with the use of ReliefWeb API". Read alone,
that sounds like clearance. It is not — *free of charge* is not *licensed to
redistribute*. This is exactly the "do not infer redistribution rights from
'open data'" rule.

**(b) A pre-approved `appname` is now mandatory.**
`apidoc.reliefweb.int`:

> All versions require the `appname` parameter. **From 1 November 2025, you need
> to use a pre-approved appname.**

That date is already past. Obtaining a pre-approved appname requires contacting
OCHA — i.e. registration and correspondence, which is outside what I may do
(no accounts, no emails). Even ignoring (a), the feed is not accessible on
permissionless terms today.

Quotas, for the record: 1000 entries/call, 1000 calls/day, no fees.

### 2.2 Australian state incident feeds (TfNSW, QLDTraffic) — **BLOCKED, NOT REJECTED**

Conceptually the *best* fit for "public events": official road incidents,
closures and hazards, with real surveyed coordinates, from the same agencies
whose cameras Signalwatch already lists.

Blocker: both require a free developer **account and API key**. That is not a
cost problem — it is the standing "do not create provider accounts" rule. This
is a decision for you, not for me, and it is the only blocker I found. The $0
invariant would survive (both are free tiers with no metering that Signalwatch's
server-side polling could exceed), but the account-creation rule does not bend
on its own.

Left open deliberately rather than rejected.

### 2.3 GDELT Project — **PERMISSION CLEARED, BUT THE GEOLOCATED ENDPOINT IS DOWN**

> **VERDICT UPDATE (2026-09-30, after live probing): BLOCKED. Not implementable
> today.** The licence is excellent and unchanged, but the only GDELT endpoint
> that supplies coordinates returns HTTP 404. See §2.4.

| Question | Finding |
| --- | --- |
| Access | `https://api.gdeltproject.org/api/v2/geo/geo?query=…` — public HTTPS, **no key, no account, no registration** |
| Licence | "all datasets released by the GDELT Project are available for **unlimited and unrestricted use for any academic, commercial, or governmental use of any kind without fee**" |
| Redistribution | "You may redistribute, rehost, republish, and mirror any of the GDELT datasets in any form." |
| Attribution | Required: "any use or redistribution of the data must include a citation to the GDELT Project and a link to this website (https://www.gdeltproject.org/)" |
| Public display | Permitted (unrestricted use + redistribution) |
| Freshness | Rolling 7-day window, **updated every 15 minutes** |
| Coverage | Worldwide, 65+ machine-translated languages |
| Output | GeoJSON at point / ADM1 / country level |
| Cost | $0, no tier, no metering, no account that could later be billed |

This is the cleanest permission grant of any source audited in this project —
better than Digitraffic's or BarentsWatch's, because it requires no account at
all.

**But the coordinates do not mean what a map marker implies.**

A GDELT GEO point is *a place mentioned in an article near a keyword*, resolved
by machine geocoding of text. It is not a reported event location. GDELT says so
itself, unprompted:

> …geocoding and disambiguating more than 9 million places on earth … you will
> almost always see at least some level of error in the results this API
> provides. This can range from one city being confused for another of the same
> name and context to a city name being mistranslated to an unrelated temporary
> breaking news inset at a different location being incorrectly inserted into
> the middle of an article.

Also structurally important: the GEO API returns **aggregated location counts**
("this place was mentioned N times, here are up to 5 example articles"), not one
record per event. There is no event identity to key a marker on.

So GDELT can honestly power a layer that means:

> *Where the world's news coverage is currently pointing* — a place mentioned in
> reporting, with the articles that mention it.

It **cannot** honestly power a layer that means "a public event happened here".
Presenting inferred mention-geography as event locations would be the same
category of lie Phase J just removed — fabricated precision, just from a
different direction.

### 2.4 GDELT GEO 2.0 API — live probe results (blocking)

Before writing any code, the endpoint was probed directly. Results:

| URL probed | Result |
| --- | --- |
| `api/v2/geo/geo?query=trump` (GDELT's **own** documented example) | **404 Not Found** |
| `api/v2/geo/geo?query=flood&format=geojson` | **404 Not Found** |
| `api/v2/geo/geo?query=flooding&format=geojson&mode=pointdata` | **404 Not Found** |
| `api/v2/doc/doc?query=flood&mode=artlist&format=json` | **200** — but returns a usage advisory, not data (below) |
| `api/v1/gkg_geojson?QUERY=flood` (the superseded v1 GeoJSON API) | **200** with an **empty** `FeatureCollection` |

The DOC 2.0 API's response was an advisory rather than articles:

> Please limit requests to one every 5 seconds or contact
> kalev.leetaru5@gmail.com for larger queries. All high-traffic users should
> switch to our ngrams dataset…

Three things follow, and none of them are guesses:

1. **The coordinate-bearing endpoint is unavailable.** GEO 2.0 is the *only*
   GDELT API that returns locations. Its own documented example URL 404s. The
   v1 GeoJSON predecessor answers but returns nothing. So there is currently no
   working GDELT path to coordinates.
2. **This is a known, recurring condition, not a momentary blip.** A
   live-validated third-party GDELT toolkit (May 2026) documents it plainly:
   "GDELT's GEO endpoint is occasionally unavailable (HTTP 404) independent of
   the DOC API."
3. **GDELT has previously gone dark for funding reasons.** In mid-2025 the
   project's APIs were reported down because the Google Cloud project behind
   them had an inactive billing account. That is worth recording under the $0
   invariant — not because it would cost Signalwatch anything, but because the
   rule is "a provider Signalwatch can use *indefinitely*". A free service whose
   uptime depends on a third party's cloud bill, and which has already gone dark
   for that reason once, carries a documented continuity risk.

**Consequence:** News Mentions cannot be built right now. Building it would mean
inventing the GeoJSON property names, because the live contract cannot be
observed — precisely the fabrication this project forbids. The rate-limit
request (1 request / 5 s) is separately noted and would be easily satisfied by
one server-side poll per 60 s, but that only matters if GEO returns.

**Re-check condition:** probe the three GEO URLs above. If they return GeoJSON,
capture the real property names, then implement against those bytes.

---

## 3. The architectural item: `sourceKind`

Independently of which source is chosen, the current hazard/news split relies on
id-prefix matching (`usgs-`, `eonet-`). That is defensible today because the ids
are minted server-side and stable, but it is a shim, not a semantic boundary.

Planned fix, to land with whatever Public Events work happens: give the
normalized briefing record an explicit provenance field —

```
sourceKind: "hazard" | "news" | …
```

— set at the point the record is created from its feed, so layer routing becomes
semantic instead of string-prefix-dependent. The prefix check then disappears
rather than being duplicated.

---

## 4. Unresolved

- **Whether GDELT's mention-geography is an acceptable Public Events layer**, or
  whether it should be its own distinctly named layer. This is a product
  decision, not a technical one. See §2.3.
- **Whether provider accounts may be created** for TfNSW / QLDTraffic. Standing
  rule says no; only you can change that.
- No other permissionless, genuinely geolocated public-reporting source was
  found in this pass. If both options above are declined, the honest outcome is
  that **Public Events stays operational-but-unmappable**, and that state should
  be shown in the UI rather than hidden.

---

## 5. Recommendation

Decisions taken: the layer is to be named **News Mentions**, modelled as an
aggregate observation (`NewsMentionObservation`), and kept separate from
`public-events`. `sourceKind` has since landed.

**However, implementation is blocked** by §2.4: the GDELT GEO 2.0 endpoint
returns 404, so there is no observable contract to build against. Nothing was
implemented. The layer stays unregistered rather than shipped against a dead
endpoint or invented field names.

Unblocking paths, in order of preference:

1. **Re-probe GDELT GEO** later; it is known to be intermittently available. If
   it answers, capture the real GeoJSON properties and build immediately — the
   licence is already cleared and is the strongest in the project.
2. **Authorise accounts for TfNSW / QLDTraffic** (§2.2). These give official,
   surveyed coordinates for genuine civic events and would restore
   `public-events` properly rather than substituting media attention for events.
3. Accept that both remain unavailable, in which case `public-events` stays
   honestly unmappable — which the UI now states explicitly rather than showing
   a green "available" next to zero records.
