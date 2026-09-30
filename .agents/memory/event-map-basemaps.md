---
name: Event map basemaps
description: Basemap provider behavior observed while implementing Signalwatch’s dark event map.
---

Prefer a basemap whose tile requests are verified in the actual preview. The CARTO `dark_all` tile URL returned visible “API KEY REQUIRED” tiles in Signalwatch; standard OpenStreetMap tiles returned images and worked with a CSS dark filter.

**Why:** A basemap can fail independently of the map component and leave a map that looks blank even while markers and controls work.

**How to apply:** When changing tile providers, test a real tile response and inspect the rendered map; retain the provider’s required attribution and keep event markers limited to source coordinates.