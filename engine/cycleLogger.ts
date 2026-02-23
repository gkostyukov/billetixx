import path from 'path';
import { promises as fs } from 'fs';
import type { MarketContext, RiskCheckResult, ScannerPairStatus, TradeIntent } from '../services/types';

function summarizeMarket(context: MarketContext) {
  return {
    pair: context.pair,
    now: context.now,
    mid: context.price.mid,
    spread_pips: context.spread_pips,
    trend_h1: context.indicators.trend_h1,
    momentum_m15: context.indicators.momentum_m15,
    atr_m15: context.indicators.atr_m15,
    atr_h1: context.indicators.atr_h1,
    openPositions: context.account.openPositions.length,
    openTrades: context.account.openTrades.length,
  };
}

export async function logEngineCycle(payload: {
  strategyId: string;
  marketContext?: MarketContext;
  intent?: TradeIntent | null;
  risk?: RiskCheckResult | null;
  result: 'NO_TRADE' | 'READY' | 'EXECUTED';
  reason: string;
}) {
  try {
    const logsDir = path.join(process.cwd(), 'logs');
    const filePath = path.join(logsDir, 'engine-cycles.log');
    await fs.mkdir(logsDir, { recursive: true });

    const record = {
      ts: new Date().toISOString(),
      strategyId: payload.strategyId,
      market: payload.marketContext ? summarizeMarket(payload.marketContext) : null,
      intent: payload.intent || null,
      risk: payload.risk || null,
      result: payload.result,
      reason: payload.reason,
    };

    await fs.appendFile(filePath, `${JSON.stringify(record)}\n`, 'utf-8');
  } catch (error) {
    console.error('Failed to log engine cycle:', error);
  }
}

export async function logScannerCycle(payload: {
  strategyId: string;
  scannedPairs: ScannerPairStatus[];
  selectedTrade: string | null;
}) {
  try {
    const logsDir = path.join(process.cwd(), 'logs');
    const filePath = path.join(logsDir, 'engine-cycles.log');
    await fs.mkdir(logsDir, { recursive: true });

    const ts = new Date().toISOString();
    const lines = payload.scannedPairs.map((pairResult) => {
      const record = {
        ts,
        strategyId: payload.strategyId,
        pair: pairResult.pair,
        decision: pairResult.decision,
        rr: pairResult.rr,
        spread: pairResult.spread,
        score: pairResult.score,
        rejectionReasons: pairResult.rejectionReasons,
        selectedTrade: payload.selectedTrade,
      };

      return JSON.stringify(record);
    });

    if (lines.length) {
      await fs.appendFile(filePath, `${lines.join('\n')}\n`, 'utf-8');
    }
  } catch (error) {
    console.error('Failed to log scanner cycle:', error);
  }
}

export async function logScannerSummary(payload: {
  engine: string;
  instrumentsCount: number;
  candidatesCount: number;
  rejectedCount: number;
  decision: 'TRADE' | 'NO_TRADE';
  topReason: string;
}) {
  try {
    const logsDir = path.join(process.cwd(), 'logs');
    const filePath = path.join(logsDir, 'engine-cycles.log');
    await fs.mkdir(logsDir, { recursive: true });

    const record = {
      ts: new Date().toISOString(),
      type: 'scanner_summary',
      engine: payload.engine,
      instruments_count: payload.instrumentsCount,
      candidates_count: payload.candidatesCount,
      rejected_count: payload.rejectedCount,
      decision: payload.decision,
      top_reason: payload.topReason,
    };

    await fs.appendFile(filePath, `${JSON.stringify(record)}\n`, 'utf-8');
  } catch (error) {
    console.error('Failed to log scanner summary:', error);
  }
}
