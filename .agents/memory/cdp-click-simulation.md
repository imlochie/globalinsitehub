---
name: Chromium DevTools click simulation
description: Reliable click-event synthesis when testing app interactions through Chrome DevTools Protocol.
---

When using `Input.dispatchMouseEvent` to exercise a click in Chromium, include `clickCount: 1` on both the `mousePressed` and `mouseReleased` events. A down/up pair without it may not produce a browser click event.

**Why:** A globe-marker test appeared to miss an SVG target even though `document.elementFromPoint` confirmed the marker was under the pointer; the test event sequence had not emitted a click.

**How to apply:** Before changing UI handlers in response to a failed CDP click test, verify the hit target and set `clickCount: 1`. Prefer a browser automation library when one is already available.