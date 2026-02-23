import path from 'path';
import { promises as fs } from 'fs';
import type { ScannerPairStatus } from '../services/types';

export interface ScannerSnapshot {
  activeStrategy: string;
  scannedPairs: ScannerPairStatus[];
  selectedTrade: string | null;
  updatedAt: string;
}

const SNAPSHOT_PATH = path.join(process.cwd(), 'logs', 'scanner-status.json');

export async function saveScannerSnapshot(snapshot: Omit<ScannerSnapshot, 'updatedAt'>) {
  const payload: ScannerSnapshot = {
    ...snapshot,
    updatedAt: new Date().toISOString(),
  };

  const dir = path.dirname(SNAPSHOT_PATH);
  await fs.mkdir(dir, { recursive: true });
  await fs.writeFile(SNAPSHOT_PATH, JSON.stringify(payload, null, 2), 'utf-8');
}

export async function loadScannerSnapshot(): Promise<ScannerSnapshot | null> {
  try {
    const raw = await fs.readFile(SNAPSHOT_PATH, 'utf-8');
    const parsed = JSON.parse(raw);
    if (!parsed || !Array.isArray(parsed.scannedPairs)) return null;

    return {
      activeStrategy: String(parsed.activeStrategy || ''),
      scannedPairs: parsed.scannedPairs,
      selectedTrade: parsed.selectedTrade ? String(parsed.selectedTrade) : null,
      updatedAt: parsed.updatedAt ? String(parsed.updatedAt) : new Date().toISOString(),
    };
  } catch {
    return null;
  }
}
