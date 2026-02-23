import { NextResponse } from 'next/server';
import { getEngineStatus } from '../../../engine/statusStore';
import { loadStrategyConfig } from '../../../engine/strategyConfig';
import { loadScannerSnapshot } from '../../../engine/scannerSnapshot';

export async function GET() {
  const config = await loadStrategyConfig();
  const status = getEngineStatus();
  const snapshot = await loadScannerSnapshot();

  return NextResponse.json({
    activeStrategyId: snapshot?.activeStrategy || config.activeStrategyId,
    lastIntent: status.lastIntent,
    lastRejectionReasons: status.lastRejectionReasons,
    lastRationale: status.lastRationale,
    lastUpdatedAt: snapshot?.updatedAt || status.lastUpdatedAt,
    scannedPairs: snapshot?.scannedPairs || status.scannedPairs,
    selectedTrade: snapshot?.selectedTrade ?? status.selectedTrade,
  });
}