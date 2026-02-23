import { NextResponse } from 'next/server';
import { getEngineStatus } from '../../../engine/statusStore';
import { loadStrategyConfig } from '../../../engine/strategyConfig';

export async function GET() {
  const config = await loadStrategyConfig();
  const status = getEngineStatus();

  return NextResponse.json({
    activeStrategyId: config.activeStrategyId,
    lastIntent: status.lastIntent,
    lastRejectionReasons: status.lastRejectionReasons,
    lastRationale: status.lastRationale,
    lastUpdatedAt: status.lastUpdatedAt,
  });
}
