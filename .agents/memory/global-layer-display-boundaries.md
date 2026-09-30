---
name: Global-layer display boundaries
description: Rules for combining source-backed observations with illustrative global views.
---

Operational points use only coordinates present in their public source records. The globe displays a provider-balanced sample of camera records capped at 180 and keeps a selected camera visible even when it falls outside that sample. The detailed map and list remain the place to inspect the full bounded catalogue. Sector markers and replay stay visually separate and are never treated as source observations.

**Why:** A globe becomes unreadable at catalogue scale. Sampling preserves provider representation without discarding records, while keeping the selected item accessible and the full bounded set available in the detailed map and list.

**How to apply:** When adding a provider or operational layer, retain its source coordinates and attribution, define a render cap or sampling policy for globe-scale data, preserve the selected record in view, and expose the full bounded dataset through the detailed map/list.