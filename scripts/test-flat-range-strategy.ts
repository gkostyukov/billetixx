import { calculateScore } from '../engine/scoring';
import { runRiskChecks } from '../services/riskManager';
import { flatRangeFadeStrategy } from '../strategies/flatRangeFade';
import type { Candle, MarketContext } from '../services/types';

function makeRangeCandles(base: number, rangeWidth: number, total: number): Candle[] {
  const candles: Candle[] = [];
  const half = rangeWidth / 2;

  for (let index = 0; index < total; index += 1) {
    const phase = index % 8;
    const oscillation = (phase < 4 ? phase : 8 - phase) / 4;
    const mid = base - half + oscillation * rangeWidth;
    const open = mid + (index % 2 === 0 ? 0.00005 : -0.00005);
    const close = mid + (index % 2 === 0 ? -0.00002 : 0.00002);
    const high = Math.max(open, close) + 0.0002;
    const low = Math.min(open, close) - 0.0002;

    candles.push({
      time: new Date(Date.now() - (total - index) * 60_000).toISOString(),
      open: Number(open.toFixed(5)),
      high: Number(high.toFixed(5)),
      low: Number(low.toFixed(5)),
      close: Number(close.toFixed(5)),
      volume: 100 + index,
      complete: true,
    });
  }

  return candles;
}

function makeTrendCandles(base: number, total: number): Candle[] {
  const candles: Candle[] = [];

  for (let index = 0; index < total; index += 1) {
    const drift = index * 0.00045;
    const open = base + drift;
    const close = open + 0.0003;
    const high = close + 0.00035;
    const low = open - 0.00035;

    candles.push({
      time: new Date(Date.now() - (total - index) * 60_000).toISOString(),
      open: Number(open.toFixed(5)),
      high: Number(high.toFixed(5)),
      low: Number(low.toFixed(5)),
      close: Number(close.toFixed(5)),
      volume: 120 + index,
      complete: true,
    });
  }

  return candles;
}

function buildContext(input: {
  pair: string;
  m15: Candle[];
  h1: Candle[];
  bid: number;
  ask: number;
  spreadPips: number;
  trend: 'BULL' | 'BEAR' | 'RANGE';
}): MarketContext {
  return {
    pair: input.pair,
    now: new Date().toISOString(),
    price: {
      bid: input.bid,
      ask: input.ask,
      mid: Number((((input.bid + input.ask) / 2)).toFixed(5)),
    },
    spread_pips: input.spreadPips,
    candles: {
      M15: input.m15,
      H1: input.h1,
    },
    indicators: {
      atr_m15: 0.0005,
      atr_h1: 0.0009,
      swings_m15: {
        highs: input.m15.slice(-40).map((c) => c.high),
        lows: input.m15.slice(-40).map((c) => c.low),
      },
      trend_h1: input.trend,
      momentum_m15: 'NEUTRAL',
    },
    account: {
      balance: 10_000,
      openPositions: [],
      openTrades: [],
      fifoConstraints: true,
    },
  };
}

function assertCondition(condition: unknown, message: string) {
  if (!condition) {
    throw new Error(message);
  }
}

async function run() {
  const scoringWeights = {
    rrWeight: 0.4,
    trendClarityWeight: 0.3,
    spreadWeight: 0.2,
    distanceFromSRWeight: 0.1,
  };

  const flatM15 = makeRangeCandles(1.1000, 0.0014, 80);
  const flatH1 = makeRangeCandles(1.1000, 0.0020, 80);
  const flatContext = buildContext({
    pair: 'EUR_USD',
    m15: flatM15,
    h1: flatH1,
    bid: 1.09922,
    ask: 1.09926,
    spreadPips: 0.4,
    trend: 'RANGE',
  });

  const flatIntent = flatRangeFadeStrategy.evaluate(flatContext, {
    units: 1000,
    rangeWindowBars: 32,
    atrMaxPips: 10,
    minRangePips: 8,
    maxRangePips: 30,
    entryBandPips: 5,
    maxSpreadPips: 1.5,
    slBufferPips: 1.2,
    tpMode: 'MIDLINE',
    minRiskReward: 1.2,
    rsiEnabled: false,
    minTouchCount: 3,
  });

  assertCondition(flatIntent.decision !== 'NO_TRADE', `Expected flat context to produce candidate, got NO_TRADE (${flatIntent.reasonCode || 'no_code'}).`);

  const risk = runRiskChecks(flatContext, flatIntent, { maxConcurrentTrades: 1 });
  assertCondition(risk.passed, `Expected flat candidate to pass risk checks, got: ${risk.reasons.join('; ')}`);

  const score = calculateScore(flatIntent, flatContext, scoringWeights);
  assertCondition(score.passed, `Expected flat candidate to pass scoring, got: ${score.rejectionReasons.join('; ')}`);

  const trendM15 = makeTrendCandles(1.1000, 80);
  const trendH1 = makeTrendCandles(1.1000, 80);
  const trendContext = buildContext({
    pair: 'EUR_USD',
    m15: trendM15,
    h1: trendH1,
    bid: 1.1352,
    ask: 1.13526,
    spreadPips: 0.6,
    trend: 'BULL',
  });

  const trendIntent = flatRangeFadeStrategy.evaluate(trendContext, {
    atrMaxPips: 8,
    maxSpreadPips: 1.5,
    rsiEnabled: false,
  });

  assertCondition(trendIntent.decision === 'NO_TRADE', 'Expected trend context to produce NO_TRADE.');
  assertCondition(trendIntent.reasonCode === 'NOT_RANGE_BOUND', `Expected NOT_RANGE_BOUND reason code, got ${trendIntent.reasonCode || 'undefined'}.`);

  console.log('flat_range_v1 synthetic tests passed.');
  console.log(`flat candidate: ${flatIntent.decision}, score=${score.score}, rr=${score.rr}`);
  console.log(`trend rejection: ${trendIntent.reasonCode} -> ${trendIntent.rationale}`);
}

run().catch((error) => {
  console.error('flat_range_v1 synthetic tests failed:', error);
  process.exit(1);
});
