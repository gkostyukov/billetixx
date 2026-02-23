import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { loadUserTradingRuntimeConfig } from '../../../../../engine/userTradingConfig';

export async function GET() {
  try {
    const session = await auth();
    if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const config = await loadUserTradingRuntimeConfig(session.user.id);
    return NextResponse.json({ config });
  } catch (error: any) {
    console.error('trading/config GET error:', error?.message || error);
    return NextResponse.json({ error: 'Failed to load trading config' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const body = await request.json().catch(() => ({}));

    const payload = {
      activeStrategyId: String(body?.activeStrategyId || 'h1_trend_m15_pullback'),
      activeProfile: body?.activeProfile === 'soft' ? 'soft' : 'strict',
      profilesJson: JSON.stringify(body?.strategyProfiles || {}),
      watchlistJson: JSON.stringify(body?.watchlist || []),
      maxConcurrentTrades: Number(body?.maxConcurrentTrades || 1),
      scoringJson: JSON.stringify(body?.scoring || {}),
      fixedUnits: Number(body?.engine?.fixedUnits || 1000),
      riskPerTradeUsd: Number(body?.engine?.riskPerTradeUsd || 10),
      minRiskReward: Number(body?.engine?.minRiskReward || 1.2),
      maxSpreadToSlRatio: Number(body?.engine?.maxSpreadToSlRatio || 0.6),
    };

    await prisma.userTradingConfig.upsert({
      where: { userId: session.user.id },
      create: { userId: session.user.id, ...payload },
      update: payload,
    });

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error('trading/config POST error:', error?.message || error);
    return NextResponse.json({ error: 'Failed to save trading config' }, { status: 500 });
  }
}
