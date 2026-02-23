import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { runTradingEngine } from '../../../../../engine/tradingEngine';

export async function POST(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json().catch(() => ({}));
    const pair = body?.pair ? String(body.pair).toUpperCase() : undefined;
    const execute = Boolean(body?.execute);

    const result = await runTradingEngine({ userId: session.user.id, pair, execute });
    return NextResponse.json(result);
  } catch (error: any) {
    console.error('Trading engine route error:', error?.response?.data || error?.message || error);
    if (error?.message?.includes('Missing')) {
      return NextResponse.json({ error: 'Missing API keys' }, { status: 403 });
    }
    return NextResponse.json({ error: 'Failed to run trading engine' }, { status: 500 });
  }
}
