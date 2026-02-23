# Billetixx — User Guide (RU/EN)

This guide is for new users who want to start safely with the trading terminal, scanner, and conservative engine.

## 1) First login and setup

1. Sign in with your account.
2. Open Settings → API.
3. Set OANDA environment to `practice` (recommended for onboarding).
4. Fill OANDA account ID and token.
5. Add OpenAI API key (optional for AI text analysis, not used for scoring).
6. Save settings.

If API keys are missing, account/trading requests are blocked with clear warnings.

## 2) What the terminal does

On the Trading page you get:
- Live chart and bid/ask stream.
- AI scenario text (advisory only).
- Conservative Engine controls (`Dry Run` / `Execute`).
- Scanner Status panel (multi-pair scan results).
- Order Ticket (manual order submission with validations).

## 3) Scanner workflow (multi-pair)

The engine scans watchlist pairs from `config/trading.json`:
1. Fetch market/account data per pair.
2. Build indicators and market context.
3. Run active strategy.
4. Run risk manager checks.
5. Score valid candidates.
6. Pick one best candidate by score.
7. Execute only if risk + exposure constraints pass.

Important: only one concurrent trade is allowed (`maxConcurrentTrades=1`).

## 4) How to use Dry Run vs Execute

- Use `Dry Run` for routine monitoring.
- Check `Scanner Status`:
  - `BEST` = strongest valid candidate by score.
  - `SELECTED` = pair chosen by engine for potential execution.
- Open rejection reasons for pairs that were filtered out.
- Only use `Execute` when setup and exposure context are clear.

## 5) Safety model (capital-protective)

Always enforced locally:
- fixed size = `1000` units
- max risk per trade = `$6`
- FIFO checks
- spread filter
- risk/reward threshold
- correlated exposure block (USD-long stacking protection)
- max concurrent trades cap

No AI is used in scoring logic.

## 6) Dashboard scanner panel

Dashboard includes the same scanner visibility:
- Active strategy
- Selected trade
- Pair list with decision/score/RR/spread/reason
- Filters: All / Only valid / Only rejected

Use this for passive monitoring without opening the full terminal.

## 7) Logs and observability

- `logs/engine-cycles.log` — per-cycle scan + decision data.
- `logs/ai-decisions.log` — AI analysis diagnostics.
- `GET /scanner-status` — current scanner snapshot.
- `GET /status` — current engine status summary.

## 8) Recommended onboarding path

1. Configure practice keys.
2. Run `Dry Run` only for a full session.
3. Observe `BEST` and `SELECTED` behavior across market phases.
4. Validate rejection reasons match your expectations.
5. Execute only after confidence in process discipline.

---

For architecture and extension details see `ARCHITECTURE.md`.
