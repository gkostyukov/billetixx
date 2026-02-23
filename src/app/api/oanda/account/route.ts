import { NextRequest, NextResponse } from 'next/server';
import { getOandaClient } from '@/lib/oanda';
import { auth } from '@/lib/auth';

/**
 * GET /api/oanda/account
 *
 * Returns the OANDA account summary for the authenticated user:
 * balance, NAV, unrealized P&L, margin used/available, open trade count.
 */
export async function GET(request: NextRequest) {
    try {
        const session = await auth();
        if (!session?.user?.id) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const { client, accountId } = await getOandaClient(session.user.id);

        const response = await client.get(`/v3/accounts/${accountId}/summary`);
        return NextResponse.json(response.data);
    } catch (error: any) {
        console.error('Oanda Account Route Error:', error?.response?.data || error.message);
        if (error?.message?.includes('Missing')) {
            return NextResponse.json({ error: 'Missing API Keys' }, { status: 403 });
        }
        return NextResponse.json(
            { error: 'Failed to fetch account data', details: error?.response?.data || error?.message },
            { status: error?.response?.status || 500 }
        );
    }
}
