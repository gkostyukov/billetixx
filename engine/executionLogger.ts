import path from 'path';
import { promises as fs } from 'fs';
import type { TradeIntent, MarketContext } from '../services/types';

export interface ExecutionLogEvent {
  ts: string;
  pair: string;
  side: 'BUY' | 'SELL';
  units: number;
  entryType: 'MARKET' | 'LIMIT';
  entryPrice: number | null;
  stopLoss: number | null;
  takeProfit: number | null;
  score: number | null;
  strategyId: string;
  rationale: string;
  executionResult?: unknown;
}

const EXECUTIONS_PATH = path.join(process.cwd(), 'logs', 'executions.jsonl');

export async function logExecutionEvent(params: {
  pair: string;
  strategyId: string;
  intent: TradeIntent;
  marketContext: MarketContext;
  score: number | null;
  executionResult: unknown;
}) {
  const { pair, strategyId, intent, score, executionResult } = params;

  const units = Math.abs(Number(intent.units ?? 0)) || 0;
  const event: ExecutionLogEvent = {
    ts: new Date().toISOString(),
    pair,
    side: intent.decision === 'SELL' ? 'SELL' : 'BUY',
    units,
    entryType: intent.entryType === 'LIMIT' ? 'LIMIT' : 'MARKET',
    entryPrice: intent.entryPrice ?? null,
    stopLoss: intent.stopLoss ?? null,
    takeProfit: intent.takeProfit ?? null,
    score: typeof score === 'number' ? score : null,
    strategyId,
    rationale: intent.rationale || '',
    executionResult,
  };

  const dir = path.dirname(EXECUTIONS_PATH);
  await fs.mkdir(dir, { recursive: true });
  await fs.appendFile(EXECUTIONS_PATH, `${JSON.stringify(event)}\n`, 'utf-8');
}
