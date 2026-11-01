# TechVerse dashboard

Next.js 16 App Router dashboard for TechVerse. React 19, Tailwind 4, and the
[`@adem.rejeb/ui`](https://www.npmjs.com/package/@adem.rejeb/ui) design system.

## Run

```bash
npm install
npm run dev      # http://localhost:3000
```

The API is expected at `http://localhost:3001/api` (override with
`NEXT_PUBLIC_API_URL`). Start the backend with `docker compose up -d` from the
repository root.

## Scripts

```bash
npm run dev      # dev server
npm run build    # production build (also type-checks)
npm run start    # serve the production build
npm run lint     # eslint
```

## Structure

```text
src/app/                 routes (App Router)
src/components/ui/       app-facing primitives (Button/Card backed by @adem.rejeb/ui)
src/components/platform/ shell, navigation, command palette
src/components/chat/     messaging UI
src/lib/                 api client, auth, i18n, theme, chat
```

## Styling

- `src/app/globals.css` imports Tailwind and the design system inside the `ui`
  cascade layer, then maps the app tokens (`--background`, `--primary`, …) onto
  the design system's `--ui-*` tokens.
- Theme is applied to `<html>` as both `class="dark"` and `data-theme`.
- Import primitives from `@/components/ui`, not from the package, so the app
  keeps a single API surface.

Full notes: [`../docs/UI.md`](../docs/UI.md).

## Notes

- `lucide-react` is 1.x; `@adem.rejeb/ui` declares `<1.0.0` as a peer, so
  `.npmrc` sets `legacy-peer-deps=true`.
- Arabic-first UI: use logical properties (`ps-*`, `pe-*`, `start-*`, `end-*`).
