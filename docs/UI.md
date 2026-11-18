# UI — `@adem.rejeb/ui` integration

The dashboard (`techdebt-platform/`) uses the personal design system
[`@adem.rejeb/ui`](https://www.npmjs.com/package/@adem.rejeb/ui) — a
token-driven, accessible React 19 component library with 135 components and
`ui-` prefixed CSS.

## Install

```bash
npm --prefix techdebt-platform install
```

`techdebt-platform/.npmrc` sets `legacy-peer-deps=true` because the design
system declares `lucide-react <1.0.0` as a peer while the dashboard uses
`lucide-react` 1.x. The icon API the library uses is unchanged.

## Styles and cascade layers

The stylesheet is imported once, from `src/app/globals.css`:

```css
@layer theme, base, components, ui, utilities;

@import "tailwindcss";
@import "@adem.rejeb/ui/styles.css" layer(ui);
```

The layer order is deliberate:

| Layer | Contains | Why |
| --- | --- | --- |
| `theme` | Tailwind theme variables | lowest |
| `base` | Tailwind preflight | |
| `components` | Tailwind component classes | |
| `ui` | design-system reset, tokens, components | beats base, loses to utilities |
| `utilities` | Tailwind utilities | highest |

Consequences:

- Design-system components keep their look (they are not flattened by
  preflight).
- App code can still override layout/spacing/size with ordinary Tailwind
  utilities (`className="h-8 w-8"` works).
- Do **not** import `@adem.rejeb/ui/styles.css` from a component or from
  `layout.tsx`; that would put it outside the `ui` layer and break the order.

## Tokens

The app's Tailwind tokens are aliases of the design-system semantic tokens, so
there is one palette for both systems:

```css
:root {
  --background: var(--ui-background);
  --foreground: var(--ui-foreground);
  --card: var(--ui-surface);
  --primary: var(--ui-primary);
  --border: var(--ui-border);
  /* …see src/app/globals.css */
}
```

Change a colour in `globals.css` only through the `--ui-*` mapping. Do not
hard-code hex values in components.

## Theme

`src/lib/theme-context.tsx` writes both signals to `<html>`:

- `class="dark"` for Tailwind's `dark:` variant;
- `data-theme="light|dark"` for the design system's token resolution.

The inline `THEME_SCRIPT` in `layout.tsx` applies the same attributes before
paint, so there is no flash.

## App-facing primitives

Call sites import from `@/components/ui`; they never import the package
directly. This keeps the app's prop names stable while the implementation moves
to the design system.

| Primitive | Status |
| --- | --- |
| `Button` | Backed by `@adem.rejeb/ui` (`default→primary`, `destructive→danger`, `icon→md + square`) |
| `Card` | Backed by `@adem.rejeb/ui` (surface, border, elevation) |
| `Badge`, `Avatar`, `Skeleton`, `Modal`, `Tooltip`, `Dropdown` | App-local, already token-driven |

To migrate another primitive:

1. Keep the exported prop names and variants.
2. Map them to the design-system component in a small wrapper.
3. Run `npm --prefix techdebt-platform run build` and check the page visually in
   both themes and both directions (LTR/RTL).

## Using a design-system component directly

For new screens, import from the package:

```tsx
import { PageHeader, Toolbar, StatCard, DataTable } from "@adem.rejeb/ui"
```

Use it directly when the app does not already have an equivalent. If a screen
needs the same thing in three places, add a wrapper in `@/components/ui` instead
of importing the package in every file.

## Rules

- Keep `@/components/ui` as the app-facing API.
- Keep the layer order; the design system is `ui`.
- Prefer logical properties (`ps-*`, `pe-*`, `start-*`, `end-*`) for RTL.
- Every interactive component must keep keyboard support and an accessible name.
- Do not commit `node_modules`, `.next` or build output.

## Navigation model

The sidebar is intentionally small: one entry per domain, with sub-pages exposed
as a horizontal section tab bar. This keeps the primary rail at nine items while
preserving every existing URL.

| Sidebar | Section tabs | Routes |
| --- | --- | --- |
| Overview | — | `/dashboard` |
| Projects | — | `/dashboard/projects`, `/dashboard/projects/[id]` |
| Messages | — | `/dashboard/messages` |
| Code health | Analysis, Rules, Issues, Repositories | `/dashboard/dev`, `/dashboard/dev/rules`, `/dashboard/dev/issues`, `/dashboard/repositories` |
| Delivery | Pipelines, Servers | `/dashboard/pipelines`, `/dashboard/servers` |
| Software Factory | Runs, Agent connections, AI models | `/dashboard/factory`, `/dashboard/agents`, `/dashboard/ai` |
| Service Desk | Overview, Requests, Incidents, Knowledge, Catalog, SLA | `/dashboard/service-desk/*` |
| People | Overview, Timesheet, Leave, Holidays, Payroll, Teams | `/dashboard/people`, `/dashboard/timesheet`, `/dashboard/leave`, `/dashboard/holidays`, `/dashboard/payroll`, `/dashboard/teams` |
| Administration | — | `/dashboard/admin` |

Route groups (`app/dashboard/(code)`, `(delivery)`, `(factory)`, `(service)`,
`(people)`) provide the shared tab layout without changing any URL. The layout
files are client components because they pass Lucide icon components to
`SectionTabs`.

`SectionTabs` supports `cap` and `min` requirements so role-gated tabs (for
example Payroll) disappear for users the API would reject. The sidebar uses the
same `NAV_SECTIONS` matrix as the admin Roles tab, so UI and API permissions do
not drift.
