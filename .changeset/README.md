# Changesets

Run `pnpm changeset` to describe a change. On merge to `main`, the release workflow opens a
"chore: release" PR. Merging that PR bumps the version, updates `CHANGELOG.md`, publishes the
package to npm, tags `vX.Y.Z` and creates a GitHub release.
