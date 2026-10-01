# NWS radar base reflectivity (WMS) — admission record

**Status: ADOPT — implemented, awaiting operational sign-off.**
Runtime behaviour is verified in `nws-radar-operational-verification.md`;
that record, not this one, is where radar becomes "operationally verified".

The two conditions left open by `weather-source-admission.md`
are now satisfied. Researched 2026-10-01 against Signalwatch `a577716`, under
`source-admission-standard.md`.

`weather-source-admission.md` recorded this source as **ADOPT WITH
CONDITIONS**, the conditions being (1) read the service's own usage terms and
(2) confirm the WMS `GetMap` parameters. The standard states that
`ADOPT WITH CONDITIONS` does not authorise implementation until the conditions
are satisfied **and recorded**. This record does that, and nothing more — no
weather code exists yet.

---

## 1. Condition 1 — usage terms, read

National Weather Service disclaimer, section *Use of NOAA/NWS Data and
Products* (<https://www.weather.gov/disclaimer>):

> "The information on National Weather Service (NWS) Web pages are in the
> public domain, unless specifically noted otherwise, and may be used without
> charge for any lawful purpose so long as you do not: 1) claim it is your own
> (e.g., by claiming copyright for NWS information …), 2) use it in a manner
> that implies an endorsement or affiliation with NOAA/NWS, or 3) modify its
> content and then present it as official government material. You also cannot
> present information of your own in a way that makes it appear to be official
> government information."

On the name and identifier:

> "Use of the NWS name … and/or visual identifier are protected under
> trademark law … Use of the NWS name and/or visual identifier to identify
> unaltered NWS content or links to NWS web sites are allowable uses.
> Permission is not required to display unaltered NWS products which include
> the NWS name or NWS/NOAA visual identifier as part of the original product."

And, directly relevant to a radar layer:

> "Before using information obtained from any NWS Web page special attention
> should be given to the date and time of the data and products being
> displayed."

Supplied "as is", with all warranties disclaimed.

### What this permits, and what it constrains

| | |
| --- | --- |
| Cost | **$0.** Public domain, no charge, no key, no account |
| Display | Permitted. Signalwatch renders the **unaltered** provider-rendered tile |
| Attribution | `copyrightText` on the service: "National Oceanic and Atmospheric Administration, NOAA, National Weather Service, NWS" |
| Must not | Claim the imagery as Signalwatch's own, imply NOAA/NWS endorsement or affiliation, alter the imagery and present it as official, or present Signalwatch's own content as official government information |

Three implementation consequences follow and are binding:

1. **Do not recolour, reclassify or composite the radar image.** Signalwatch
   displays the provider's rendering. This sits naturally with the existing
   rule against fusing provider-native classifications — and here it is also a
   terms condition, not only a design preference.
2. **Label the product and its time explicitly.** The provider asks for
   attention to the date and time of the data. The layer must show the frame's
   valid time, not merely "live".
3. **Keep Signalwatch's own layers visually distinct from the NWS product**, so
   Signalwatch content is never presented as official government information.

## 2. Condition 1b — the published appropriate-use policy answers rate limits

The same page carries *Public Notice of Appropriate Use (Defining Abuse)*,
which is the closest thing NWS publishes to a rate limit:

> "**Know your data refresh frequency** — NWS has data which is updated at
> significantly different intervals. Knowing the frequency of the data update
> cycle will help you to create sensible request cycles."
>
> "**Request only the data that you need** …"
>
> "**React appropriately to return status and error codes** …"

And:

> "Sometimes the NWS determines that a particular user is impacting our service
> delivery capability … we may find it necessary to block IP addresses or query
> types."

So there is no numeric quota, but there *is* a published behavioural standard.
Polling faster than the product's refresh cadence is the defined abuse, which
converts a vague "be polite" into a concrete cache rule: **never refresh faster
than the slowest stated cadence**, and treat a block as a stop signal.
Signalwatch's `providerFetch` already declines to retry behind another
identity on 401/403/429, which is exactly the "react appropriately to return
status and error codes" behaviour asked for.

