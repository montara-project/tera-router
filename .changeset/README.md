# Changesets

Versioning and changelog tooling for this monorepo ([changesets](https://github.com/changesets/changesets)).

## Adding an entry

After a user-facing change, run `pnpm changeset` from the repo root, pick the
affected packages (`@tera/web`, `@tera/main`, `@tera/docs`, `@tera/server`), and
choose a bump level. This writes a markdown file under `.changeset/` — commit it
with your change.

## How releases work

Merging into `main` triggers the `Changesets` workflow: it consumes the pending
entries and opens/updates a **Version Packages** PR that bumps every affected
`package.json` and writes `CHANGELOG.md` files. Changelog entries are formatted
by `@changesets/changelog-github`, so they link PRs and authors. Merge that PR
to cut the release.

All workspace packages are `private`, so nothing is published to npm — this
setup only maintains versions and changelogs. Docker images are published
separately by `.github/workflows/release.yml`.

## Running `changeset version` locally

`@changesets/changelog-github` calls the GitHub API while writing changelogs.
Provide a token locally or the command fails:

```sh
GITHUB_TOKEN=$(gh auth token) pnpm changeset:version
```
