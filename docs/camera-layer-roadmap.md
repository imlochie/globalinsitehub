# Signalwatch camera layer

## Stage 1 — Provider contract and catalogue metadata

Implemented: the API exposes normalized camera metadata at `GET /monitoring/cameras` through a provider registry. The first adapter reads OpenTrafficCamMap's public USA catalogue, validates its nested structure, URLs and coordinates, ignores `(0, 0)` entries, deduplicates feed URLs, and caches the catalogue in memory.

The response reports catalogue health separately from feed reachability. `available` means the catalogue request and its structure were accepted; every camera's `feedStatus` remains `not-probed`. Signalwatch does not request camera URLs, proxy media, or claim that a listed feed is live or reusable. Catalogue attribution is returned with each provider and camera record. The OpenTrafficCamMap repository identifies the catalogue as MIT-licensed; this does not grant rights to the third-party media at the listed URLs.

Source: [OpenTrafficCamMap](https://github.com/AidanWelch/OpenTrafficCamMap), USA catalogue at `cameras/USA.json`, licence at [LICENSE](https://github.com/AidanWelch/OpenTrafficCamMap/blob/master/LICENSE). The repository warns that the USA catalogue is being modernized, so parsing is defensive and rejects unexpected top-level structure.

## Stage 2 — Web camera layer

Add a camera layer to the existing Signalwatch web experience using the normalized API contract. The layer should show provider attribution and catalogue/feed status clearly, preserve existing monitoring events, and never present an unprobed feed as live.

## Stage 3 — Coverage expansion: Australian government traffic cameras

Australia is the first official-provider expansion. The Queensland TMR adapter reads the public State controlled traffic camera ArcGIS layer, currently returning 158 validated camera records with direct JPEG snapshot URLs and CC BY 3.0 attribution. The camera endpoint supports country and provider filters, for example `?country=AU&provider=qld-tmr&limit=50`.

The Transport for NSW adapter reads the public GeoJSON file documented in the official Live Traffic NSW Developer Guide at `https://data.livetraffic.com/cameras/traffic-cam.json`. It currently returns 241 validated records with direct JPEG snapshot URLs. The file's rights metadata identifies Transport for NSW and links to its CC BY dataset. The separate API endpoint requires a key and is not used; no credentials are sent and individual snapshots remain unprobed. Country/provider filters also support `?country=AU&provider=transport-for-nsw`.

Before adding other regions or providers, review catalogue shape, attribution, licence, public-access terms, and update behavior. OpenTrafficCamMap's other country catalogues and Argus coverage references are candidates for assessment, not runtime dependencies.

## Stage 3b — Coverage expansion: Finland and Hong Kong

Two providers added by the OSIRIS migration batches, both keyless and free.

**Fintraffic Digitraffic road weather cameras** (Finland, CC BY 4.0) supply the
first provider-published per-camera availability signal, so `unavailable` is a
real provider-sourced state rather than a guess. Signalwatch identifies itself
with the `Digitraffic-User` header the provider asks for.

**Hong Kong Transport Department traffic snapshot images** (Camera Batch 2A)
are published through DATA.GOV.HK under terms that permit commercial and
non-commercial reuse, redistribution and reproduction with attribution. The
imagery clears the independent media-class test on its own evidence: the terms
define "Data" to include photographs, and each of the ~1,013 JPEGs is published
as a first-class dataset resource. The provider documents the request path
`https://tdcctv.data.one.gov.hk/<Key>.JPG`, a 320x240 JPEG response and a
two-minute refresh. Unlike Digitraffic, it publishes no per-camera availability
field — a temporarily unavailable camera shows the provider's own "No Service"
frame — so this adapter never emits `unavailable`.

Decision records: `docs/research/providers/hk-td-traffic-snapshots-admission.md`
and `docs/research/providers/rijkswaterstaat-cameras-exclusion.md`.

The camera country selector is derived from the layer registry rather than
hard-coded, so registering an admitted provider is sufficient to make it
selectable.

## Stage 4 — Media and playback

Consider direct playback only for sources whose access and reuse terms permit it. Keep media delivery separate from catalogue discovery; do not add a relay, proxy, hosted camera service, or per-camera health probe without an explicit product and rights review.

## Stage 5 — Persistent history and cross-layer correlation

After coverage and media behavior are established, assess persistent camera/entity history and correlation with existing monitoring events. Keep this additive to the current news, USGS earthquake, and NASA EONET event model.