## 3. Condition 2 — WMS GetMap parameters, confirmed

Read from the service's own `GetCapabilities`
(`.../radar/radar_base_reflectivity_time/ImageServer/WMSServer?request=GetCapabilities&service=WMS`):

| Parameter | Confirmed value |
| --- | --- |
| Service / version | **WMS 1.3.0** |
| Layer name | `radar_base_reflectivity_time` |
| Image formats | `image/png`, `image/png24`, `image/png32`, `image/jpeg`, `image/gif`, `image/bmp`, `image/tiff`, `image/svg` |
| CRS | `CRS:84`, `EPSG:4326`, `EPSG:3857` |
| Geographic bounding box | west `-176.0`, east `150.00479`, south `8.99568`, north `72.0` |
| Time dimension | present, ISO 8601 extent, e.g. `2026-10-01T11:14:16Z/2026-10-01T13:06:59Z/PT1S` |
| Transparency | supported (`BLANK` background / PNG with alpha) |

Base endpoint:

```
https://mapservices.weather.noaa.gov/eventdriven/services/
  radar/radar_base_reflectivity_time/ImageServer/WMSServer
```

### The axis-order trap, recorded before it is hit

In **WMS 1.3.0**, `EPSG:4326` has **latitude first** (`BBOX=miny,minx,maxy,maxx`),
whereas `CRS:84` is lon/lat and `EPSG:3857` is x/y. This reverses between
WMS 1.1.1 and 1.3.0 and is the single most common cause of a WMS layer landing
in the wrong place. Signalwatch should request **`EPSG:3857`** to match the
web-mercator basemap and sidestep the ambiguity entirely.

## 4. Product semantics

From the service metadata:

- **What it is:** Multi-Radar/Multi-Sensor (MRMS) composite base reflectivity
  from the WSR-88D network. It is a *rendered radar mosaic*, not a
  precipitation-rate measurement and not a forecast.
- **Coverage, as stated by this service:** "Continental United States, Alaska,
  The Caribbean, Guam, and Hawaii."
- **Time behaviour:** four-hour moving window; times in UTC; epoch
  milliseconds for the REST interface, ISO for WMS; "If time parameters are
  omitted, the most recent image will be returned."

### Two provider inconsistencies, recorded rather than smoothed over

1. **Cadence.** The service description says "Update Frequency: Every 5
   minutes", while its own Time Information paragraph says the window is
   "updated approximately every ten minutes". `weather-source-admission.md`
   recorded 10 minutes from the sibling MapServer. Signalwatch takes the
   **slower** figure for polling (10 minutes) — the conservative reading is the
   one that cannot constitute abuse.
2. **Canada.** The earlier record quoted the MapServer coverage as including
   Canada. The **time-enabled ImageServer used here does not list Canada.**
   Signalwatch must describe the coverage of the service it actually calls, so
   Canada is not claimed for this product.

Neither is a defect; both are reasons to quote the specific service rather
than "NOAA radar" in the UI.

### A third, found during implementation: the bounding box is not an extent

Added 2026-10-01 while building Weather Batch 1.

The capabilities document advertises one geographic bounding box:

```
west -176.000000   east 150.004790   south 8.995680   north 72.000000
```

That is the **min/max of five disjoint regions**, not a contiguous extent.
Guam sits near +145 and the Caribbean near −65, so the envelope wraps the long
way round and spans **326° of longitude** — it contains Europe, Africa, all of
Asia, and most of the Atlantic and Indian Oceans.

Why it matters here rather than in the renderer: a `GetMap` for a tile over
Berlin is a perfectly valid request, and the service will answer it. It
answers with a **transparent PNG**, because it has no data there. Drawn on a
map, transparent radar over Berlin is indistinguishable from radar reporting
**no precipitation** over Berlin — the one claim binding constraint 5 forbids.

So this envelope must **never** be used as a render clip. Signalwatch clips
instead to one box per region the service names, each strictly inside the
envelope so the clip only ever narrows NOAA's claim:

