import type { Candle, MarketContext, TradeIntent } from '../services/types';
import type { StrategyPlugin } from './Strategy';

type TpMode = 'FIXED_TP_PIPS' | 'MIDLINE';

function noTrade(reasonCode: string, rationale: string, tags: string[] = [], metrics?: Record<string, number | string | boolean | null>): TradeIntent {
  return {
    decision: 'NO_TRADE',
    entryType: 'MARKET',
    entryPrice: null,
    stopLoss: null,
    takeProfit: null,
    reasonCode,
    rationale,
    tags,
    metrics,
  };
}

function pipSize(pair: string): number {
  return pair.includes('JPY') ? 0.01 : 0.0001;
}

function calcRsi(candles: Candle[], period: number): number | null {
  if (candles.length < period + 1) return null;

  let gains = 0;
  let losses = 0;

  for (let index = candles.length - period; index < candles.length; index += 1) {
    const prev = candles[index - 1];
    const current = candles[index];
    const change = current.close - prev.close;

    if (change > 0) gains += change;
    else losses += Math.abs(change);
  }

  const avgGain = gains / period;
  const avgLoss = losses / period;

  if (avgLoss === 0) return 100;

  const rs = avgGain / avgLoss;
  return 100 - 100 / (1 + rs);
}

function calcAtrPips(candles: Candle[], period: number, pip: number): number | null {
  if (candles.length < period + 1) return null;

  let trSum = 0;
  for (let index = candles.length - period; index < candles.length; index += 1) {
    const current = candles[index];
    const prevClose = candles[index - 1].close;
    const tr = Math.max(
      current.high - current.low,
      Math.abs(current.high - prevClose),
      Math.abs(current.low - prevClose),
    );
    trSum += tr;
  }

  return (trSum / period) / pip;
}

function roundPrice(price: number, pair: string): number {
  const precision = pair.includes('JPY') ? 3 : 5;
  return Number(price.toFixed(precision));
}

function countBoundaryTouches(candles: Candle[], rangeLow: number, rangeHigh: number, tolerancePrice: number): number {
  return candles.reduce((acc, candle) => {
    const nearLow = Math.abs(candle.low - rangeLow) <= tolerancePrice;
    const nearHigh = Math.abs(candle.high - rangeHigh) <= tolerancePrice;
    return acc + (nearLow || nearHigh ? 1 : 0);
  }, 0);
}

function clamp01(value: number): number {
  return Math.max(0, Math.min(1, value));
}

