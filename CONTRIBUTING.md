# Contributing

Issues and pull requests are welcome. For bigger changes, please open an issue first so we can
talk about it.

## Setup

```sh
pnpm install   # also builds dist/
pnpm dev       # rebuild on change
```

To try a local checkout in an app, add `"@bztes/vibes-t0n": "link:../path/to/vibes-t0n"` to its
dependencies.

## Studio

The studio UI is a Svelte app in [src/studio/ui](src/studio/ui), served by
[src/studio/server.ts](src/studio/server.ts). To work on it with hot reload, run the studio
server for an app and the UI dev server side by side:

```sh
pnpm studio --locales ../some-app/locales   # API on port 4983
pnpm dev:studio                             # UI with hot reload, open the printed URL
```

## Before opening a pull request

```sh
pnpm check     # type check, including the Svelte files
pnpm test      # run the tests (pnpm test:watch while working)
pnpm format    # format with prettier
pnpm changeset # describe your change for the changelog
```
