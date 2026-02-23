import type { Candle, MarketContext, TradeIntent } from '../services/types';
import type { StrategyPlugin } from './Strategy';

function pipSize(pair: string): number {
  return pair.includes('JPY') ? 0.01 : 0.0001;
}

function noTrade(rationale: string, tags: string[] = [], metrics: TradeIntent['metrics'] = {}): TradeIntent {
  return {
    decision: 'NO_TRADE',
    entryType: 'MARKET',
    entryPrice: null,
    stopLoss: null,
    takeProfit: null,
    rationale,
    tags,
    metrics,
  };
}

function last(candles: Candle[]): Candle | null {
  return candles.length ? candles[candles.length - 1] : null;
}

function rangeHighLow(candles: Candle[]): { high: number; low: number } {
  let high = -Infinity;
  let low = Infinity;
  for (const c of candles) {
    if (c.high > high) high = c.high;
    if (c.low < low) low = c.low;
  }
  return { high, low };
}

function findLastCompleteCandle(candles: Candle[]): Candle | null {
  for (let index = candles.length - 1; index >= 0; index -= 1) {
    if (candles[index]?.complete) {
      return candles[index];
    }
  }
  return null;
}

function countRangeTouches(candles: Candle[], boundary: number, tolerance: number, side: 'HIGH' | 'LOW'): number {
  let touches = 0;
  for (const candle of candles) {
    if (side === 'HIGH') {
      if (Math.abs(candle.high - boundary) <= tolerance) touches += 1;
      continue;
    }
    if (Math.abs(candle.low - boundary) <= tolerance) touches += 1;
  }
  return touches;
}

function isTrendAllowed(side: 'BUY' | 'SELL', trend: MarketContext['indicators']['trend_h1']): boolean {
  if (side === 'BUY') return trend !== 'BEAR';
  return trend !== 'BULL';
}

