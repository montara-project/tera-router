---
title: "Long-list forms use SimpleAlertScrollableDialogForm, keyed by id+open to reset"
author: Masb0ymas
date: 2026-10-23
branch: dev
cost: { minutes: 6, tokens: 64883 }
id: l-381ff138
scope: repo
status: active
touches:
  - apps/web-ui/src/components/block/traffic/chains/chain-form-dialog.tsx
  - apps/web-ui/src/components/block/traffic/model-alias/alias-form-dialog.tsx
  - apps/web-ui/src/components/block/common/simple-alert-scrollable-dialog-form.tsx
---

## Decided
Forms whose rows grow unbounded (chain Steps, model alias Fallback Order) render through `apps/web-ui/src/components/block/common/simple-alert-scrollable-dialog-form.tsx` so the body scrolls while header and footer stay visible. The user asked for this for `traffic/chains/chain-form-dialog.tsx` and `traffic/model-alias/alias-form-dialog.tsx`.

## Watch out
With this component the `useAppForm` hook lives outside `AlertDialogContent`, so closing the dialog no longer unmounts the form state. Both dialogs key the inner form by `${id ?? 'new'}-${open}` so each open starts from fresh defaults. The cost is that the dialog closes without its exit animation. To keep the animation, call `form.reset()` when the dialog opens instead.
The shared component takes only string `title`/`description`, so the old `IconBadge` header icon was dropped. Its loading label reads "Loading...".
