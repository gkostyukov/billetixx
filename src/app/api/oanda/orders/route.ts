import { NextRequest, NextResponse } from 'next/server';
import { getOandaClient } from '@/lib/oanda';
import { auth } from '@/lib/auth';

/**
 * GET /api/oanda/orders
 *
 * Returns open trades (positions) for the authenticated user's OANDA account.
 * Each trade entry includes: instrument, direction, units, open price,
 * current price, unrealized P&L.
 */
export async function GET(request: NextRequest) {
    try {
        const session = await auth();
        if (!session?.user?.id) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const { client, accountId } = await getOandaClient(session.user.id);

        // Fetch open trades (filled, not closed)
        const response = await client.get(`/v3/accounts/${accountId}/openTrades`);
        return NextResponse.json(response.data);
    } catch (error: any) {
        console.error('Oanda Orders Route Error:', error?.response?.data || error.message);
        if (error?.message?.includes('Missing')) {
            return NextResponse.json({ error: 'Missing API Keys' }, { status: 403 });
        }
        return NextResponse.json(
            { error: 'Failed to fetch orders', details: error?.response?.data || error?.message },
            { status: error?.response?.status || 500 }
        );
    }
}
