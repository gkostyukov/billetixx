import path from 'path';
import { promises as fs } from 'fs';

type EngineResult = 'NO_TRADE' | 'READY' | 'EXECUTED';
type ScannerDecision = 'TRADE' | 'NO_TRADE';

interface LogRecord {
  ts?: string;
  strategyId?: string;
  pair?: string;
  decision?: 'BUY' | 'SELL' | 'NO_TRADE';
  rr?: number;
  spread?: number;
  score?: number | null;
  rejectionReasons?: string[];
  selectedTrade?: string | null;
  type?: string;
  engine?: string;
  instruments_count?: number;
  candidates_count?: number;
  rejected_count?: number;
  top_reason?: string;
  market?: unknown;
  intent?: unknown;
  risk?: unknown;
  result?: EngineResult;
  reason?: string;
}

interface PairStats {
  scans: number;
  selectedCount: number;
  buyCount: number;
  sellCount: number;
  noTradeCount: number;
  rejectedCount: number;
  spreadSum: number;
  spreadCount: number;
  rrSum: number;
  rrCount: number;
  scoreSum: number;
  scoreCount: number;
}

function parseArgs() {
  const args = process.argv.slice(2);
  const values: Record<string, string> = {};

  for (let index = 0; index < args.length; index += 1) {
    const key = args[index];
    if (!key.startsWith('--')) continue;
    const value = args[index + 1];
    if (!value || value.startsWith('--')) continue;
    values[key.slice(2)] = value;
    index += 1;
  }

  return {
    input: values.input || path.join(process.cwd(), 'logs', 'engine-cycles.log'),
    outDir: values.outDir || path.join(process.cwd(), 'logs', 'reports'),
  };
}

function safeNumber(value: unknown): number | null {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  return null;
}

function increment(map: Map<string, number>, key: string) {
  map.set(key, (map.get(key) || 0) + 1);
}

function mean(sum: number, count: number): number | null {
  if (!count) return null;
  return Number((sum / count).toFixed(6));
}

function toCsv(rows: Array<Record<string, string | number | null>>) {
  if (!rows.length) return '';
  const headers = Object.keys(rows[0]);

  const escapeCell = (value: string | number | null) => {
    const raw = value == null ? '' : String(value);
    if (raw.includes(',') || raw.includes('"') || raw.includes('\n')) {
      return `"${raw.replace(/"/g, '""')}"`;
    }
    return raw;
  };

  const lines = [headers.join(',')];
  for (const row of rows) {
    const cells = headers.map((header) => escapeCell(row[header] ?? null));
    lines.push(cells.join(','));
  }

  return lines.join('\n');
}

