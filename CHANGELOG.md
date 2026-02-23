# Changelog

## 2026-02-23 — Breakout v2 scanner upgrade

### Added
- New strategy `breakout_v2` with filtered breakout logic:
  - validated M15 range (`rangeWindowBars`, touch-count checks)
  - ATR-based range width filter (`minRangeAtrMultiplier`, `maxRangeAtrMultiplier`)
  - breakout confirmation on closed M15 candle close with buffer
  - impulse body filter (`minImpulseBodyAtr`)
  - optional H1 trend alignment gate
- Entry options for breakout_v2:
  - `entryMode: retest` (default, emits `LIMIT` near broken level)
  - `entryMode: close` (immediate `MARKET` on confirmed close)
- Stop options for breakout_v2:
  - `stopMode: opposite_boundary` (default)
  - `stopMode: impulse_extreme`
- False-breakout scenario handling:
  - emits `NO_TRADE` with diagnostics by default
  - optional reversal trading via `allowFalseBreakoutReversalTrade`

### Engine / Scanner
- Added anti-noise deduplication: one signal per closed M15 candle side (`BUY`/`SELL`) per user+pair+strategy.
- New rejection code: `DUPLICATE_M15_SIGNAL`.
- Scanner recommendation path now supports `breakout_v2` regime selection.

### Observability
- Extended scanner cycle logs with:
  - `recommendedStrategyId`, `appliedStrategyId`
  - `rejected`, `rejectionReasonCode`, `metrics`
- Added richer breakout diagnostics in intent metrics (range bounds, ATR ratios, touch counts, trend state, signal candle time).

### Config / Docs / Tests
- Added breakout_v2 defaults to strategy runtime profiles.
- Added synthetic test script: `npm run test:breakout-v2`.
- Added strategy doc: `BREAKOUT_V2.md`.

### Commit
- `a03f9c8` — `feat(trading): add breakout_v2 strategy with M15 dedupe and diagnostics`
