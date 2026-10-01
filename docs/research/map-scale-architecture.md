# Map 2.0 — scale-aware rendering

**Status:** Checkpoint A implemented.
**Supersedes nothing.** Extends the layer registry and the spatial layer model
described in `weather-layer-architecture.md`.

---

## 1. The problem this solves

Signalwatch was scale-blind. The map had one behaviour at every zoom: draw
every enabled layer, everywhere, identically. Zooming in produced more
pixels, not more information.

That is the wrong shape for a situational-awareness product, because the
question a user is asking changes as they zoom:

| Band | Question |
| --- | --- |
| global | What is happening? |
| regional | What is happening here? |
| city | What is happening around this place? |
| street | What is happening on this road? |
| streetContext | What does the situation look like from here? |

A layer that is informative at one of those scales can be noise or, worse, a
false claim at another.

There was also a concrete gap. `isOutsideCoverage()` had existed since Weather
Batch 1 and was fully tested, but `use-global-layer-data.ts` hardcoded
`viewport: null` with a comment saying it was not plumbed through. The
coverage model was therefore **enforced but silent**: Leaflet's per-area
`bounds` stopped the requests, so no dishonest pixel was ever drawn, but
nothing in the UI could say *why* the map was empty. "No radar source here"
was unreachable code.

---

## 2. Scale bands

`src/lib/map-scale.ts`. Five named bands over Leaflet zoom 2–18.

The edges are derived from ground resolution, not chosen for roundness.
Leaflet's EPSG:3857 CRS uses 256 px tiles across a 40 075 016.686 m equator,
so `metresPerPixel(z) = 40075016.686 / (256 · 2^z)`:

| Band | Zoom | m/px | A 1024 px view spans | Why the cut is here |
| --- | --- | --- | --- | --- |
| global | 2–3 | 39 135 – 19 567 | 40 074 – 20 037 km | a road is smaller than one pixel |
| regional | 4–7 | 9 784 – 1 223 | 10 018 – 1 252 km | country to continent |
| city | 8–11 | 611 – 76 | 626 – 78 km | a city fits on screen |
| street | 12–15 | 38 – 4.8 | 39 – 4.9 km | roads acquire width and separation |
| streetContext | 16–18 | 2.4 – 0.6 | 2.4 – 0.6 km | lane and frontage level |

The test suite re-derives these from the projection constants rather than
restating them, so changing the table means satisfying the arithmetic.

Bands clamp rather than throw for out-of-range or fractional zoom: Leaflet
reports both mid-animation, and a renderer must not crash because an easing
function overshot.

Three constants the map previously hardcoded now come from this table:
`MAP_MIN_ZOOM`, `MAP_MAX_ZOOM`, `MAP_DEFAULT_ZOOM`. One changed meaning:
`MAP_FOCUS_ZOOM` (the zoom used when a selected record is flown to) was the
literal `6`, which sits mid-`regional` — selecting a single camera framed it
on a view over a thousand kilometres across. It is now the bottom of `city`.

---

## 3. Layer scale policy

Declared on the layer, read by shared code:

```ts
scale?: {
  minBand?: MapScaleBand;   // below this the layer is noise
  maxBand?: MapScaleBand;   // above this the layer overclaims
  note?: string;            // required if either end is set
}
```

Two rules are enforced at registration by `validateLayerDefinition`:

- an inverted range throws, because the layer could never draw;
- **a restricted range without a `note` throws.** A layer that disappears at
  some zoom and cannot explain itself is indistinguishable from a bug.

An absent policy means the full range. That is the regression guarantee:
introducing this model changed the behaviour of exactly one layer, and a test
asserts that cameras, public events, maritime and natural hazards all remain
visible at every band.

`registry.visibleAtBand(band)` lets shared rendering ask which layers belong
at the current scale without naming any of them. No `if (layerId === ...)`
was added to any renderer.

### 3.1 The one restriction, and why it is the provider's decision

Radar declares `maxBand: "street"`.

This is read off NOAA's own metadata, not chosen for taste. The MRMS mosaic
publishes a pixel size of **564.774 m** (recorded in
`providers/nws-radar-wms-admission.md`). Leaflet reaches that resolution at
about zoom 8. By the top of `street` (zoom 15, 4.78 m/px) one source sample
already covers ~118 screen pixels; in `streetContext` (zoom 16–18) it covers
236 to 945.

At that point nothing on screen is observation. It is interpolation between
samples half a kilometre apart, drawn sharply enough to look like detail —
the same category of error as painting transparent pixels over Europe and
letting them read as "no rain". A test asserts the cut stays somewhere the
upsampling factor exceeds 100×, so the limit cannot quietly drift into
territory where it is merely a preference.

There is no limit at the coarse end: a continental mosaic is exactly what the
world view should show.

---

