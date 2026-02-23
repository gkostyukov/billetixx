import type { EngineCycleStatus, ScannerPairStatus, TradeIntent } from '../services/types';

const statusStore: EngineCycleStatus = {
  activeStrategyId: '',
  lastIntent: null,
  lastRejectionReasons: [],
  lastRationale: '',
  scannedPairs: [],
  selectedTrade: null,
  lastUpdatedAt: null,
};

export function updateEngineStatus(payload: {
  activeStrategyId: string;
  lastIntent: TradeIntent | null;
  lastRejectionReasons: string[];
  lastRationale: string;
  scannedPairs?: ScannerPairStatus[];
  selectedTrade?: string | null;
}) {
  statusStore.activeStrategyId = payload.activeStrategyId;
  statusStore.lastIntent = payload.lastIntent;
  statusStore.lastRejectionReasons = payload.lastRejectionReasons;
  statusStore.lastRationale = payload.lastRationale;
  statusStore.scannedPairs = payload.scannedPairs || [];
  statusStore.selectedTrade = payload.selectedTrade || null;
  statusStore.lastUpdatedAt = new Date().toISOString();
}

export function getEngineStatus(): EngineCycleStatus {
  return { ...statusStore };
}
