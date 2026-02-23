import { prisma } from '@/lib/prisma';
import { ENGINE_CONFIG } from '../config/models';
import { loadStrategyConfig } from './strategyConfig';
import { loadTradingConfig } from './tradingConfig';

export interface EngineConfigOverrides {
  fixedUnits: number;
  riskPerTradeUsd: number;
  minRiskReward: number;
  maxSpreadToSlRatio: number;
}

export interface UserTradingRuntimeConfig {
  activeStrategyId: string;
  activeProfile: 'strict' | 'soft';
  strategyProfiles: Record<'strict' | 'soft', Record<string, unknown>>;

  watchlist: string[];
  maxConcurrentTrades: number;
  scoring: {
    rrWeight: number;
    trendClarityWeight: number;
    spreadWeight: number;
    distanceFromSRWeight: number;
  };

  engine: EngineConfigOverrides;
}

function safeJson<T>(raw: string | null | undefined, fallback: T): T {
  if (!raw) return fallback;
  try {
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

export async function loadUserTradingRuntimeConfig(userId: string): Promise<UserTradingRuntimeConfig> {
  const [fileStrategy, fileTrading, row] = await Promise.all([
    loadStrategyConfig(),
    loadTradingConfig(),
    prisma.userTradingConfig.findUnique({ where: { userId } }),
  ]);

  const activeStrategyId = row?.activeStrategyId || fileStrategy.activeStrategyId;
  const activeProfile = (row?.activeProfile === 'soft' ? 'soft' : 'strict') as 'strict' | 'soft';

  const strategyProfiles = safeJson<Record<'strict' | 'soft', Record<string, unknown>>>(
    row?.profilesJson,
    fileStrategy.profiles as any,
  );

  const watchlist = safeJson<string[]>(row?.watchlistJson, fileTrading.watchlist)
    .map((p) => String(p || '').toUpperCase())
    .filter((p) => p.includes('_'));

  const scoring = safeJson(fileTrading.scoring ? JSON.stringify(fileTrading.scoring) : '', fileTrading.scoring);
  const scoringOverride = safeJson<Record<string, number>>(row?.scoringJson, {});

  const mergedScoring = {
    rrWeight: Number(scoringOverride.rrWeight ?? scoring.rrWeight),
    trendClarityWeight: Number(scoringOverride.trendClarityWeight ?? scoring.trendClarityWeight),
    spreadWeight: Number(scoringOverride.spreadWeight ?? scoring.spreadWeight),
    distanceFromSRWeight: Number(scoringOverride.distanceFromSRWeight ?? scoring.distanceFromSRWeight),
  };

  const engine = {
    fixedUnits: Number(row?.fixedUnits ?? ENGINE_CONFIG.fixedUnits),
    riskPerTradeUsd: Number(row?.riskPerTradeUsd ?? ENGINE_CONFIG.riskPerTradeUsd),
    minRiskReward: Number(row?.minRiskReward ?? ENGINE_CONFIG.minRiskReward),
    maxSpreadToSlRatio: Number(row?.maxSpreadToSlRatio ?? ENGINE_CONFIG.maxSpreadToSlRatio),
  };

  return {
    activeStrategyId,
    activeProfile,
    strategyProfiles,
    watchlist: watchlist.length ? watchlist : fileTrading.watchlist,
    maxConcurrentTrades: Number(row?.maxConcurrentTrades ?? fileTrading.maxConcurrentTrades),
    scoring: mergedScoring,
    engine,
  };
}
