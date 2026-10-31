# Commission Tracker

Commission tracking for car salespeople on the Germain Hyundai sales pay plan (effective May 1, 2026). Log the deals you sell, the cars you buy from customers and your spiffs, and see what the check on the 10th of next month will be: commission, volume bonus, Dealer Performance Bonus, the draws already paid, and what's left.

Each salesperson signs in with their own account and only ever sees their own numbers.

## Features

- **Log a deal** as new or pre-owned with the customer, vehicle, stock number, date and gross profit. The form shows what the deal pays before you save it.
- **Log a car bought** from an off-street or service-drive customer ($200 each), and **spiffs** paid to you.
- **The month at a glance:** the check due on the 10th, progress toward the next volume milestone, every deal with its commission, and a line-by-line breakdown you can compare with the dealership's commission sheet.
- **Month settings** for the Dealer Performance Bonus and the draws you were actually paid.
- **Built for the phone:** large touch targets on phones and tablets, compact controls with a mouse, and light and dark themes.

## The pay plan as implemented

All pay rules live in `shared/`: `payplan.ts` holds the plan as data, versioned by its effective date, and `commission.ts` computes each deal and the month from it. `bun test` covers them.

- **Commission** is a percentage of the gross as the dealership reports it, which is already net of the $500 management fee: 16% on new and 18% on pre-owned, plus 1 point after one year of tenure and 2 after two. Every deal pays at least $250 (new) or $200 (pre-owned), even when the gross is negative.
- **Volume bonus** is cumulative: every milestone reached pays. 13, 16 and 19 units pay $500 each; 22, 26 and 30 pay $1,000 each; 35 and 40 pay $1,500 each. Sales at an affiliated store count toward volume and use the commission that store reports.
- **Dealer Performance Bonus:** in a month where you meet the CSI and certification standards, a per-car amount is added to the gross of every new vehicle.
- **Cars bought** from customers pay $200 each. They are not sales and don't count toward volume.
- **Draws** are $500 every Friday ($600 in the first 90 days after hire), at most 4 Fridays a month, so $2,000 or $2,400 at most. You can enter the amount you were actually paid instead.
- **The check** is what you earned minus the draws already paid. The draw is a guarantee, so a slow month still pays the draws, and the shortfall doesn't carry over.

## Tech stack

- **Runtime and API:** [Bun](https://bun.com) and [Hono](https://hono.dev)
- **Database:** [Neon](https://neon.com) Postgres through [Prisma](https://www.prisma.io) 7
- **Sign-in:** Neon Auth (managed Better Auth)
- **Web app:** React 19, Vite, TanStack Query, React Router, Tailwind CSS v4 and [shadcn/ui](https://ui.shadcn.com)

## Getting started

You'll need [Bun](https://bun.com) 1.4 or later, a [Neon](https://neon.com) account and the Neon CLI. The database lives in Neon only; there is no local Postgres.

```sh
bun install                 # installs dependencies and generates the Prisma client
neon login
neon link                   # pick or create the Neon project for this folder
neon deploy                 # sets up Postgres and Neon Auth from neon.ts, and writes their variables to .env
```

Then add the two values Neon doesn't provide to `.env` (see `.env.example` for the full list):

```sh
echo "NEON_AUTH_COOKIE_SECRET=$(openssl rand -base64 32)" >> .env
echo "PORT=3000" >> .env
```

Apply the migrations and start the app:

```sh
bun run db:deploy           # creates the tables
bun run dev                 # API on :3000, web app on http://localhost:5173
```

Create an account from the sign-up screen. For sample data, `bun run db:seed` creates a demo account (`demo@example.com` / `demo-password`) with last month and this month of activity. Read the note about it under [Security](#security) first.

## Scripts

| Command | What it does |
| --- | --- |
| `bun run dev` | API with reload on :3000, and Vite on :5173, which forwards `/api` to the API |
| `bun test` | Pay plan tests |
| `bun run typecheck` | Type-checks the server, shared code and web app |
| `bun run build` | Type-checks, then builds the web app into `dist/` |
| `bun run start` | Production: one process serves the API and the built app |
| `bun run db:migrate --name <change>` | Creates a migration after editing `prisma/schema.prisma` |
| `bun run db:deploy` | Applies committed migrations (no prompts, never resets data) |
| `bun run db:seed` | Creates or recreates the demo account |
| `bun run db:studio` | Opens Prisma Studio to browse the data |

## Project structure

```
shared/        Pay plan data and rules, date helpers, request schemas (used by both server and web)
server/        Hono API, the Neon Auth proxy, Prisma client and seed
prisma/        Database schema and migrations
web/           React app
  pages/       Dashboard, profile, sign-in and sign-up
  components/  Dashboard cards and forms; ui/ holds the shadcn/ui components
```

## Deployment

The production build is one Bun process that serves the API and the web app on `PORT`. On any host that runs a long-lived process (Railway, Render, Fly.io and similar), configure:

| Step | Command |
| --- | --- |
| Build | `bun run build` |
| Before each release (pre-deploy) | `bun run db:deploy` |
| Start | `bun run start` |

1. Set `DATABASE_URL`, `DATABASE_URL_UNPOOLED`, `NEON_AUTH_BASE_URL` and `NEON_AUTH_COOKIE_SECRET` on the host (most hosts set `PORT` themselves). The server won't start without them; the build doesn't need them.
2. Add the production domain to Neon Auth's trusted domains. Only `localhost` is trusted by default, so sign-in fails on any other domain until you do.
3. Don't run `bun run db:seed` against the Neon project the deployment uses (see the demo account note below).

Serverless platforms such as Vercel need changes first: the app has to be exported instead of started with `Bun.serve`, the built web app has to be served as static files, and the Bun runtime has to be enabled.

## Security

- **Sign-in:** Neon Auth handles accounts, passwords and sessions. The browser reaches it only through `/api/auth/*` on this server, so the session cookies stay first-party.
- **Your data stays yours:** every API query is filtered by the signed-in user. Another user's records answer 404.
- **Requests:** bodies are validated with Zod and capped at 64 KB, form posts from other sites are rejected, and every response carries standard security headers.
- **Secrets** live only in `.env`, which git ignores. `.env.example` lists the keys without values.
- **Demo account:** the seed creates `demo@example.com` with the password published above, in whichever Neon Auth project `.env` points at. Don't run it against the project a public deployment uses, or delete that account before going live.
- **Open sign-up:** anyone who can reach a deployment can create an account. Restrict sign-up in Neon Auth if the app is only for your team.

If you find a security problem, please report it privately through the repository's **Security** tab (private vulnerability reporting) instead of opening a public issue.

## License

[MIT](LICENSE). The design skills in `.claude/skills/` are third-party and keep their own Apache-2.0 licenses.