| Region | west | south | east | north |
| --- | --- | --- | --- | --- |
| Continental United States | −127 | 23 | −64 | 51 |
| Alaska | −176 | 50 | −128 | 72 |
| Hawaii | −162 | 17 | −153 | 24 |
| Caribbean (PR / USVI) | −69 | 16 | −63 | 20 |
| Guam | 143 | 12 | 150.00479 | 21 |

The boxes are drawn generously around each named region so nothing NOAA
publishes is hidden. They are a **rendering clip derived from the provider's
own region list**, not a coverage claim of their own, and they are recorded
here so the derivation is auditable.

## 5. Admission lines

| Line | Finding |
| --- | --- |
| Identity | NOAA / National Weather Service, `mapservices.weather.noaa.gov`, time-enabled radar ImageServer with OGC WMS 1.3.0 |
| Access | **none** — keyless, no account |
| Registration | **none** |
| Cost | **$0** |
| Licence | US Government work, public domain per the NWS disclaimer |
| Attribution | "National Oceanic and Atmospheric Administration, NOAA, National Weather Service, NWS" |
| Rights | Display permitted; must not claim ownership, imply endorsement, or alter and present as official |
| Limits | No numeric quota. Published appropriate-use policy: match the refresh cadence, request only what is needed, honour error codes |
| Semantics | Rendered MRMS composite base reflectivity. Observation, not forecast |
| Coverage | CONUS, Alaska, Caribbean, Guam, Hawaii. **Explicitly not global** |
| Provenance | WSR-88D network via MRMS; NOAA is both operator and publisher |

## 6. Verification honesty

Outbound TLS from this workspace to arbitrary provider hosts is blocked, so the
`GetCapabilities` and service metadata above were read through the research
fetcher, not by the application. **No `GetMap` request has been issued and no
rendering has been verified.** The parameters above are the provider's declared
capabilities; the first implementation task is to confirm a real `GetMap`
response in an environment with egress.

## 7. Decision

**ADOPT.** Both outstanding conditions are satisfied. Implementation is now
authorised, subject to the constraints recorded above:

1. Display the provider's unaltered rendering; no recolouring or compositing.
2. Request `EPSG:3857`; do not rely on `EPSG:4326` axis order.
3. Show the frame's valid time, and distinguish it from receipt time.
4. Refresh no faster than once per 10 minutes.
5. Describe coverage as CONUS, Alaska, Caribbean, Guam and Hawaii — never as
   national, continental or global — and report *no source* outside it rather
   than *no precipitation*.
6. Attribute NOAA/NWS, and never imply endorsement or affiliation.

This authorises the radar provider only. The field/imagery layer kind it will
plug into is still the first engineering task of Weather Batch 1.

### Implemented 2026-10-01 — where each constraint lives

| # | Constraint | Where it is enforced |
| --- | --- | --- |
| 1 | Unaltered rendering | the browser requests `GetMap` and draws NOAA's own PNG; Signalwatch has no recolour, reclassify or composite step anywhere |
| 2 | EPSG:3857 | `IMAGERY_CRS` in `weather-sources/nws-radar.ts`; an unsupported CRS skips the surface rather than substituting one |
| 3 | Frame time distinct from receipt time | `sourceTimestamp` (read from the WMS time dimension) vs `ingestionTimestamp`; both shown in the weather panel |
| 4 | No faster than 10 min | `REFRESH_INTERVAL_MS`, the API-server cache TTL, and the client query's `refetchInterval` |
| 5 | Honest coverage | five clip boxes (above) given to Leaflet as per-area `bounds`, so no tile outside them is ever requested; `describeAvailability` states "no source", never "no precipitation" |
| 6 | Attribution, no implied endorsement | `ATTRIBUTION`, the verbatim `copyrightText`, carried on the Leaflet layer and in the panel |

Architecture: `docs/research/weather-layer-architecture.md`.

**Still no `GetMap` has been issued.** The first live check is the
Windows/networked runtime; §12.1 of the architecture record lists exactly what
to verify.
