import { getOandaClient } from '../src/lib/oanda';
import { ENGINE_CONFIG } from '../config/models';
import type { TradeIntent } from './types';

export async function executeTrade(userId: string, pair: string, intent: TradeIntent) {
  const { client, accountId } = await getOandaClient(userId);

  if (intent.decision === 'NO_TRADE') {
    throw new Error('Cannot execute NO_TRADE intent');
  }

  const baseUnits = Number(intent.units && intent.units > 0 ? intent.units : ENGINE_CONFIG.fixedUnits);
  const signedUnits = intent.decision === 'BUY' ? baseUnits : -baseUnits;
  const orderType = intent.entryType === 'LIMIT' ? 'LIMIT' : 'MARKET';

  const orderPayload: any = {
    order: {
      type: orderType,
      instrument: pair,
      units: String(signedUnits),
      timeInForce: orderType === 'MARKET' ? 'FOK' : 'GTC',
      positionFill: 'DEFAULT',
    },
  };

  if (orderType === 'LIMIT') {
    if (!intent.entryPrice || !Number.isFinite(intent.entryPrice)) {
      throw new Error('LIMIT intent requires entryPrice');
    }
    orderPayload.order.price = String(intent.entryPrice);
  }

  if (intent.stopLoss && Number.isFinite(intent.stopLoss)) {
    orderPayload.order.stopLossOnFill = { price: String(intent.stopLoss) };
  }

  if (intent.takeProfit && Number.isFinite(intent.takeProfit)) {
    orderPayload.order.takeProfitOnFill = { price: String(intent.takeProfit) };
  }

  const response = await client.post(`/v3/accounts/${accountId}/orders`, orderPayload);
  return response.data;
}

export async function cancelOrder(userId: string, orderId: string) {
  const { client, accountId } = await getOandaClient(userId);
  const response = await client.put(`/v3/accounts/${accountId}/orders/${orderId}/cancel`, {});
  return response.data;
}

export async function closeTrade(userId: string, tradeId: string) {
  const { client, accountId } = await getOandaClient(userId);
  const response = await client.put(`/v3/accounts/${accountId}/trades/${tradeId}/close`, {});
  return response.data;
}