async function main() {
  const { input, outDir } = parseArgs();

  const raw = await fs.readFile(input, 'utf-8');
  const lines = raw
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);

  const records: LogRecord[] = [];
  let invalidLines = 0;

  for (const line of lines) {
    try {
      records.push(JSON.parse(line) as LogRecord);
    } catch {
      invalidLines += 1;
    }
  }

  const resultCounts = new Map<EngineResult, number>([
    ['NO_TRADE', 0],
    ['READY', 0],
    ['EXECUTED', 0],
  ]);
  const scannerSummaryCounts = new Map<ScannerDecision, number>([
    ['NO_TRADE', 0],
    ['TRADE', 0],
  ]);
  const noTradeReasonCounts = new Map<string, number>();
  const scannerTopReasonCounts = new Map<string, number>();
  const rejectionReasonCounts = new Map<string, number>();
  const pairStats = new Map<string, PairStats>();

  let firstTs: string | null = null;
  let lastTs: string | null = null;

  for (const record of records) {
    if (record.ts) {
      if (!firstTs || record.ts < firstTs) firstTs = record.ts;
      if (!lastTs || record.ts > lastTs) lastTs = record.ts;
    }

    if (record.result && resultCounts.has(record.result)) {
      resultCounts.set(record.result, (resultCounts.get(record.result) || 0) + 1);
      if (record.result === 'NO_TRADE' && record.reason) {
        increment(noTradeReasonCounts, record.reason);
      }
    }

    if (record.type === 'scanner_summary') {
      const decision = record.decision === 'TRADE' ? 'TRADE' : 'NO_TRADE';
      scannerSummaryCounts.set(decision, (scannerSummaryCounts.get(decision) || 0) + 1);
      if (record.top_reason) {
        increment(scannerTopReasonCounts, record.top_reason);
      }
    }

    if (!record.pair) continue;

    const stats = pairStats.get(record.pair) || {
      scans: 0,
      selectedCount: 0,
      buyCount: 0,
      sellCount: 0,
      noTradeCount: 0,
      rejectedCount: 0,
      spreadSum: 0,
      spreadCount: 0,
      rrSum: 0,
      rrCount: 0,
      scoreSum: 0,
      scoreCount: 0,
    };

    stats.scans += 1;

    if (record.selectedTrade && record.selectedTrade === record.pair) {
      stats.selectedCount += 1;
    }

    if (record.decision === 'BUY') stats.buyCount += 1;
    else if (record.decision === 'SELL') stats.sellCount += 1;
    else stats.noTradeCount += 1;

    const spread = safeNumber(record.spread);
    if (spread != null) {
      stats.spreadSum += spread;
      stats.spreadCount += 1;
    }

    const rr = safeNumber(record.rr);
    if (rr != null) {
      stats.rrSum += rr;
      stats.rrCount += 1;
    }

    const score = safeNumber(record.score);
    if (score != null) {
      stats.scoreSum += score;
      stats.scoreCount += 1;
    }

    if (Array.isArray(record.rejectionReasons) && record.rejectionReasons.length) {
      stats.rejectedCount += 1;
      for (const reason of record.rejectionReasons) {
        increment(rejectionReasonCounts, reason);
      }
    }

    pairStats.set(record.pair, stats);
  }

  const sortedReasonRows = Array.from(rejectionReasonCounts.entries())
    .sort((left, right) => right[1] - left[1])
    .map(([reason, count]) => ({ reason, count }));

  const sortedNoTradeRows = Array.from(noTradeReasonCounts.entries())
    .sort((left, right) => right[1] - left[1])
    .map(([reason, count]) => ({ reason, count }));

  const sortedScannerTopRows = Array.from(scannerTopReasonCounts.entries())
    .sort((left, right) => right[1] - left[1])
    .map(([reason, count]) => ({ reason, count }));

  const pairRows = Array.from(pairStats.entries())
    .sort((left, right) => right[1].scans - left[1].scans)
    .map(([pair, stats]) => ({
      pair,
      scans: stats.scans,
      selectedCount: stats.selectedCount,
      buyCount: stats.buyCount,
      sellCount: stats.sellCount,
      noTradeCount: stats.noTradeCount,
      rejectedCount: stats.rejectedCount,
      avgSpread: mean(stats.spreadSum, stats.spreadCount),
      avgRR: mean(stats.rrSum, stats.rrCount),
      avgScore: mean(stats.scoreSum, stats.scoreCount),
    }));

  const report = {
    generatedAt: new Date().toISOString(),
    sourceFile: input,
    period: {
      firstTs,
      lastTs,
    },
    totals: {
      lines: lines.length,
      parsedRecords: records.length,
      invalidLines,
      engineResultCounts: {
        NO_TRADE: resultCounts.get('NO_TRADE') || 0,
        READY: resultCounts.get('READY') || 0,
        EXECUTED: resultCounts.get('EXECUTED') || 0,
      },
      scannerSummaryCounts: {
        NO_TRADE: scannerSummaryCounts.get('NO_TRADE') || 0,
        TRADE: scannerSummaryCounts.get('TRADE') || 0,
      },
    },
    topReasons: {
      rejectionReasons: sortedReasonRows.slice(0, 20),
      engineNoTradeReasons: sortedNoTradeRows.slice(0, 20),
      scannerTopReasons: sortedScannerTopRows.slice(0, 20),
    },
    pairs: pairRows,
  };

  await fs.mkdir(outDir, { recursive: true });

  const jsonPath = path.join(outDir, 'dry-run-analysis.json');
  const pairCsvPath = path.join(outDir, 'dry-run-pairs.csv');
  const reasonCsvPath = path.join(outDir, 'dry-run-rejection-reasons.csv');

  await fs.writeFile(jsonPath, JSON.stringify(report, null, 2), 'utf-8');
  await fs.writeFile(pairCsvPath, toCsv(pairRows), 'utf-8');
  await fs.writeFile(reasonCsvPath, toCsv(sortedReasonRows), 'utf-8');

  console.log('Dry run analysis exported');
  console.log(`JSON: ${jsonPath}`);
  console.log(`CSV (pairs): ${pairCsvPath}`);
  console.log(`CSV (rejection reasons): ${reasonCsvPath}`);
  console.log('Engine result counts:', report.totals.engineResultCounts);
}

main().catch((error) => {
  console.error('Failed to analyze dry run logs:', error);
  process.exit(1);
});
