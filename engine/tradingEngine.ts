import { ENGINE_CONFIG } from '../config/models';
import { fetchMarketData } from '../services/oandaService';
import { buildMarketContext } from '../services/indicatorService';
import { runRiskChecks } from '../services/riskManager';
import { executeTrade } from '../services/tradeExecutor';
import { getStrategyRegistry } from '../strategies';
import { loadStrategyConfig } from './strategyConfig';
import { loadTradingConfig } from './tradingConfig';
import { calculateScore } from './scoring';
import { updateEngineStatus } from './statusStore';
import { logEngineCycle, logScannerCycle, logScannerSummary } from './cycleLogger';
import { saveScannerSnapshot } from './scannerSnapshot';
import type { MarketContext, ScoredTradeCandidate, ScannerPairStatus, TradeIntent } from '../services/types';

interface EngineInput {
  userId: string;
  pair?: string;
  execute?: boolean;
}

interface PairStrategyRecommendation {
  recommendedStrategyId: string;
  appliedStrategyId: string;
  confidence: number;
  reason: string;
}

function toPipSize(pair: string): number {
  return pair.includes('JPY') ? 0.01 : 0.0001;
}

function recommendStrategyForPair(params: {
  marketContext: MarketContext;
  activeStrategyId: string;
  availableStrategyIds: Set<string>;
}): PairStrategyRecommendation {
  const { marketContext, activeStrategyId, availableStrategyIds } = params;
  const trend = marketContext.indicators.trend_h1;
  const momentum = marketContext.indicators.momentum_m15;
  const spreadPips = marketContext.spread_pips;
  const atrPips = marketContext.indicators.atr_m15 / toPipSize(marketContext.pair);

  const hasRangeStrategy = availableStrategyIds.has('flat_range_v1');
  const hasTrendStrategy = availableStrategyIds.has('h1_trend_m15_pullback');

  if (hasRangeStrategy && trend === 'RANGE' && spreadPips <= 2.2 && atrPips <= 12) {
    return {
      recommendedStrategyId: 'flat_range_v1',
      appliedStrategyId: 'flat_range_v1',
      confidence: 0.82,
      reason: `Range regime detected (trend=${trend}, atr_pips=${atrPips.toFixed(2)}, spread=${spreadPips.toFixed(2)}).`,
    };
  }

  if (hasTrendStrategy && (trend === 'BULL' || trend === 'BEAR')) {
    return {
      recommendedStrategyId: 'h1_trend_m15_pullback',
      appliedStrategyId: 'h1_trend_m15_pullback',
      confidence: momentum === 'NEUTRAL' ? 0.7 : 0.78,
      reason: `Trend regime detected (trend=${trend}, momentum=${momentum}).`,
    };
  }

  const fallback = availableStrategyIds.has(activeStrategyId)
    ? activeStrategyId
    : hasTrendStrategy
      ? 'h1_trend_m15_pullback'
      : hasRangeStrategy
        ? 'flat_range_v1'
        : Array.from(availableStrategyIds)[0] || activeStrategyId;

  return {
    recommendedStrategyId: fallback,
    appliedStrategyId: fallback,
    confidence: 0.55,
    reason: `Fallback strategy selected for mixed/unclear regime (trend=${trend}, atr_pips=${atrPips.toFixed(2)}, spread=${spreadPips.toFixed(2)}).`,
  };
}

