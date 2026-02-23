import type { StrategyPlugin } from './Strategy';

export const breakoutTemplateStrategy: StrategyPlugin = {
  id: 'breakout_v1',
  name: 'Breakout Template v1',
  version: '0.1.0',
  requiredTimeframes: ['H1', 'M15'],
  parametersSchema: {
    type: 'object',
    properties: {
      note: { type: 'string', description: 'Template placeholder parameter', default: 'replace with real breakout logic' },
    },
  },
  evaluate: () => ({
    decision: 'NO_TRADE',
    entryType: 'MARKET',
    entryPrice: null,
    stopLoss: null,
    takeProfit: null,
    rationale: 'Template strategy breakout_v1 is not implemented yet.',
    tags: ['TEMPLATE', 'NO_TRADE'],
  }),
};
