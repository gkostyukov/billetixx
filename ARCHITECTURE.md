# Billetixx — Architecture Overview

> AI-powered Forex trading terminal built with **Next.js 15**, **OANDA REST API**, **OpenAI GPT**, **Prisma ORM**, and **PostgreSQL**.

---

## Stack

| Layer | Technology |
|---|---|
| Framework | Next.js 15 App Router (Turbopack) |
| Language | TypeScript |
| Database | PostgreSQL via Prisma ORM |
| Auth | NextAuth v5 (credentials + OAuth-ready) |
| i18n | next-intl (EN / RU) |
| Styles | Tailwind CSS + shadcn/ui |
| Broker API | OANDA v20 REST API |
| AI Analysis | OpenAI GPT (`gpt-5`, advisory analysis text in terminal) |
| AI Coding | GPT-5.3-Codex (development/refactoring only, never trade decisions) |
| Charts | Lightweight Charts (TradingView) |
| Container | Docker (postgres:16-alpine) |

---

## Directory Structure

```
src/
├── app/
│   ├── [locale]/              # i18n-aware routes (EN/RU)
│   │   ├── page.tsx           # Landing page (unauthenticated)
│   │   ├── layout.tsx         # Locale layout (NextIntlClientProvider)
│   │   ├── dashboard/         # Live account summary + open positions
│   │   ├── trading/           # Chart terminal + AI analysis sidebar
│   │   ├── analytics/         # AI trade signal cards
│   │   └── settings/          # OANDA + OpenAI API key configuration
│   ├── api/
│   │   ├── auth/              # NextAuth handler
│   │   ├── oanda/
│   │   │   ├── account/       # GET account summary (balance, NAV, P&L)
│   │   │   ├── orders/        # GET open trades/positions
│   │   │   ├── pricing/       # GET live bid/ask pricing
│   │   │   └── candles/       # GET OHLC candle data for charts
│   │   ├── ai/analyze/        # POST → OpenAI GPT analysis
│   │   ├── signals/           # GET/POST/PATCH TradeSignal records
│   │   ├── register/          # POST → new user registration
│   │   └── settings/          # GET/POST user API key settings
│   ├── auth/
│   │   ├── signin/            # Sign-in page
│   │   └── signup/            # Registration page
│   └── layout.tsx             # Root layout (theme, session providers)
│
├── components/
│   ├── Navbar.tsx             # Top nav with language switcher + theme toggle
│   ├── TradingChart.tsx       # Lightweight Charts candlestick component
│   ├── providers.tsx          # SessionProvider wrapper
│   ├── theme-provider.tsx     # next-themes wrapper
│   └── ui/                    # shadcn/ui components (Button, Input, Card…)
│
├── lib/
│   ├── auth.ts                # NextAuth config (credentials provider)
│   ├── oanda.ts               # OANDA axios client factory (per-user auth)
│   ├── prisma.ts              # Prisma client singleton
│   └── utils.ts               # cn() utility for class merging
│
├── i18n/
│   ├── routing.ts             # next-intl routing config (locales, prefix)
│   └── request.ts             # next-intl server request config
│
└── types/                     # Shared TypeScript type definitions

engine/
└── tradingEngine.ts           # Orchestrates data→indicators→AI→risk→execution pipeline

services/
├── aiService.ts               # Calls GPT-5 with structured JSON only + decision logging
├── indicatorService.ts        # Local-only indicators and market structure
├── oandaService.ts            # OANDA market/account data retrieval layer
├── riskManager.ts             # Local risk filters and hard safety checks
├── tradeExecutor.ts           # OANDA order execution (fixed 1000 units)
└── types.ts                   # Shared engine/service interfaces

config/
└── models.ts                  # Model separation and conservative engine constants

messages/
├── en.json                    # English translations
└── ru.json                    # Russian translations

prisma/
├── schema.prisma              # Database schema (User, TradeSignal, Auth models)
└── seed.ts                    # Demo user + sample TradeSignal seed data
```

---

## Data Flow

### Authentication
```
User → /auth/signin → NextAuth credentials provider
     → bcrypt password verify → JWT session → cookie
```

### Live Trading Data
```
Browser (polling 5s) → /api/oanda/pricing
                     → getOandaClient(userId)   ← reads DB credentials
                     → OANDA REST API
                     → response → UI
```

### AI Analysis
```
Terminal page → /api/oanda/candles (200 M15 candles)
             → /api/ai/analyze (POST to OpenAI GPT)
             → parse action/entry/SL/TP from text
             → /api/signals POST → save TradeSignal to DB
             → display in Terminal + appear in Analytics
```

### Conservative Trading Engine (Multi-Pair Scanner)
```
POST /api/trading/engine
  → load active strategy + scanner config (watchlist, scoring weights, trade cap)
  → for each pair in watchlist:
       - fetch OANDA data (candles/pricing/account)
       - build local market context + indicators
       - evaluate strategy intent (BUY/SELL/NO_TRADE)
       - apply hard risk checks (RR, max risk, spread, FIFO, exposure limits)
       - if valid, compute deterministic score (no AI)
  → sort valid candidates by score
  → pick one top candidate as SELECTED
  → if execute=false: return READY (dry run)
  → if execute=true: place OANDA order with fixed size 1000 units
  → if none valid: return NO_TRADE with rejection context
```

AI analysis logs are persisted to `logs/ai-decisions.log` with timestamp.

