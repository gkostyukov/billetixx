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
import type { ScoredTradeCandidate, ScannerPairStatus, TradeIntent } from '../services/types';

interface EngineInput {
  userId: string;
  pair?: string;
  execute?: boolean;
}

export async function runTradingEngine(input: EngineInput) {
  const execute = Boolean(input.execute);
  const strategyConfig = await loadStrategyConfig();
  const tradingConfig = await loadTradingConfig();
  const activeStrategyId = strategyConfig.activeStrategyId;
  const registry = getStrategyRegistry();
  const strategy = registry.get(activeStrategyId);
  const watchlist = input.pair ? [String(input.pair).toUpperCase()] : tradingConfig.watchlist;

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
    const rawData = await fetchMarketData(input.userId, pair, strategy.requiredTimeframes);

    if (!rawData) {
      scannedPairs.push({
        pair,
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
    const intent: TradeIntent = strategy.evaluate(marketContext, strategyConfig.params || {});

    if (intent.decision === 'NO_TRADE') {
      scannedPairs.push({
        pair,
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
      strategyId: activeStrategyId,
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
      strategyId: activeStrategyId,
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
    strategyId: activeStrategyId,
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
