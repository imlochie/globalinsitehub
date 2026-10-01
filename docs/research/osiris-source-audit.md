# OSIRIS source audit

Research record. **Nothing in this document is implemented.** It is an
inventory and adoption matrix produced by reading the OSIRIS source tree, not
its README.

- Repository: `https://github.com/simplifaisoul/osiris` (MIT, © 2026 simplifaisoul)
- Audited at: shallow clone of `master`, 958 files, 17 MB
- Signalwatch baseline: `bbf9d79`
- Recorded: 2026-09-30

**OSIRIS's MIT licence covers its code. It says nothing about the licence of
the data its adapters fetch.** Every data source below needs its own
first-party licence check before adoption. That check has *not* been done in
this pass except where noted.

---

## 0. Standing rules this audit applies

Three rules from existing Signalwatch practice govern every decision here.

1. **A source earns a viewing/observation capability from documented provider
   semantics, not because an adapter can technically retrieve something.**
   This is the rule established by the QLDTraffic camera work and it applies
   to every OSIRIS source: OSIRIS labelling something a "camera" or a "live
   feed" is not evidence.
2. **$0 recurring cost is an architectural invariant.** Free public data and
   free government-data accounts are allowed; paid APIs, usage billing and
   paid infrastructure are not.
3. **No runtime dependency on OSIRIS.** Techniques and source identities may
   be reproduced natively; OSIRIS's own hosts must never be called.

### Three findings that constrain everything below

**(a) OSIRIS proxies some media through its own infrastructure.**
`src/app/api/cctv/sweden.ts` references `osirisai.live`. Any adapter routed
through an OSIRIS-owned host is unusable for Signalwatch: it is someone else's
recurring cost and a runtime dependency on a third party. Adopt the *upstream*
source or nothing.

**(b) Several OSIRIS "layers" are hard-coded static data.**
`src/app/api/maritime/route.ts` ships a literal `PORTS` array (Shanghai,
Singapore, Rotterdam … with TEU volumes), and the README describes Conflict as
"13 Active Zones | **Static OSINT Intel**". These are reference tables
presented inside a real-time dashboard. Signalwatch must not import them as
observation layers — that is precisely the "no fake markers" rule.

**(c) OSIRIS's maritime feed is `aisstream.io`.** Signalwatch already
evaluated and **excluded** AISStream/AISHub by explicit product decision. This
audit does not reopen that.

---

## 1. OSIRIS inventory (derived from the source tree)

71 API route groups under `src/app/api/**`, 88 modules under `src/lib/**`,
47 CCTV adapter files.

| Domain | OSIRIS route | Upstream host(s) observed in source |
| --- | --- | --- |
| Aviation | `aircraft`, `flights`, `flight-route` | `opendata.adsb.fi/api/v2`, `adsb.lol/data/traces`, `api.adsbdb.com`, `opensky-network.org`, `api.airplanes.live`, `hexdb.io` |
| Maritime | `maritime` | `aisstream.io` (websocket) + hard-coded port table |
| Seismic | `earthquakes`, `country-risk` | `earthquake.usgs.gov` |
| Fires | `fires` | `firms.modaps.eosdis.nasa.gov`, `eonet.gsfc.nasa.gov` |
| Weather | `weather` | `api.weather.gov`, `eonet.gsfc.nasa.gov`, `www.gdacs.org` |
| Space | `satellites`, `satellites/orbit`, `space-weather` | `celestrak.org`, `db.satnogs.org`, `services.swpc.noaa.gov` |
| Air quality | `air-quality` | `api.openaq.org` |
| Connectivity | `radar`, `cloudflare-radar` | `api.ioda.inetintel.cc.gatech.edu`, `radar.cloudflare.com` |
| News / events | `news`, `gdelt-events`, `gdelt`, `live-news` | `feeds.bbci.co.uk`, `www.gdeltproject.org`, `www.gdacs.org`, `t.me`, `tass.com`, `www.aa.com.tr`, `youtube.com`, `rumble.com` |
| Conflict | `conflicts`, `frontlines` | `*.liveuamap.com`, `deepstatemap.live`, static zone table |
| Sanctions | `osint/sanctions` | OpenSanctions (CC BY 4.0, keyless per README) |
| Crypto / markets | `crypto`, `markets`, `chain/daily` | `api.coingecko.com`, `query1.finance.yahoo.com`, Blockstream/Blockscout |
| Cyber (passive) | `osint/cve`, `cyber-attacks`, `cyber-threats` | `cve.circl.lu`, `cveawg.mitre.org`, `feodotracker.abuse.ch`, `cisa.gov`, `shadowserver.org` |
| Cyber (active) | `scanner`, `osint/sweep`, `osint/shodan`, `osint/fingerprint` | — **out of scope, see §6** |
| Imagery | `sentinel` | `catalogue.dataspace.copernicus.eu`, `earth-search.aws.element84.com` |
| Infrastructure | `infrastructure` | `en.wikipedia.org`, `earthquake.usgs.gov` |

