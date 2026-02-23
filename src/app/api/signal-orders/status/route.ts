import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { getOandaClient } from '@/lib/oanda';

// POST /api/signal-orders/status
// Body: { linkId: string, status: string, oandaOrderId?: string, oandaTradeId?: string }
export async function POST(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const linkId = String(body.linkId || '').trim();
    const status = String(body.status || '').trim();

    if (!linkId || !status) {
      return NextResponse.json({ error: 'linkId and status are required' }, { status: 400 });
    }

    const updated = await prisma.signalOrderLink.updateMany({
      where: { id: linkId, userId: session.user.id },
      data: {
        status,
        oandaOrderId: body.oandaOrderId ? String(body.oandaOrderId) : undefined,
        oandaTradeId: body.oandaTradeId ? String(body.oandaTradeId) : undefined,
      },
    });

    return NextResponse.json({ updated: updated.count });
  } catch (error: any) {
    console.error('signal-orders/status POST error:', error?.message || error);
    return NextResponse.json({ error: 'Failed to update link status' }, { status: 500 });
  }
}
