export type TradeDecision = 'BUY' | 'SELL' | 'NO_TRADE';
export type EntryType = 'MARKET' | 'LIMIT';
export type Timeframe = 'H1' | 'M15';
export type Trend = 'BULL' | 'BEAR' | 'RANGE';
export type Momentum = 'STRONG_UP' | 'STRONG_DOWN' | 'NEUTRAL';

export interface Candle {
  time: string;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
  complete: boolean;
}

export interface PriceSnapshot {
  bid: number;
  ask: number;
  mid: number;
}

export interface AccountSnapshot {
  balance: number;
  openPositions: Array<{ instrument: string; long?: { units: string }; short?: { units: string } }>;
  openTrades: Array<{ id: string; instrument: string; currentUnits: string }>;
  fifoConstraints: boolean;
}

export interface RawMarketData {
  pair: string;
  now: string;
  price: PriceSnapshot;
  spread_pips: number;
  candles: Record<Timeframe, Candle[]>;
  account: AccountSnapshot;
}

export interface IndicatorBundle {
  atr_m15: number;
  atr_h1: number;
  swings_m15: { highs: number[]; lows: number[] };
  trend_h1: Trend;
  momentum_m15: Momentum;
}

export interface MarketContext {
  pair: string;
  now: string;
  price: PriceSnapshot;
  spread_pips: number;
  candles: Record<Timeframe, Candle[]>;
  indicators: IndicatorBundle;
  account: AccountSnapshot;
}

export interface TradeIntent {
  decision: TradeDecision;
  entryType: EntryType;
  entryPrice: number | null;
  stopLoss: number | null;
  takeProfit: number | null;
  units?: number;
  reasonCode?: string;
  metrics?: Record<string, number | string | boolean | null>;
  rationale: string;
  tags: string[];
}

export interface RiskCheckResult {
  passed: boolean;
  reasons: string[];
  slPips: number;
  rr: number;
  riskUsd: number;
}

export interface ScannerPairStatus {
  pair: string;
  recommendedStrategyId?: string;
  appliedStrategyId?: string;
  recommendationConfidence?: number;
  recommendationReason?: string;
  decision: TradeDecision;
  score: number | null;
  rr: number;
  spread: number;
  rejected: boolean;
  rejectionReasonCode?: string;
  metrics?: Record<string, number | string | boolean | null>;
  rejectionReasons: string[];
}

export interface ScoredTradeCandidate {
  pair: string;
  strategyId: string;
  intent: TradeIntent;
  score: number;
  rejectionReasons: string[];
  rr: number;
  spread: number;
  marketContext: MarketContext;
  riskCheck: RiskCheckResult;
}

export interface EngineCycleStatus {
  activeStrategyId: string;
  lastIntent: TradeIntent | null;
  lastRejectionReasons: string[];
  lastRationale: string;
  scannedPairs: ScannerPairStatus[];
  selectedTrade: string | null;
  lastUpdatedAt: string | null;
}

export interface StructuredMarketData {
  pair: string;
  current_price: number;
  h1_trend: 'bullish' | 'bearish' | 'ranging';
  m15_structure: 'bullish' | 'bearish' | 'ranging';
  last_impulse_pips: number;
  atr_m15: number;
  support_levels: number[];
  resistance_levels: number[];
  spread: number;
  account_balance: number;
  risk_per_trade_usd: number;
  target_profit_usd: number;
}

export interface AiTradeDecision {
  decision: TradeDecision;
  entry: number;
  stop_loss: number;
  take_profit: number;
  reasoning: string;
}
