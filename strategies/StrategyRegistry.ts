import type { StrategyPlugin } from './Strategy';

export class StrategyRegistry {
  private readonly strategies = new Map<string, StrategyPlugin>();

  register(strategy: StrategyPlugin) {
    this.strategies.set(strategy.id, strategy);
  }

  get(strategyId: string): StrategyPlugin | null {
    return this.strategies.get(strategyId) || null;
  }

  list(): StrategyPlugin[] {
    return Array.from(this.strategies.values());
  }
}
