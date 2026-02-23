import { NextRequest, NextResponse } from 'next/server';
import { getOandaClient } from '@/lib/oanda';
import { auth } from '@/lib/auth';

export async function POST(request: NextRequest) {
    try {
        const session = await auth();
        if (!session?.user?.id) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const { orderId } = await request.json();
        if (!orderId) {
            return NextResponse.json({ error: 'orderId is required' }, { status: 400 });
        }

        const { client, accountId } = await getOandaClient(session.user.id);
        const response = await client.put(`/v3/accounts/${accountId}/orders/${orderId}/cancel`, {});

        return NextResponse.json({ success: true, result: response.data });
    } catch (error: any) {
        console.error('Oanda Cancel Order Route Error:', error?.response?.data || error?.message || error);
        if (error?.message?.includes('Missing')) {
            return NextResponse.json({ error: 'Missing API Keys' }, { status: 403 });
        }
        return NextResponse.json(
            { error: 'Failed to cancel order', details: error?.response?.data || error?.message },
            { status: error?.response?.status || 500 }
        );
    }
}
