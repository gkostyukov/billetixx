import type { MarketContext, TradeIntent } from '../services/types';

interface ScoringWeights {
  rrWeight: number;
  trendClarityWeight: number;
  spreadWeight: number;
  distanceFromSRWeight: number;
}

interface ScoreResult {
  passed: boolean;
  score: number;
  rr: number;
  rejectionReasons: string[];
}

function pipSize(pair: string): number {
  return pair.includes('JPY') ? 0.01 : 0.0001;
}

function computeRiskReward(entry: number, stopLoss: number, takeProfit: number): number {
  const risk = Math.abs(entry - stopLoss);
  const reward = Math.abs(takeProfit - entry);
  if (risk <= 0) return 0;
  return reward / risk;
}

function normalizeRiskReward(rr: number): number {
  if (rr >= 2.0) return 1.0;
  if (rr >= 1.5) return 0.8;
  if (rr >= 1.2) return 0.5;
  return -1;
}

function trendClarity(context: MarketContext): number {
  const trend = context.indicators.trend_h1;
  const momentum = context.indicators.momentum_m15;

  if (trend === 'RANGE') return 0;
  if ((trend === 'BULL' && momentum === 'STRONG_UP') || (trend === 'BEAR' && momentum === 'STRONG_DOWN')) {
    return 1.0;
  }

  if (momentum === 'NEUTRAL') return 0.5;
  return 0.5;
}

function spreadQuality(spreadPips: number, slPips: number): number {
  const ratio = slPips > 0 ? spreadPips / slPips : 1;
  if (ratio <= 0.1) return 1.0;
  if (ratio <= 0.2) return 0.7;
  return -1;
}

function srDistanceQuality(intent: TradeIntent, context: MarketContext, slPips: number): number {
  const entry = Number(intent.entryPrice || 0);
  if (entry <= 0 || slPips <= 0) return 0.2;

  const pip = pipSize(context.pair);
  const slDistance = slPips * pip;

  let nearestDistance = Number.POSITIVE_INFINITY;

  if (intent.decision === 'BUY') {
    for (const level of context.indicators.swings_m15.highs) {
      if (level > entry) {
        nearestDistance = Math.min(nearestDistance, level - entry);
      }
    }
  }

  if (intent.decision === 'SELL') {
    for (const level of context.indicators.swings_m15.lows) {
      if (level < entry) {
        nearestDistance = Math.min(nearestDistance, entry - level);
      }
    }
  }

  const distanceRatio = Number.isFinite(nearestDistance) ? nearestDistance / slDistance : 2;

  if (distanceRatio > 1.5) return 1.0;
  if (distanceRatio >= 1.0) return 0.6;
  return 0.2;
}

function metricScore(metrics: Record<string, number | string | boolean | null> | undefined, key: string): number | null {
  if (!metrics) return null;
  const value = metrics[key];
  if (typeof value !== 'number' || !Number.isFinite(value)) return null;
  return Math.max(0, Math.min(1, value));
}

function rangeFadeSignalQuality(intent: TradeIntent): number {
  if (!intent.tags.includes('RANGE_FADE')) return 0;

  const atrStability = metricScore(intent.metrics, 'atr_stability_score') ?? 0.5;
  const boundaryProximity = metricScore(intent.metrics, 'boundary_proximity_score') ?? 0.5;
  const rsiEdge = metricScore(intent.metrics, 'rsi_edge_score') ?? 0.5;
  const touchDensity = metricScore(intent.metrics, 'touch_density_score') ?? 0.5;

  return (atrStability * 0.3) + (boundaryProximity * 0.3) + (rsiEdge * 0.2) + (touchDensity * 0.2);
}

export function calculateScore(
  intent: TradeIntent,
  context: MarketContext,
  weights: ScoringWeights,
): ScoreResult {
  const rejectionReasons: string[] = [];

  const entry = Number(intent.entryPrice || 0);
  const stopLoss = Number(intent.stopLoss || 0);
  const takeProfit = Number(intent.takeProfit || 0);

  if (intent.decision === 'NO_TRADE') {
    rejectionReasons.push('Intent decision is NO_TRADE.');
    return { passed: false, score: 0, rr: 0, rejectionReasons };
  }

  if (entry <= 0 || stopLoss <= 0 || takeProfit <= 0) {
    rejectionReasons.push('Malformed intent prices for scoring.');
    return { passed: false, score: 0, rr: 0, rejectionReasons };
  }

  const pip = pipSize(context.pair);
  const slPips = Math.abs(entry - stopLoss) / pip;
  const rr = computeRiskReward(entry, stopLoss, takeProfit);
  const rrNormalized = normalizeRiskReward(rr);

  if (rrNormalized < 0) {
    rejectionReasons.push(`Risk:Reward ${rr.toFixed(2)} below scoring floor 1.2.`);
  }

  const spreadScore = spreadQuality(context.spread_pips, slPips);
  if (spreadScore < 0) {
    rejectionReasons.push('Spread exceeds 20% of stop-loss distance (scoring filter).');
  }

  if (rejectionReasons.length) {
    return {
      passed: false,
      score: 0,
      rr: Number(rr.toFixed(2)),
      rejectionReasons,
    };
  }

  const trendScore = trendClarity(context);
  const srScore = srDistanceQuality(intent, context, slPips);

  const weighted =
    rrNormalized * weights.rrWeight +
    trendScore * weights.trendClarityWeight +
    spreadScore * weights.spreadWeight +
    srScore * weights.distanceFromSRWeight;

  const rangeFadeBoost = rangeFadeSignalQuality(intent);
  const boostedWeighted = Math.min(1, weighted + rangeFadeBoost * 0.25);

  return {
    passed: true,
    score: Number((Math.max(0, Math.min(1, boostedWeighted)) * 100).toFixed(2)),
    rr: Number(rr.toFixed(2)),
    rejectionReasons: [],
  };
}