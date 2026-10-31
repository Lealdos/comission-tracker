# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

Commission tracker for car salespeople on the Germain Hyundai pay plan (effective 2026-05-01). Each user logs deals (gross + new/pre-owned), cars bought from customers, and spiffs; the app computes commission, bonuses, draws and the check due on the 10th of the next month. Multi-user, each user sees only their own data.

## Commands

```sh
bun install                 # also runs `prisma generate` (postinstall)
neon env pull               # fill .env from the linked Neon branch (.neon); `neon deploy` applies neon.ts and pulls too
bun run db:migrate          # prisma migrate dev; add `--name <change>` after editing prisma/schema.prisma
bun run db:seed             # demo account demo@example.com / demo-password (in Neon Auth) with last month and this month of sample activity
bun run dev                 # API on :3000 (bun --watch) + Vite on :5173, which proxies /api to :3000
bun test                    # commission engine tests
bun test shared/commission.test.ts -t "volume"   # single test / describe by name
bun run typecheck           # tsc --noEmit over shared/ + server/, then web/ (web/tsconfig.json)
bun run build               # typecheck + vite build to dist/
bun run db:deploy           # production: apply committed migrations (no prompts, never resets)
bun run start               # production: Hono serves dist/ and the API from one process
bun run db:studio           # Prisma Studio, to browse/edit rows
```

`.env` needs the Neon variables (`DATABASE_URL`, `DATABASE_URL_UNPOOLED`, `NEON_AUTH_BASE_URL`, from `neon env pull`) plus `NEON_AUTH_COOKIE_SECRET` (`openssl rand -base64 32`) and `PORT`; see `.env.example`.

## Architecture

Stack: Bun runtime, Hono API (`server/`), Prisma 7 + Neon Postgres, Neon Auth, React 19 + Vite + TanStack Query + React Router + Tailwind v4 (`web/`). Single package, no workspaces.

- **`shared/` is the only place pay rules live.** `payplan.ts` holds the plan as data, versioned by `effectiveFrom` (a month uses the plan in effect on its 1st). For a pay plan change, add a new entry; don't edit the old one, or past months will recompute differently. `commission.ts` holds pure functions over the plan. The server uses `monthSummary()` for the authoritative numbers, and `web/components/DealForm.tsx` calls `dealCommission()` for the live "this deal pays" preview, so the two always agree.
- **Commission is computed on read, never stored.** `GET /api/months/:YYYY-MM` loads the month's rows and runs `monthSummary()`. Editing a deal, the hire date or the month's DPB setting recomputes everything.
- **Money is integer cents everywhere**; it's formatted only in the UI (`formatCents`, `parseDollars`).
- **Dates are `"YYYY-MM-DD"` strings** in the API and in `shared/`, with UTC arithmetic in `shared/dates.ts`. Prisma returns `@db.Date` columns as `Date` objects at UTC midnight, so every row leaves the server through a mapper in `server/serialize.ts`, and writes convert with `toDbDate`. Query by month with `inMonth(month)`.
- **Per-user isolation:** every query filters by `c.get("user").id` (set by the `requireUser` middleware in `server/auth.ts`). Single-row writes use `where: { id, userId }` wrapped in `orNotFound()`, so another user's id gets a 404.
- **Neon:** the folder is linked to Neon project `wandering-resonance-48133781`, branch `production` (`.neon`, git-ignored); `neon.ts` declares the services (Postgres, Auth). The app uses the pooled `DATABASE_URL` through `@prisma/adapter-pg` (node-postgres, right for a long-running server); `prisma.config.ts` points Prisma Migrate at `DATABASE_URL_UNPOOLED`, since migrations break through the pooler.
- **Auth:** Neon Auth (Managed Better Auth) owns email, password and sessions (`neon_auth` schema). The browser uses `@neon/auth`'s client (`web/auth.ts`) against `/api/auth/*`, which `server/auth.ts` proxies to `NEON_AUTH_BASE_URL` with the `@neon/auth/server` toolkit, so the cookies are first-party. `requireSession` checks the session (cached for 5 minutes in a signed `session_data` cookie); `requireUser` also loads the app profile, the `users` row whose `auth_user_id` is the Neon Auth user id. Sign-up creates the Neon Auth account, then the profile via `POST /api/me`; a signed-in account without a profile gets the "Finish setting up" screen.
- **Hardening** (`server/index.ts`): `secureHeaders()` on every response; `csrf()` on `/api/*`, because Neon Auth's cookies are `SameSite=None` (JSON calls already need a CORS preflight the API never grants, and `csrf()` turns away cross-site form posts); a 64 KB `bodyLimit`. `onError` keeps the status of an `HTTPException` (403 from csrf, 400 for malformed JSON) and hides everything else behind a generic 500. Before a public deployment, keep the seeded demo account (published password) out of that Neon Auth project.
- **Validation:** request bodies are Zod schemas in `shared/schemas.ts`, applied via `server/validate.ts`, and errors come back as `{ error }`. Zod 4 applies `.default()` values inside `.partial()`, which is why `dealPatch` is built from the default-free `dealFields`. Keep that pattern for any PATCH schema. Deals and cars bought require `customerName` and `vehicle` (enforced there, not in the database, whose `""` defaults only cover rows logged before the requirement; the deals table flags those as "Missing details").
- **Web ↔ server types:** `web/api.ts` imports response types from `server/serialize.ts` with `import type` only. Never value-import server code into `web/`, or Prisma ends up in the browser bundle.
- **TypeScript 7** (the native compiler) is installed, and its `types` option defaults to `[]`. Ambient types therefore come only from the list in `tsconfig.json` (`bun`, `vite/client`); add any new `@types/*` package there.
- `web/` is type-checked as its own project (`web/tsconfig.json`) because `@neon/auth`'s root typings declare a global `Bun` that shadows bun-types. Server code imports only `@neon/auth/server`, which doesn't.

