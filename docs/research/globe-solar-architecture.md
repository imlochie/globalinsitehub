# Globe solar architecture (Checkpoint C2)

**Implements:** physically derived day/night on the existing WebGL globe.
**Does not implement:** weather on the globe (C3). The insertion point is
described in §6 and nothing else was built.

---

## 1. Why the existing renderer was kept

The Checkpoint C inspection established that
`components/satellite-sector-globe.tsx` is already a real three.js globe
(`react-globe.gl` → `three-globe` → `three`), not an SVG illustration. Its
material is already a `MeshPhongMaterial`, which responds to light, and the
component set **no lights at all** — so it was being rendered by the
library's default ambient and directional lighting.

That made the honest fix small: supply the lights. Nothing was replaced.

## 2. Illumination is computed, not drawn

There is no gradient overlay, no night PNG, no second canvas and no
hand-tuned terminator arc. A `DirectionalLight` is placed over the subsolar
point and three.js shades the sphere. The terminator is then the great circle
where the surface turns away from the light — which is what a terminator
physically *is*.

```
AmbientLight  0.22   night side stays legible, not black
DirectionalLight 3.2 positioned at solarLightPosition(solar)
```

The light sits 20 globe radii out so its rays are effectively parallel; a
near light would bend the terminator visibly and wrongly.

**One consequence worth stating:** because the shading comes from the
lighting equation and the marker comes from the same `SolarPosition`, the two
cannot disagree. The brief calls a disagreement here a hard defect; the
architecture makes it unrepresentable rather than merely tested.

The stylised "signal" texture mode had `emissiveIntensity: 0.2`. Emissive is
what a surface glows with *regardless of lighting*, so it is precisely what
erases a terminator. It was reduced to `0.06`: enough to keep the mode's
look, little enough that night is genuinely dark.

## 3. The algorithm

`lib/solar-geometry.ts`, pure, no React, no `Date.now()` inside it.

NOAA's Solar Calculator formulation, which follows Jean Meeus,
*Astronomical Algorithms* (2nd ed., 1998) — ch. 7 Julian day, ch. 22
obliquity, ch. 25 solar coordinates, ch. 28 equation of time. Published at
<https://gml.noaa.gov/grad/solcalc/calcdetails.html>.

**Accuracy, stated honestly.** NOAA gives roughly 0.01° of solar position for
1801–2099. That is about 1.1 km on the ground — a small fraction of a pixel
at any globe zoom, so it is far more than this needs.

**What is *not* claimed:** this is not a scientific ephemeris. No planetary
perturbations beyond the equation of centre, no atmospheric refraction, a
spherical Earth, and UT1≈UTC (up to 0.9 s, ~0.004° of rotation). Not suitable
for eclipse prediction or high-latitude sunrise times.

**Conventions.** Latitude positive north. Longitude positive east,
normalised to (−180, +180]. Hour angle positive west of Greenwich, equal to
−subsolarLongitude. Input is an absolute instant and every field is read with
`getUTC*`, so the host timezone cannot influence the result — the single most
likely way for this module to be subtly wrong, and the reason there is a test
asserting three spellings of one instant agree.

## 4. Verification against the sky

The tests are deliberately not round-trips. Each pins an independently known
astronomical fact:

| Check | Expected | Got |
| --- | --- | --- |
| Declination at the March/September equinoxes | 0 | 0.002 / 0.001 |
| Declination at the June/December solstices | ±23.44 (the obliquity) | +23.438 / −23.438 |
| Equation of time, annual minimum | ≈ −14.2 min, ~11 Feb | −14.23 on 2026-02-11 |
| Equation of time, annual maximum | ≈ +16.4 min, ~3 Nov | +16.49 on 2026-11-03 |
| Subsolar longitude drift | 15°/hour westward | 15.00 ± 0.05 |
| June solstice poles | North lit, South dark | confirmed, and swaps in December |
| Perth / Sydney at 2026-06-21T08:25Z | 16:25 AWST lit, 18:25 AEST dark | confirmed |
| Subsolar point vs brute-forced illumination maximum over the whole globe | coincide | within the 1° search grid |
| `geoToGlobeVector` vs three-globe's `polar2Cartesian` | identical | Δ = 0 |

The equation-of-time extremes are the strongest evidence: their magnitudes
*and their calendar dates* are textbook values this implementation was not
fitted to.

### The coordinate-inversion guard

