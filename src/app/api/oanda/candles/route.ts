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
        const instrument = searchParams.get('instrument') || 'EUR_USD';
        const granularity = searchParams.get('granularity') || 'M15';
        const count = searchParams.get('count') || '200';

        const { client } = await getOandaClient(session.user.id);

        const response = await client.get(`/v3/instruments/${instrument}/candles`, {
            params: {
                granularity,
                count,
                price: 'MBA',
            },
        });
        return NextResponse.json(response.data);
    } catch (error: any) {
        console.error(`Oanda Candles Error Global:`, error?.response?.data || error.message || error);
        if (error?.message?.includes('Missing')) {
            return NextResponse.json({ error: 'Missing API Keys' }, { status: 403 });
        }
        return NextResponse.json(
            { error: 'Global failed to fetch candle data', details: error?.response?.data || error?.message || error?.toString() },
            { status: error?.response?.status || 500 }
        );
    }
}
