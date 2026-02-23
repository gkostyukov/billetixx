import { NextRequest, NextResponse } from 'next/server';
import { getOandaClient } from '@/lib/oanda';
import { auth } from '@/lib/auth';

export async function POST(request: NextRequest) {
    try {
        const session = await auth();
        if (!session?.user?.id) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const { instrument } = await request.json();
        if (!instrument) {
            return NextResponse.json({ error: 'instrument is required' }, { status: 400 });
        }

        const { client, accountId } = await getOandaClient(session.user.id);

        // Close both sides if present. OANDA treats missing side as no-op.
        const response = await client.put(`/v3/accounts/${accountId}/positions/${instrument}/close`, {
            longUnits: 'ALL',
            shortUnits: 'ALL',
        });

        return NextResponse.json({ success: true, result: response.data });
    } catch (error: any) {
        console.error('Oanda Close Position Route Error:', error?.response?.data || error?.message || error);
        if (error?.message?.includes('Missing')) {
            return NextResponse.json({ error: 'Missing API Keys' }, { status: 403 });
        }
        return NextResponse.json(
            { error: 'Failed to close position', details: error?.response?.data || error?.message },
            { status: error?.response?.status || 500 }
        );
    }
}