three-globe does not export its `polar2Cartesian`, so `geoToGlobeVector`
mirrors it. A test re-implements the library's formula as an independent
oracle and asserts exact agreement, which means a dependency upgrade that
changed the convention fails loudly instead of silently lighting the wrong
hemisphere. The same convention places observation markers and country
polygons, so Sun and data cannot drift apart.

## 5. Time

`SolarTimeState` is `{mode: "live"} | {mode: "paused", instant} |
{mode: "simulated", instant}`. Only `live` is wired; the others exist so that
a scrubber is a new case in `resolveSolarInstant`, not a renderer rewrite.

Live ticks once per **60 s** (`SOLAR_LIVE_REFRESH_MS`). The Earth turns 0.25°
in that time — invisible at globe scale — and the brief forbids driving React
renders from the clock. One state update per minute, not one per frame.

**Solar time is not weather time.** Radar time is provider data describing
when the atmosphere was observed; the solar instant is which moment the
application is depicting. They coincide in live mode and diverge the moment
simulation exists, so they never share a field. A test asserts
`SolarPosition` carries no `productId`, `providerId`, `validTime`, `runTime`
or `freshness`.

## 6. Insertion point for globe weather (C3)

Not built. The intended composition order, per the brief:

```
Earth base texture
  → weather spatial surfaces      (customLayerData, reprojected)
  → solar illumination            (lights — already present)
  → atmosphere                    (showAtmosphere — already present)
  → observations                  (pointsData — already present)
```

Two structural facts make this additive rather than disruptive:

1. The **subsolar marker already uses `customLayerData`**, which is the same
   mechanism a reprojected weather surface would use. It is deliberately not
   in `pointsData`: that array is sectors and observations, and a calculated
   planetary position must never enter a collection where it could be
   selected, inspected, or counted as a record.
2. Weather must not become responsible for sunlight. The lights effect
   depends only on `SolarPosition`, so adding a weather layer cannot change
   the illumination, and a weather outage cannot darken the Earth.

The registry still throws if an imagery or field layer declares
`capabilities.globe`. That stays; C3's job is to add a separate
`globeSurface` capability so markers and surfaces keep separate renderers
and separate validation.

## 7. Known runtime dependency — Earth textures (C2.9)

The globe fetches its Earth textures from a third-party CDN at runtime:

```
https://cdn.jsdelivr.net/npm/three-globe/example/img/earth-topology.png
https://cdn.jsdelivr.net/npm/three-globe/example/img/earth-blue-marble.jpg
```

This predates Checkpoint C and **no new external dependency was added**.

**Is it covered by existing policy?** Yes, permissively rather than
deliberately:

- **Desktop CSP** — `img-src 'self' data: blob: https: http://127.0.0.1:*`.
  The broad `https:` admits it. It is permitted, but it was never
  specifically contemplated.
- **Service worker** — the shipped `sw.js` is a self-unregistering,
  cache-clearing worker. It caches nothing, so the "service worker must not
  cache provider imagery" invariant holds trivially, and these textures are
  not cached either.
- **Provider policy** — not applicable. This is a static basemap shipped in
  an npm package, not a data provider, and it makes no situational claim.

**Consequence, stated plainly: the globe is not fully offline.** With no
network the Earth texture fails to load. The lighting, the subsolar point,
the country outlines and the observation markers are all computed or bundled
locally and still work, so the failure is cosmetic rather than functional —
but it is real and should not be described as offline-capable.

**A project-native path already exists.** The exact files are already on disk
as part of the installed dependency:

```
node_modules/three-globe/example/img/earth-topology.png     378 KB
node_modules/three-globe/example/img/earth-blue-marble.jpg  1.4 MB
```

so bundling them is a build-config change, not an acquisition problem. Also
present and relevant later: `earth-night.jpg`, the city-lights night texture,
which is the natural companion to this checkpoint's day/night work — a real
night side showing human settlement rather than plain darkness.

Deliberately **not** done here: the brief says not to turn C2 into an asset
migration. Recorded for a future checkpoint.

## 8. What stays illustrative

The nine `SectorLocation` markers (Brisbane, New York, London, …) remain
decorative navigation aids and are still labelled "illustrative sector" in
the surrounding UI. They were not touched and must not be presented as
observations.

What is now real on the globe: Earth orientation, solar illumination, the
day/night boundary, the subsolar point, and observation coordinates. The
solar readout prints the subsolar latitude and longitude so the claim is
auditable against any almanac rather than taken on trust.
