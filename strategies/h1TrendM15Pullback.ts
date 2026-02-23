import type { Candle, MarketContext, TradeIntent } from '../services/types';
import type { StrategyPlugin } from './Strategy';

function noTrade(rationale: string, tags: string[] = []): TradeIntent {
  return {
    decision: 'NO_TRADE',
    entryType: 'MARKET',
    entryPrice: null,
    stopLoss: null,
    takeProfit: null,
    rationale,
    tags,
  };
}

function countLastDirectionCandles(candles: Candle[], direction: 'bearish' | 'bullish', amount: number): number {
  const recent = candles.slice(-amount);
  return recent.filter((candle) =>
    direction === 'bearish' ? candle.close < candle.open : candle.close > candle.open,
  ).length;
}

function nearestBelow(levels: number[], price: number): number | null {
  const filtered = levels.filter((level) => level < price).sort((a, b) => b - a);
  return filtered[0] ?? null;
}

function nearestAbove(levels: number[], price: number): number | null {
  const filtered = levels.filter((level) => level > price).sort((a, b) => a - b);
  return filtered[0] ?? null;
}

export const h1TrendM15PullbackStrategy: StrategyPlugin = {
  id: 'h1_trend_m15_pullback',
  name: 'H1 Trend + M15 Pullback',
  version: '1.0.0',
  requiredTimeframes: ['H1', 'M15'],
  parametersSchema: {
    type: 'object',
    properties: {
      rrTarget: { type: 'number', description: 'Target RR ratio', default: 1.6 },
      pullbackAtrRatio: { type: 'number', description: 'Minimum pullback depth in ATR', default: 0.3 },
      zoneAtrTolerance: { type: 'number', description: 'Distance to support/resistance in ATR', default: 0.35 },
      slAtrBuffer: { type: 'number', description: 'SL buffer beyond zone in ATR', default: 0.1 },
      minSlAtr: { type: 'number', description: 'Minimum SL distance in ATR', default: 0.2 },
    },
  },
  evaluate: (marketContext, params) => {
    const rrTarget = Number(params.rrTarget ?? 1.6);
    const pullbackAtrRatio = Number(params.pullbackAtrRatio ?? 0.3);
    const zoneAtrTolerance = Number(params.zoneAtrTolerance ?? 0.35);
    const slAtrBuffer = Number(params.slAtrBuffer ?? 0.1);
    const minSlAtr = Number(params.minSlAtr ?? 0.2);

    const { trend_h1: trendH1, momentum_m15: momentumM15, atr_m15: atrM15, swings_m15: swingsM15 } = marketContext.indicators;
    const m15Candles = marketContext.candles.M15;

    if (!m15Candles.length || atrM15 <= 0) {
      return noTrade('Недостаточно данных M15/ATR для стратегии.', ['DATA_MISSING']);
    }

    if (trendH1 === 'RANGE') {
      return noTrade('H1 в диапазоне (RANGE), стратегия не торгует флэт.', ['TREND_RANGE']);
    }

    const lastPriceBid = marketContext.price.bid;
    const lastPriceAsk = marketContext.price.ask;
    const mid = marketContext.price.mid;

    const recentHigh = nearestAbove(swingsM15.highs, mid) ?? Math.max(...swingsM15.highs, ...m15Candles.slice(-8).map((c) => c.high));
    const recentLow = nearestBelow(swingsM15.lows, mid) ?? Math.min(...swingsM15.lows, ...m15Candles.slice(-8).map((c) => c.low));

    const bearishPullbackCandles = countLastDirectionCandles(m15Candles, 'bearish', 3);
    const bullishPullbackCandles = countLastDirectionCandles(m15Candles, 'bullish', 3);

    if (trendH1 === 'BULL') {
      const retrace = Math.max(0, recentHigh - mid);
      const hasPullback = bearishPullbackCandles >= 2 || retrace >= atrM15 * pullbackAtrRatio;
      const support = nearestBelow(swingsM15.lows, mid);
      const nearSupport = support != null ? (mid - support) <= atrM15 * zoneAtrTolerance : false;

      if (momentumM15 === 'STRONG_DOWN') {
        return noTrade('M15 momentum STRONG_DOWN против BUY.', ['MOMENTUM_CONFLICT']);
      }
      if (!hasPullback) {
        return noTrade('Нет подтвержденного pullback для BUY.', ['PULLBACK_MISSING']);
      }
      if (!nearSupport) {
        return noTrade('Цена не в зоне поддержки для BUY pullback.', ['NOT_NEAR_SUPPORT']);
      }

      const entry = lastPriceAsk;
      const slRaw = (support ?? recentLow) - atrM15 * slAtrBuffer;
      const minSlDistance = atrM15 * minSlAtr;
      const stopLoss = Math.min(slRaw, entry - minSlDistance);
      const riskDistance = entry - stopLoss;
      const takeProfit = entry + riskDistance * rrTarget;
      const nearestResistance = nearestAbove(swingsM15.highs, entry);

      if (nearestResistance != null && takeProfit >= nearestResistance - atrM15 * 0.05) {
        return noTrade('Для RR>=1.5 TP упирается в ближайшее сопротивление.', ['RR_BLOCKED_BY_RESISTANCE']);
      }

      return {
        decision: 'BUY',
        entryType: 'MARKET',
        entryPrice: Number(entry.toFixed(5)),
        stopLoss: Number(stopLoss.toFixed(5)),
        takeProfit: Number(takeProfit.toFixed(5)),
        rationale: `H1=BULL (MA slope). Pullback подтвержден: bearishCandles=${bearishPullbackCandles}, retrace=${retrace.toFixed(5)}, support=${support ?? recentLow}. RR target=${rrTarget}.`,
        tags: ['H1_BULL', 'M15_PULLBACK', 'CONSERVATIVE'],
      };
    }

    const retrace = Math.max(0, mid - recentLow);
    const hasPullback = bullishPullbackCandles >= 2 || retrace >= atrM15 * pullbackAtrRatio;
    const resistance = nearestAbove(swingsM15.highs, mid);
    const nearResistance = resistance != null ? (resistance - mid) <= atrM15 * zoneAtrTolerance : false;

    if (momentumM15 === 'STRONG_UP') {
      return noTrade('M15 momentum STRONG_UP против SELL.', ['MOMENTUM_CONFLICT']);
    }
    if (!hasPullback) {
      return noTrade('Нет подтвержденного pullback для SELL.', ['PULLBACK_MISSING']);
    }
    if (!nearResistance) {
      return noTrade('Цена не в зоне сопротивления для SELL pullback.', ['NOT_NEAR_RESISTANCE']);
    }

    const entry = lastPriceBid;
    const slRaw = (resistance ?? recentHigh) + atrM15 * slAtrBuffer;
    const minSlDistance = atrM15 * minSlAtr;
    const stopLoss = Math.max(slRaw, entry + minSlDistance);
    const riskDistance = stopLoss - entry;
    const takeProfit = entry - riskDistance * rrTarget;
    const nearestSupport = nearestBelow(swingsM15.lows, entry);

    if (nearestSupport != null && takeProfit <= nearestSupport + atrM15 * 0.05) {
      return noTrade('Для RR>=1.5 TP упирается в ближайшую поддержку.', ['RR_BLOCKED_BY_SUPPORT']);
    }

    return {
      decision: 'SELL',
      entryType: 'MARKET',
      entryPrice: Number(entry.toFixed(5)),
      stopLoss: Number(stopLoss.toFixed(5)),
      takeProfit: Number(takeProfit.toFixed(5)),
      rationale: `H1=BEAR (MA slope). Pullback подтвержден: bullishCandles=${bullishPullbackCandles}, retrace=${retrace.toFixed(5)}, resistance=${resistance ?? recentHigh}. RR target=${rrTarget}.`,
      tags: ['H1_BEAR', 'M15_PULLBACK', 'CONSERVATIVE'],
    };
  },
};