## Pay plan interpretations (confirmed with the user)

- Gross is entered **as the dealership reports it, already net of the $500 management fee**, so the app never subtracts the fee: commission = max(rate × (gross + DPB), minimum). Rates are 16% new / 18% pre-owned, +1 point after 1 year and +2 after 2 years of tenure, measured at the sale date. Minimums are $250 new / $200 pre-owned, applied per deal even when gross is negative.
- Volume bonus is **cumulative**: every milestone reached pays (13/16/19 → $500 each, 22/26/30 → $1,000 each, 35/40 → $1,500 each).
- The Dealer Performance Bonus is a monthly toggle plus a per-car amount, added to **new vehicles only**.
- The $200 off-street/service-drive bonus is a separate "car bought" entry (`acquisitions`), not a flag on a sale and not a unit. It's logged from the log panel's Bought tab (`LogPanel` in `DealForm.tsx`, next to the New and Pre-owned sale tabs) and listed under "Cars bought from customers".
- Draws are $500 every Friday ($600 for Fridays less than 90 days after hire), **at most 4 Fridays a month** ($2,000, or $2,400 in training; a 5th Friday doesn't count), and can be overridden per month. Check = max(0, earnings − draws); the draw is a guarantee with no carryover.
- Affiliated-store sales count toward volume and use a manually entered commission.

## UI and design system

Design skills live in `.claude/skills/` (`frontend-design`, `ui-taste`; `ios-design` is for native iPhone apps, not this web app), pinned in `skills-lock.json`.

The UI is built on **shadcn/ui** (new-york style, `components.json`): vendored primitives in `web/components/ui/`, added with `bunx --bun shadcn@latest add <name>`. They import each other through the `@/` alias (`web/`, set in `tsconfig.json` and `vite.config.ts`) and use the `cn` package (shadcn's clsx + tailwind-merge replacement); app code keeps relative imports. App-level pieces built on them (`Field`, `MoneyInput`, `NativeSelect`, `PayPreview`, `ConfirmDelete`, `Money`, `formatDate`, …) are in `web/components/common.tsx`.

- **Mobile first:** salespeople log deals from a phone or tablet. Controls are 44px by default and shrink with `pointer-fine:` (mouse or trackpad); inputs stay at 16px text on touch so iOS doesn't zoom. Forms lay out with container queries (`@container` on the card, `@xl:` spans) so the log card fits both the desktop sidebar and a full-width tablet. On phones the deals list becomes three-line rows and deleting a deal happens from its edit form. On desktop the dashboard is one two-column grid (`Dashboard.tsx`): what you enter on the left (log card, month settings), what it adds up to on the right (volume, activity), both columns ending level (the last card in each is `lg:flex-1`; the deals list fills the activity card), then the breakdown at full width with its two groups aligned to the same columns. On phones the column wrappers are `display: contents`, so the cards form one list with month settings moved last. After `shadcn add`, re-apply the `pointer-fine:` sizing and the lighter dark fills (`dark:bg-input/15`) to the new component.
- **Look:** Figtree for the interface and Barlow Semi Condensed (`font-display`) for the check sign and key figures, loaded from Google Fonts in `index.html`. White cards on a soft green-gray ground. The signature element is the check as a green highway guide sign (`CheckSign` in `Dashboard.tsx`, echoed by `SignMark` in the header and auth screens); keep everything else quiet. Deletes confirm in an `AlertDialog` that says what goes and what it does to the check; saves confirm with a `sonner` toast.
- **Colors are semantic tokens** in `web/index.css`, named the shadcn way (`background`, `card`, `primary`, `muted-foreground`, `border`, `input`, `destructive`, …) plus the app's own (`sign`, `positive`/`positive-soft`, `warning`/`warning-soft`), with one set of values per theme. `--input` is deliberately strong (3:1 against cards) so fields are findable outdoors. In app code, don't use raw Tailwind palette colors or `dark:` variants; add or adjust a token instead (the vendored shadcn components do use `dark:`).
- **Dark mode:** `web/theme.ts` holds the System/Light/Dark preference (localStorage `theme`; absent means System) and sets `data-theme` on `<html>`, which the `dark:` variant follows (`@custom-variant` in `index.css`). An inline script in `index.html` does the same before first paint; keep the two in sync. The header has a light/dark toggle, Profile → Appearance can go back to System, and the toaster reads the same store.

## Prisma notes

- `prisma`, `@prisma/client` and `@prisma/adapter-pg` are pinned to the same exact version (7.10.1). `package.json` overrides `lodash` to 4.18.1: Prisma Studio pulls an older one with security advisories (`bun audit` should stay clean). npm's `latest` tag for `prisma` points at an 8.0 RC, so don't run a bare `bun add prisma`.
- `prisma.config.ts` holds the datasource URL (`DATABASE_URL_UNPOOLED`, else `DATABASE_URL`, loaded from `.env` via `dotenv`); `schema.prisma` has no `url`. The client connects through `@prisma/adapter-pg` in `server/db/client.ts`.
- The client is generated into `server/generated/prisma/` (gitignored) and imported from `server/generated/prisma/client.ts`. Run `bun run db:generate` after schema changes if you didn't migrate.
- Models use `@map`/`@@map` to keep snake_case tables and columns.
