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
