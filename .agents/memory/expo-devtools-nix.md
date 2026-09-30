---
name: Expo DevTools on Nix
description: Non-fatal React Native DevTools installation warning in the Expo preview environment.
---

The Replit Nix mobile preview may report that React Native DevTools could not start because `libglib-2.0.so.0` is unavailable, while Metro still reports ready and the Expo web preview loads.

**Why:** DevTools are optional to bundling and preview; treating this message alone as an app failure can lead to unnecessary package or system changes.

**How to apply:** Confirm Metro is ready and the app preview bundles before investigating the missing library. Treat it as blocking only if the bundler or app itself fails.