import { breakoutV2Strategy } from '../strategies/breakoutTemplate';
import type { Candle, MarketContext } from '../services/types';

function assertCondition(condition: unknown, message: string) {
  if (!condition) {
    throw new Error(message);
  }
}

function makeTime(index: number): string {
  return new Date(Date.UTC(2026, 0, 1, 0, index * 15, 0)).toISOString();
}

function buildBaseContext(m15: Candle[], trend: 'BULL' | 'BEAR' | 'RANGE', bid: number, ask: number): MarketContext {
  return {
    pair: 'EUR_USD',
    now: new Date().toISOString(),
    price: {
      bid,
      ask,
      mid: Number((((bid + ask) / 2)).toFixed(5)),
    },
    spread_pips: 0.5,
    candles: {
      M15: m15,
      H1: m15.slice(-40),
    },
    indicators: {
      atr_m15: 0.00045,
      atr_h1: 0.00075,
      swings_m15: {
        highs: m15.slice(-40).map((c) => c.high),
        lows: m15.slice(-40).map((c) => c.low),
      },
      trend_h1: trend,
      momentum_m15: 'NEUTRAL',
    },
    account: {
      balance: 10000,
      openPositions: [],
      openTrades: [],
      fifoConstraints: true,
    },
  };
}

function makeRangeWindowCandles(total: number, low: number, high: number): Candle[] {
  const candles: Candle[] = [];
  for (let index = 0; index < total; index += 1) {
    const isUpper = index % 2 === 0;
    const touch = isUpper ? high - 0.00003 : low + 0.00003;
    const open = touch + (isUpper ? -0.00008 : 0.00008);
    const close = touch + (isUpper ? -0.00005 : 0.00005);
    candles.push({
      time: makeTime(index),
      open: Number(open.toFixed(5)),
      high: Number((Math.max(open, close) + 0.00005).toFixed(5)),
      low: Number((Math.min(open, close) - 0.00005).toFixed(5)),
      close: Number(close.toFixed(5)),
      volume: 120 + index,
      complete: true,
    });
  }
  return candles;
}

async function run() {
  const rangeLow = 1.0993;
  const rangeHigh = 1.1002;
  const base = makeRangeWindowCandles(28, rangeLow, rangeHigh);

  const breakoutSignal: Candle = {
    time: makeTime(29),
    open: 1.10005,
    high: 1.10115,
    low: 1.10002,
    close: 1.10092,
    volume: 190,
    complete: true,
  };

  const breakoutContext = buildBaseContext([...base, breakoutSignal], 'BULL', 1.10018, 1.10024);

  const breakoutIntent = breakoutV2Strategy.evaluate(breakoutContext, {
    rangeWindowBars: 24,
    breakoutBufferPips: 1,
    minTouchesPerSide: 2,
    touchTolerancePips: 2,
    minRangeAtrMultiplier: 0.6,
    maxRangeAtrMultiplier: 3,
    minImpulseBodyAtr: 0.25,
    requireH1TrendFilter: true,
    entryMode: 'retest',
    retestTolerancePips: 2.8,
    stopMode: 'opposite_boundary',
    slBufferPips: 2,
    rrTarget: 1.7,
  });

  assertCondition(breakoutIntent.decision === 'BUY', `Expected BUY breakout signal, got ${breakoutIntent.decision}.`);
  assertCondition(breakoutIntent.entryType === 'LIMIT', `Expected LIMIT entry in retest mode, got ${breakoutIntent.entryType}.`);

  const falseBreakoutSignal: Candle = {
    time: makeTime(30),
    open: 1.10005,
    high: 1.10085,
    low: 1.09995,
    close: 1.10005,
    volume: 180,
    complete: true,
  };

  const falseBreakoutContext = buildBaseContext([...base, falseBreakoutSignal], 'RANGE', 1.10004, 1.1001);

  const falseBreakoutIntent = breakoutV2Strategy.evaluate(falseBreakoutContext, {
    rangeWindowBars: 24,
    breakoutBufferPips: 1,
    minTouchesPerSide: 2,
    touchTolerancePips: 2,
    minRangeAtrMultiplier: 0.6,
    maxRangeAtrMultiplier: 3,
    minImpulseBodyAtr: 0.25,
    enableFalseBreakoutScenario: true,
    allowFalseBreakoutReversalTrade: false,
    rrTarget: 1.7,
  });

  assertCondition(falseBreakoutIntent.decision === 'NO_TRADE', 'Expected NO_TRADE when false-breakout reversal is disabled.');
  assertCondition(
    (falseBreakoutIntent.tags || []).includes('FALSE_BREAKOUT'),
    `Expected FALSE_BREAKOUT tag, got ${(falseBreakoutIntent.tags || []).join(', ')}`,
  );

  console.log('breakout_v2 synthetic tests passed.');
  console.log(`breakout candidate: ${breakoutIntent.decision}, entryType=${breakoutIntent.entryType}`);
  console.log(`false breakout handling: ${falseBreakoutIntent.decision} (${falseBreakoutIntent.rationale})`);
}

run().catch((error) => {
  console.error('breakout_v2 synthetic tests failed:', error);
  process.exit(1);
});
