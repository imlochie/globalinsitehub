---
name: Leaf workspace package installs
description: Add dependencies to the owning package when the package installer targets a pnpm monorepo root.
---

Install app-specific dependencies in their owning pnpm workspace package, not the monorepo root. In this workspace, the package installer attempted a root-level `pnpm add` and failed with `ERR_PNPM_ADDING_TO_ROOT`; a package-filtered pnpm add worked.

**Why:** Keeping dependencies in the leaf package makes ownership and deployment requirements explicit without polluting shared workspace tooling.

**How to apply:** If the package helper targets the workspace root, retry with `pnpm --filter @workspace/<package> add ...` and verify the dependency is recorded in that package's manifest.