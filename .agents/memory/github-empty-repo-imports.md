---
name: Empty GitHub repositories
description: Bootstrap Git Database API writes when importing source into a repository with no commits
---

When a GitHub repository is empty, creating a blob through the Git Database API can fail with `409 Git Repository is empty`. Bootstrap with a Contents API commit using an existing source file, then create the complete tree and commit. If the goal is one clean root commit, move the branch to the full root commit only after confirming the repository was empty. Recursive tree responses include directory entries; compare source paths, modes, and blob hashes only against entries with `type: blob`.

**Why:** Direct blob creation was rejected before the repository had a commit, and the recursive verification response included directories in addition to files.

**How to apply:** For a source import into a confirmed-empty repository, create a small source-backed seed commit, add the full tree, then verify blob entries. Only replace the seed branch tip when there was no pre-existing history to preserve.