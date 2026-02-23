import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

/**
 * GET /api/signals
 * Returns all TradeSignal records for the authenticated user, newest first.
 */
export async function GET(request: NextRequest) {
    try {
        const session = await auth();
        if (!session?.user?.id) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const signalId = request.nextUrl.searchParams.get('id');
        if (signalId) {
            const signal = await prisma.tradeSignal.findFirst({
                where: { id: signalId, userId: session.user.id },
            });

            if (!signal) {
                return NextResponse.json({ error: 'Signal not found' }, { status: 404 });
            }

            return NextResponse.json({ signal });
        }

        const signals = await prisma.tradeSignal.findMany({
            where: { userId: session.user.id },
            orderBy: { createdAt: 'desc' },
        });

        return NextResponse.json({ signals });
    } catch (error: any) {
        console.error('Signals GET error:', error.message);
        return NextResponse.json({ error: 'Failed to fetch signals' }, { status: 500 });
    }
}

/**
 * POST /api/signals
 * Creates a new TradeSignal record for the authenticated user.
 * Body: { instrument, timeframe, action, entryPrice, stopLoss, takeProfit, rationale }
 */
export async function POST(request: NextRequest) {
    try {
        const session = await auth();
        if (!session?.user?.id) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const body = await request.json();
        const { instrument, timeframe, action, entryPrice, stopLoss, takeProfit, rationale } = body;

        if (!instrument || !action || !rationale) {
            return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
        }

        const signal = await prisma.tradeSignal.create({
            data: {
                userId: session.user.id,
                instrument,
                timeframe: timeframe || 'M15',
                action,
                entryPrice: entryPrice ? parseFloat(entryPrice) : null,
                stopLoss: stopLoss ? parseFloat(stopLoss) : null,
                takeProfit: takeProfit ? parseFloat(takeProfit) : null,
                rationale,
                status: 'open',
            },
        });

        return NextResponse.json({ signal }, { status: 201 });
    } catch (error: any) {
        console.error('Signals POST error:', error.message);
        return NextResponse.json({ error: 'Failed to create signal' }, { status: 500 });
    }
}

/**
 * PATCH /api/signals
 * Updates the status of a TradeSignal by ID.
 * Body: { id, status }
 */
export async function PATCH(request: NextRequest) {
    try {
        const session = await auth();
        if (!session?.user?.id) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const { id, status } = await request.json();

        const signal = await prisma.tradeSignal.updateMany({
            where: { id, userId: session.user.id },
            data: { status },
        });

        return NextResponse.json({ updated: signal.count });
    } catch (error: any) {
        console.error('Signals PATCH error:', error.message);
        return NextResponse.json({ error: 'Failed to update signal' }, { status: 500 });
    }
}
