import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { loadUserTradingRuntimeConfig } from '../../../../../engine/userTradingConfig';
import { getStrategyRegistry } from '../../../../../strategies';

export async function GET() {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const config = await loadUserTradingRuntimeConfig(session.user.id);
    const registry = getStrategyRegistry();
    const strategies = registry.list().map((strategy) => ({
      id: strategy.id,
      name: strategy.name,
      version: strategy.version,
    }));

    return NextResponse.json({
      activeStrategyId: config.activeStrategyId,
      strategies,
    });
  } catch (error: any) {
    console.error('Trading strategy GET error:', error?.message || error);
    return NextResponse.json({ error: 'Failed to load strategies' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json().catch(() => ({}));
    const strategyId = String(body?.strategyId || '').trim();

    if (!strategyId) {
      return NextResponse.json({ error: 'Invalid strategyId' }, { status: 400 });
    }

    const registry = getStrategyRegistry();
    if (!registry.get(strategyId)) {
      return NextResponse.json({ error: 'Strategy not found' }, { status: 404 });
    }

    await prisma.userTradingConfig.upsert({
      where: { userId: session.user.id },
      create: {
        userId: session.user.id,
        activeStrategyId: strategyId,
      },
      update: {
        activeStrategyId: strategyId,
      },
    });

    return NextResponse.json({
      activeStrategyId: strategyId,
    });
  } catch (error: any) {
    console.error('Trading strategy POST error:', error?.message || error);
    return NextResponse.json({ error: 'Failed to update strategy' }, { status: 500 });
  }
}