export const flatRangeFadeStrategy: StrategyPlugin = {
  id: 'flat_range_v1',
  name: 'Range Fade (Flat) v1',
  version: '1.0.0',
  requiredTimeframes: ['M15', 'H1'],
  parametersSchema: {
    type: 'object',
    properties: {
      units: { type: 'number', description: 'Fixed units per trade', default: 1000 },
      rangeWindowBars: { type: 'number', description: 'Bars for range detection', default: 32 },
      atrMaxPips: { type: 'number', description: 'Max ATR(14) in pips for flat regime', default: 12 },
      minRangePips: { type: 'number', description: 'Minimum acceptable range size in pips', default: 8 },
      maxRangePips: { type: 'number', description: 'Maximum acceptable range size in pips', default: 35 },
      entryBandPips: { type: 'number', description: 'Distance to boundary for entry setup', default: 3 },
      maxSpreadPips: { type: 'number', description: 'Maximum allowed spread', default: 2.2 },
      slBufferPips: { type: 'number', description: 'Stop-loss buffer beyond range boundary', default: 1.7 },
      tpMode: { type: 'string', description: 'FIXED_TP_PIPS or MIDLINE', default: 'MIDLINE' },
      tpPips: { type: 'number', description: 'Fixed TP distance (used in FIXED_TP_PIPS mode)', default: 10 },
      minRiskReward: { type: 'number', description: 'Minimum RR threshold', default: 1.1 },
      rsiEnabled: { type: 'boolean', description: 'Enable RSI filter', default: true },
      rsiPeriod: { type: 'number', description: 'RSI period', default: 14 },
      rsiBuyMax: { type: 'number', description: 'RSI max for BUY setup', default: 45 },
      rsiSellMin: { type: 'number', description: 'RSI min for SELL setup', default: 55 },
      minTouchCount: { type: 'number', description: 'Min boundary touches for stable range', default: 2 },
      enableNewsWindowFilter: { type: 'boolean', description: 'Block trading around high-impact news', default: false },
      inNewsWindow: { type: 'boolean', description: 'External flag indicating news window', default: false },
    },
  },
  evaluate: (marketContext, params) => {
    const pair = marketContext.pair;
    const pip = pipSize(pair);
    const m15 = marketContext.candles.M15 || [];

    const units = Math.max(1, Number(params.units ?? 1000));
    const rangeWindowBars = Math.max(20, Math.min(48, Number(params.rangeWindowBars ?? 32)));
    const atrMaxPips = Number(params.atrMaxPips ?? 12);
    const minRangePips = Number(params.minRangePips ?? 8);
    const maxRangePips = Number(params.maxRangePips ?? 35);
    const entryBandPips = Number(params.entryBandPips ?? 3);
    const maxSpreadPips = Number(params.maxSpreadPips ?? 2.2);
    const slBufferPips = Number(params.slBufferPips ?? 1.7);
    const tpMode = String(params.tpMode ?? 'MIDLINE').toUpperCase() as TpMode;
    const tpPips = Number(params.tpPips ?? 10);
    const minRiskReward = Number(params.minRiskReward ?? 1.1);
    const rsiEnabled = Boolean(params.rsiEnabled ?? true);
    const rsiPeriod = Math.max(2, Number(params.rsiPeriod ?? 14));
    const rsiBuyMax = Number(params.rsiBuyMax ?? 45);
    const rsiSellMin = Number(params.rsiSellMin ?? 55);
    const minTouchCount = Math.max(1, Number(params.minTouchCount ?? 2));
    const enableNewsWindowFilter = Boolean(params.enableNewsWindowFilter ?? false);
    const inNewsWindow = Boolean(params.inNewsWindow ?? false);

    if (enableNewsWindowFilter && inNewsWindow) {
      return noTrade('NEAR_NEWS_WINDOW', 'NO_TRADE: near news window.', ['RANGE_FADE', 'NEWS_BLOCK']);
    }

    if (marketContext.spread_pips > maxSpreadPips) {
      return noTrade('SPREAD_TOO_WIDE', `NO_TRADE: spread too wide (${marketContext.spread_pips.toFixed(2)} > ${maxSpreadPips.toFixed(2)}).`, ['RANGE_FADE', 'SPREAD_FILTER'], {
        spread_pips: Number(marketContext.spread_pips.toFixed(2)),
        max_spread_pips: Number(maxSpreadPips.toFixed(2)),
      });
    }

    if (m15.length < rangeWindowBars + 1) {
      return noTrade('DATA_UNAVAILABLE', 'NO_TRADE: DATA_UNAVAILABLE, not enough M15 candles.', ['RANGE_FADE', 'DATA_UNAVAILABLE'], {
        required_bars: rangeWindowBars + 1,
        available_bars: m15.length,
      });
    }

    const windowCandles = m15.slice(-rangeWindowBars);
    const rangeHigh = Math.max(...windowCandles.map((c) => c.high));
    const rangeLow = Math.min(...windowCandles.map((c) => c.low));
    const rangeMid = (rangeHigh + rangeLow) / 2;
    const rangeSizePips = (rangeHigh - rangeLow) / pip;
    const atrPips = calcAtrPips(m15, 14, pip);

    if (atrPips == null || atrPips <= 0) {
      return noTrade('DATA_UNAVAILABLE', 'NO_TRADE: DATA_UNAVAILABLE, ATR cannot be calculated.', ['RANGE_FADE', 'DATA_UNAVAILABLE']);
    }

    if (atrPips > atrMaxPips) {
      return noTrade('NOT_RANGE_BOUND', `NO_TRADE: market not range-bound (ATR ${atrPips.toFixed(2)} pips > ${atrMaxPips.toFixed(2)}).`, ['RANGE_FADE', 'NOT_RANGE_BOUND'], {
        atr_pips: Number(atrPips.toFixed(2)),
        atr_max_pips: Number(atrMaxPips.toFixed(2)),
      });
    }

    if (rangeSizePips < minRangePips || rangeSizePips > maxRangePips) {
      return noTrade('RANGE_SIZE_OUT_OF_BOUNDS', `NO_TRADE: range size out of bounds (${rangeSizePips.toFixed(2)} pips).`, ['RANGE_FADE', 'RANGE_FILTER'], {
        range_size_pips: Number(rangeSizePips.toFixed(2)),
        min_range_pips: Number(minRangePips.toFixed(2)),
        max_range_pips: Number(maxRangePips.toFixed(2)),
      });
    }

    const tolerancePrice = Math.max(entryBandPips * pip, 0.5 * pip);
    const touchCount = countBoundaryTouches(windowCandles, rangeLow, rangeHigh, tolerancePrice);

    if (touchCount < minTouchCount) {
      return noTrade('RANGE_UNSTABLE', `NO_TRADE: range is unstable (touches ${touchCount} < ${minTouchCount}).`, ['RANGE_FADE', 'RANGE_UNSTABLE'], {
        touch_count: touchCount,
        min_touch_count: minTouchCount,
      });
    }

    const bid = marketContext.price.bid;
    const ask = marketContext.price.ask;
    const mid = marketContext.price.mid;

    const distToLowPips = (mid - rangeLow) / pip;
    const distToHighPips = (rangeHigh - mid) / pip;
    const nearLow = distToLowPips <= entryBandPips;
    const nearHigh = distToHighPips <= entryBandPips;

    if (!nearLow && !nearHigh) {
      return noTrade('ENTRY_BAND_MISS', 'NO_TRADE: price not near range boundaries.', ['RANGE_FADE', 'ENTRY_BAND_MISS'], {
        distance_to_low_pips: Number(distToLowPips.toFixed(2)),
        distance_to_high_pips: Number(distToHighPips.toFixed(2)),
        entry_band_pips: Number(entryBandPips.toFixed(2)),
      });
    }

    const rsi = calcRsi(m15, rsiPeriod);
    const preferBuy = nearLow && (!nearHigh || distToLowPips <= distToHighPips);
    const side: 'BUY' | 'SELL' = preferBuy ? 'BUY' : 'SELL';

    if (rsiEnabled && rsi != null) {
      if (side === 'BUY' && rsi > rsiBuyMax) {
        return noTrade('RSI_FILTER_BLOCK', `NO_TRADE: RSI filter blocks BUY (${rsi.toFixed(2)} > ${rsiBuyMax.toFixed(2)}).`, ['RANGE_FADE', 'RSI_FILTER'], {
          rsi: Number(rsi.toFixed(2)),
          rsi_buy_max: Number(rsiBuyMax.toFixed(2)),
        });
      }

      if (side === 'SELL' && rsi < rsiSellMin) {
        return noTrade('RSI_FILTER_BLOCK', `NO_TRADE: RSI filter blocks SELL (${rsi.toFixed(2)} < ${rsiSellMin.toFixed(2)}).`, ['RANGE_FADE', 'RSI_FILTER'], {
          rsi: Number(rsi.toFixed(2)),
          rsi_sell_min: Number(rsiSellMin.toFixed(2)),
        });
      }
    }

    const entry = side === 'BUY' ? ask : bid;
    const stopLoss = side === 'BUY'
      ? rangeLow - slBufferPips * pip
      : rangeHigh + slBufferPips * pip;

    const takeProfit = tpMode === 'FIXED_TP_PIPS'
      ? side === 'BUY'
        ? entry + tpPips * pip
        : entry - tpPips * pip
      : rangeMid;

    const risk = Math.abs(entry - stopLoss);
    const reward = Math.abs(takeProfit - entry);
    const rr = risk > 0 ? reward / risk : 0;

    if (!Number.isFinite(rr) || rr < minRiskReward) {
      return noTrade('RR_TOO_LOW', `NO_TRADE: RR ${rr.toFixed(2)} below minimum ${minRiskReward.toFixed(2)}.`, ['RANGE_FADE', 'RR_FILTER'], {
        rr: Number(rr.toFixed(2)),
        min_rr: Number(minRiskReward.toFixed(2)),
      });
    }

    const boundaryDistance = Math.min(distToLowPips, distToHighPips);
    const atrStabilityScore = clamp01((atrMaxPips - atrPips) / Math.max(atrMaxPips, 0.0001));
    const boundaryProximityScore = clamp01(1 - boundaryDistance / Math.max(entryBandPips, 0.0001));
    const touchDensityScore = clamp01(touchCount / Math.max(minTouchCount + 2, 1));
    const rsiEdgeScore = rsi == null
      ? 0.5
      : side === 'BUY'
        ? clamp01((rsiBuyMax - rsi) / Math.max(rsiBuyMax, 1))
        : clamp01((rsi - rsiSellMin) / Math.max(100 - rsiSellMin, 1));

    return {
      decision: side,
      entryType: 'MARKET',
      entryPrice: roundPrice(entry, pair),
      stopLoss: roundPrice(stopLoss, pair),
      takeProfit: roundPrice(takeProfit, pair),
      units,
      reasonCode: 'TRADE_READY',
      rationale: `Range Fade: ${side} near ${side === 'BUY' ? 'range low' : 'range high'}; range=${rangeSizePips.toFixed(2)} pips, ATR=${atrPips.toFixed(2)} pips, RR=${rr.toFixed(2)}.`,
      tags: ['RANGE_FADE', 'MEAN_REVERSION', `TP_${tpMode}`],
      metrics: {
        atr_pips: Number(atrPips.toFixed(2)),
        atr_stability_score: Number(atrStabilityScore.toFixed(3)),
        range_size_pips: Number(rangeSizePips.toFixed(2)),
        boundary_distance_pips: Number(boundaryDistance.toFixed(2)),
        boundary_proximity_score: Number(boundaryProximityScore.toFixed(3)),
        touch_count: touchCount,
        touch_density_score: Number(touchDensityScore.toFixed(3)),
        rsi: rsi == null ? null : Number(rsi.toFixed(2)),
        rsi_edge_score: Number(rsiEdgeScore.toFixed(3)),
        rr: Number(rr.toFixed(2)),
      },
    };
  },
};
