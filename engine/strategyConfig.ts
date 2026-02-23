import path from 'path';
import { promises as fs } from 'fs';

export type StrategyProfile = 'strict' | 'soft';

const CONFIG_PATH = path.join(process.cwd(), 'config', 'strategy.json');

export interface StrategyRuntimeConfig {
  activeStrategyId: string;
  params: Record<string, unknown>;
  activeProfile: StrategyProfile;
  profiles: Record<StrategyProfile, Record<string, unknown>>;
}

const DEFAULT_CONFIG: StrategyRuntimeConfig = {
  activeStrategyId: 'h1_trend_m15_pullback',
  activeProfile: 'strict',
  profiles: {
    strict: {
      rrTarget: 1.6,
      pullbackAtrRatio: 0.3,
      zoneAtrTolerance: 0.35,
      slAtrBuffer: 0.1,
      minSlAtr: 0.2,
      rangeWindowBars: 24,
      breakoutBufferPips: 1.2,
      minTouchesPerSide: 2,
      touchTolerancePips: 1.5,
      minRangeAtrMultiplier: 0.8,
      maxRangeAtrMultiplier: 2.6,
      minImpulseBodyAtr: 0.35,
      requireH1TrendFilter: true,
      entryMode: 'retest',
      retestTolerancePips: 2,
      stopMode: 'opposite_boundary',
      slBufferPips: 2,
      enableFalseBreakoutScenario: true,
      allowFalseBreakoutReversalTrade: false,
    },
    soft: {
      rrTarget: 1.45,
      pullbackAtrRatio: 0.22,
      zoneAtrTolerance: 0.45,
      slAtrBuffer: 0.1,
      minSlAtr: 0.2,
      rangeWindowBars: 24,
      breakoutBufferPips: 1,
      minTouchesPerSide: 2,
      touchTolerancePips: 2,
      minRangeAtrMultiplier: 0.75,
      maxRangeAtrMultiplier: 2.8,
      minImpulseBodyAtr: 0.3,
      requireH1TrendFilter: true,
      entryMode: 'retest',
      retestTolerancePips: 2.5,
      stopMode: 'opposite_boundary',
      slBufferPips: 2,
      enableFalseBreakoutScenario: true,
      allowFalseBreakoutReversalTrade: false,
    },
  },
  params: {
    rrTarget: 1.6,
    pullbackAtrRatio: 0.3,
    zoneAtrTolerance: 0.35,
    slAtrBuffer: 0.1,
    minSlAtr: 0.2,
    rangeWindowBars: 24,
    breakoutBufferPips: 1.2,
    minTouchesPerSide: 2,
    touchTolerancePips: 1.5,
    minRangeAtrMultiplier: 0.8,
    maxRangeAtrMultiplier: 2.6,
    minImpulseBodyAtr: 0.35,
    requireH1TrendFilter: true,
    entryMode: 'retest',
    retestTolerancePips: 2,
    stopMode: 'opposite_boundary',
    slBufferPips: 2,
    enableFalseBreakoutScenario: true,
    allowFalseBreakoutReversalTrade: false,
  },
};

export async function loadStrategyConfig(): Promise<StrategyRuntimeConfig> {
  try {
    const raw = await fs.readFile(CONFIG_PATH, 'utf-8');
    const parsed = JSON.parse(raw);
    const activeStrategyId = String(parsed?.activeStrategyId || DEFAULT_CONFIG.activeStrategyId);
    const parsedProfiles = parsed?.profiles && typeof parsed.profiles === 'object' ? parsed.profiles : {};
    const strictParams = parsedProfiles?.strict && typeof parsedProfiles.strict === 'object'
      ? parsedProfiles.strict
      : DEFAULT_CONFIG.profiles.strict;
    const softParams = parsedProfiles?.soft && typeof parsedProfiles.soft === 'object'
      ? parsedProfiles.soft
      : DEFAULT_CONFIG.profiles.soft;
    const profiles = {
      strict: strictParams,
      soft: softParams,
    };

    const activeProfile: StrategyProfile = parsed?.activeProfile === 'soft' ? 'soft' : 'strict';

    const legacyParams = parsed?.params && typeof parsed.params === 'object' ? parsed.params : null;
    const params = legacyParams || profiles[activeProfile] || DEFAULT_CONFIG.params;

    return {
      activeStrategyId,
      params,
      activeProfile,
      profiles,
    };
  } catch {
    return DEFAULT_CONFIG;
  }
}

export async function setActiveStrategyProfile(profile: StrategyProfile): Promise<StrategyRuntimeConfig> {
  const current = await loadStrategyConfig();
  const updated: StrategyRuntimeConfig = {
    ...current,
    activeProfile: profile,
    params: current.profiles[profile],
  };

  const fileContent = {
    activeStrategyId: updated.activeStrategyId,
    activeProfile: updated.activeProfile,
    profiles: updated.profiles,
  };

  await fs.writeFile(CONFIG_PATH, `${JSON.stringify(fileContent, null, 2)}\n`, 'utf-8');

  return updated;
}

export async function setActiveStrategyId(strategyId: string): Promise<StrategyRuntimeConfig> {
  const current = await loadStrategyConfig();
  const normalized = String(strategyId || '').trim();

  if (!normalized) {
    throw new Error('Invalid strategyId');
  }

  const updated: StrategyRuntimeConfig = {
    ...current,
    activeStrategyId: normalized,
    params: current.profiles[current.activeProfile],
  };

  const fileContent = {
    activeStrategyId: updated.activeStrategyId,
    activeProfile: updated.activeProfile,
    profiles: updated.profiles,
  };

  await fs.writeFile(CONFIG_PATH, `${JSON.stringify(fileContent, null, 2)}\n`, 'utf-8');

  return updated;
}
