---
name: preview-to-host
description: Save a rig page as one HTML file and put it on a public host (Vercel CLI), then later upload it again without the lane marker over the same link. Use for a plan's "Preview for review" and "Clean up" steps (ADR 0003).
---

# preview-to-host

A preview is one static HTML file on a public HTTPS link we can upload over (ADR 0003). The
file never goes into the repo, an issue or a chat attachment.

## Before you start

- Ask the human before each upload: what it is, where, who can see it, how to undo it.
- The Vercel CLI must be signed in (`vercel whoami`). If not, the human runs `vercel login`.
  With nvm, a fresh shell may not find `vercel`: give the full path (`which vercel`).

## Save the page

Use a folder outside the repo, e.g. `../preview/`. Port 8799 avoids a running dev server.

```sh
PORT=8799 pnpm start &                     # with the marker from .env
curl -sf localhost:8799/digest/<night> -o ../preview/index.html
kill %1
```

For the clean copy, start it with `LANE_MARKER= PORT=8799 pnpm start` instead. Check the file:
`grep -c <marker> index.html` must be 0 and `grep 'no marker set'` must match.

## Upload

```sh
cd ../preview && vercel deploy --prod --yes   # first time: add --name <project>
```

Send only the `Aliased:` link (e.g. `https://<project>.vercel.app`). Per-deployment URLs sit
behind Vercel login. Before you send it, check it like a stranger would:
`curl -s -o /dev/null -w "%{http_code}" <link>` must say 200.

The clean-up deploys again from the same folder (it holds `.vercel/`), so the alias is overwritten.
Check the live link no longer shows the marker.

## Issues

The review issue stays open until the reviewer has looked, not until the link is sent (AGENTS.md).
Delete the Vercel project when the preview is no longer needed.
