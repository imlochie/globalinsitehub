# Mobile-first — permanent architectural constraint

Status: **permanent and binding from now on.** Applies to all new UI and
service architecture, including work already in progress.

---

## 1. The rule

**Phone support is not a later port.** It is not a milestone, not a
"responsive pass", and not something C-something will deal with. Every new
piece of UI and service architecture must *stay* compatible with phones as it
is written.

**Desktop-only assumptions must not enter shared application logic.**

That is the whole constraint. The rest of this document is what it implies.

## 2. What "compatible" means concretely

New work must remain workable under all of:

- responsive phone layouts and narrow viewports
- touch input
- intermittent connectivity
- mobile storage limits
- installable PWA behaviour
- deep links
- push where supported
- device location permissions
- battery-conscious refresh
- low bandwidth

## 3. Rendering

Map and globe rendering **needs a mobile fallback**, and **WebGL must degrade
gracefully**.

The globe already sits behind a `webglAvailable` check and a
`WebGLErrorBoundary` with a static fallback, which is the right shape. That
shape must be preserved, not bypassed, as the globe gains capability — the
Checkpoint C3 surface renderer inherits it.

A phone that cannot run the globe must still be a usable Signalwatch, not a
broken one.

## 4. Background work

**Long-running background polling must never be assumed alive on a phone.**

iOS and Android suspend, throttle and kill background execution on their own
schedule. Any design whose correctness depends on a timer continuing to fire
is already wrong on mobile. State must be reconstructable on resume rather
than accumulated by an always-running loop.

This interacts directly with provider cadence rules: a resumed client must
not stampede a provider to catch up.

## 5. Sharing between Arena and Signalwatch

**Arena and Signalwatch share API and data contracts, not UI
implementations.**

The Arena OS connector must therefore be **network/API based, not
desktop-process based**, so Windows, browser, iOS and Android can all use it.
See `arena-os-connector-directive.md`.

## 6. Why this is recorded as a constraint rather than a task

A port can be scheduled. A constraint has to be enforced at the moment each
decision is made, because the cost of a desktop-only assumption is paid when
it is removed, not when it is introduced — and by then it is load-bearing.
