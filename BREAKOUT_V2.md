# Breakout v2 (Filtered Breakout)

`breakout_v2` is a range-breakout strategy with stricter validity filters and anti-noise behavior.

## Core logic

1. Build range from the last `rangeWindowBars` closed M15 candles (default `24`) before the signal candle.
2. Validate range quality:
   - touch count on both boundaries (`minTouchesPerSide`)
   - width in ATR units (`minRangeAtrMultiplier .. maxRangeAtrMultiplier`)
3. Confirm breakout only on **closed M15 candle close** beyond boundary + `breakoutBufferPips`.
4. Require impulse quality: breakout candle body in ATR units (`minImpulseBodyAtr`).
5. Optional H1 trend gate (`requireH1TrendFilter`):
   - BUY disallowed in H1 BEAR
   - SELL disallowed in H1 BULL

## Entry and risk

- `entryMode = retest` (default): signal waits for retest near broken level (`retestTolerancePips`), then emits `LIMIT` entry.
- `entryMode = close`: immediate `MARKET` entry on confirmed breakout close.
- `stopMode = opposite_boundary` (default): SL behind opposite range side (+ `slBufferPips`).
- `stopMode = impulse_extreme`: SL behind impulse extreme (+ `slBufferPips`).
- TP uses fixed RR target (`rrTarget`).

## False breakout scenario

When wick pierces boundary but candle closes back inside the range:

- if `allowFalseBreakoutReversalTrade=false` (default): emits `NO_TRADE` with `FALSE_BREAKOUT` tags and diagnostics.
- if enabled: can emit reversal trade with normal risk model and optional H1 trend filtering.

## Anti-duplicate signal suppression

Engine now suppresses duplicate signals from the same strategy/pair/user on the same closed M15 candle side (`BUY`/`SELL`), returning rejection code `DUPLICATE_M15_SIGNAL`.

## Diagnostics

`breakout_v2` writes richer metrics into scanner entries and cycle logs (`range_high/low`, ATR ratios, touch counts, impulse metrics, trend state, signal candle time).

## Synthetic check

Run:

```bash
npm run test:breakout-v2
```

This validates:
- bullish breakout candidate generation in retest mode
- false breakout handling path when reversal execution is disabled
