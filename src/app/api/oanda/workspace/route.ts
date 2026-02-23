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
        const orders = ordersResult.status === 'fulfilled' ? ordersResult.value.data?.orders || [] : [];
        const positions = positionsResult.status === 'fulfilled' ? positionsResult.value.data?.positions || [] : [];
        const transactions = activityResult.status === 'fulfilled' ? activityResult.value.data?.transactions || [] : [];

        return NextResponse.json({
            account,
            trades,
            orders,
            positions,
            activity: transactions.slice(-30).reverse(),
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
