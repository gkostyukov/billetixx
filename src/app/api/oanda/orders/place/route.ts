import { NextRequest, NextResponse } from 'next/server';
import { getOandaClient } from '@/lib/oanda';
import { auth } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

type OrderType = 'MARKET' | 'LIMIT' | 'STOP';
type OrderSide = 'BUY' | 'SELL';

export async function POST(request: NextRequest) {
    try {
        const session = await auth();
        if (!session?.user?.id) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const body = await request.json();
        const instrument = String(body.instrument || '').toUpperCase();
        const side = String(body.side || '').toUpperCase() as OrderSide;
        const orderType = String(body.orderType || '').toUpperCase() as OrderType;
        const unitsRaw = Number(body.units || 0);
        const entryPrice = body.entryPrice ? Number(body.entryPrice) : null;
        const stopLoss = body.stopLoss ? Number(body.stopLoss) : null;
        const takeProfit = body.takeProfit ? Number(body.takeProfit) : null;
        const signalId = body.signalId ? String(body.signalId) : null;

        if (!instrument || !['BUY', 'SELL'].includes(side)) {
            return NextResponse.json({ error: 'Invalid instrument or side' }, { status: 400 });
        }

        if (!['MARKET', 'LIMIT', 'STOP'].includes(orderType)) {
            return NextResponse.json({ error: 'Invalid orderType' }, { status: 400 });
        }

        if (!Number.isFinite(unitsRaw) || unitsRaw <= 0) {
            return NextResponse.json({ error: 'Units must be a positive number' }, { status: 400 });
        }

        if ((orderType === 'LIMIT' || orderType === 'STOP') && (!entryPrice || !Number.isFinite(entryPrice))) {
            return NextResponse.json({ error: 'entryPrice is required for LIMIT/STOP order' }, { status: 400 });
        }

        const referencePrice = entryPrice && Number.isFinite(entryPrice) ? entryPrice : null;

        if (referencePrice && stopLoss && Number.isFinite(stopLoss)) {
            if (side === 'BUY' && stopLoss >= referencePrice) {
                return NextResponse.json({ error: 'For BUY, stopLoss must be below entryPrice' }, { status: 400 });
            }
            if (side === 'SELL' && stopLoss <= referencePrice) {
                return NextResponse.json({ error: 'For SELL, stopLoss must be above entryPrice' }, { status: 400 });
            }
        }

        if (referencePrice && takeProfit && Number.isFinite(takeProfit)) {
            if (side === 'BUY' && takeProfit <= referencePrice) {
                return NextResponse.json({ error: 'For BUY, takeProfit must be above entryPrice' }, { status: 400 });
            }
            if (side === 'SELL' && takeProfit >= referencePrice) {
                return NextResponse.json({ error: 'For SELL, takeProfit must be below entryPrice' }, { status: 400 });
            }
        }

        const { client, accountId } = await getOandaClient(session.user.id);
        const signedUnits = side === 'BUY' ? unitsRaw : -unitsRaw;

        const order: any = {
            instrument,
            units: String(signedUnits),
            positionFill: 'DEFAULT',
        };

        if (orderType === 'MARKET') {
            order.type = 'MARKET';
            order.timeInForce = 'FOK';
        } else if (orderType === 'LIMIT') {
            order.type = 'LIMIT';
            order.timeInForce = 'GTC';
            order.price = String(entryPrice);
        } else {
            order.type = 'STOP';
            order.timeInForce = 'GTC';
            order.price = String(entryPrice);
        }

        if (stopLoss && Number.isFinite(stopLoss)) {
            order.stopLossOnFill = { price: String(stopLoss) };
        }

        if (takeProfit && Number.isFinite(takeProfit)) {
            order.takeProfitOnFill = { price: String(takeProfit) };
        }

        const response = await client.post(`/v3/accounts/${accountId}/orders`, { order });

        // If this order was placed from an Analytics ticket, persist a link for later UI cross-referencing.
        if (signalId) {
            const orderId = String(
                response.data?.orderCreateTransaction?.id ||
                response.data?.orderCreateTransaction?.orderID ||
                response.data?.orderFillTransaction?.orderID ||
                response.data?.orderCancelTransaction?.orderID ||
                '',
            );

            const tradeId = String(
                response.data?.orderFillTransaction?.tradeOpened?.tradeID ||
                response.data?.orderFillTransaction?.tradeReduced?.tradeID ||
                response.data?.orderFillTransaction?.tradeClosed?.tradeID ||
                '',
            );

            const status = response.data?.orderCancelTransaction
                ? 'cancelled'
                : response.data?.orderRejectTransaction
                    ? 'rejected'
                    : response.data?.orderFillTransaction
                        ? 'filled'
                        : 'created';

            await prisma.signalOrderLink.create({
                data: {
                    userId: session.user.id,
                    signalId,
                    instrument,
                    side,
                    orderType,
                    oandaOrderId: orderId || null,
                    oandaTradeId: tradeId || null,
                    status,
                    detailsJson: JSON.stringify({
                        response: response.data,
                    }),
                },
            });
        }

        return NextResponse.json({ success: true, result: response.data });
    } catch (error: any) {
        console.error('Oanda Place Order Route Error:', error?.response?.data || error?.message || error);
        if (error?.message?.includes('Missing')) {
            return NextResponse.json({ error: 'Missing API Keys' }, { status: 403 });
        }
        return NextResponse.json(
            { error: 'Failed to place order', details: error?.response?.data || error?.message },
            { status: error?.response?.status || 500 }
        );
    }
}
