# NASA FIRMS — active fire provider admission record

**Status: ADOPT**, via the keyless bulk download path. Researched 2026-09-30
against Signalwatch `d884628`, under `source-admission-standard.md`.

---

## 1. The MAP_KEY question was the wrong question

The OSIRIS audit recorded FIRMS as "ADOPT (pending key decision)", on the
assumption that a free NASA `MAP_KEY` registration would be required and would
need to be judged against the amended government-account rule.

Reading the provider's own pages shows **two distinct access paths**, and only
one of them involves a key:

| Path | Key | Purpose |
| --- | --- | --- |
| **Bulk active fire downloads** — `firms.modaps.eosdis.nasa.gov/data/active_fire/...` CSV / shapefile / KML, 24h / 48h / 7d, world and regions | **none** | Published directly on the FIRMS "Active Fire Data" page as the standard download product |
| **Area API** — `/api/area/csv/[MAP_KEY]/[SOURCE]/[AREA]/[DAY_RANGE]` | **free MAP_KEY**, quota-metered ("map transactions") | Bounding-box queries and Real-Time / Ultra Real-Time data |

The bulk path is not a scrape or an undocumented endpoint: the Active Fire
Data page publishes the exact URLs per product, per region, per window.

**Consequence:** Signalwatch needs no NASA account at all for the product it
wants. The amended government-account rule is not invoked. The account
question only returns if Signalwatch later needs RT/URT or bounding-box
queries, which it does not.

*Evidence:* <https://firms.modaps.eosdis.nasa.gov/active_fire/> (download
tables, keyless URLs) and <https://firms.modaps.eosdis.nasa.gov/api/area/>
("To use FIRMS web services, request **free** MAP_KEY"; "Mapkey transaction
amount"; RT/URT availability).

## 2. The OSIRIS source list is about to break

OSIRIS's `api/fires/route.ts` pulls exactly two products:

```
.../suomi-npp-viirs-c2/csv/SUOMI_VIIRS_C2_Global_24h.csv
.../modis-c6.1/csv/MODIS_C6_1_Global_24h.csv
```

FIRMS currently carries this notice:

> "Delivery of Suomi National Polar-orbiting Partnership (Suomi NPP) satellite
> data products will cease on **November 1, 2026**. Data users should
> transition now to alternative products from NOAA-21 and NOAA-20."

Today is 2026-09-30. Migrating OSIRIS's source list verbatim would have
shipped a provider that stops producing data in about a month.

Signalwatch therefore uses the **NOAA-20** product as primary, with the option
of NOAA-21:

```
.../noaa-20-viirs-c2/csv/J1_VIIRS_C2_Global_24h.csv     NOAA-20, VIIRS 375 m
.../noaa-21-viirs-c2/csv/J2_VIIRS_C2_Global_24h.csv     NOAA-21, VIIRS 375 m
```

This is invariant 2 earning its place: OSIRIS's working implementation was not
evidence that its source choice was current.

## 3. Admission lines

| Line | Finding |
| --- | --- |
| Identity | NASA LANCE / FIRMS, `firms.modaps.eosdis.nasa.gov` |
| Access | **none** — keyless bulk download |
| Registration | **none** for this path |
| Cost | **$0** |
| Licence | NASA EOSDIS open data. Established in `research/natural-hazards-source-decision.md`: ESDIS content "is generally not copyrighted", NASA asks to be acknowledged, mission data defaults to CC0 where unmarked |
| Attribution | "Source: NASA FIRMS (LANCE / EOSDIS)" |
| Coverage | **Global**, satellite-derived |
| Latency | NRT is "available within 60 minutes of satellite overpass" per NASA's own definition. RT/URT are faster but live behind the keyed API, so Signalwatch's product is NRT |
| Observation semantics | Each row is a **thermal anomaly / active fire detection pixel**, not a confirmed fire. FIRMS publishes a per-detection `confidence` value |
| Rate limits | None published for the bulk files. They are static artefacts regenerated periodically, not a query API |

## 4. Operational constraints this imposes

Unlike every provider migrated so far, this is a **bulk artefact**, not a
query endpoint. Two consequences:

1. **The 60-second shared hazard cache is wrong for it.** A global 24-hour
   detection file is regenerated on satellite-overpass timescales, so polling
   it every minute would transfer megabytes repeatedly for no new data. FIRMS
   gets its own longer cache window.
2. **The response must be bounded.** A global 24-hour VIIRS file can contain
   tens of thousands of detections. Signalwatch must cap what it normalises
   and say so, rather than pushing an unbounded set into the layer.

## 5. Honest language required

- A detection is **not** a confirmed fire. The record must carry FIRMS'
  `confidence` as the source's own value and must not be relabelled as a
  severity or certainty score.
- Coverage is global but **satellite-overpass sampled**: a fire between
  overpasses, or under cloud, is not detected. "No detections here" is not
  "no fire here".
- The detection time is the satellite acquisition time, kept distinct from
  Signalwatch receipt time.

## 6. Decision

**ADOPT.** No key, no account, no cost, licence already established for the
same NASA data family, global coverage, documented product semantics, and an
official keyless distribution path.

Conditions folded into the implementation rather than left outstanding:

1. Use NOAA-20 / NOAA-21, never Suomi NPP.
2. Separate, longer cache window from the other hazard feeds.
3. Bounded normalisation with the cap disclosed.
4. `confidence` carried as the source's own value.
5. Coverage described as satellite-sampled, not continuous.