export const breakoutTemplateStrategy: StrategyPlugin = {
  id: 'breakout_v1',
  name: 'Breakout v1',
  version: '1.0.0',
  requiredTimeframes: ['H1', 'M15'],
  parametersSchema: {
    type: 'object',
    properties: {
      rangeWindowBars: { type: 'number', description: 'M15 bars used to compute breakout range', default: 32 },
      breakoutBufferPips: { type: 'number', description: 'Pips beyond range boundary to confirm breakout', default: 1.5 },
      slBufferPips: { type: 'number', description: 'SL buffer beyond opposite boundary', default: 2.0 },
      rrTarget: { type: 'number', description: 'Target RR ratio', default: 1.6 },
      requireTrendAlignment: { type: 'boolean', description: 'Require H1 trend alignment', default: true },
      requireMomentumAlignment: { type: 'boolean', description: 'Require M15 momentum alignment', default: true },
      minRangePips: { type: 'number', description: 'Minimum range size in pips', default: 8 },
      maxRangePips: { type: 'number', description: 'Maximum range size in pips', default: 60 },
    },
  },
  evaluate: (marketContext: MarketContext, params) => {
    const pair = marketContext.pair;
    const pip = pipSize(pair);

    const m15 = marketContext.candles.M15 || [];
    const atrM15 = marketContext.indicators.atr_m15;
    const trendH1 = marketContext.indicators.trend_h1;
    const momentumM15 = marketContext.indicators.momentum_m15;

    if (m15.length < 40 || atrM15 <= 0) {
      return noTrade('Not enough M15/ATR data for breakout scan.', ['DATA_MISSING']);
    }

    const rangeWindowBars = Math.max(16, Math.min(80, Number(params.rangeWindowBars ?? 32)));
    const breakoutBufferPips = Number(params.breakoutBufferPips ?? 1.5);
    const slBufferPips = Number(params.slBufferPips ?? 2.0);
    const rrTarget = Number(params.rrTarget ?? 1.6);
    const requireTrendAlignment = Boolean(params.requireTrendAlignment ?? true);
    const requireMomentumAlignment = Boolean(params.requireMomentumAlignment ?? true);
    const minRangePips = Number(params.minRangePips ?? 8);
    const maxRangePips = Number(params.maxRangePips ?? 60);

    const windowCandles = m15.slice(-(rangeWindowBars + 1), -1); // exclude last candle for boundary calculation
    const lastC = last(m15);
    if (!lastC || windowCandles.length < 10) {
      return noTrade('Not enough candles in breakout window.', ['DATA_MISSING']);
    }

    const { high: rangeHigh, low: rangeLow } = rangeHighLow(windowCandles);
    const rangePips = (rangeHigh - rangeLow) / pip;

    if (!Number.isFinite(rangePips) || rangePips < minRangePips) {
      return noTrade('Range too small for breakout.', ['RANGE_TOO_SMALL'], { rangePips });
    }
    if (rangePips > maxRangePips) {
      return noTrade('Range too wide for breakout.', ['RANGE_TOO_WIDE'], { rangePips });
    }

    const confirmUp = rangeHigh + breakoutBufferPips * pip;
    const confirmDown = rangeLow - breakoutBufferPips * pip;

    const ask = marketContext.price.ask;
    const bid = marketContext.price.bid;

    // Use last close as signal confirmation, but enter at current bid/ask.
    const brokeUp = lastC.close >= confirmUp;
    const brokeDown = lastC.close <= confirmDown;

    if (!brokeUp && !brokeDown) {
      return noTrade('Price has not broken out of the range.', ['NO_BREAKOUT'], { rangePips, rangeHigh, rangeLow });
    }

    if (brokeUp) {
      if (requireTrendAlignment && trendH1 === 'BEAR') {
        return noTrade('Breakout up conflicts with H1 BEAR trend.', ['TREND_CONFLICT'], { trendH1 });
      }
      if (requireMomentumAlignment && momentumM15 === 'STRONG_DOWN') {
        return noTrade('Breakout up conflicts with M15 STRONG_DOWN momentum.', ['MOMENTUM_CONFLICT'], { momentumM15 });
      }

      const entry = ask;
      const stopLoss = (rangeLow - slBufferPips * pip);
      const risk = entry - stopLoss;
      const takeProfit = entry + risk * rrTarget;

      return {
        decision: 'BUY',
        entryType: 'MARKET',
        entryPrice: entry,
        stopLoss,
        takeProfit,
        rationale: `Breakout BUY: close=${lastC.close.toFixed(5)} broke above rangeHigh=${rangeHigh.toFixed(5)} (buffer=${breakoutBufferPips}p).`,
        tags: ['BREAKOUT', 'BUY'],
        metrics: { rangePips, trendH1, momentumM15, rangeHigh, rangeLow },
      };
    }

    // brokeDown
    if (requireTrendAlignment && trendH1 === 'BULL') {
      return noTrade('Breakout down conflicts with H1 BULL trend.', ['TREND_CONFLICT'], { trendH1 });
    }
    if (requireMomentumAlignment && momentumM15 === 'STRONG_UP') {
      return noTrade('Breakout down conflicts with M15 STRONG_UP momentum.', ['MOMENTUM_CONFLICT'], { momentumM15 });
    }

    const entry = bid;
    const stopLoss = (rangeHigh + slBufferPips * pip);
    const risk = stopLoss - entry;
    const takeProfit = entry - risk * rrTarget;

    return {
      decision: 'SELL',
      entryType: 'MARKET',
      entryPrice: entry,
      stopLoss,
      takeProfit,
      rationale: `Breakout SELL: close=${lastC.close.toFixed(5)} broke below rangeLow=${rangeLow.toFixed(5)} (buffer=${breakoutBufferPips}p).`,
      tags: ['BREAKOUT', 'SELL'],
      metrics: { rangePips, trendH1, momentumM15, rangeHigh, rangeLow },
    };
  },
};

