import { StrategyRegistry } from './StrategyRegistry';
import { h1TrendM15PullbackStrategy } from './h1TrendM15Pullback';
import { breakoutTemplateStrategy } from './breakoutTemplate';
import { flatRangeFadeStrategy } from './flatRangeFade';

let registrySingleton: StrategyRegistry | null = null;

export function getStrategyRegistry(): StrategyRegistry {
  if (registrySingleton) return registrySingleton;

  const registry = new StrategyRegistry();
  registry.register(h1TrendM15PullbackStrategy);
  registry.register(breakoutTemplateStrategy);
  registry.register(flatRangeFadeStrategy);

  registrySingleton = registry;
  return registry;
}
