# Billetixx — AI-Assisted Forex Terminal

Billetixx is a Next.js trading terminal with a conservative multi-pair scanner engine, strict local risk controls, and broker execution through OANDA.

## What it does

- Runs strategy-based scanning across a watchlist (`config/trading.json`).
- Scores valid setups deterministically (no AI scoring) and selects one top candidate.
- Supports `Dry Run` and `Execute` modes via the trading engine route.
- Shows scanner observability in UI (BEST / SELECTED, filters, rejection reasons).
- Provides bilingual interface (EN/RU) via `next-intl`.

## Core principles

- Safety-first defaults: reject unless conditions are clear.
- Local risk checks are mandatory before execution.
- Fixed sizing and conservative hard limits.
- AI is advisory for analysis text; not used for scanner scoring.

## Stack

- Next.js 15 (App Router), TypeScript, React 19
- Prisma ORM + PostgreSQL
- NextAuth v5
- OANDA v20 REST API
- OpenAI (analysis assistant on terminal)
- Tailwind CSS + shadcn/ui

## Documentation map

- Quick setup: `QUICKSTART.md`
- User onboarding and operation guide: `USER_GUIDE.md`
- System design and engine architecture: `ARCHITECTURE.md`
- Deployment details: `DEPLOYMENT.md`
- Features inventory: `FEATURES.md`

## Quick local run

```bash
npm install
npm run dev
```

Open `http://localhost:3000` and configure API keys on Settings page.

## Runtime endpoints

- `POST /api/trading/engine` — run scanner/engine (`execute: false|true`)
- `GET /status` — engine status snapshot
- `GET /scanner-status` — scanner rows + selected pair

## Project structure (high-level)

- `src/app/[locale]/trading/page.tsx` — terminal UI
- `src/app/[locale]/dashboard/page.tsx` — dashboard + scanner panel
- `engine/tradingEngine.ts` — scan → risk → score → select → execute
- `engine/scoring.ts` — deterministic scoring model
- `services/riskManager.ts` — strict risk filters
- `messages/en.json`, `messages/ru.json` — localization

## Notes

- Prefer OANDA `practice` credentials for onboarding.
- Start with `Dry Run` to validate behavior before execution.
- See `USER_GUIDE.md` for a step-by-step operator workflow.