export async function runTradingEngine(input: EngineInput) {
  const execute = Boolean(input.execute);
  const strategyConfig = await loadStrategyConfig();
  const tradingConfig = await loadTradingConfig();
  const activeStrategyId = strategyConfig.activeStrategyId;
  const registry = getStrategyRegistry();
  const strategies = registry.list();
  const strategy = registry.get(activeStrategyId);
  const watchlist = input.pair ? [String(input.pair).toUpperCase()] : tradingConfig.watchlist;
  const requiredTimeframes = Array.from(new Set(strategies.flatMap((item) => item.requiredTimeframes)));
  const strategyIds = new Set(strategies.map((item) => item.id));

  if (!strategy) {
    const reason = `Active strategy not found: ${activeStrategyId}`;
    const scannedPairs: ScannerPairStatus[] = [];
    updateEngineStatus({
      activeStrategyId,
      lastIntent: null,
      lastRejectionReasons: [reason],
      lastRationale: reason,
      scannedPairs,
      selectedTrade: null,
    });
    await saveScannerSnapshot({ activeStrategy: activeStrategyId, scannedPairs, selectedTrade: null });
    await logScannerSummary({
      engine: activeStrategyId,
      instrumentsCount: 0,
      candidatesCount: 0,
      rejectedCount: 0,
      decision: 'NO_TRADE',
      topReason: reason,
    });
    await logEngineCycle({ strategyId: activeStrategyId, result: 'NO_TRADE', reason });

    return {
      status: 'NO_TRADE',
      reasonCode: 'ACTIVE_STRATEGY_NOT_FOUND',
      reason,
      executed: false,
      candidates: [],
      rejectedCandidates: [],
      scannedPairs,
      selectedTrade: null,
      activeStrategyId,
      riskCheck: { passed: false, reasons: [reason], slPips: 0, rr: 0, riskUsd: 0 },
    };
  }

  const scannedPairs: ScannerPairStatus[] = [];
  const validCandidates: ScoredTradeCandidate[] = [];

  for (const pair of watchlist) {
    const rawData = await fetchMarketData(input.userId, pair, requiredTimeframes);

    if (!rawData) {
      scannedPairs.push({
        pair,
        recommendedStrategyId: activeStrategyId,
        appliedStrategyId: activeStrategyId,
        recommendationConfidence: 0,
        recommendationReason: 'No market data available; fallback strategy marker only.',
        decision: 'NO_TRADE',
        score: null,
        rr: 0,
        spread: 0,
        rejected: true,
        rejectionReasonCode: 'DATA_UNAVAILABLE',
        metrics: { source: 'fetchMarketData' },
        rejectionReasons: ['Market data is incomplete.'],
      });
      continue;
    }

    const marketContext = buildMarketContext(rawData);
    const recommendation = recommendStrategyForPair({
      marketContext,
      activeStrategyId,
      availableStrategyIds: strategyIds,
    });
    const strategyForPair = registry.get(recommendation.appliedStrategyId) || strategy;

    if (!strategyForPair) {
      scannedPairs.push({
        pair,
        recommendedStrategyId: recommendation.recommendedStrategyId,
        appliedStrategyId: recommendation.appliedStrategyId,
        recommendationConfidence: recommendation.confidence,
        recommendationReason: recommendation.reason,
        decision: 'NO_TRADE',
        score: null,
        rr: 0,
        spread: marketContext.spread_pips,
        rejected: true,
        rejectionReasonCode: 'ACTIVE_STRATEGY_NOT_FOUND',
        metrics: { requested_strategy: recommendation.appliedStrategyId },
        rejectionReasons: ['Strategy plugin is unavailable for selected pair.'],
      });
      continue;
    }

    const intent: TradeIntent = strategyForPair.evaluate(marketContext, strategyConfig.params || {});

    if (intent.decision === 'NO_TRADE') {
      scannedPairs.push({
        pair,
        recommendedStrategyId: recommendation.recommendedStrategyId,
        appliedStrategyId: strategyForPair.id,
        recommendationConfidence: recommendation.confidence,
        recommendationReason: recommendation.reason,
        decision: intent.decision,
        score: null,
        rr: 0,
        spread: marketContext.spread_pips,
        rejected: true,
        rejectionReasonCode: intent.reasonCode || 'STRATEGY_NO_TRADE',
        metrics: intent.metrics,
        rejectionReasons: [intent.rationale || 'Strategy decision is NO_TRADE.'],
      });
      continue;
    }

    const riskCheck = runRiskChecks(marketContext, intent, {
      maxConcurrentTrades: tradingConfig.maxConcurrentTrades,
    });

    if (!riskCheck.passed) {
      scannedPairs.push({
        pair,
        recommendedStrategyId: recommendation.recommendedStrategyId,
        appliedStrategyId: strategyForPair.id,
        recommendationConfidence: recommendation.confidence,
        recommendationReason: recommendation.reason,
        decision: intent.decision,
        score: null,
        rr: riskCheck.rr,
        spread: marketContext.spread_pips,
        rejected: true,
        rejectionReasonCode: 'RISK_CHECK_FAILED',
        metrics: {
          sl_pips: riskCheck.slPips,
          rr: riskCheck.rr,
          risk_usd: riskCheck.riskUsd,
        },
        rejectionReasons: riskCheck.reasons,
      });
      continue;
    }

    const scoreResult = calculateScore(intent, marketContext, tradingConfig.scoring);

    if (!scoreResult.passed) {
      scannedPairs.push({
        pair,
        recommendedStrategyId: recommendation.recommendedStrategyId,
        appliedStrategyId: strategyForPair.id,
        recommendationConfidence: recommendation.confidence,
        recommendationReason: recommendation.reason,
        decision: intent.decision,
        score: null,
        rr: scoreResult.rr,
        spread: marketContext.spread_pips,
        rejected: true,
        rejectionReasonCode: 'SCORING_FILTER_FAILED',
        metrics: intent.metrics,
        rejectionReasons: scoreResult.rejectionReasons,
      });
      continue;
    }

    scannedPairs.push({
      pair,
      recommendedStrategyId: recommendation.recommendedStrategyId,
      appliedStrategyId: strategyForPair.id,
      recommendationConfidence: recommendation.confidence,
      recommendationReason: recommendation.reason,
      decision: intent.decision,
      score: scoreResult.score,
      rr: scoreResult.rr,
      spread: marketContext.spread_pips,
      rejected: false,
      rejectionReasonCode: undefined,
      metrics: intent.metrics,
      rejectionReasons: [],
    });

    validCandidates.push({
      pair,
      strategyId: strategyForPair.id,
      intent,
      score: scoreResult.score,
      rejectionReasons: [],
      rr: scoreResult.rr,
      spread: marketContext.spread_pips,
      marketContext,
      riskCheck,
    });
  }

  const candidates = validCandidates.map((candidate) => ({
    instrument: candidate.pair,
    strategyId: candidate.strategyId,
    side: candidate.intent.decision,
    type: candidate.intent.entryType,
    entry: candidate.intent.entryPrice,
    sl: candidate.intent.stopLoss,
    tp: candidate.intent.takeProfit,
    units: candidate.intent.units,
    score: candidate.score,
    rationale: [candidate.intent.rationale],
    tags: candidate.intent.tags,
  }));

  const rejectedCandidates = scannedPairs
    .filter((pairStatus) => pairStatus.rejected)
    .map((pairStatus) => ({
      instrument: pairStatus.pair,
      rejected_reason_code: pairStatus.rejectionReasonCode || 'UNKNOWN',
      rejected_reason_text: pairStatus.rejectionReasons[0] || 'Rejected by scanner filters.',
      metrics: pairStatus.metrics || {},
    }));

  if (!validCandidates.length) {
    const reason = 'NO_TRADE: no valid trades after scan/risk/scoring filters.';
    const topReason = rejectedCandidates[0]?.rejected_reason_text || 'All scanned pairs rejected.';
    const reasonCode = rejectedCandidates[0]?.rejected_reason_code || 'ALL_REJECTED';
    updateEngineStatus({
      activeStrategyId,
      lastIntent: null,
      lastRejectionReasons: [topReason],
      lastRationale: reason,
      scannedPairs,
      selectedTrade: null,
    });
    await saveScannerSnapshot({ activeStrategy: activeStrategyId, scannedPairs, selectedTrade: null });
    await logScannerCycle({ strategyId: activeStrategyId, scannedPairs, selectedTrade: null });
    await logScannerSummary({
      engine: activeStrategyId,
      instrumentsCount: watchlist.length,
      candidatesCount: 0,
      rejectedCount: rejectedCandidates.length,
      decision: 'NO_TRADE',
      topReason,
    });
    await logEngineCycle({ strategyId: activeStrategyId, result: 'NO_TRADE', reason });

    return {
      status: 'NO_TRADE',
      reasonCode,
      reason,
      executed: false,
      candidates,
      rejectedCandidates,
      scannedPairs,
      selectedTrade: null,
      activeStrategyId,
      riskCheck: { passed: false, reasons: [topReason], slPips: 0, rr: 0, riskUsd: 0 },
    };
  }

  validCandidates.sort((a, b) => b.score - a.score);
  const selected = validCandidates[0];
  const selectedTrade = selected.pair;

  const aiDecision = {
    decision: selected.intent.decision,
    entry: selected.intent.entryPrice || 0,
    stop_loss: selected.intent.stopLoss || 0,
    take_profit: selected.intent.takeProfit || 0,
    reasoning: selected.intent.rationale,
    strategyId: selected.strategyId,
  };

  const openPositionsCount = selected.marketContext.account.openPositions.length;
  if (openPositionsCount >= tradingConfig.maxConcurrentTrades) {
    const reason = `Execution blocked: open positions ${openPositionsCount} >= maxConcurrentTrades ${tradingConfig.maxConcurrentTrades}.`;
    updateEngineStatus({
      activeStrategyId,
      lastIntent: selected.intent,
      lastRejectionReasons: [reason],
      lastRationale: selected.intent.rationale,
      scannedPairs,
      selectedTrade,
    });
    await saveScannerSnapshot({ activeStrategy: activeStrategyId, scannedPairs, selectedTrade });
    await logScannerCycle({ strategyId: activeStrategyId, scannedPairs, selectedTrade });
    await logScannerSummary({
      engine: activeStrategyId,
      instrumentsCount: watchlist.length,
      candidatesCount: candidates.length,
      rejectedCount: rejectedCandidates.length,
      decision: 'NO_TRADE',
      topReason: reason,
    });
    await logEngineCycle({
      strategyId: selected.strategyId,
      marketContext: selected.marketContext,
      intent: selected.intent,
      risk: selected.riskCheck,
      result: 'NO_TRADE',
      reason,
    });

    return {
      status: 'NO_TRADE',
      reasonCode: 'MAX_CONCURRENT_TRADES',
      reason,
      executed: false,
      aiDecision,
      intent: selected.intent,
      riskCheck: selected.riskCheck,
      marketContext: selected.marketContext,
      candidates,
      rejectedCandidates,
      activeStrategyId,
      scannedPairs,
      selectedTrade,
    };
  }

  if (!execute) {
    const reason = 'Top-scored trade selected. Execution disabled (dry run).';
    updateEngineStatus({
      activeStrategyId,
      lastIntent: selected.intent,
      lastRejectionReasons: [],
      lastRationale: selected.intent.rationale,
      scannedPairs,
      selectedTrade,
    });
    await saveScannerSnapshot({ activeStrategy: activeStrategyId, scannedPairs, selectedTrade });
    await logScannerCycle({ strategyId: activeStrategyId, scannedPairs, selectedTrade });
    await logScannerSummary({
      engine: activeStrategyId,
      instrumentsCount: watchlist.length,
      candidatesCount: candidates.length,
      rejectedCount: rejectedCandidates.length,
      decision: 'TRADE',
      topReason: reason,
    });
    await logEngineCycle({
      strategyId: selected.strategyId,
      marketContext: selected.marketContext,
      intent: selected.intent,
      risk: selected.riskCheck,
      result: 'READY',
      reason,
    });

    return {
      status: 'READY',
      reasonCode: 'TRADE_READY',
      reason,
      executed: false,
      aiDecision,
      intent: selected.intent,
      riskCheck: selected.riskCheck,
      marketContext: selected.marketContext,
      candidates,
      rejectedCandidates,
      activeStrategyId,
      scannedPairs,
      selectedTrade,
      score: selected.score,
    };
  }

  const executionResult = await executeTrade(input.userId, selected.pair, selected.intent);

  const reason = 'Top-scored trade executed after scan and all validations.';
  updateEngineStatus({
    activeStrategyId,
    lastIntent: selected.intent,
    lastRejectionReasons: [],
    lastRationale: selected.intent.rationale,
    scannedPairs,
    selectedTrade,
  });
  await saveScannerSnapshot({ activeStrategy: activeStrategyId, scannedPairs, selectedTrade });
  await logScannerCycle({ strategyId: activeStrategyId, scannedPairs, selectedTrade });
  await logScannerSummary({
    engine: activeStrategyId,
    instrumentsCount: watchlist.length,
    candidatesCount: candidates.length,
    rejectedCount: rejectedCandidates.length,
    decision: 'TRADE',
    topReason: reason,
  });
  await logEngineCycle({
    strategyId: selected.strategyId,
    marketContext: selected.marketContext,
    intent: selected.intent,
    risk: selected.riskCheck,
    result: 'EXECUTED',
    reason,
  });

  return {
    status: 'EXECUTED',
    reasonCode: 'TRADE_EXECUTED',
    reason,
    executed: true,
    aiDecision,
    intent: selected.intent,
    riskCheck: selected.riskCheck,
    marketContext: selected.marketContext,
    executionResult,
    candidates,
    rejectedCandidates,
    activeStrategyId,
    scannedPairs,
    selectedTrade,
    score: selected.score,
  };
}
