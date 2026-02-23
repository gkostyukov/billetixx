import { loadStrategyConfig } from '../engine/strategyConfig';
import { loadTradingConfig } from '../engine/tradingConfig';
import { calculateScore } from '../engine/scoring';
import { runRiskChecks } from '../services/riskManager';
import { getStrategyRegistry } from '../strategies';
import type { Candle, MarketContext, ScoredTradeCandidate, ScannerPairStatus, TradeIntent } from '../services/types';

type PairDiagnosticRow = {
  pair: string;
  stage: 'strategy' | 'risk' | 'scoring' | 'selected';
  decision: TradeIntent['decision'];
  score: number | null;
  rr: number;
  spread: number;
  reason: string;
  rationale: string;
};

function makeCandles(base: number, direction: 'up' | 'down' | 'mixed'): Candle[] {
  const candles: Candle[] = [];

  for (let index = 0; index < 20; index += 1) {
    const drift = direction === 'up' ? index * 0.00003 : direction === 'down' ? -index * 0.00003 : (index % 2 === 0 ? 0.00002 : -0.00002) * index;
    const open = base + drift;
    const close = open + (direction === 'up' ? 0.00004 : direction === 'down' ? -0.00004 : index % 2 === 0 ? 0.00002 : -0.00002);
    const high = Math.max(open, close) + 0.00005;
    const low = Math.min(open, close) - 0.00005;

    candles.push({
      time: new Date(Date.now() - (20 - index) * 60_000).toISOString(),
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

function makeContext(input: {
  pair: string;
  bid: number;
  ask: number;
  spreadPips: number;
  trend: 'BULL' | 'BEAR' | 'RANGE';
  momentum: 'STRONG_UP' | 'STRONG_DOWN' | 'NEUTRAL';
  atrM15: number;
  atrH1: number;
  highs: number[];
  lows: number[];
  m15Direction: 'up' | 'down' | 'mixed';
}): MarketContext {
  const mid = Number(((input.bid + input.ask) / 2).toFixed(5));

  return {
    pair: input.pair,
    now: new Date().toISOString(),
    price: { bid: input.bid, ask: input.ask, mid },
    spread_pips: input.spreadPips,
    candles: {
      H1: makeCandles(mid, input.trend === 'BULL' ? 'up' : input.trend === 'BEAR' ? 'down' : 'mixed'),
      M15: makeCandles(mid, input.m15Direction),
    },
    indicators: {
      atr_m15: input.atrM15,
      atr_h1: input.atrH1,
      swings_m15: { highs: input.highs, lows: input.lows },
      trend_h1: input.trend,
      momentum_m15: input.momentum,
    },
    account: {
      balance: 10_000,
      openPositions: [],
      openTrades: [],
      fifoConstraints: true,
    },
  };
}

function buildFakeMarket(): Record<string, MarketContext> {
  return {
    EUR_USD: makeContext({
      pair: 'EUR_USD',
      bid: 1.10008,
      ask: 1.10012,
      spreadPips: 0.4,
      trend: 'BULL',
      momentum: 'NEUTRAL',
      atrM15: 0.0005,
      atrH1: 0.0009,
      highs: [1.1018, 1.1024, 1.1032],
      lows: [1.09995, 1.0997, 1.0994],
      m15Direction: 'down',
    }),
    GBP_USD: makeContext({
      pair: 'GBP_USD',
      bid: 1.2749,
      ask: 1.2750,
      spreadPips: 1,
      trend: 'BULL',
      momentum: 'NEUTRAL',
      atrM15: 0.0006,
      atrH1: 0.0011,
      highs: [1.2751, 1.276, 1.2772],
      lows: [1.272, 1.271, 1.2695],
      m15Direction: 'mixed',
    }),
    USD_JPY: makeContext({
      pair: 'USD_JPY',
      bid: 149.25,
      ask: 149.29,
      spreadPips: 4,
      trend: 'RANGE',
      momentum: 'NEUTRAL',
      atrM15: 0.06,
      atrH1: 0.12,
      highs: [149.4, 149.55, 149.7],
      lows: [149.1, 148.95, 148.8],
      m15Direction: 'mixed',
    }),
  };
}

async function simulateScan(strategyId: string, params: Record<string, unknown>) {
  const tradingConfig = await loadTradingConfig();
  const registry = getStrategyRegistry();
  const strategy = registry.get(strategyId);

  if (!strategy) {
    throw new Error(`Strategy not found: ${strategyId}`);
  }

  const fakeMarket = buildFakeMarket();
  const watchlist = tradingConfig.watchlist.filter((pair) => fakeMarket[pair]);

  const scannedPairs: ScannerPairStatus[] = [];
  const validCandidates: ScoredTradeCandidate[] = [];
  const diagnostics: PairDiagnosticRow[] = [];

  for (const pair of watchlist) {
    const context = fakeMarket[pair];
    const intent: TradeIntent = strategy.evaluate(context, params);

    if (intent.decision === 'NO_TRADE') {
      const reason = intent.rationale || 'Strategy decision is NO_TRADE.';
      scannedPairs.push({
        pair,
        decision: intent.decision,
        score: null,
        rr: 0,
        spread: context.spread_pips,
        rejected: true,
        rejectionReasons: [reason],
      });

      diagnostics.push({
        pair,
        stage: 'strategy',
        decision: intent.decision,
        score: null,
        rr: 0,
        spread: context.spread_pips,
        reason,
        rationale: intent.rationale,
      });
      continue;
    }

    const riskCheck = runRiskChecks(context, intent, {
      maxConcurrentTrades: tradingConfig.maxConcurrentTrades,
    });

    if (!riskCheck.passed) {
      const reason = riskCheck.reasons[0] || 'Risk checks failed.';
      scannedPairs.push({
        pair,
        decision: intent.decision,
        score: null,
        rr: riskCheck.rr,
        spread: context.spread_pips,
        rejected: true,
        rejectionReasons: riskCheck.reasons,
      });

      diagnostics.push({
        pair,
        stage: 'risk',
        decision: intent.decision,
        score: null,
        rr: riskCheck.rr,
        spread: context.spread_pips,
        reason,
        rationale: intent.rationale,
      });
      continue;
    }

    const score = calculateScore(intent, context, tradingConfig.scoring);

    if (!score.passed) {
      const reason = score.rejectionReasons[0] || 'Scoring filters failed.';
      scannedPairs.push({
        pair,
        decision: intent.decision,
        score: null,
        rr: score.rr,
        spread: context.spread_pips,
        rejected: true,
        rejectionReasons: score.rejectionReasons,
      });

      diagnostics.push({
        pair,
        stage: 'scoring',
        decision: intent.decision,
        score: null,
        rr: score.rr,
        spread: context.spread_pips,
        reason,
        rationale: intent.rationale,
      });
      continue;
    }

    scannedPairs.push({
      pair,
      decision: intent.decision,
      score: score.score,
      rr: score.rr,
      spread: context.spread_pips,
      rejected: false,
      rejectionReasons: [],
    });

    validCandidates.push({
      pair,
      intent,
      score: score.score,
      rejectionReasons: [],
      rr: score.rr,
      spread: context.spread_pips,
      marketContext: context,
      riskCheck,
    });

    diagnostics.push({
      pair,
      stage: 'selected',
      decision: intent.decision,
      score: score.score,
      rr: score.rr,
      spread: context.spread_pips,
      reason: 'Passed strategy + risk + scoring.',
      rationale: intent.rationale,
    });
  }

  validCandidates.sort((left, right) => right.score - left.score);

  return {
    strategyId,
    scannedPairs,
    diagnostics,
    selectedTrade: validCandidates[0]?.pair || null,
    selectedScore: validCandidates[0]?.score || null,
  };
}

async function main() {
  const config = await loadStrategyConfig();
  const activeResult = await simulateScan(config.activeStrategyId, config.params);
  const controlResult = await simulateScan('h1_trend_m15_pullback', config.profiles.strict);

  console.log('\n=== Fake Scanner Run: active strategy ===');
  console.log(`strategy: ${activeResult.strategyId}`);
  console.table(activeResult.scannedPairs.map((row) => ({
    pair: row.pair,
    decision: row.decision,
    score: row.score ?? '—',
    rr: row.rr,
    spread: row.spread,
    rejected: row.rejected,
    reason: row.rejectionReasons[0] || '',
  })));
  console.table(activeResult.diagnostics.map((row) => ({
    pair: row.pair,
    stage: row.stage,
    decision: row.decision,
    score: row.score ?? '—',
    rr: row.rr,
    spread: row.spread,
    reason: row.reason,
    rationale: row.rationale,
  })));
  console.log(`selectedTrade: ${activeResult.selectedTrade || 'none'}\n`);

  if (activeResult.strategyId !== 'h1_trend_m15_pullback') {
    console.log('=== Fake Scanner Run: control h1 strategy ===');
    console.log(`strategy: ${controlResult.strategyId}`);
    console.table(controlResult.scannedPairs.map((row) => ({
      pair: row.pair,
      decision: row.decision,
      score: row.score ?? '—',
      rr: row.rr,
      spread: row.spread,
      rejected: row.rejected,
      reason: row.rejectionReasons[0] || '',
    })));
    console.table(controlResult.diagnostics.map((row) => ({
      pair: row.pair,
      stage: row.stage,
      decision: row.decision,
      score: row.score ?? '—',
      rr: row.rr,
      spread: row.spread,
      reason: row.reason,
      rationale: row.rationale,
    })));
    console.log(`selectedTrade: ${controlResult.selectedTrade || 'none'}\n`);
  }
}

main().catch((error) => {
  console.error('Fake scanner test failed:', error);
  process.exit(1);
});
