import { NextRequest, NextResponse } from 'next/server';
import { getOandaClient } from '@/lib/oanda';
import { auth } from '@/lib/auth';

export async function GET(request: NextRequest) {
    try {
        const session = await auth();
        if (!session?.user?.id) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const searchParams = request.nextUrl.searchParams;
        const instruments = searchParams.get('instruments') || 'EUR_USD';

        const { client, accountId } = await getOandaClient(session.user.id);

        const response = await client.get(`/v3/accounts/${accountId}/pricing`, {
            params: { instruments },
        });
        return NextResponse.json(response.data);
    } catch (error: any) {
        console.error('Oanda Pricing Global Route Error:', error?.response?.data || error.message || error);
        if (error?.message?.includes('Missing')) {
            return NextResponse.json({ error: 'Missing API Keys' }, { status: 403 });
        }
        return NextResponse.json(
            { error: 'Global failed to fetch pricing data', details: error?.response?.data || error?.message || error?.toString() },
            { status: error?.response?.status || 500 }
        );
    }
}