### News Impact Analytics (Cached)
```
Terminal page → /api/news/impact?instrument=EUR_USD&timeframe=M15
             → check NewsImpactSnapshot cache in PostgreSQL
             → if valid cache exists: return cached probabilities
             → else fetch fresh forex headlines (Google News RSS)
             → rule-based sentiment scoring
             → output upside/downside/reversal percentages
             → save snapshot with TTL (expiresAt)
             → display in Terminal risk block
```

### Language Switching
```
Navbar "EN/RU" button → router.replace(currentPath, { locale })
                      → next-intl reloads page with new locale prefix
                      → messages/[locale].json loaded server-side
```

---

## Database Models

### `User`
Stores credentials and per-user OANDA/OpenAI API keys.
Key fields: `oandaEnvironment`, `oandaPracticeAccountId`, `oandaPracticeToken`, `openaiApiKey`

### `TradeSignal`
AI-generated trading decision ticket.
Key fields: `instrument`, `action` (BUY/SELL/WAIT), `entryPrice`, `stopLoss`, `takeProfit`, `rationale`, `status`

### `NewsImpactSnapshot`
Cached news sentiment/risk snapshot per instrument/timeframe.
Key fields: `upsideProbability`, `downsideProbability`, `reversalRisk`, `marketBias`, `summary`, `expiresAt`

### Auth Models
`Account`, `Session`, `VerificationToken` — standard NextAuth v5 models.

---

## Environment Variables (`.env`)

| Variable | Description |
|---|---|
| `AUTH_SECRET` | NextAuth JWT secret |
| `DATABASE_URL` | PostgreSQL connection string |
| `OANDA_ACCOUNT_ID` | Default practice account ID (used in seed) |
| `OANDA_PRACTICE_TOKEN` | Default practice token (used in seed) |
| `OANDA_BASE_URL` | OANDA practice base URL |
| `OPENAI_API_KEY` | Server-level OpenAI key (fallback if user has none) |
| `TRADING_ANALYSIS_MODEL` | Trading analyst model (`gpt-5`) |
| `CODING_MODEL` | Development model (`gpt-5.3-codex`) |

---

## Safety Defaults

- Default decision is `NO_TRADE` if market data is incomplete.
- Default decision is `NO_TRADE` if AI response is malformed or unclear.
- Indicator calculations are local-only (AI never computes indicators).
- AI receives structured market JSON only (no raw broker account control logic).
- Execution layer is separate and only runs after local risk manager approval.
- Position size is fixed to `1000` units (no auto-scaling).

---

## Pluggable Strategy Engine

The trading engine is split into strict, replaceable layers:

1. **Data layer** — [services/oandaService.ts](services/oandaService.ts)
     - Fetches OANDA data and normalizes into `RawMarketData`.
2. **Indicators layer** — [services/indicatorService.ts](services/indicatorService.ts)
     - Computes ATR, swing highs/lows, H1 trend (MA slope), and M15 momentum locally.
3. **Strategy layer** — [strategies](strategies)
     - Plugin strategies evaluate `MarketContext` and return `TradeIntent`.
4. **Risk layer** — [services/riskManager.ts](services/riskManager.ts)
     - Strategy-agnostic checks: RR, max USD risk, spread, FIFO, existing positions.
5. **Execution layer** — [services/tradeExecutor.ts](services/tradeExecutor.ts)
     - Places (and supports cancel/close) OANDA orders.

Engine orchestration lives in [engine/tradingEngine.ts](engine/tradingEngine.ts).

---

## Strategy Plugins

- Strategy interface: [strategies/Strategy.ts](strategies/Strategy.ts)
- Registry: [strategies/StrategyRegistry.ts](strategies/StrategyRegistry.ts)
- Registered strategies: [strategies/index.ts](strategies/index.ts)

Default conservative strategy:
- [strategies/h1TrendM15Pullback.ts](strategies/h1TrendM15Pullback.ts)
- ID: `h1_trend_m15_pullback`

Template strategy for future extensions:
- [strategies/breakoutTemplate.ts](strategies/breakoutTemplate.ts)
- ID: `breakout_v1`

Active strategy config:
- [config/strategy.json](config/strategy.json)

---

## Status & Logs

- Runtime status endpoint: `GET /status` via [src/app/status/route.ts](src/app/status/route.ts)
  - Returns: `activeStrategyId`, `lastIntent`, `lastRejectionReasons`, `lastRationale`.
- Scanner status endpoint: `GET /scanner-status` via [src/app/scanner-status/route.ts](src/app/scanner-status/route.ts)
     - Returns: `activeStrategy`, `scannedPairs`, `selectedTrade`.
- Cycle logs: `logs/engine-cycles.log`
     - Includes per-cycle scan summary, selected pair, strategy id, intent, and risk validation result.

---

## Add New Strategy

1. Create a module in [strategies](strategies), e.g. `myStrategy.ts`, implementing `StrategyPlugin`.
2. Implement required metadata: `id`, `name`, `version`, `requiredTimeframes`, `parametersSchema`.
3. Implement `evaluate(marketContext, params) => TradeIntent`.
4. Register it in [strategies/index.ts](strategies/index.ts).
5. Activate it in [config/strategy.json](config/strategy.json) by setting `activeStrategyId` and `params`.

This keeps strategy changes isolated from risk/execution infrastructure.

---

## Running Locally

```bash
# 1. Start PostgreSQL
docker compose up -d postgres

# 2. Sync schema & seed demo user
npx prisma db push
npx prisma db seed

# 3. Start dev server
npm run dev
```

Demo credentials: `demo@billetixx.com` / `demo123`
