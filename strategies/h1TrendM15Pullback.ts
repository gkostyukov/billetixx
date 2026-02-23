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

function lastCandleDirection(candles: Candle[]): 'bearish' | 'bullish' | 'flat' {
  const last = candles[candles.length - 1];
  if (!last) return 'flat';
  if (last.close > last.open) return 'bullish';
  if (last.close < last.open) return 'bearish';
  return 'flat';
}

function minStopDistance(pair: string, atrM15: number, minSlAtr: number): number {
  // ATR-based minimum is often too small on quiet sessions; enforce a pip floor.
  const pipFloor = pair.includes('JPY') ? 0.01 * 6 : 0.0001 * 6; // 6 pips
  return Math.max(atrM15 * minSlAtr, pipFloor);
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
    const pair = marketContext.pair;
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

      // NOTE: During a pullback in a bullish trend, momentum can legitimately be STRONG_DOWN.
      // Instead of banning it, wait for the pullback to start stabilizing (a bullish/flat last candle).
      if (momentumM15 === 'STRONG_DOWN' && lastCandleDirection(m15Candles) === 'bearish') {
        return noTrade('M15 momentum STRONG_DOWN: ждём стабилизацию pullback перед BUY.', ['MOMENTUM_CONFLICT']);
      }
      if (!hasPullback) {
        return noTrade('Нет подтвержденного pullback для BUY.', ['PULLBACK_MISSING']);
      }
      if (!nearSupport) {
        return noTrade('Цена не в зоне поддержки для BUY pullback.', ['NOT_NEAR_SUPPORT']);
      }

      const entry = lastPriceAsk;
      const slRaw = (support ?? recentLow) - atrM15 * slAtrBuffer;
      const minSlDistance = minStopDistance(pair, atrM15, minSlAtr);
      const stopLoss = Math.min(slRaw, entry - minSlDistance);
      const riskDistance = entry - stopLoss;
      const takeProfit = entry + riskDistance * rrTarget;
      const nearestResistance = nearestAbove(swingsM15.highs, entry);

      // A) Do NOT hard-reject when TP is near resistance.
      // Instead, flag it so scoring/UX can down-rank it. This helps dry-run find candidates.
      const pip = pair.includes('JPY') ? 0.01 : 0.0001;
      const resistanceBuffer = Math.max(atrM15 * 0.12, pip * 4); // ~4 pips floor
      const tpNearResistance = nearestResistance != null && takeProfit >= nearestResistance - resistanceBuffer;
      const distanceToResistancePips = nearestResistance != null ? (nearestResistance - entry) / pip : null;

      return {
        decision: 'BUY',
        entryType: 'MARKET',
        entryPrice: Number(entry.toFixed(5)),
        stopLoss: Number(stopLoss.toFixed(5)),
        takeProfit: Number(takeProfit.toFixed(5)),
        rationale: `H1=BULL (MA slope). Pullback подтвержден: bearishCandles=${bearishPullbackCandles}, retrace=${retrace.toFixed(5)}, support=${support ?? recentLow}. RR target=${rrTarget}.` + (tpNearResistance ? ` (WARN: TP near resistance ${nearestResistance})` : ''),
        tags: ['H1_BULL', 'M15_PULLBACK', 'CONSERVATIVE', ...(tpNearResistance ? ['TP_NEAR_RESISTANCE'] : [])],
        metrics: {
          tp_near_resistance: tpNearResistance,
          tp_resistance_buffer_pips: Number((resistanceBuffer / pip).toFixed(2)),
          distance_to_resistance_pips: distanceToResistancePips == null ? null : Number(distanceToResistancePips.toFixed(2)),
        },
      };
    }

    const retrace = Math.max(0, mid - recentLow);
    const hasPullback = bullishPullbackCandles >= 2 || retrace >= atrM15 * pullbackAtrRatio;
    const resistance = nearestAbove(swingsM15.highs, mid);
    const nearResistance = resistance != null ? (resistance - mid) <= atrM15 * zoneAtrTolerance : false;

    // Symmetric handling for bearish trend: pullbacks can show STRONG_UP.
    if (momentumM15 === 'STRONG_UP' && lastCandleDirection(m15Candles) === 'bullish') {
      return noTrade('M15 momentum STRONG_UP: ждём стабилизацию pullback перед SELL.', ['MOMENTUM_CONFLICT']);
    }
    if (!hasPullback) {
      return noTrade('Нет подтвержденного pullback для SELL.', ['PULLBACK_MISSING']);
    }
    if (!nearResistance) {
      return noTrade('Цена не в зоне сопротивления для SELL pullback.', ['NOT_NEAR_RESISTANCE']);
    }

    const entry = lastPriceBid;
    const slRaw = (resistance ?? recentHigh) + atrM15 * slAtrBuffer;
    const minSlDistance = minStopDistance(pair, atrM15, minSlAtr);
    const stopLoss = Math.max(slRaw, entry + minSlDistance);
    const riskDistance = stopLoss - entry;
    const takeProfit = entry - riskDistance * rrTarget;
    const nearestSupport = nearestBelow(swingsM15.lows, entry);

    const pip = pair.includes('JPY') ? 0.01 : 0.0001;
    const supportBuffer = Math.max(atrM15 * 0.12, pip * 4); // ~4 pips floor
    const tpNearSupport = nearestSupport != null && takeProfit <= nearestSupport + supportBuffer;
    const distanceToSupportPips = nearestSupport != null ? (entry - nearestSupport) / pip : null;

    return {
      decision: 'SELL',
      entryType: 'MARKET',
      entryPrice: Number(entry.toFixed(5)),
      stopLoss: Number(stopLoss.toFixed(5)),
      takeProfit: Number(takeProfit.toFixed(5)),
      rationale: `H1=BEAR (MA slope). Pullback подтвержден: bullishCandles=${bullishPullbackCandles}, retrace=${retrace.toFixed(5)}, resistance=${resistance ?? recentHigh}. RR target=${rrTarget}.` + (tpNearSupport ? ` (WARN: TP near support ${nearestSupport})` : ''),
      tags: ['H1_BEAR', 'M15_PULLBACK', 'CONSERVATIVE', ...(tpNearSupport ? ['TP_NEAR_SUPPORT'] : [])],
      metrics: {
        tp_near_support: tpNearSupport,
        tp_support_buffer_pips: Number((supportBuffer / pip).toFixed(2)),
        distance_to_support_pips: distanceToSupportPips == null ? null : Number(distanceToSupportPips.toFixed(2)),
      },
    };
  },
};