Credentials OSIRIS declares in `.env.example`: `FIRMS_API_KEY`,
`OPENSKY_CLIENT_ID/SECRET`, `N2YO_API_KEY`, `AIS_API_KEY`, `ETHERSCAN_API_KEY`,
`HELIUS_API_KEY`, `CLOUDFLARE_API_TOKEN`, `SCANNER_URL/KEY`. Everything not
listed there is keyless in OSIRIS's own configuration.

---

## 2. CCTV provider inventory

47 adapter files. Grouped by what the upstream actually is, because that
determines adoptability far more than the country does.

### 2a. Government open-data camera APIs — strongest candidates

| Adapter | Upstream | Note |
| --- | --- | --- |
| `finland` | `tie.digitraffic.fi`, `weathercam.digitraffic.fi` | **Fintraffic Digitraffic — CC BY 4.0, already a cleared Signalwatch provider for maritime.** Highest-confidence adoption in the whole audit. |
| `hongkong` | `data.gov.hk`, `tdcctv.data.one.gov.hk` | HK government open data portal |
| `netherlands` | `api.rwsverkeersinfo.nl` | Rijkswaterstaat open data |
| `newzealand` | `trafficnz.info` | NZTA |
| `iceland` | `vegagerdin.is` | Icelandic Road Administration |
| `lithuania` | `eismoinfo.lt` | Lithuanian road administration |
| `taiwan` | `thbapp.thb.gov.tw` | Taiwan THB |
| `australia` | `www.livetraffic.com` | **TfNSW — Signalwatch already has this provider.** |

### 2b. US state DOT "511" systems

`arizona` (az511), `florida`/`ibi511` (fl511), `georgia` (511ga), `indiana`
(511in, trafficwise), `louisiana` (511la), `michigan` (mdotjboss.state.mi.us),
`nevada` (nvroads), `northcarolina` (drivenc), `oregon` (tripcheck), `texas`
(its.txdot.gov), `utah` (prod-ut.ibi511.com), `edmonton` (Canada).

These are genuine public DOT camera systems, but several are operated by
commercial platform vendors (IBI/511 platforms) whose terms of use are *not*
open-data licences. **Each needs an individual terms check.** Grouped as
RESEARCH, not ADOPT.

### 2c. Third-party aggregators and UGC — mostly EXCLUDE

- `skylinewebcams.com` (`asia-skyline.generated`, `world-skyline.generated`,
  `italy`, `france`, `spain`, `switzerland`) — commercial webcam network;
  embedding is governed by their terms, not an open licence.
- `youtube.com` live pages (`czechia`, `germany`, `japan`, `poland`,
  `slovakia`, `spain`, `thailand`, `taiwan`, `france`) — UGC livestreams.
  At best `external-viewer`; resolving stream URLs out of YouTube pages is
  against their terms.
- `public-webcams.generated` — `*.streamlock.net` Wowza endpoints and similar,
  with no identifiable operator or licence. **EXCLUDE.**
