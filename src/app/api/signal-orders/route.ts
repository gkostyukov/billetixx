import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

// GET /api/signal-orders?signalId=<id>
export async function GET(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const signalId = request.nextUrl.searchParams.get('signalId');

    const links = await prisma.signalOrderLink.findMany({
      where: {
        userId: session.user.id,
        ...(signalId ? { signalId } : {}),
      },
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        signalId: true,
        instrument: true,
        side: true,
        orderType: true,
        oandaOrderId: true,
        oandaTradeId: true,
        status: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    return NextResponse.json({ links });
  } catch (error: any) {
    console.error('signal-orders GET error:', error?.message || error);
    return NextResponse.json({ error: 'Failed to fetch signal order links' }, { status: 500 });
  }
}
