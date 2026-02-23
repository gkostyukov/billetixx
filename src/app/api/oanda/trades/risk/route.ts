import { NextRequest, NextResponse } from 'next/server';
import { getOandaClient } from '@/lib/oanda';
import { auth } from '@/lib/auth';

export async function POST(request: NextRequest) {
    try {
        const session = await auth();
        if (!session?.user?.id) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const body = await request.json();
        const tradeId = String(body.tradeId || '').trim();

        // These can be number | null
        const stopLoss = body.stopLoss === null || body.stopLoss === undefined ? null : Number(body.stopLoss);
        const takeProfit = body.takeProfit === null || body.takeProfit === undefined ? null : Number(body.takeProfit);
        const trailingStopDistance = body.trailingStopDistance === null || body.trailingStopDistance === undefined
            ? null
            : Number(body.trailingStopDistance);

        if (!tradeId) {
            return NextResponse.json({ error: 'tradeId is required' }, { status: 400 });
        }

        const invalidNumber = (value: number | null) => value != null && (!Number.isFinite(value) || value <= 0);
        if (invalidNumber(stopLoss) || invalidNumber(takeProfit) || invalidNumber(trailingStopDistance)) {
            return NextResponse.json({ error: 'stopLoss/takeProfit/trailingStopDistance must be positive numbers or null' }, { status: 400 });
        }

        const payload: any = {};

        // OANDA: pass object to set/update, pass null to cancel.
        payload.stopLoss = stopLoss == null ? null : { price: String(stopLoss) };
        payload.takeProfit = takeProfit == null ? null : { price: String(takeProfit) };
        payload.trailingStopLoss = trailingStopDistance == null ? null : { distance: String(trailingStopDistance) };

        const { client, accountId } = await getOandaClient(session.user.id);
        const response = await client.put(`/v3/accounts/${accountId}/trades/${tradeId}/orders`, payload);

        return NextResponse.json({ success: true, result: response.data });
    } catch (error: any) {
        console.error('Oanda Trade Risk Route Error:', error?.response?.data || error?.message || error);
        if (error?.message?.includes('Missing')) {
            return NextResponse.json({ error: 'Missing API Keys' }, { status: 403 });
        }
        return NextResponse.json(
            { error: 'Failed to update trade risk orders', details: error?.response?.data || error?.message },
            { status: error?.response?.status || 500 }
        );
    }
}
