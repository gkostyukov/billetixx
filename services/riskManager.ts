import { ENGINE_CONFIG } from '../config/models';
import type { MarketContext, RiskCheckResult, TradeIntent } from './types';

interface RiskCheckOptions {
  maxConcurrentTrades?: number;
}

function pipSize(pair: string): number {
  return pair.includes('JPY') ? 0.01 : 0.0001;
}

function estimatePipValueUsd(pair: string, units: number, currentPrice: number): number {
  const pip = pipSize(pair);

  if (pair.endsWith('_USD')) {
    return units * pip;
  }

  if (pair.startsWith('USD_') && currentPrice > 0) {
    return (units * pip) / currentPrice;
  }

  return units * pip;
}

function getDirection(units: string): 'BUY' | 'SELL' | 'FLAT' {
  const parsed = Number(units || 0);
  if (parsed > 0) return 'BUY';
  if (parsed < 0) return 'SELL';
  return 'FLAT';
}

function parsePair(pair: string): { base: string; quote: string } {
  const [base, quote] = String(pair || '').split('_');
  return {
    base: base || '',
    quote: quote || '',
  };
}

function usdDeltaFromExposure(pair: string, units: number): number {
  const { base, quote } = parsePair(pair);
  if (!base || !quote || units === 0) return 0;

  const direction = units > 0 ? 1 : -1;
  let usdDelta = 0;

  if (base === 'USD') usdDelta += 1 * direction;
  if (quote === 'USD') usdDelta -= 1 * direction;

  return usdDelta;
}

function getExistingUsdExposureScore(marketContext: MarketContext): number {
  return marketContext.account.openTrades.reduce((acc, trade) => {
    const units = Number(trade.currentUnits || 0);
    return acc + usdDeltaFromExposure(trade.instrument, units);
  }, 0);
}

function getCandidateUsdExposure(pair: string, decision: TradeIntent['decision']): number {
  if (decision === 'NO_TRADE') return 0;
  const units = decision === 'BUY' ? ENGINE_CONFIG.fixedUnits : -ENGINE_CONFIG.fixedUnits;
  return usdDeltaFromExposure(pair, units);
}

export function runRiskChecks(
  marketContext: MarketContext,
  intent: TradeIntent,
  options?: RiskCheckOptions,
): RiskCheckResult {
  const reasons: string[] = [];
  const maxConcurrentTrades = Number(options?.maxConcurrentTrades || 1);

  const entryPrice = Number(intent.entryPrice || 0);
  const stopLoss = Number(intent.stopLoss || 0);
  const takeProfit = Number(intent.takeProfit || 0);

  let slPips = 0;
  let rr = 0;
  let riskUsd = 0;

  const effectiveUnits = Number(intent.units && intent.units > 0 ? intent.units : ENGINE_CONFIG.fixedUnits);

  if (intent.decision === 'NO_TRADE') {
    reasons.push('Intent decision is NO_TRADE.');
    return { passed: false, reasons, slPips, rr, riskUsd };
  }

  if (!Number.isFinite(entryPrice) || !Number.isFinite(stopLoss) || !Number.isFinite(takeProfit) || entryPrice <= 0 || stopLoss <= 0 || takeProfit <= 0) {
    reasons.push('Malformed intent price fields.');
    return { passed: false, reasons, slPips, rr, riskUsd };
  }

  const slDistance = Math.abs(entryPrice - stopLoss);
  const tpDistance = Math.abs(takeProfit - entryPrice);
  const pip = pipSize(marketContext.pair);
  slPips = slDistance / pip;
  rr = slDistance > 0 ? tpDistance / slDistance : 0;

  if (slDistance <= 0 || slPips <= 0) {
    reasons.push('Invalid stop loss distance.');
  }

  const pipValueUsd = estimatePipValueUsd(marketContext.pair, effectiveUnits, marketContext.price.mid);
  riskUsd = slPips * pipValueUsd;

  if (riskUsd > ENGINE_CONFIG.riskPerTradeUsd) {
    reasons.push(`Risk ${riskUsd.toFixed(2)} USD exceeds limit ${ENGINE_CONFIG.riskPerTradeUsd} USD.`);
  }

  if (marketContext.account.openTrades.length >= maxConcurrentTrades) {
    reasons.push(`Max concurrent trades reached (${maxConcurrentTrades}).`);
  }

  if (marketContext.spread_pips > slPips * ENGINE_CONFIG.maxSpreadToSlRatio) {
    reasons.push('Spread exceeds 20% of stop-loss distance.');
  }

  if (rr < ENGINE_CONFIG.minRiskReward) {
    reasons.push(`Risk:Reward ${rr.toFixed(2)} below minimum ${ENGINE_CONFIG.minRiskReward}.`);
  }

  const sameInstrumentTrades = marketContext.account.openTrades.filter((trade) => trade.instrument === marketContext.pair);
  const hasOppositeTrade = sameInstrumentTrades.some((trade) => {
    const direction = getDirection(trade.currentUnits);
    return (intent.decision === 'BUY' && direction === 'SELL') || (intent.decision === 'SELL' && direction === 'BUY');
  });

  if (marketContext.account.fifoConstraints && hasOppositeTrade) {
    reasons.push('FIFO conflict risk: opposite trade already open on same pair.');
  }

  if (marketContext.account.fifoConstraints) {
    const requestedAbsUnits = Math.abs(Number(intent.units ?? ENGINE_CONFIG.fixedUnits));
    const conflictingSameSize = sameInstrumentTrades.find((trade) => {
      const existingAbsUnits = Math.abs(Number(trade.currentUnits || 0));
      return existingAbsUnits === requestedAbsUnits && Boolean(trade.hasRiskOrders);
    });

    if (conflictingSameSize) {
      const suggestionDown = Math.max(1, requestedAbsUnits - 1);
      const suggestionUp = requestedAbsUnits + 1;
      reasons.push(
        `FIFO constraint: existing trade ${conflictingSameSize.id} already uses ${requestedAbsUnits} units on ${marketContext.pair} with TP/SL/TS. Use a unique unit size (e.g., ${suggestionDown} or ${suggestionUp}).`,
      );
    }
  }

  const hasPositionOnPair = marketContext.account.openPositions.some((position) => {
    if (position.instrument !== marketContext.pair) return false;
    const longUnits = Number(position.long?.units || 0);
    const shortUnits = Number(position.short?.units || 0);
    return longUnits > 0 || shortUnits > 0;
  });

  if (hasPositionOnPair) {
    reasons.push('Open position already exists for this pair (simple mode).');
  }

  const existingUsdExposure = getExistingUsdExposureScore(marketContext);
  const candidateUsdExposure = getCandidateUsdExposure(marketContext.pair, intent.decision);
  if (existingUsdExposure > 0 && candidateUsdExposure > 0) {
    reasons.push('Correlated exposure blocked: USD-long exposure already exists.');
  }

  return {
    passed: reasons.length === 0,
    reasons,
    slPips: Number(slPips.toFixed(2)),
    rr: Number(rr.toFixed(2)),
    riskUsd: Number(riskUsd.toFixed(2)),
  };
}
