import path from 'path';
import { promises as fs } from 'fs';

export interface TradingRuntimeConfig {
  watchlist: string[];
  maxConcurrentTrades: number;
  scoring: {
    rrWeight: number;
    trendClarityWeight: number;
    spreadWeight: number;
    distanceFromSRWeight: number;
  };
}

const DEFAULT_TRADING_CONFIG: TradingRuntimeConfig = {
  watchlist: ['EUR_USD', 'USD_JPY', 'GBP_USD', 'AUD_USD', 'USD_CHF', 'USD_CAD'],
  maxConcurrentTrades: 1,
  scoring: {
    rrWeight: 0.4,
    trendClarityWeight: 0.3,
    spreadWeight: 0.2,
    distanceFromSRWeight: 0.1,
  },
};

function toPositiveNumber(value: unknown, fallback: number): number {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

export async function loadTradingConfig(): Promise<TradingRuntimeConfig> {
  const filePath = path.join(process.cwd(), 'config', 'trading.json');

  try {
    const raw = await fs.readFile(filePath, 'utf-8');
    const parsed = JSON.parse(raw);

    const watchlist = Array.isArray(parsed?.watchlist)
      ? parsed.watchlist
        .map((pair: unknown) => String(pair || '').toUpperCase())
        .filter((pair: string) => pair.includes('_'))
      : DEFAULT_TRADING_CONFIG.watchlist;

    const maxConcurrentTrades = toPositiveNumber(
      parsed?.maxConcurrentTrades,
      DEFAULT_TRADING_CONFIG.maxConcurrentTrades,
    );

    const scoring = {
      rrWeight: Number(parsed?.scoring?.rrWeight ?? DEFAULT_TRADING_CONFIG.scoring.rrWeight),
      trendClarityWeight: Number(
        parsed?.scoring?.trendClarityWeight ?? DEFAULT_TRADING_CONFIG.scoring.trendClarityWeight,
      ),
      spreadWeight: Number(parsed?.scoring?.spreadWeight ?? DEFAULT_TRADING_CONFIG.scoring.spreadWeight),
      distanceFromSRWeight: Number(
        parsed?.scoring?.distanceFromSRWeight ?? DEFAULT_TRADING_CONFIG.scoring.distanceFromSRWeight,
      ),
    };

    return {
      watchlist: watchlist.length ? watchlist : DEFAULT_TRADING_CONFIG.watchlist,
      maxConcurrentTrades,
      scoring,
    };
  } catch {
    return DEFAULT_TRADING_CONFIG;
  }
}