import type { MarketContext, Timeframe, TradeIntent } from '../services/types';

export interface StrategyParameterSchema {
  type: 'object';
  properties: Record<string, { type: string; description?: string; default?: unknown }>;
  required?: string[];
}

export interface StrategyPlugin {
  id: string;
  name: string;
  version: string;
  requiredTimeframes: Timeframe[];
  parametersSchema: StrategyParameterSchema;
  evaluate: (marketContext: MarketContext, params: Record<string, unknown>) => TradeIntent;
}