- `opencctv.org`, `world-live`, `asia-live` — aggregator catalogues of
  unknown provenance.
- `sweden` — routes via `osirisai.live`. **EXCLUDE** per §0(a).
- Assorted single-host cameras (`bulgaria` via `meteo.chavo.biz`,
  `pics.smartburgas.eu`; `romania` via `home-solutions.bg`; `macedonia` via
  `streaming1.neotel.net.mk`; `serbia` via `kamere.amss.org.rs`) — private or
  unclear operators.

### 2d. The capability question

OSIRIS classifies streams as HLS / iframe / MJPEG and resolves live pages.
Signalwatch already has the right model for this (`live-image`,
`video-stream`, `external-viewer`, `catalogue-only`, `unavailable`). **The
OSIRIS classification must not be trusted as input** — each adopted provider
must declare `documentedAs` from its own published contract, exactly as
QLDTraffic and TfNSW do today.

---

## 3. Gap analysis against the Signalwatch layer registry

| Signalwatch layer | Status today | What OSIRIS could add |
| --- | --- | --- |
| `cameras` | operational — QLDTraffic, QLD ArcGIS, TfNSW, OpenTrafficCamMap | Digitraffic weathercams, HK, Rijkswaterstaat, NZTA, Iceland, Lithuania, Taiwan |
| `public-events` | operational — QLDTraffic, TfNSW (regional) | nothing directly; GDELT/GDACS are different semantics |
| `natural-hazards` | operational — USGS, EONET | **NASA FIRMS active fire hotspots**, **GDACS**, NOAA `api.weather.gov` alerts |
| `maritime` | operational — Digitraffic, BarentsWatch | nothing adoptable (AISStream excluded; ports table is static) |
| `aircraft` | **planned, blocked on a free provider** | **`opendata.adsb.fi`, `adsb.lol` — keyless in OSIRIS's own config.** Highest-value finding. |
| `satellites` | planned | `celestrak.org` TLEs, `db.satnogs.org` |
| `weather` | planned | `api.weather.gov` (US only), GDACS |
| `infrastructure` | planned | weak — OSIRIS uses Wikipedia scraping |
| *(none)* | — | **air quality** (OpenAQ), **internet outages** (IODA), **space weather** (NOAA SWPC) are genuinely new domains |

---

## 4. Adoption matrix

| Provider | Domain | Free | Auth | Decision | Notes |
| --- | --- | --- | --- | --- | --- |
| Digitraffic weathercams | cameras | yes | none | **ADOPT** | CC BY 4.0 already verified for maritime; same provider, same terms |
| NASA FIRMS | hazards | yes | **free MAP_KEY** | **ADOPT** (pending key decision) | Government open data; key is free registration, fits the amended account rule |
| NOAA SWPC | space weather | yes | none | **ADOPT** | US government, public domain |
| CelesTrak | satellites | yes | none | **RESEARCH** | Confirm redistribution terms for TLE sets |
| GDACS | hazards | yes | none | **RESEARCH** | Confirm licence; overlaps EONET semantics |
| `api.weather.gov` | weather | yes | none | **RESEARCH** | US-only; coverage honesty matters |
| adsb.fi / adsb.lol | aircraft | yes | none observed | **RESEARCH — priority** | Must verify ToS and whether read access requires feeding, as with ADSBHub |
| OpenSky | aircraft | yes | optional creds | **RESEARCH** | Anonymous access is heavily rate-limited |
| OpenAQ | air quality | yes | key on v3 | **RESEARCH** | Verify current key policy |
| IODA (Georgia Tech) | connectivity | yes | none | **RESEARCH** | Academic source; confirm acceptable use |
| OpenSanctions | sanctions | yes | none | **DEFER** | Licence fine (CC BY 4.0); no Signalwatch layer fits yet |
| HK / Rijkswaterstaat / NZTA / Iceland / Lithuania / Taiwan cameras | cameras | yes | varies | **RESEARCH** | Per-provider licence + capability check |
| US 511 systems | cameras | yes | varies | **RESEARCH** | Vendor terms, not open-data licences |
| SkylineWebcams, YouTube, streamlock hosts | cameras | n/a | n/a | **EXCLUDE** | Commercial/UGC terms; no redistribution right |
| `osirisai.live` routes | cameras | n/a | n/a | **EXCLUDE** | Third-party runtime dependency |
| AISStream | maritime | — | key | **EXCLUDE** | Already excluded by product decision |
| Static ports / conflict zones | — | — | — | **EXCLUDE** | Static tables, not observations |
| CoinGecko, Yahoo Finance, Etherscan, Helius | markets/crypto | mixed | keys | **EXCLUDE** | Outside the product; several are paid-tiered |
| Scanner, sweep, Shodan, fingerprint | active recon | — | — | **EXCLUDE** | §6 |