## 4. Viewport plumbing, and the hazard it created

`SignalMap` now reports its settled view (`moveend` / `zoomend`, never
mid-gesture) through `onViewChange`. `useGlobalLayerData` holds it and passes
`viewport` and `band` into the spatial layer source.

This is where the danger was. Every settled pan produces a **new surface
list**, because availability and message text are resolved against the
viewport. The raster effect previously depended on the `imagery` array, so
wiring the viewport naively would have made Leaflet destroy and rebuild every
WMS layer on each pan — re-requesting NOAA tiles far more often than the
ten-minute floor allows. The NWS appropriate-use notice treats that as abuse,
not as waste. It is the same class of bug caught before `64d02c1`, and
plumbing the viewport would have reintroduced it in a worse form, because it
would fire on user input rather than on React's whim.

The fix is structural rather than a dependency-array patch:
`imageryRenderSignature()` is a **value identity for the tile layers that
would be constructed** — endpoint, layer, version, CRS, format, transparency,
opacity, attribution, selected frame, clip areas. It deliberately excludes
availability, freshness and message.

The raster effect depends on that string. Panning changes none of its inputs,
so the tile layers survive; toggling the layer, a new frame, leaving coverage
or crossing the resolution limit all change it, and the layers are rebuilt
exactly then.

This is asserted, not asserted-by-comment. Tests confirm two different
in-coverage viewports at two different bands produce an identical signature,
and that leaking either `availability` or `freshness` into it fails the suite.

A second guard sits in `useGlobalLayerData`: an identical reported view
returns the previous state object, because Leaflet re-fires `moveend` for
gestures that end where they started and for `invalidateSize`.

---

## 5. What the user is told

`SpatialAvailability` gained `beyond-resolution`. Precedence in
`resolveAvailability`, strongest first:

1. `unavailable` — the provider failed. Outranks everything, because any
   statement about coverage would be unsupported.
2. `unconfigured`
3. `outside-coverage` — there is no source here.
4. `beyond-resolution` — there is a source and it covers here, but the view
   is finer than its samples.
5. `stale` / `covered`

Coverage outranks resolution deliberately. Over Europe at street-context zoom
both hold; the user needs "there is no radar here", because a resolution
caveat would imply a source exists and is merely coarse.

The weather panel renders these as distinct, named silences:

- **No radar source here** — followed by the provider's own coverage note,
  and never the words "no precipitation", "no rain" or "clear".
- **Not drawn at this zoom** — followed by the scale note.

Tests assert the forbidden phrasings are absent, and that an **off** layer
announces no coverage gap at all: a layer that is switched off is not making
a claim about anywhere.

### 5.1 Available vs Active

The layer control now shows two independent badges per operational row:

- **Available** — Signalwatch has an admitted source. A property of the
  registry, not of the session.
- **Active / Inactive** — the user's switch.

Collapsing these is how an implemented layer reads as missing. Weather is
operational and admitted but ships switched off, and a single dimmed row
could not distinguish "we have no source for this" from "you have not turned
it on". The first is a limitation of the product; the second is a choice the
user already made.

The map also shows the current band and the question it answers, so the scale
model is visible rather than implicit.

---

## 6. What was deliberately not done

- **No layer was suppressed without evidence.** Only radar restricts its
  range, and only because the provider publishes a sample size. Guessing that
  cameras are "too dense at world zoom" would have been a taste judgement
  dressed as architecture; the existing `provider-balanced` sampling cap
  already bounds marker counts.
- **No second registry, no weather-specific map component, no GIS
  framework.** The policy is four optional fields on the existing
  `LayerDefinition`.
- **No street-context provider, no navigation layer, no traffic source.**
  Those are Checkpoints C–G and each needs admission research first.
- **The globe was not touched.** It already filters on `capabilities.globe`,
  which radar declares `false`, so raster surfaces structurally cannot reach
  it.

---

## 7. Manual acceptance checks

Scale behaviour that cannot be proven without a browser. The frontend test
environment has no DOM, so Leaflet is never instantiated.

1. Open the map. The readout says **Global · What is happening?**
2. Zoom in. The readout passes through Regional, City, Street, Street
   context at zooms 4, 8, 12 and 16.
3. Enable Weather over the United States at city zoom. Radar draws.
4. Keep zooming past zoom 16. The radar disappears and the panel reads
   **Not drawn at this zoom**, with the 565 m explanation.
5. Pan to Europe. Nothing draws and the panel reads **No radar source here**.
6. With devtools open, pan repeatedly inside the United States at a fixed
   zoom. **No new `GetMap` requests should be issued for already-visited
   tiles** — this is the behaviour `imageryRenderSignature` exists to
   guarantee, and the only way to confirm it end-to-end.
7. Switch Weather off and on. The badges move between Inactive and Active
   while **Available** stays lit throughout.
