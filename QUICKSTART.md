# Quick Start (Conservative Trading Workflow)

Get Billetixx running and validate scanner behavior safely.

## 1) Start application

```bash
npm install
npm run dev
```

Open `http://localhost:3000`.

## 2) Configure API keys

In Settings → API:
- set OANDA environment to `practice`
- fill OANDA account ID + token
- optionally add OpenAI key for AI analysis text

Without OANDA keys, account and execution routes are blocked.

## 3) First safe run (recommended)

1. Open Trading page.
2. Keep engine in `Dry Run`.
3. Run scanner/engine manually.
4. Inspect Scanner panel:
   - `BEST` = strongest valid candidate by score
   - `SELECTED` = candidate chosen for potential execution
5. Check rejected pairs and reasons.

## 4) Execute only after validation

Use `Execute` only when:
- strategy/risk context is clear
- rejection reasons are understood
- exposure constraints are acceptable

## 5) Useful endpoints

- `POST /api/trading/engine` (`{ "execute": false }` or `{ "execute": true }`)
- `GET /status`
- `GET /scanner-status`

## 6) Next docs

- Full user flow: `USER_GUIDE.md`
- Architecture details: `ARCHITECTURE.md`
- Deployment: `DEPLOYMENT.md`
