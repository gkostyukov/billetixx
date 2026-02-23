import { NextRequest, NextResponse } from 'next/server';
import { getOandaClient } from '@/lib/oanda';
import { auth } from '@/lib/auth';

export async function GET(request: NextRequest) {
    try {
        const session = await auth();
        if (!session?.user?.id) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const { client, accountId } = await getOandaClient(session.user.id);

        const accountResponse = await client.get(`/v3/accounts/${accountId}/summary`);
        const account = accountResponse.data?.account;
        const lastTransactionID = Number(account?.lastTransactionID || 1);
        const fromTransactionID = Math.max(1, lastTransactionID - 200);

        const [tradesResult, ordersResult, positionsResult, activityResult] = await Promise.allSettled([
            client.get(`/v3/accounts/${accountId}/openTrades`),
            client.get(`/v3/accounts/${accountId}/pendingOrders`),
            client.get(`/v3/accounts/${accountId}/openPositions`),
            client.get(`/v3/accounts/${accountId}/transactions/idrange`, {
                params: {
                    from: fromTransactionID,
                    to: lastTransactionID,
                },
            }),
        ]);

        const trades = tradesResult.status === 'fulfilled' ? tradesResult.value.data?.trades || [] : [];
        const rawOrders = ordersResult.status === 'fulfilled' ? ordersResult.value.data?.orders || [] : [];
        const positions = positionsResult.status === 'fulfilled' ? positionsResult.value.data?.positions || [] : [];
        const transactions = activityResult.status === 'fulfilled' ? activityResult.value.data?.transactions || [] : [];

        const tradeInstrumentById = new Map<string, string>();
        trades.forEach((trade: any) => {
            if (trade?.id && trade?.instrument) {
                tradeInstrumentById.set(String(trade.id), String(trade.instrument));
            }
        });

        const orders = rawOrders.map((order: any) => {
            const tradeId = String(order?.tradeID || order?.tradeId || order?.relatedTradeID || order?.relatedTradeId || '');
            const instrument = String(order?.instrument || tradeInstrumentById.get(tradeId) || '');
            const price = order?.price ?? order?.triggerPrice ?? order?.stopLossOrder?.price ?? order?.takeProfitOrder?.price;

            return {
                ...order,
                instrument,
                tradeId: tradeId || null,
                displayPrice: price != null ? String(price) : null,
            };
        });

        const activity = transactions.slice(-30).reverse().map((tx: any) => {
            const instrument = String(tx?.instrument || '');
            const parts: string[] = [];

            if (instrument) parts.push(instrument);
            if (tx?.units != null) parts.push(`units=${String(tx.units)}`);
            if (tx?.price != null) parts.push(`price=${String(tx.price)}`);
            if (tx?.pl != null) parts.push(`pl=${String(tx.pl)}`);
            if (tx?.reason) parts.push(String(tx.reason));
            if (tx?.orderID) parts.push(`order#${String(tx.orderID)}`);
            if (tx?.tradeID) parts.push(`trade#${String(tx.tradeID)}`);

            return {
                id: String(tx?.id || ''),
                type: String(tx?.type || ''),
                instrument: instrument || null,
                time: tx?.time ? String(tx.time) : null,
                details: parts.length ? parts.join(' · ') : null,
            };
        });

        return NextResponse.json({
            account,
            trades,
            orders,
            positions,
            activity,
        });
    } catch (error: any) {
        console.error('Oanda Workspace Route Error:', error?.response?.data || error?.message || error);
        if (error?.message?.includes('Missing')) {
            return NextResponse.json({ error: 'Missing API Keys' }, { status: 403 });
        }
        return NextResponse.json(
            { error: 'Failed to fetch workspace data', details: error?.response?.data || error?.message },
            { status: error?.response?.status || 500 }
        );
    }
}
