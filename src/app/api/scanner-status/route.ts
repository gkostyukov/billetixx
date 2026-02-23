import { NextResponse } from 'next/server';
import { getEngineStatus } from '../../../../engine/statusStore';
import { loadStrategyConfig } from '../../../../engine/strategyConfig';
import { loadScannerSnapshot } from '../../../../engine/scannerSnapshot';

export async function GET() {
  const config = await loadStrategyConfig();
  const status = getEngineStatus();
  const snapshot = await loadScannerSnapshot();

  return NextResponse.json({
    activeStrategy: snapshot?.activeStrategy || config.activeStrategyId,
    scannedPairs: snapshot?.scannedPairs || status.scannedPairs,
    selectedTrade: snapshot?.selectedTrade ?? status.selectedTrade,
    updatedAt: snapshot?.updatedAt || status.lastUpdatedAt,
  });
}
