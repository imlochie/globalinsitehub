# ADSB.lol — aircraft provider admission record

**Status: ADOPT WITH CONDITIONS. Conditions are NOT yet met, so no adapter may
be written.** Researched 2026-09-30 against Signalwatch `46d00a2`.

This record exists so a future implementation agent does not repeat the legal
and terms research. It does **not** authorise implementation on its own — see
"Blocking conditions".

---

## 1. Evidence

| Claim | Source | Section |
| --- | --- | --- |
| API is free | <https://api.adsb.lol/docs> | "Terms of Service" |
| Future API key obtainable by feeding | <https://api.adsb.lol/docs> | "Terms of Service" |
| Production users should contact the operator | <https://api.adsb.lol/docs> | "Terms of Service" |
| API and all public data are ODbL | <https://api.adsb.lol/docs> | "License" |
| ODbL full text | <https://opendatacommons.org/licenses/odbl/1-0/> | §3.1, §4.3, §4.4, §4.5, §4.6, §6.2 |
| Feeder-only re-api is separate | <https://www.adsb.lol/docs/feeders-only/re-api/> | linked from "Feeders" |
| Endpoint list | <https://api.adsb.lol/docs> | "v2" / "v0" |

Verbatim, from the API documentation:

> "You can use the API for free."
>
> "In the future, you will require an API key which you can get by feeding to
> adsb.lol."
>
> "If you want to use the API for production purposes, please contact me so I
> do not break your application by accident."
>
> "The license for the API as well as all data ADSB.lol makes public is ODbL.
> This is the same license OpenStreetMap uses."

---

## 2. Blocking conditions

Implementation must not begin until all four are satisfied.

1. **Operator contact for production use.** The provider explicitly asks for
   it. Signalwatch ships a Windows installer and a PWA, which is production
   use. *Product-owner action — the agent cannot create accounts or send
   messages.*
2. **Rate limit established.** None is published. Without it there is no way
   to design a polling interval that is demonstrably compliant, and guessing
   would be optimising around an undocumented limit.
3. **ODbL §4.6 scope resolved.** Whether a short-TTL normalised cache is a
   Derivative Database, and whether publishing the open-source adapter
   satisfies the obligation to offer "the method of making the alterations".
4. **Future-key gate acknowledged.** If ADSB.lol enforces the feeder-gated API
   key, Signalwatch would face a hardware/reciprocity obligation. The agreed
   response must be to return the layer to `planned`, not to quietly accept
   the cost.

---

## 3. API surface approved for consideration

Only the public v2 endpoints. Principally:

```
GET /v2/lat/{lat}/lon/{lon}/dist/{radius}      radius capped at 250 nm
GET /v2/closest/{lat}/{lon}/{radius}
GET /v2/hex/{icao_hex}
GET /v2/callsign/{callsign}
GET /v2/registration/{registration}
GET /v2/type/{aircraft_type}
GET /v2/sqk/{squawk}
GET /v2/mil | /v2/pia | /v2/ladd
```

**Excluded surfaces:** the feeder-only `readsb` re-api and beast/MLAT outputs
(require feeding), and `adsb.lol/data/traces` (used by OSIRIS, absent from the
official documentation).

**There is no public global snapshot endpoint.** Any worldwide view must be
composed from tiled 250 nm queries, which is precisely why condition 2 blocks
implementation.

---

## 4. Obligations that must appear in the implementation

- **ODbL §4.3 notice**, wherever aircraft observations are publicly shown:

  > Contains information from [ADSB.lol](https://adsb.lol/), which is made
  > available here under the [Open Database License (ODbL)](https://opendatacommons.org/licenses/odbl/1-0/).

- **No historical retention** in the first implementation. Retaining tracks
  strengthens the Derivative Database reading and triggers §4.6.
- **Coverage language must be qualified.** Not "global aircraft". The honest
  phrasing is "aircraft reported by the ADSB.lol community receiver network,
  where receivers exist." ADS-B is line-of-sight; oceanic and low-altitude
  coverage is poor, and density follows volunteers.
- **Attribution and licence travel with every record**, as they already do for
  Digitraffic, BarentsWatch, USGS, EONET and QLDTraffic.

---

## 5. Still unknown at implementation time

- Field-level response schema. The OpenAPI index names `V2Response_Model`,
  `V2Response_AcItem`, `V2Response_LastPosition`, `PlaneInstance`,
  `PlaneList`, but fields were not enumerated. Read
  <https://api.adsb.lol/api/openapi.json> before designing the normalizer.
- Whether `LastPosition` marks a stale position distinct from a live one. If
  so, it maps naturally onto the freshness model Signalwatch already uses for
  vessels, where provider observation time and Signalwatch receipt time are
  kept separate.
- Provider posture on military / PIA / LADD aircraft beyond simply exposing
  filters. Signalwatch should set its own policy rather than inferring one
  from endpoint availability.

---

## 6. Why this is not ADOPT

Every substantive legal question is answered favourably: the licence permits
commercial use, public display and derivative databases, and access is free
and keyless today.

What is missing is operational, and the provider itself defined it — it asked
production users to make contact, and published no rate limit. Writing an
adapter now would mean choosing a polling rate the provider has not sanctioned
against a network run by volunteers. That is the kind of "technically
accessible, therefore permitted" reasoning this admission process exists to
stop.