export const breakoutV2Strategy: StrategyPlugin = {
  id: 'breakout_v2',
  name: 'Breakout v2',
  version: '2.0.0',
  requiredTimeframes: ['H1', 'M15'],
  parametersSchema: {
    type: 'object',
    properties: {
      rangeWindowBars: { type: 'number', description: 'M15 bars for breakout range', default: 24 },
      breakoutBufferPips: { type: 'number', description: 'Close buffer outside range in pips', default: 1.2 },
      minTouchesPerSide: { type: 'number', description: 'Minimum boundary touches per side', default: 2 },
      touchTolerancePips: { type: 'number', description: 'Touch tolerance around boundaries', default: 1.5 },
      minRangeAtrMultiplier: { type: 'number', description: 'Minimum range width in ATR multiples', default: 0.8 },
      maxRangeAtrMultiplier: { type: 'number', description: 'Maximum range width in ATR multiples', default: 2.6 },
      minImpulseBodyAtr: { type: 'number', description: 'Minimum breakout candle body in ATR multiples', default: 0.35 },
      requireH1TrendFilter: { type: 'boolean', description: 'Require H1 trend alignment with breakout side', default: true },
      entryMode: { type: 'string', description: 'breakout entry mode: retest or close', default: 'retest' },
      retestTolerancePips: { type: 'number', description: 'Tolerance around broken level for retest', default: 2.0 },
      stopMode: { type: 'string', description: 'stop mode: opposite_boundary or impulse_extreme', default: 'opposite_boundary' },
      slBufferPips: { type: 'number', description: 'SL buffer in pips', default: 2.0 },
      rrTarget: { type: 'number', description: 'Risk-reward target', default: 1.7 },
      enableFalseBreakoutScenario: { type: 'boolean', description: 'Detect false breakout events', default: true },
      allowFalseBreakoutReversalTrade: { type: 'boolean', description: 'Allow reversal trade after false breakout', default: false },
    },
  },
  evaluate: (marketContext: MarketContext, params) => {
    const pair = marketContext.pair;
    const pip = pipSize(pair);
    const m15 = marketContext.candles.M15 || [];
    const atrM15 = marketContext.indicators.atr_m15;
    const trendH1 = marketContext.indicators.trend_h1;

    if (!m15.length || !Number.isFinite(atrM15) || atrM15 <= 0) {
      return noTrade('Missing M15 or ATR data for breakout_v2.', ['DATA_MISSING'], { atr_m15: atrM15 || 0 });
    }

    const rangeWindowBars = Math.max(16, Math.min(80, Number(params.rangeWindowBars ?? 24)));
    const breakoutBufferPips = Math.max(0.3, Number(params.breakoutBufferPips ?? 1.2));
    const minTouchesPerSide = Math.max(1, Number(params.minTouchesPerSide ?? 2));
    const touchTolerancePips = Math.max(0.3, Number(params.touchTolerancePips ?? 1.5));
    const minRangeAtrMultiplier = Math.max(0.1, Number(params.minRangeAtrMultiplier ?? 0.8));
    const maxRangeAtrMultiplier = Math.max(minRangeAtrMultiplier + 0.1, Number(params.maxRangeAtrMultiplier ?? 2.6));
    const minImpulseBodyAtr = Math.max(0.05, Number(params.minImpulseBodyAtr ?? 0.35));
    const requireH1TrendFilter = Boolean(params.requireH1TrendFilter ?? true);
    const entryMode = String(params.entryMode ?? 'retest').toLowerCase() === 'close' ? 'close' : 'retest';
    const retestTolerancePips = Math.max(0.2, Number(params.retestTolerancePips ?? 2.0));
    const stopMode = String(params.stopMode ?? 'opposite_boundary').toLowerCase() === 'impulse_extreme'
      ? 'impulse_extreme'
      : 'opposite_boundary';
    const slBufferPips = Math.max(0.5, Number(params.slBufferPips ?? 2.0));
    const rrTarget = Math.max(1.0, Number(params.rrTarget ?? 1.7));
    const enableFalseBreakoutScenario = Boolean(params.enableFalseBreakoutScenario ?? true);
    const allowFalseBreakoutReversalTrade = Boolean(params.allowFalseBreakoutReversalTrade ?? false);

    const signalCandle = findLastCompleteCandle(m15);
    if (!signalCandle) {
      return noTrade('No closed M15 candle for breakout confirmation.', ['DATA_MISSING']);
    }

    const signalIndex = m15.findIndex((candle) => candle.time === signalCandle.time);
    const rangeStart = Math.max(0, signalIndex - rangeWindowBars);
    const rangeCandles = m15.slice(rangeStart, signalIndex);

    if (rangeCandles.length < Math.min(16, rangeWindowBars)) {
      return noTrade('Insufficient range candles for breakout_v2.', ['DATA_MISSING'], {
        range_window_bars: rangeWindowBars,
        available_range_bars: rangeCandles.length,
      });
    }

    const { high: rangeHigh, low: rangeLow } = rangeHighLow(rangeCandles);
    const rangeWidth = rangeHigh - rangeLow;
    const rangePips = rangeWidth / pip;
    const rangeAtrRatio = rangeWidth / atrM15;
    const body = Math.abs(signalCandle.close - signalCandle.open);
    const impulseBodyAtr = body / atrM15;
    const touchTolerance = touchTolerancePips * pip;
    const touchesHigh = countRangeTouches(rangeCandles, rangeHigh, touchTolerance, 'HIGH');
    const touchesLow = countRangeTouches(rangeCandles, rangeLow, touchTolerance, 'LOW');

    const commonMetrics = {
      range_high: rangeHigh,
      range_low: rangeLow,
      range_pips: Number(rangePips.toFixed(2)),
      range_atr_ratio: Number(rangeAtrRatio.toFixed(3)),
      atr_m15: atrM15,
      impulse_body_atr: Number(impulseBodyAtr.toFixed(3)),
      touches_high: touchesHigh,
      touches_low: touchesLow,
      trend_h1: trendH1,
      signal_candle_time: signalCandle.time,
    };

    if (touchesHigh < minTouchesPerSide || touchesLow < minTouchesPerSide) {
      return noTrade('Range is not validated by enough touches.', ['RANGE_INVALID_TOUCHES'], {
        ...commonMetrics,
        min_touches_per_side: minTouchesPerSide,
      });
    }

    if (rangeAtrRatio < minRangeAtrMultiplier) {
      return noTrade('Range too narrow versus ATR for breakout_v2.', ['RANGE_TOO_NARROW_ATR'], {
        ...commonMetrics,
        min_range_atr_multiplier: minRangeAtrMultiplier,
      });
    }

    if (rangeAtrRatio > maxRangeAtrMultiplier) {
      return noTrade('Range too wide versus ATR for breakout_v2.', ['RANGE_TOO_WIDE_ATR'], {
        ...commonMetrics,
        max_range_atr_multiplier: maxRangeAtrMultiplier,
      });
    }

    const breakoutBuffer = breakoutBufferPips * pip;
    const upConfirm = rangeHigh + breakoutBuffer;
    const downConfirm = rangeLow - breakoutBuffer;
    const breaksUp = signalCandle.close >= upConfirm;
    const breaksDown = signalCandle.close <= downConfirm;

    if (!breaksUp && !breaksDown) {
      if (enableFalseBreakoutScenario) {
        const falseUp = signalCandle.high >= upConfirm && signalCandle.close <= rangeHigh && signalCandle.close >= rangeLow;
        const falseDown = signalCandle.low <= downConfirm && signalCandle.close >= rangeLow && signalCandle.close <= rangeHigh;

        if (falseUp || falseDown) {
          const reversalSide: 'BUY' | 'SELL' = falseUp ? 'SELL' : 'BUY';
          const entry = reversalSide === 'BUY' ? marketContext.price.ask : marketContext.price.bid;
          const stopLoss = reversalSide === 'BUY'
            ? signalCandle.low - slBufferPips * pip
            : signalCandle.high + slBufferPips * pip;
          const risk = reversalSide === 'BUY' ? entry - stopLoss : stopLoss - entry;
          const takeProfit = reversalSide === 'BUY'
            ? entry + risk * rrTarget
            : entry - risk * rrTarget;

          if (!allowFalseBreakoutReversalTrade) {
            return noTrade('False breakout detected; reversal idea available but execution disabled.', ['FALSE_BREAKOUT', falseUp ? 'FALSE_UP' : 'FALSE_DOWN'], {
              ...commonMetrics,
              false_breakout: true,
              false_breakout_direction: falseUp ? 'UP' : 'DOWN',
              reversal_side: reversalSide,
            });
          }

          if (requireH1TrendFilter && !isTrendAllowed(reversalSide, trendH1)) {
            return noTrade('False breakout reversal conflicts with H1 trend filter.', ['FALSE_BREAKOUT', 'TREND_CONFLICT'], {
              ...commonMetrics,
              false_breakout: true,
              false_breakout_direction: falseUp ? 'UP' : 'DOWN',
              reversal_side: reversalSide,
            });
          }

          if (!(risk > 0 && Number.isFinite(risk))) {
            return noTrade('Invalid reversal risk sizing after false breakout.', ['FALSE_BREAKOUT', 'INVALID_RISK'], {
              ...commonMetrics,
              false_breakout: true,
              risk,
            });
          }

          return {
            decision: reversalSide,
            entryType: 'MARKET',
            entryPrice: entry,
            stopLoss,
            takeProfit,
            rationale: `False breakout ${falseUp ? 'above' : 'below'} range detected, taking ${reversalSide} reversal setup.`,
            tags: ['BREAKOUT_V2', 'FALSE_BREAKOUT', reversalSide],
            metrics: {
              ...commonMetrics,
              false_breakout: true,
              false_breakout_direction: falseUp ? 'UP' : 'DOWN',
              entry_mode: 'reversal_market',
              rr_target: rrTarget,
            },
          };
        }
      }

      return noTrade('Breakout candle close did not confirm range breakout.', ['NO_BREAKOUT_CLOSE'], commonMetrics);
    }

    if (impulseBodyAtr < minImpulseBodyAtr) {
      return noTrade('Breakout impulse body is too small relative to ATR.', ['IMPULSE_TOO_WEAK'], {
        ...commonMetrics,
        min_impulse_body_atr: minImpulseBodyAtr,
      });
    }

    const side: 'BUY' | 'SELL' = breaksUp ? 'BUY' : 'SELL';

    if (requireH1TrendFilter && !isTrendAllowed(side, trendH1)) {
      return noTrade('Breakout side rejected by H1 trend filter.', ['TREND_CONFLICT'], {
        ...commonMetrics,
        breakout_side: side,
      });
    }

    const breakoutLevel = side === 'BUY' ? rangeHigh : rangeLow;
    const currentEntry = side === 'BUY' ? marketContext.price.ask : marketContext.price.bid;
    const retestTolerance = retestTolerancePips * pip;

    let entryType: TradeIntent['entryType'] = 'MARKET';
    let entryPrice = currentEntry;

    if (entryMode === 'retest') {
      const distanceFromRetest = Math.abs(currentEntry - breakoutLevel);
      if (distanceFromRetest > retestTolerance) {
        return noTrade('Breakout detected; waiting for retest entry near broken level.', ['WAIT_RETEST'], {
          ...commonMetrics,
          breakout_side: side,
          breakout_level: breakoutLevel,
          retest_tolerance_pips: retestTolerancePips,
          distance_from_retest_pips: Number((distanceFromRetest / pip).toFixed(2)),
        });
      }
      entryType = 'LIMIT';
      entryPrice = breakoutLevel;
    }

    const stopLoss = side === 'BUY'
      ? (stopMode === 'impulse_extreme'
        ? Math.min(signalCandle.low, rangeLow) - slBufferPips * pip
        : rangeLow - slBufferPips * pip)
      : (stopMode === 'impulse_extreme'
        ? Math.max(signalCandle.high, rangeHigh) + slBufferPips * pip
        : rangeHigh + slBufferPips * pip);

    const risk = side === 'BUY' ? entryPrice - stopLoss : stopLoss - entryPrice;
    if (!(risk > 0 && Number.isFinite(risk))) {
      return noTrade('Breakout risk sizing is invalid.', ['INVALID_RISK'], {
        ...commonMetrics,
        breakout_side: side,
        stop_mode: stopMode,
        risk,
      });
    }

    const takeProfit = side === 'BUY'
      ? entryPrice + risk * rrTarget
      : entryPrice - risk * rrTarget;

    return {
      decision: side,
      entryType,
      entryPrice,
      stopLoss,
      takeProfit,
      rationale: `Breakout v2 ${side}: close confirmed beyond ${breaksUp ? 'range high' : 'range low'} with ATR and impulse filters passed.`,
      tags: ['BREAKOUT_V2', side, entryMode === 'retest' ? 'RETEST' : 'CLOSE_ENTRY'],
      metrics: {
        ...commonMetrics,
        breakout_side: side,
        breakout_confirm_close: signalCandle.close,
        breakout_buffer_pips: breakoutBufferPips,
        entry_mode: entryMode,
        stop_mode: stopMode,
        rr_target: rrTarget,
      },
    };
  },
};
