export const MODEL_CONFIG = {
  analysisModel: process.env.TRADING_ANALYSIS_MODEL || 'gpt-5',
  codingModel: 'gpt-5.3-codex',
} as const;

export const ENGINE_CONFIG = {
  pair: 'EUR_USD',
  m15Count: 100,
  h1Count: 100,
  fixedUnits: 1000,
  riskPerTradeUsd: 6,
  targetProfitUsd: 2.5,
  minRiskReward: 1.5,
  maxSpreadToSlRatio: 0.2,
} as const;