---

## 5. Implementation roadmap

Deliberately ordered by *verified value per unit of risk*, not by OSIRIS's
domain list.

- **Batch A — Aircraft unblock (research first).** Verify adsb.fi / adsb.lol
  terms to the standard already applied to ADSBHub and ADSB IQ. If a provider
  genuinely permits keyless read access without a feeding obligation, the
  Aircraft layer moves from `planned` to implementable. This is the single
  biggest capability gain available and it needs no new architecture.
- **Batch B — Camera expansion, government sources only.** Digitraffic
  weathercams first (licence already cleared), then HK, Rijkswaterstaat, NZTA.
  Each as its own provider adapter with `documentedAs` from its own contract.
- **Batch C — Natural hazards expansion.** NASA FIRMS active fire hotspots,
  which materially extends a layer that currently depends on EONET's curated
  event list.
- **Batch D — New domains.** Space weather (NOAA SWPC) as a new layer;
  satellites (CelesTrak) if terms clear.
- **Batch E — Air quality / connectivity.** OpenAQ and IODA, both pending
  terms verification.
- **Batch F — US 511 cameras**, only for states whose terms permit
  redistribution.

Each batch ships as its own commit with its own provider decision record, the
same way maritime, hazards and public events did.

---

## 6. Excluded by safety boundary

OSIRIS contains `scanner`, `osint/sweep`, `osint/shodan`,
`osint/fingerprint`, `osint/leaks`, `osint/hudsonrock` and related tooling.
These perform or query active reconnaissance, credential-exposure and
host-vulnerability data.

Signalwatch is a passive public-observation system. These are **not** adopted,
and they are not "deferred" — they are out of scope, consistent with the
existing `research/future-concepts.md` boundary. Passive, published CVE
advisories (MITRE/CIRCL) remain acceptable in principle but have no layer
today.

---

## 7. Techniques worth reproducing (not copying)

Small, genuinely useful patterns observed in `src/lib`:

- `camera-catalog.ts` — "Partial retries must add cameras, not erase
  previously loaded regions." Signalwatch's provider isolation already does
  this per provider; the regional variant is worth keeping in mind as camera
  counts grow.
- `fetch-pool.ts` — bounded concurrency across many provider fetches. Relevant
  once the camera provider list grows past a handful.
- `camera-preview.ts` / `cctv-snapshot.ts` — snapshot handling and image-type
  detection.
- Viewport-aware and regional loading — relevant to Signalwatch's existing
  sampling model rather than a replacement for it.

None of these require importing OSIRIS code; they are ideas, and Signalwatch's
own architecture already has the right seams for them.

---

## 8. Unresolved

- Terms of service for adsb.fi, adsb.lol, OpenSky anonymous access.
- Whether NASA FIRMS' free `MAP_KEY` registration is authorised under the
  amended "free government-data accounts" rule — it appears to qualify.
- Licence terms for CelesTrak, GDACS, IODA, OpenAQ v3.
- Individual terms for every US 511 platform.
- Whether any camera provider in §2a documents a current-image URL to the same
  standard QLDTraffic does. **Until that is checked per provider, none of them
  can be classified above `catalogue-only`.**
