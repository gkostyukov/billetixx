import type { Candle, IndicatorBundle, MarketContext, Momentum, RawMarketData, Trend } from './types';

function sma(values: number[], period: number): number {
  const sample = values.slice(-period);
  if (!sample.length) return 0;
  return sample.reduce((acc, value) => acc + value, 0) / sample.length;
}

function calculateAtr(candles: Candle[], period: number = 14): number {
  if (candles.length < period + 1) return 0;

  const trueRanges: number[] = [];
  for (let index = 1; index < candles.length; index += 1) {
    const high = candles[index].high;
    const low = candles[index].low;
    const previousClose = candles[index - 1].close;

    const tr = Math.max(
      high - low,
      Math.abs(high - previousClose),
      Math.abs(low - previousClose),
    );

    trueRanges.push(tr);
  }

  const sample = trueRanges.slice(-period);
  const atr = sample.reduce((acc, value) => acc + value, 0) / sample.length;
  return Number(atr.toFixed(5));
}

function detectH1TrendByMaSlope(h1Candles: Candle[]): Trend {
  const closes = h1Candles.map((candle) => candle.close).filter((value) => Number.isFinite(value) && value > 0);
  if (closes.length < 60) return 'RANGE';

  const currentShortSma = sma(closes, 20);
  const currentLongSma = sma(closes, 50);
  const previousShortSma = sma(closes.slice(0, -1), 20);

  const slope = currentShortSma - previousShortSma;
  const spread = currentShortSma - currentLongSma;

  if (spread > 0 && slope > 0) return 'BULL';
  if (spread < 0 && slope < 0) return 'BEAR';
  return 'RANGE';
}

function detectMomentumM15(m15Candles: Candle[], atrM15: number): Momentum {
  if (m15Candles.length < 6 || atrM15 <= 0) return 'NEUTRAL';

  const window = m15Candles.slice(-6);
  const delta = window[window.length - 1].close - window[0].close;

  if (delta >= atrM15 * 0.6) return 'STRONG_UP';
  if (delta <= -atrM15 * 0.6) return 'STRONG_DOWN';
  return 'NEUTRAL';
}

function detectSwingLevels(candles: Candle[], leftRight: number = 2): { highs: number[]; lows: number[] } {
  const highs: number[] = [];
  const lows: number[] = [];

  for (let i = leftRight; i < candles.length - leftRight; i += 1) {
    const high = candles[i].high;
    const low = candles[i].low;

    const left = candles.slice(i - leftRight, i);
    const right = candles.slice(i + 1, i + 1 + leftRight);

    const isSwingHigh = [...left, ...right].every((candle) => high > candle.high);
    const isSwingLow = [...left, ...right].every((candle) => low < candle.low);

    if (isSwingHigh) highs.push(Number(high.toFixed(5)));
    if (isSwingLow) lows.push(Number(low.toFixed(5)));
  }

  return {
    highs: highs.slice(-8),
    lows: lows.slice(-8),
  };
}

export function computeIndicators(rawData: RawMarketData): IndicatorBundle {
  const atrM15 = calculateAtr(rawData.candles.M15, 14);
  const atrH1 = calculateAtr(rawData.candles.H1, 14);
  const swingsM15 = detectSwingLevels(rawData.candles.M15, 2);
  const trendH1 = detectH1TrendByMaSlope(rawData.candles.H1);
  const momentumM15 = detectMomentumM15(rawData.candles.M15, atrM15);

  return {
    atr_m15: atrM15,
    atr_h1: atrH1,
    swings_m15: swingsM15,
    trend_h1: trendH1,
    momentum_m15: momentumM15,
  };
}

export function buildMarketContext(rawData: RawMarketData): MarketContext {
  return {
    pair: rawData.pair,
    now: rawData.now,
    price: rawData.price,
    spread_pips: rawData.spread_pips,
    candles: rawData.candles,
    indicators: computeIndicators(rawData),
    account: rawData.account,
  };
}
