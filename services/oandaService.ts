import { getOandaClient } from '../src/lib/oanda';
import { ENGINE_CONFIG } from '../config/models';
import type { Candle, RawMarketData, Timeframe } from './types';

function toNumber(value: unknown): number {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function pipSize(pair: string): number {
  return pair.includes('JPY') ? 0.01 : 0.0001;
}

function normalizeCandle(rawCandle: any): Candle {
  return {
    time: String(rawCandle?.time || ''),
    open: toNumber(rawCandle?.mid?.o ?? rawCandle?.bid?.o ?? rawCandle?.ask?.o),
    high: toNumber(rawCandle?.mid?.h ?? rawCandle?.bid?.h ?? rawCandle?.ask?.h),
    low: toNumber(rawCandle?.mid?.l ?? rawCandle?.bid?.l ?? rawCandle?.ask?.l),
    close: toNumber(rawCandle?.mid?.c ?? rawCandle?.bid?.c ?? rawCandle?.ask?.c),
    volume: toNumber(rawCandle?.volume),
    complete: Boolean(rawCandle?.complete),
  };
}

export async function fetchMarketData(
  userId: string,
  pair: string = ENGINE_CONFIG.pair,
  requiredTimeframes: Timeframe[] = ['H1', 'M15'],
): Promise<RawMarketData | null> {
  const { client, accountId } = await getOandaClient(userId);

  const timeframeToCount: Record<Timeframe, number> = {
    H1: ENGINE_CONFIG.h1Count,
    M15: ENGINE_CONFIG.m15Count,
  };

  const candleRequests = requiredTimeframes.map((timeframe) =>
    client.get(`/v3/instruments/${pair}/candles`, {
      params: { granularity: timeframe, count: timeframeToCount[timeframe], price: 'MBA' },
    }),
  );

  const [candleResponses, pricingRes, accountRes, positionsRes, tradesRes] = await Promise.all([
    Promise.all(candleRequests),
    client.get(`/v3/accounts/${accountId}/pricing`, { params: { instruments: pair } }),
    client.get(`/v3/accounts/${accountId}/summary`),
    client.get(`/v3/accounts/${accountId}/openPositions`),
    client.get(`/v3/accounts/${accountId}/openTrades`),
  ]);

  const candles = {
    H1: [] as Candle[],
    M15: [] as Candle[],
  };

  requiredTimeframes.forEach((timeframe, index) => {
    const normalized = (candleResponses[index]?.data?.candles || [])
      .map(normalizeCandle)
      .filter((item: Candle) => item.complete && item.close > 0);
    candles[timeframe] = normalized;
  });

  const pricing = pricingRes.data?.prices?.[0];

  const bid = toNumber(pricing?.closeoutBid || pricing?.bids?.[0]?.price);
  const ask = toNumber(pricing?.closeoutAsk || pricing?.asks?.[0]?.price);
  const mid = bid > 0 && ask > 0 ? (bid + ask) / 2 : 0;
  const spreadPips = ask > 0 && bid > 0 ? (ask - bid) / pipSize(pair) : 0;

  const accountBalance = toNumber(accountRes.data?.account?.balance);
  const openPositions = positionsRes.data?.positions || [];
  const rawOpenTrades = tradesRes.data?.trades || [];

  const openTrades = rawOpenTrades.map((trade: any) => ({
    id: String(trade?.id || ''),
    instrument: String(trade?.instrument || ''),
    currentUnits: String(trade?.currentUnits ?? '0'),
    hasRiskOrders: Boolean(
      trade?.takeProfitOrder ||
        trade?.stopLossOrder ||
        trade?.trailingStopLossOrder ||
        trade?.takeProfitOrderID ||
        trade?.stopLossOrderID ||
        trade?.trailingStopLossOrderID,
    ),
  }));

  if (!candles.M15.length || !candles.H1.length || mid <= 0 || accountBalance <= 0) {
    return null;
  }

  return {
    pair,
    now: new Date().toISOString(),
    price: { bid, ask, mid },
    spread_pips: Number(spreadPips.toFixed(2)),
    candles,
    account: {
      balance: Number(accountBalance.toFixed(2)),
      openPositions,
      openTrades,
      fifoConstraints: true,
    },
  };
}
