'use client';

import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import TradingChart from '@/components/TradingChart';
import { useTranslations } from 'next-intl';
import { Link } from '@/i18n/routing';
import { useSearchParams } from 'next/navigation';

/** Supported forex instrument pairs */
const INSTRUMENTS = [
    'EUR_USD', 'GBP_USD', 'USD_JPY', 'USD_CHF',
    'AUD_USD', 'USD_CAD', 'NZD_USD', 'EUR_GBP',
];

const AI_REFRESH_INTERVAL_MIN = 15;
const FORCE_REFRESH_ON_BREAKOUT = true;
const FORCE_REFRESH_ON_POSITION_CLOSE = true;

type AiRefreshReason = 'MANUAL' | 'TIME_INTERVAL' | 'MARKET_REGIME_CHANGE' | 'POSITION_CLOSE';

interface MarketRegimeSnapshot {
    atr: number;
    rangeLow: number;
    rangeHigh: number;
    mid: number;
    hash: string;
}

interface TerminalTrade {
    id: string;
    instrument: string;
    currentUnits: string;
    unrealizedPL: string;
}

interface TerminalOrder {
    id: string;
    instrument: string;
    type: string;
    units?: string;
    displayPrice?: string | null;
    tradeId?: string | null;
}

interface TerminalPosition {
    instrument: string;
    unrealizedPL: string;
    long?: { units: string };
    short?: { units: string };
}

interface TerminalActivity {
    id: string;
    type: string;
    instrument?: string | null;
    time?: string | null;
    details?: string | null;
}

interface NewsHeadline {
    title: string;
    link: string;
    pubDate: string;
}

interface NewsImpact {
    cached: boolean;
    generatedAt: string;
    expiresAt: string;
    upsideProbability: number;
    downsideProbability: number;
    reversalRisk: number;
    marketBias: string;
    summary: string;
    headlines: NewsHeadline[];
}

type DecisionType = 'MARKET_ENTRY' | 'PLACE_PENDING_ORDER' | 'WAIT';

interface TradeReadiness {
    decision: DecisionType;
    side: 'BUY' | 'SELL' | 'WAIT';
    confidence: number;
    reason: string;
}

interface EngineRiskCheck {
    passed: boolean;
    reasons: string[];
}

interface EngineDecision {
    decision: 'BUY' | 'SELL' | 'NO_TRADE';
    entry: number;
    stop_loss: number;
    take_profit: number;
    reasoning: string;
}

interface EngineRunResponse {
    status: 'NO_TRADE' | 'READY' | 'EXECUTED';
    reason: string;
    executed: boolean;
    aiDecision?: EngineDecision;
    riskCheck?: EngineRiskCheck;
}

interface ScannerPairRow {
    pair: string;
    recommendedStrategyId?: string;
    appliedStrategyId?: string;
    recommendationConfidence?: number;
    recommendationReason?: string;
    decision: 'BUY' | 'SELL' | 'NO_TRADE';
    score: number | null;
    rr: number;
    spread: number;
    rejected: boolean;
    rejectionReasonCode?: string;
    metrics?: Record<string, number | string | boolean | null>;
    rejectionReasons: string[];
}

interface ScannerStatusResponse {
    activeStrategy: string;
    scannedPairs: ScannerPairRow[];
    selectedTrade: string | null;
    updatedAt?: string;
}

interface StrategyOption {
    id: string;
    name: string;
    version: string;
}

type TerminalTab = 'trades' | 'orders' | 'positions' | 'activity';
type RightPanelTab = 'ticket' | 'news' | 'workspace';
type ScannerFilter = 'ALL' | 'VALID' | 'REJECTED';
type TradingProfile = 'strict' | 'soft';

type TicketOrderType = 'MARKET' | 'LIMIT' | 'STOP';

interface OrderTicketState {
    side: 'BUY' | 'SELL';
    orderType: TicketOrderType;
    units: string;
    entryPrice: string;
    stopLoss: string;
    takeProfit: string;
}

function clamp(value: number, min: number, max: number): number {
    return Math.max(min, Math.min(max, value));
}

function extractPriceValue(text: string | null, pattern: RegExp): string {
    if (!text) return '';
    const match = text.match(pattern);
    if (!match?.[1]) return '';
    const normalized = String(match[1]).replace(',', '.');
    const numeric = Number(normalized);
    return Number.isFinite(numeric) ? numeric.toString() : '';
}

function buildFallbackRiskTargets(
    entry: number,
    side: 'BUY' | 'SELL',
    instrument: string,
): { stopLoss: string; takeProfit: string } {
    const isJpyPair = instrument.includes('JPY');
    const pip = isJpyPair ? 0.01 : 0.0001;
    const stopDistance = pip * 20;
    const takeDistance = pip * 40;
    const precision = isJpyPair ? 3 : 5;

    const stopLoss = side === 'BUY' ? entry - stopDistance : entry + stopDistance;
    const takeProfit = side === 'BUY' ? entry + takeDistance : entry - takeDistance;

    return {
        stopLoss: stopLoss.toFixed(precision),
        takeProfit: takeProfit.toFixed(precision),
    };
}

function formatCountdown(totalSeconds: number): string {
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = totalSeconds % 60;
    return `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
}

function formatInstrumentLabel(value: unknown): string {
    if (typeof value !== 'string' || value.length === 0) return 'UNKNOWN';
    return value.replace('_', '/');
}

function getMidFromPricing(pricing: any): number | null {
    const ask = Number(pricing?.asks?.[0]?.price ?? NaN);
    const bid = Number(pricing?.bids?.[0]?.price ?? NaN);
    if (!Number.isFinite(ask) || !Number.isFinite(bid)) return null;
    return (ask + bid) / 2;
}

function calculateAtrFromCandles(candles: any[], period = 14): number {
    if (!Array.isArray(candles) || candles.length < period + 1) return 0;

    let trSum = 0;
    for (let index = candles.length - period; index < candles.length; index += 1) {
        const current = candles[index];
        const prevClose = Number(candles[index - 1]?.mid?.c ?? candles[index - 1]?.close ?? 0);
        const high = Number(current?.mid?.h ?? current?.high ?? 0);
        const low = Number(current?.mid?.l ?? current?.low ?? 0);

        if (![prevClose, high, low].every(Number.isFinite)) {
            return 0;
        }

        const tr = Math.max(high - low, Math.abs(high - prevClose), Math.abs(low - prevClose));
        trSum += tr;
    }

    return trSum / period;
}

function buildMarketRegimeSnapshot(candles: any[], pricing: any): MarketRegimeSnapshot | null {
    if (!Array.isArray(candles) || candles.length < 20) return null;
    const windowCandles = candles.slice(-20);
    const highs = windowCandles.map((candle) => Number(candle?.mid?.h ?? candle?.high ?? NaN));
    const lows = windowCandles.map((candle) => Number(candle?.mid?.l ?? candle?.low ?? NaN));

    if (![...highs, ...lows].every(Number.isFinite)) return null;

    const rangeHigh = Math.max(...highs);
    const rangeLow = Math.min(...lows);
    const mid = getMidFromPricing(pricing);

    if (!Number.isFinite(rangeHigh) || !Number.isFinite(rangeLow) || !Number.isFinite(mid)) {
        return null;
    }

    const atr = calculateAtrFromCandles(candles, 14);
    const hash = [
        (atr || 0).toFixed(5),
        rangeLow.toFixed(5),
        rangeHigh.toFixed(5),
        Number(mid).toFixed(5),
    ].join('|');

    return {
        atr,
        rangeLow,
        rangeHigh,
        mid,
        hash,
    };
}

/**
 * Trading Terminal page.
 * Shows a live candlestick chart with real-time bid/ask pricing
 * and an AI trade scenario sidebar.
 * Completed AI analyses are saved as TradeSignal records via /api/signals.
 */
export default function TradingDashboard() {
    const t = useTranslations('Trading');
    const searchParams = useSearchParams();
    const signalId = searchParams.get('signalId');
    const [instrument, setInstrument] = useState('EUR_USD');
    const [pricing, setPricing] = useState<any>(null);
    const [aiAnalysis, setAiAnalysis] = useState<string | null>(null);
    const [isAnalyzing, setIsAnalyzing] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [saved, setSaved] = useState(false);
    const [workspaceTab, setWorkspaceTab] = useState<TerminalTab>('trades');
    const [trades, setTrades] = useState<TerminalTrade[]>([]);
    const [orders, setOrders] = useState<TerminalOrder[]>([]);
    const [positions, setPositions] = useState<TerminalPosition[]>([]);
    const [activity, setActivity] = useState<TerminalActivity[]>([]);
    const [actionLoadingKey, setActionLoadingKey] = useState<string | null>(null);
    const [editingTradeId, setEditingTradeId] = useState<string | null>(null);
    const [editingTradeInstrument, setEditingTradeInstrument] = useState<string | null>(null);
    const [riskEditStopLoss, setRiskEditStopLoss] = useState<string>('');
    const [riskEditTakeProfit, setRiskEditTakeProfit] = useState<string>('');
    const [riskEditTrailing, setRiskEditTrailing] = useState<string>('');
    const [newsImpact, setNewsImpact] = useState<NewsImpact | null>(null);
    const [newsLoading, setNewsLoading] = useState(false);
    const [placingOrder, setPlacingOrder] = useState(false);
    const [orderMessage, setOrderMessage] = useState<string | null>(null);
    const [engineLoading, setEngineLoading] = useState(false);
    const [engineMessage, setEngineMessage] = useState<string | null>(null);
    const [engineResult, setEngineResult] = useState<EngineRunResponse | null>(null);
    const [activeStrategyId, setActiveStrategyId] = useState<string>('h1_trend_m15_pullback');
    const [strategyOptions, setStrategyOptions] = useState<StrategyOption[]>([]);
    const [strategyUpdating, setStrategyUpdating] = useState(false);
    const [activeTradingProfile, setActiveTradingProfile] = useState<TradingProfile>('strict');
    const [profileUpdating, setProfileUpdating] = useState(false);
    const [scannerStatus, setScannerStatus] = useState<ScannerStatusResponse | null>(null);
    const [scannerLoading, setScannerLoading] = useState(false);
    const [scannerFilter, setScannerFilter] = useState<ScannerFilter>('ALL');
    const [autoDryRunEnabled, setAutoDryRunEnabled] = useState(false);
    const [autoDryRunIntervalSec, setAutoDryRunIntervalSec] = useState(60);
    const [autoCountdownSec, setAutoCountdownSec] = useState<number | null>(null);
    const [lastAutoRunAt, setLastAutoRunAt] = useState<string | null>(null);
    const [lastAiUpdateTimestamp, setLastAiUpdateTimestamp] = useState<number | null>(null);
    const [aiScenarioVersion, setAiScenarioVersion] = useState(0);
    const [marketRegimeHash, setMarketRegimeHash] = useState<string | null>(null);
    const [aiRefreshReason, setAiRefreshReason] = useState<AiRefreshReason | null>(null);
    const engineLoadingRef = useRef(false);
    const lastAiUpdateRef = useRef<number | null>(null);
    const autoCycleRunningRef = useRef(false);
    const marketRegimeSnapshotRef = useRef<MarketRegimeSnapshot | null>(null);
    const lastSeenTradesCountRef = useRef<number | null>(null);
    const maybeRefreshAiScenarioRef = useRef<() => Promise<void>>(async () => {});
    const runAutoCycleEngineRef = useRef<() => Promise<void>>(async () => {});
    const [rightPanelTab, setRightPanelTab] = useState<RightPanelTab>('ticket');
    const [orderTicket, setOrderTicket] = useState<OrderTicketState>({
        side: 'BUY',
        orderType: 'LIMIT',
        units: '1000',
        entryPrice: '',
        stopLoss: '',
        takeProfit: '',
    });

    const localizeScannerReason = useCallback((reason: string) => {
        if (!reason) return reason;
        if (reason === 'Strategy decision is NO_TRADE.') return t('scannerReasonStrategyNoTrade');
        if (reason === 'Market data is incomplete.') return t('scannerReasonMarketDataIncomplete');
        if (reason.includes('NO_TRADE: market not range-bound')) return t('scannerReasonRangeNotBound');
        if (reason.includes('NO_TRADE: spread too wide')) return t('scannerReasonSpreadTooWide');
        if (reason.includes('NO_TRADE: near news window')) return t('scannerReasonNearNewsWindow');
        return reason;
    }, [t]);

    const localizeAiRefreshReason = useCallback((reason: AiRefreshReason | null) => {
        if (!reason) return t('aiRefreshNever');
        if (reason === 'MANUAL') return t('aiRefreshReasonManual');
        if (reason === 'TIME_INTERVAL') return t('aiRefreshReasonTimeInterval');
        if (reason === 'MARKET_REGIME_CHANGE') return t('aiRefreshReasonMarketRegimeChange');
        if (reason === 'POSITION_CLOSE') return t('aiRefreshReasonPositionClose');
        return reason;
    }, [t]);

    useEffect(() => {
        lastAiUpdateRef.current = lastAiUpdateTimestamp;
    }, [lastAiUpdateTimestamp]);

    const tradeReadiness = useMemo<TradeReadiness>(() => {
        const analysisText = (aiAnalysis || '').toUpperCase();
        const aiSide: 'BUY' | 'SELL' | 'WAIT' =
            /(\bBUY\b|\bLONG\b|ПОКУПКА)/i.test(analysisText)
                ? 'BUY'
                : /(\bSELL\b|\bSHORT\b|ПРОДАЖА)/i.test(analysisText)
                    ? 'SELL'
                    : 'WAIT';

        if (!aiAnalysis) {
            return {
                decision: 'WAIT',
                side: 'WAIT',
                confidence: 0,
                reason: t('readinessNoAnalysis'),
            };
        }

        if (!newsImpact) {
            return {
                decision: 'PLACE_PENDING_ORDER',
                side: aiSide,
                confidence: 45,
                reason: t('readinessNoNews'),
            };
        }

        const reversalRisk = newsImpact.reversalRisk;
        const upside = newsImpact.upsideProbability;
        const downside = newsImpact.downsideProbability;
        const alignedWithNews = (aiSide === 'BUY' && upside >= downside) || (aiSide === 'SELL' && downside >= upside);
        const directionalEdge = Math.max(upside, downside);

        if (aiSide === 'WAIT') {
            return {
                decision: 'WAIT',
                side: 'WAIT',
                confidence: 55,
                reason: t('readinessAiWait'),
            };
        }

        if (reversalRisk >= 70) {
            return {
                decision: 'WAIT',
                side: aiSide,
                confidence: clamp(100 - reversalRisk, 5, 35),
                reason: t('readinessHighReversalRisk'),
            };
        }

        if (alignedWithNews && reversalRisk <= 45 && directionalEdge >= 58) {
            return {
                decision: 'MARKET_ENTRY',
                side: aiSide,
                confidence: clamp(Math.round((directionalEdge + (100 - reversalRisk)) / 2), 55, 90),
                reason: t('readinessMarketEntry'),
            };
        }

        if (alignedWithNews && reversalRisk <= 60) {
            return {
                decision: 'PLACE_PENDING_ORDER',
                side: aiSide,
                confidence: clamp(Math.round((directionalEdge + (100 - reversalRisk)) / 2), 45, 75),
                reason: t('readinessPendingOrder'),
            };
        }

        return {
            decision: 'WAIT',
            side: aiSide,
            confidence: clamp(Math.round((100 - reversalRisk) * 0.5), 20, 55),
            reason: t('readinessConflict'),
        };
    }, [aiAnalysis, newsImpact, t]);

    useEffect(() => {
        const derivedSide = tradeReadiness.side === 'WAIT' ? 'BUY' : tradeReadiness.side;
        const derivedOrderType: TicketOrderType = tradeReadiness.decision === 'MARKET_ENTRY' ? 'MARKET' : 'LIMIT';
        const parsedEntry = extractPriceValue(aiAnalysis, /(?:entry|вход)\s*[:=\-]?\s*([0-9]+[\.,]?[0-9]*)/i);
        const parsedSL = extractPriceValue(aiAnalysis, /(?:stop\s*-?\s*loss|\bsl\b|стоп\s*-?\s*лосс)\s*[:=\-]?\s*([0-9]+[\.,]?[0-9]*)/i);
        const parsedTP = extractPriceValue(aiAnalysis, /(?:take\s*-?\s*profit|\btp\b|тейк\s*-?\s*профит)\s*[:=\-]?\s*([0-9]+[\.,]?[0-9]*)/i);

        const fallbackEntry = pricing?.asks?.[0]?.price || pricing?.bids?.[0]?.price || '';

        setOrderTicket((prev) => ({
            ...prev,
            side: derivedSide,
            orderType: derivedOrderType,
            entryPrice: parsedEntry || (fallbackEntry ? String(fallbackEntry) : prev.entryPrice),
            stopLoss: parsedSL || prev.stopLoss,
            takeProfit: parsedTP || prev.takeProfit,
        }));
    }, [tradeReadiness, aiAnalysis, pricing]);

    useEffect(() => {
        const applySignalPrefill = async () => {
            if (!signalId) return;
            try {
                const res = await fetch(`/api/signals?id=${signalId}`);
                if (!res.ok) return;
                const data = await res.json();
                const signal = data?.signal;
                if (!signal) return;

                if (signal.instrument) {
                    setInstrument(signal.instrument);
                }

                if (signal.rationale) {
                    setAiAnalysis(signal.rationale);
                }

                setOrderTicket((prev) => ({
                    ...(() => {
                        const side: 'BUY' | 'SELL' = signal.action === 'SELL' ? 'SELL' : 'BUY';
                        const entryFromSignal = signal.entryPrice ? String(signal.entryPrice) : prev.entryPrice;
                        const entryNum = Number(entryFromSignal || 0);
                        const fallback = entryNum > 0
                            ? buildFallbackRiskTargets(entryNum, side, signal.instrument || instrument)
                            : null;

                        return {
                            ...prev,
                            side,
                            orderType: signal.entryPrice ? 'LIMIT' as TicketOrderType : prev.orderType,
                            entryPrice: entryFromSignal,
                            stopLoss: signal.stopLoss ? String(signal.stopLoss) : (fallback?.stopLoss || prev.stopLoss),
                            takeProfit: signal.takeProfit ? String(signal.takeProfit) : (fallback?.takeProfit || prev.takeProfit),
                        };
                    })(),
                }));

                setRightPanelTab('ticket');
                setOrderMessage(t('ticketLoadedFromAnalytics'));
            } catch (err) {
                console.error('Failed to prefill from signal', err);
            }
        };

        applySignalPrefill();
    }, [signalId, t]);

    // Fetch live pricing every 5 seconds
    useEffect(() => {
        const fetchPricing = async () => {
            try {
                const res = await fetch(`/api/oanda/pricing?instruments=${instrument}`);
                if (res.status === 403) { setError('missingKeysError'); return; }
                const data = await res.json();
                if (data?.prices?.length > 0) setPricing(data.prices[0]);
            } catch (err) {
                console.error('Failed to fetch pricing', err);
            }
        };
        fetchPricing();
        const interval = setInterval(fetchPricing, 5000);
        return () => clearInterval(interval);
    }, [instrument]);

    const fetchWorkspace = useCallback(async () => {
        try {
            const res = await fetch('/api/oanda/workspace');
            if (!res.ok) return;
            const data = await res.json();
            setTrades(data?.trades || []);
            setOrders(data?.orders || []);
            setPositions(data?.positions || []);
            setActivity(data?.activity || []);
        } catch (err) {
            console.error('Failed to fetch workspace panel data', err);
        }
    }, []);

    useEffect(() => {
        fetchWorkspace();
        const interval = setInterval(fetchWorkspace, 10000);
        return () => clearInterval(interval);
    }, [fetchWorkspace]);

    const fetchNewsImpact = useCallback(async (refresh = false) => {
        setNewsLoading(true);
        try {
            const res = await fetch(`/api/news/impact?instrument=${instrument}&timeframe=M15${refresh ? '&refresh=true' : ''}`);
            if (!res.ok) return;
            const data = await res.json();
            setNewsImpact(data);
        } catch (err) {
            console.error('Failed to fetch news impact', err);
        } finally {
            setNewsLoading(false);
        }
    }, [instrument]);

    const fetchTradingProfile = useCallback(async () => {
        try {
            const res = await fetch('/api/trading/profile');
            if (!res.ok) return;
            const data = await res.json();
            const profile = data?.activeProfile === 'soft' ? 'soft' : 'strict';
            setActiveTradingProfile(profile);
        } catch (err) {
            console.error('Failed to fetch trading profile', err);
        }
    }, []);

    const fetchStrategies = useCallback(async () => {
        try {
            const res = await fetch('/api/trading/strategy');
            if (!res.ok) return;
            const data = await res.json();
            setActiveStrategyId(String(data?.activeStrategyId || 'h1_trend_m15_pullback'));
            setStrategyOptions(Array.isArray(data?.strategies) ? data.strategies : []);
        } catch (err) {
            console.error('Failed to fetch strategy list', err);
        }
    }, []);

    const updateStrategy = useCallback(async (strategyId: string) => {
        if (!strategyId || strategyId === activeStrategyId) return;
        setStrategyUpdating(true);
        try {
            const res = await fetch('/api/trading/strategy', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ strategyId }),
            });

            if (!res.ok) {
                const data = await res.json().catch(() => ({}));
                throw new Error(data?.error || t('engineStrategySwitchError'));
            }

            const data = await res.json();
            const nextStrategyId = String(data?.activeStrategyId || strategyId);
            setActiveStrategyId(nextStrategyId);
            setEngineMessage(t('engineStrategySwitched', { strategy: nextStrategyId }));
        } catch (err: any) {
            setEngineMessage(err?.message || t('engineStrategySwitchError'));
        } finally {
            setStrategyUpdating(false);
        }
    }, [activeStrategyId, t]);

    const updateTradingProfile = useCallback(async (profile: TradingProfile) => {
        if (profile === activeTradingProfile) return;
        setProfileUpdating(true);
        try {
            const res = await fetch('/api/trading/profile', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ profile }),
            });
            if (!res.ok) {
                const data = await res.json().catch(() => ({}));
                throw new Error(data?.error || t('engineProfileSwitchError'));
            }

            const data = await res.json();
            const nextProfile = data?.activeProfile === 'soft' ? 'soft' : 'strict';
            setActiveTradingProfile(nextProfile);
            setEngineMessage(t('engineProfileSwitched', { profile: nextProfile.toUpperCase() }));
        } catch (err: any) {
            setEngineMessage(err?.message || t('engineProfileSwitchError'));
        } finally {
            setProfileUpdating(false);
        }
    }, [activeTradingProfile, t]);

    const fetchScannerStatus = useCallback(async () => {
        setScannerLoading(true);
        try {
            const res = await fetch('/api/scanner-status');
            if (!res.ok) return;
            const data = await res.json();
            setScannerStatus(data);
        } catch (err) {
            console.error('Failed to fetch scanner status', err);
        } finally {
            setScannerLoading(false);
        }
    }, []);

    useEffect(() => {
        fetchNewsImpact(false);
    }, [fetchNewsImpact]);

    useEffect(() => {
        fetchTradingProfile();
    }, [fetchTradingProfile]);

    useEffect(() => {
        fetchStrategies();
    }, [fetchStrategies]);

    useEffect(() => {
        fetchScannerStatus();
        const interval = setInterval(fetchScannerStatus, 10000);
        return () => clearInterval(interval);
    }, [fetchScannerStatus]);

    const handleCloseTrade = async (tradeId: string, instrument: string) => {
        const confirmed = window.confirm(t('confirmCloseTrade', { instrument: formatInstrumentLabel(instrument) }));
        if (!confirmed) return;

        const key = `trade:${tradeId}`;
        setActionLoadingKey(key);
        try {
            const res = await fetch('/api/oanda/trades/close', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ tradeId }),
            });
            const data = await res.json();
            if (!res.ok) throw new Error(data?.error || t('errorCloseTrade'));
            await fetchWorkspace();
        } catch (err: any) {
            setError(err?.message || t('errorCloseTrade'));
        } finally {
            setActionLoadingKey(null);
        }
    };

    const handleCancelOrder = async (orderId: string, instrument: string) => {
        const confirmed = window.confirm(t('confirmCancelOrder', { instrument: formatInstrumentLabel(instrument) }));
        if (!confirmed) return;

        const key = `order:${orderId}`;
        setActionLoadingKey(key);
        try {
            const res = await fetch('/api/oanda/orders/cancel', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ orderId }),
            });
            const data = await res.json();
            if (!res.ok) throw new Error(data?.error || t('errorCancelOrder'));
            await fetchWorkspace();
        } catch (err: any) {
            setError(err?.message || t('errorCancelOrder'));
        } finally {
            setActionLoadingKey(null);
        }
    };

    const handleClosePosition = async (instrument: string) => {
        const confirmed = window.confirm(t('confirmCloseTrade', { instrument: formatInstrumentLabel(instrument) }));
        if (!confirmed) return;

        const key = `position:${instrument}`;
        setActionLoadingKey(key);
        try {
            const res = await fetch('/api/oanda/positions/close', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ instrument }),
            });
            const data = await res.json();
            if (!res.ok) throw new Error(data?.error || t('errorCloseTrade'));
            await fetchWorkspace();
        } catch (err: any) {
            setError(err?.message || t('errorCloseTrade'));
        } finally {
            setActionLoadingKey(null);
        }
    };

    const beginEditRisk = (tradeId: string, instrument: string) => {
        const tp = orders.find((order) => order.tradeId === tradeId && String(order.type || '').includes('TAKE_PROFIT'))?.displayPrice;
        const sl = orders.find((order) => order.tradeId === tradeId && String(order.type || '').includes('STOP_LOSS'))?.displayPrice;
        const ts = orders.find((order) => order.tradeId === tradeId && String(order.type || '').includes('TRAILING'))?.displayPrice;

        setEditingTradeId(tradeId);
        setEditingTradeInstrument(instrument);
        setRiskEditStopLoss(sl ? String(sl) : '');
        setRiskEditTakeProfit(tp ? String(tp) : '');
        setRiskEditTrailing(ts ? String(ts) : '');
        setOrderMessage(null);
    };

    const handleSaveRisk = async () => {
        if (!editingTradeId || !editingTradeInstrument) return;

        const key = `risk:${editingTradeId}`;
        setActionLoadingKey(key);
        setOrderMessage(null);

        const parseNullable = (value: string) => {
            const trimmed = String(value || '').trim();
            if (!trimmed) return null;
            const num = Number(trimmed);
            return Number.isFinite(num) && num > 0 ? num : NaN;
        };

        const stopLoss = parseNullable(riskEditStopLoss);
        const takeProfit = parseNullable(riskEditTakeProfit);
        const trailingStopDistance = parseNullable(riskEditTrailing);

        if ([stopLoss, takeProfit, trailingStopDistance].some((v) => typeof v === 'number' && Number.isNaN(v))) {
            setOrderMessage('Invalid SL/TP/Trailing value. Use a positive number or leave blank to remove.');
            setActionLoadingKey(null);
            return;
        }

        try {
            const res = await fetch('/api/oanda/trades/risk', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    tradeId: editingTradeId,
                    stopLoss,
                    takeProfit,
                    trailingStopDistance,
                }),
            });

            const data = await res.json();
            if (!res.ok) throw new Error(data?.error || t('orderErrorPlace'));

            setEditingTradeId(null);
            setEditingTradeInstrument(null);
            setRiskEditStopLoss('');
            setRiskEditTakeProfit('');
            setRiskEditTrailing('');
            await fetchWorkspace();
        } catch (err: any) {
            setOrderMessage(err?.message || t('orderErrorPlace'));
        } finally {
            setActionLoadingKey(null);
        }
    };

    const handleCancelRiskEdit = () => {
        setEditingTradeId(null);
        setEditingTradeInstrument(null);
        setRiskEditStopLoss('');
        setRiskEditTakeProfit('');
        setRiskEditTrailing('');
    };

    const handlePlaceOrder = async () => {
        setOrderMessage(null);
        if (!orderTicket.units || Number(orderTicket.units) <= 0) {
            setOrderMessage(t('orderErrorUnits'));
            return;
        }

        if ((orderTicket.orderType === 'LIMIT' || orderTicket.orderType === 'STOP') && !orderTicket.entryPrice) {
            setOrderMessage(t('orderErrorEntryRequired'));
            return;
        }

        const entryReference = orderTicket.orderType === 'MARKET'
            ? Number(pricing?.asks?.[0]?.price || pricing?.bids?.[0]?.price || 0)
            : Number(orderTicket.entryPrice || 0);
        const stopLoss = Number(orderTicket.stopLoss || 0);
        const takeProfit = Number(orderTicket.takeProfit || 0);

        if (entryReference > 0 && stopLoss > 0) {
            if (orderTicket.side === 'BUY' && stopLoss >= entryReference) {
                setOrderMessage(t('orderErrorBuySl'));
                return;
            }
            if (orderTicket.side === 'SELL' && stopLoss <= entryReference) {
                setOrderMessage(t('orderErrorSellSl'));
                return;
            }
        }

        if (entryReference > 0 && takeProfit > 0) {
            if (orderTicket.side === 'BUY' && takeProfit <= entryReference) {
                setOrderMessage(t('orderErrorBuyTp'));
                return;
            }
            if (orderTicket.side === 'SELL' && takeProfit >= entryReference) {
                setOrderMessage(t('orderErrorSellTp'));
                return;
            }
        }

        setPlacingOrder(true);
        try {
            const res = await fetch('/api/oanda/orders/place', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    instrument,
                    side: orderTicket.side,
                    orderType: orderTicket.orderType,
                    units: Number(orderTicket.units),
                    entryPrice: orderTicket.entryPrice ? Number(orderTicket.entryPrice) : null,
                    stopLoss: orderTicket.stopLoss ? Number(orderTicket.stopLoss) : null,
                    takeProfit: orderTicket.takeProfit ? Number(orderTicket.takeProfit) : null,
                }),
            });

            const data = await res.json();
            if (!res.ok) {
                throw new Error(data?.error || t('orderErrorPlace'));
            }

            setOrderMessage(t('orderSuccessPlaced'));
            await fetchWorkspace();
        } catch (err: any) {
            setOrderMessage(err?.message || t('orderErrorPlace'));
        } finally {
            setPlacingOrder(false);
        }
    };

    const requestNewAiScenario = useCallback(async (reason: AiRefreshReason, preloadedCandles?: any[]) => {
        if (isAnalyzing) return;

        setIsAnalyzing(true);
        setAiAnalysis(null);
        setError(null);
        setSaved(false);

        try {
            let candles = preloadedCandles;
            if (!Array.isArray(candles) || !candles.length) {
                const candlesRes = await fetch(`/api/oanda/candles?instrument=${instrument}&granularity=M15&count=200`);
                if (candlesRes.status === 403) throw new Error('missingKeysError');
                const candlesData = await candlesRes.json();
                if (!candlesData?.candles) throw new Error(candlesData?.error || 'No candles data returned');
                candles = candlesData.candles;
            }

            const aiRes = await fetch('/api/ai/analyze', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    chartData: candles,
                    pricing,
                    instrument,
                    timeframe: 'M15',
                }),
            });

            const aiData = await aiRes.json();
            if (aiData.error) {
                if (aiRes.status === 403) throw new Error('missingKeysError');
                throw new Error(aiData.error);
            }

            const analysis: string = aiData.analysis;
            setAiAnalysis(analysis);

            const recommendedStrategyId = String(aiData?.recommendedStrategyId || '').trim();
            if (recommendedStrategyId) {
                await updateStrategy(recommendedStrategyId);
                setEngineMessage(t('engineStrategyRecommended', { strategy: recommendedStrategyId }));
            }

            const recommended = aiData?.recommendedOrders?.[0] || aiData?.signal;
            if (recommended) {
                setOrderTicket((prev) => ({
                    ...(() => {
                        const side: 'BUY' | 'SELL' = recommended.action === 'SELL' ? 'SELL' : 'BUY';
                        const entryFromSignal = recommended.entryPrice != null
                            ? String(recommended.entryPrice)
                            : (prev.entryPrice || String(pricing?.asks?.[0]?.price || pricing?.bids?.[0]?.price || ''));
                        const entryNum = Number(entryFromSignal || 0);
                        const fallback = entryNum > 0
                            ? buildFallbackRiskTargets(entryNum, side, recommended.instrument || instrument)
                            : null;

                        return {
                            ...prev,
                            side: recommended.action === 'SELL' ? 'SELL' : (recommended.action === 'BUY' ? 'BUY' : prev.side),
                            entryPrice: entryFromSignal || prev.entryPrice,
                            stopLoss: recommended.stopLoss != null ? String(recommended.stopLoss) : (fallback?.stopLoss || prev.stopLoss),
                            takeProfit: recommended.takeProfit != null ? String(recommended.takeProfit) : (fallback?.takeProfit || prev.takeProfit),
                        };
                    })(),
                }));
            }

            const snapshot = buildMarketRegimeSnapshot(candles, pricing);
            if (snapshot) {
                marketRegimeSnapshotRef.current = snapshot;
                setMarketRegimeHash(snapshot.hash);
            }

            const oldVersion = aiScenarioVersion;
            const newVersion = oldVersion + 1;
            setAiScenarioVersion(newVersion);
            const nowTs = Date.now();
            setLastAiUpdateTimestamp(nowTs);
            setAiRefreshReason(reason);

            console.info('AI_REFRESH_TRIGGERED', {
                reason,
                oldVersion,
                newVersion,
                instrument,
                marketRegimeHash: snapshot?.hash || null,
            });

            setSaved(Boolean(aiData?.signal?.id));
        } catch (err: any) {
            setError(err?.message || 'AI refresh failed');
        } finally {
            setIsAnalyzing(false);
        }
    }, [aiScenarioVersion, instrument, isAnalyzing, pricing, t, updateStrategy]);

    const maybeRefreshAiScenario = useCallback(async () => {
        const candlesRes = await fetch(`/api/oanda/candles?instrument=${instrument}&granularity=M15&count=200`);
        if (!candlesRes.ok) return;

        const candlesData = await candlesRes.json().catch(() => null);
        const candles = candlesData?.candles;
        if (!Array.isArray(candles) || !candles.length) return;

        const currentSnapshot = buildMarketRegimeSnapshot(candles, pricing);
        const now = Date.now();
        const lastAiTs = lastAiUpdateRef.current;
        const minutesSinceAi = lastAiTs ? (now - lastAiTs) / 60000 : Number.POSITIVE_INFINITY;

        if (minutesSinceAi >= AI_REFRESH_INTERVAL_MIN) {
            await requestNewAiScenario('TIME_INTERVAL', candles);
            return;
        }

        const previousSnapshot = marketRegimeSnapshotRef.current;
        if (!currentSnapshot || !previousSnapshot) return;

        const atrIncrease = previousSnapshot.atr > 0 && currentSnapshot.atr > previousSnapshot.atr * 1.3;
        const breakout = currentSnapshot.mid > previousSnapshot.rangeHigh || currentSnapshot.mid < previousSnapshot.rangeLow;

        if (atrIncrease || (FORCE_REFRESH_ON_BREAKOUT && breakout)) {
            await requestNewAiScenario('MARKET_REGIME_CHANGE', candles);
        }
    }, [instrument, pricing, requestNewAiScenario]);

    const handleRunEngine = async (execute: boolean, options?: { autoMode?: boolean }) => {
        const autoMode = Boolean(options?.autoMode);
        setEngineLoading(true);
        setEngineMessage(null);
        setEngineResult(null);

        try {
            const res = await fetch('/api/trading/engine', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ pair: instrument, execute }),
            });

            const data = await res.json();
            if (!res.ok) {
                throw new Error(data?.error || t('engineRunFailed'));
            }

            let finalData = data;

            if (autoMode && !execute && data?.status === 'READY') {
                const executeRes = await fetch('/api/trading/engine', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ pair: instrument, execute: true }),
                });

                const executeData = await executeRes.json();
                if (!executeRes.ok) {
                    throw new Error(executeData?.error || t('engineRunFailed'));
                }

                finalData = executeData;
            }

            setEngineResult(finalData);
            setEngineMessage(
                finalData?.status === 'EXECUTED'
                    ? t('engineExecuted')
                    : finalData?.status === 'READY'
                        ? t('engineReady')
                        : t('engineNoTrade')
            );

            if (finalData?.aiDecision && finalData.aiDecision.decision !== 'NO_TRADE') {
                setOrderTicket((prev) => ({
                    ...prev,
                    side: finalData.aiDecision.decision === 'SELL' ? 'SELL' : 'BUY',
                    orderType: finalData?.status === 'EXECUTED' ? 'MARKET' : prev.orderType,
                    entryPrice: finalData.aiDecision.entry ? String(finalData.aiDecision.entry) : prev.entryPrice,
                    stopLoss: finalData.aiDecision.stop_loss ? String(finalData.aiDecision.stop_loss) : prev.stopLoss,
                    takeProfit: finalData.aiDecision.take_profit ? String(finalData.aiDecision.take_profit) : prev.takeProfit,
                }));
            }

            if (execute || finalData?.status === 'EXECUTED') {
                await fetchWorkspace();
            }

            await fetchScannerStatus();

            if (!execute) {
                setLastAutoRunAt(new Date().toLocaleTimeString());

                const lastAiTs = lastAiUpdateRef.current;
                const minutesSinceLastAI = lastAiTs == null ? null : Number(((Date.now() - lastAiTs) / 60000).toFixed(2));
                console.info('DRY_RUN_CYCLE', {
                    engine: activeStrategyId,
                    aiScenarioVersion,
                    minutesSinceLastAI,
                    decision: finalData?.status || 'UNKNOWN',
                });
            }

            if (autoMode && finalData?.status === 'EXECUTED') {
                setAutoDryRunEnabled(false);
                setAutoCountdownSec(null);
            }
        } catch (err: any) {
            setEngineMessage(err?.message || t('engineError'));
        } finally {
            setEngineLoading(false);
        }
    };

    useEffect(() => {
        maybeRefreshAiScenarioRef.current = maybeRefreshAiScenario;
    }, [maybeRefreshAiScenario]);

    useEffect(() => {
        runAutoCycleEngineRef.current = () => handleRunEngine(false, { autoMode: true });
    });

    useEffect(() => {
        engineLoadingRef.current = engineLoading;
    }, [engineLoading]);

    useEffect(() => {
        if (!autoDryRunEnabled) {
            setAutoCountdownSec(null);
            return;
        }

        const safeIntervalSec = Math.max(15, autoDryRunIntervalSec);
        let nextRunAt = Date.now() + safeIntervalSec * 1000;
        setAutoCountdownSec(safeIntervalSec);

        const tick = setInterval(() => {
            const now = Date.now();
            const remaining = Math.max(0, Math.ceil((nextRunAt - now) / 1000));
            setAutoCountdownSec(remaining);

            if (remaining <= 0 && !engineLoadingRef.current && !autoCycleRunningRef.current) {
                autoCycleRunningRef.current = true;

                void (async () => {
                    try {
                        await maybeRefreshAiScenarioRef.current();
                        await runAutoCycleEngineRef.current();
                    } finally {
                        nextRunAt = Date.now() + safeIntervalSec * 1000;
                        setAutoCountdownSec(safeIntervalSec);
                        autoCycleRunningRef.current = false;
                    }
                })();
            }
        }, 1000);

        return () => clearInterval(tick);
    }, [autoDryRunEnabled, autoDryRunIntervalSec, instrument]);

    useEffect(() => {
        const currentCount = trades.length;
        const previousCount = lastSeenTradesCountRef.current;

        if (previousCount == null) {
            lastSeenTradesCountRef.current = currentCount;
            return;
        }

        const closedPositionDetected = FORCE_REFRESH_ON_POSITION_CLOSE && previousCount > currentCount;
        lastSeenTradesCountRef.current = currentCount;

        if (closedPositionDetected) {
            void requestNewAiScenario('POSITION_CLOSE');
        }
    }, [requestNewAiScenario, trades.length]);

    const scannerRows = useMemo(() => {
        if (!scannerStatus?.scannedPairs?.length) return [];
        return scannerStatus.scannedPairs
            .filter((row): row is ScannerPairRow => Boolean(row && typeof row.pair === 'string' && row.pair.length > 0))
            .sort((a, b) => {
            const scoreA = a.score ?? -1;
            const scoreB = b.score ?? -1;
            return scoreB - scoreA;
        });
    }, [scannerStatus]);
    const selectedScannerPair = scannerStatus?.selectedTrade || null;
    const bestScannerPair = useMemo(() => (
        scannerRows.find((row) => !row.rejected && row.score != null)?.pair || null
    ), [scannerRows]);
    const filteredScannerRows = useMemo(() => scannerRows.filter((row) => {
        if (scannerFilter === 'VALID') return !row.rejected;
        if (scannerFilter === 'REJECTED') return row.rejected;
        return true;
    }), [scannerRows, scannerFilter]);

    const safeAutoIntervalSec = Math.max(15, autoDryRunIntervalSec);
    const autoProgressPercent = autoCountdownSec == null
        ? 0
        : Math.min(100, Math.max(0, ((safeAutoIntervalSec - autoCountdownSec) / safeAutoIntervalSec) * 100));
    const autoCountdownUrgent = autoCountdownSec != null && autoCountdownSec > 0 && autoCountdownSec <= 5;

    /**
     * Request AI analysis for the current instrument on M15 timeframe.
     * Parses the response and saves it as a TradeSignal via /api/signals.
     */
    const handleAIAnalysis = async () => {
        await requestNewAiScenario('MANUAL');
    };

    return (
        <div className="container mx-auto p-4 space-y-6">
            {/* Header bar */}
            <div className="flex flex-wrap justify-between items-center bg-gray-900 p-4 rounded-xl shadow-md border border-gray-800 gap-4">
                <div>
                    <h1 className="text-2xl font-bold text-white tracking-tight">
                        {t('title')}: {instrument.replace('_', '/')}
                    </h1>
                    <p className="text-gray-400 text-sm mt-1">{t('demoMode')}</p>
                </div>

                {/* Instrument selector */}
                <div className="flex items-center gap-3 flex-wrap">
                    <select
                        value={instrument}
                        onChange={e => { setInstrument(e.target.value); setPricing(null); setAiAnalysis(null); setError(null); }}
                        className="bg-gray-800 border border-gray-700 text-white text-sm rounded-lg px-3 py-2 focus:outline-none focus:ring-1 focus:ring-blue-500"
                    >
                        {INSTRUMENTS.map(i => (
                            <option key={i} value={i}>{i.replace('_', '/')}</option>
                        ))}
                    </select>

                    {/* Live pricing */}
                    {pricing && (
                        <div className="flex space-x-4 text-right">
                            <div>
                                <p className="text-gray-500 text-xs uppercase font-medium">{t('bid')}</p>
                                <p className="text-red-400 font-mono text-lg">{pricing.bids[0]?.price}</p>
                            </div>
                            <div>
                                <p className="text-gray-500 text-xs uppercase font-medium">{t('ask')}</p>
                                <p className="text-green-400 font-mono text-lg">{pricing.asks[0]?.price}</p>
                            </div>
                        </div>
                    )}
                </div>
            </div>

            {/* Chart top */}
            <div>
                <TradingChart instrument={instrument} />
            </div>

            {/* Bottom two equal columns */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 items-start">
                {/* Left: AI analysis */}
                <div className="bg-gray-900 p-4 rounded-xl shadow-md border border-gray-800 flex flex-col">
                    <h2 className="text-lg font-semibold text-white mb-4 border-b border-gray-700 pb-2 flex items-center gap-2">
                        <svg className="w-5 h-5 text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 10V3L4 14h7v7l9-11h-7z" />
                        </svg>
                        {t('aiTitle')}
                    </h2>

                    <button
                        onClick={handleAIAnalysis}
                        disabled={isAnalyzing}
                        className={`w-full py-3 px-4 rounded-lg font-medium text-white shadow-sm transition-all ${isAnalyzing
                            ? 'bg-blue-600/50 cursor-not-allowed'
                            : 'bg-blue-600 hover:bg-blue-700 hover:shadow-lg active:scale-95'
                            }`}
                    >
                        {isAnalyzing ? t('analyzing') : t('requestAnalysis')}
                    </button>

                    {saved && (
                        <div className="mt-2 text-center text-xs text-emerald-400 flex items-center justify-center gap-1">
                            <span>✓</span> {t('savedToAnalytics')}
                        </div>
                    )}

                    <div className="mt-2 rounded border border-gray-800 bg-gray-950/40 p-2 text-[10px] text-gray-400">
                        <p>{t('aiScenarioVersion')}: <span className="text-gray-200">{aiScenarioVersion}</span></p>
                        <p>
                            {t('aiLastUpdated')}: <span className="text-gray-200">
                                {lastAiUpdateTimestamp ? new Date(lastAiUpdateTimestamp).toLocaleTimeString() : t('aiRefreshNever')}
                            </span>
                        </p>
                        <p>{t('aiRefreshReason')}: <span className="text-blue-300">{localizeAiRefreshReason(aiRefreshReason)}</span></p>
                        <p>Regime Hash: <span className="text-gray-300">{marketRegimeHash || '—'}</span></p>
                    </div>

                    {error && error === 'missingKeysError' ? (
                        <div className="mt-4 p-4 bg-yellow-900/50 border border-yellow-800 text-yellow-200 rounded-lg text-sm text-center">
                            <p className="mb-2">{t('missingKeysError')}</p>
                            <Link href="/settings/api" className="text-blue-400 font-semibold hover:underline">
                                {t('goToApiSettings')} →
                            </Link>
                        </div>
                    ) : error ? (
                        <div className="mt-4 p-3 bg-red-900/50 border border-red-800 text-red-200 rounded-lg text-sm">
                            {t('error')}: {error}
                        </div>
                    ) : null}

                    <div className="mt-3 min-h-[22rem] max-h-[36rem] overflow-y-auto">
                        {aiAnalysis ? (
                            <div className="bg-gray-800 p-3 rounded-lg text-sm text-gray-200 whitespace-pre-wrap leading-relaxed border border-gray-700">
                                {aiAnalysis}
                            </div>
                        ) : (
                            <div className="flex flex-col items-center justify-center text-gray-500 space-y-2 py-10">
                                <svg className="w-12 h-12 text-gray-700" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1" d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                                </svg>
                                <p className="text-center text-sm px-4">{t('aiPrompt')}</p>
                            </div>
                        )}
                    </div>
                </div>

                {/* Right: ticket/news/workspace */}
                <div className="bg-gray-900 p-4 rounded-xl shadow-md border border-gray-800">
                        <div className="flex items-center gap-1 mb-3 overflow-x-auto">
                            <button onClick={() => setRightPanelTab('ticket')} className={`text-xs px-2.5 py-1.5 rounded ${rightPanelTab === 'ticket' ? 'bg-gray-700 text-white' : 'text-gray-400 hover:text-white'}`}>
                                {t('tabTicket')}
                            </button>
                            <button onClick={() => setRightPanelTab('news')} className={`text-xs px-2.5 py-1.5 rounded ${rightPanelTab === 'news' ? 'bg-gray-700 text-white' : 'text-gray-400 hover:text-white'}`}>
                                {t('tabNews')}
                            </button>
                            <button onClick={() => setRightPanelTab('workspace')} className={`text-xs px-2.5 py-1.5 rounded ${rightPanelTab === 'workspace' ? 'bg-gray-700 text-white' : 'text-gray-400 hover:text-white'}`}>
                                {t('tabWorkspace')}
                            </button>
                        </div>

                        {rightPanelTab === 'ticket' && (
                            <>
                        <div className="mb-4 p-3 border border-blue-900/60 rounded-lg bg-blue-950/20">
                            <h3 className="text-xs font-semibold text-blue-200 uppercase tracking-wide mb-2">{t('newUserGuideTitle')}</h3>
                            <ul className="list-disc list-inside space-y-1 text-[11px] text-blue-100/90">
                                <li>{t('newUserGuideStep1')}</li>
                                <li>{t('newUserGuideStep2')}</li>
                                <li>{t('newUserGuideStep3')}</li>
                                <li>{t('newUserGuideStep4')}</li>
                            </ul>
                        </div>

                        <div className="mb-4 p-3 border border-gray-800 rounded-lg bg-gray-950/40">
                            <h3 className="text-xs font-semibold text-gray-200 uppercase tracking-wide mb-2">{t('readyToTrade')}</h3>
                            <div className="flex items-center justify-between gap-2">
                                <div>
                                    <p className="text-sm text-white font-semibold">
                                        {tradeReadiness.decision === 'MARKET_ENTRY'
                                            ? t('readyDecisionMarket')
                                            : tradeReadiness.decision === 'PLACE_PENDING_ORDER'
                                                ? t('readyDecisionPending')
                                                : t('readyDecisionWait')}
                                    </p>
                                    <p className="text-[11px] text-gray-400 mt-1">{t('sideLabel')}: {tradeReadiness.side}</p>
                                </div>
                                <div className="text-right">
                                    <p className="text-[10px] text-gray-500">{t('confidenceLabel')}</p>
                                    <p className="text-sm font-semibold text-blue-300">{tradeReadiness.confidence}%</p>
                                </div>
                            </div>
                            <p className="text-[11px] text-gray-300 mt-2">{tradeReadiness.reason}</p>
                        </div>

                        <div className="mb-4 p-3 border border-gray-800 rounded-lg bg-gray-950/40">
                            <h3 className="text-xs font-semibold text-gray-200 uppercase tracking-wide mb-2">{t('engineTitle')}</h3>
                            <div className="mb-2">
                                <label className="text-[10px] text-gray-500 uppercase tracking-wide">{t('engineStrategy')}</label>
                                <select
                                    value={activeStrategyId}
                                    onChange={(e) => updateStrategy(e.target.value)}
                                    disabled={strategyUpdating}
                                    className="mt-1 w-full bg-gray-900 border border-gray-700 text-white rounded px-2 py-1 text-[11px] disabled:opacity-50"
                                >
                                    {strategyOptions.map((strategy) => (
                                        <option key={strategy.id} value={strategy.id}>
                                            {strategy.name} ({strategy.id})
                                        </option>
                                    ))}
                                </select>
                            </div>
                            <div className="mb-2 flex items-center gap-1 bg-gray-800/70 rounded p-1 w-fit">
                                <button
                                    onClick={() => updateTradingProfile('strict')}
                                    disabled={profileUpdating}
                                    className={`text-[10px] px-2 py-1 rounded ${activeTradingProfile === 'strict' ? 'bg-gray-700 text-white' : 'text-gray-400 hover:text-white'} disabled:opacity-50`}
                                >
                                    {t('engineProfileStrict')}
                                </button>
                                <button
                                    onClick={() => updateTradingProfile('soft')}
                                    disabled={profileUpdating}
                                    className={`text-[10px] px-2 py-1 rounded ${activeTradingProfile === 'soft' ? 'bg-gray-700 text-white' : 'text-gray-400 hover:text-white'} disabled:opacity-50`}
                                >
                                    {t('engineProfileSoft')}
                                </button>
                            </div>
                            <p className="mb-2 text-[10px] text-gray-500">{t('engineProfileActive')}: <span className="text-gray-300 uppercase">{activeTradingProfile}</span></p>
                            <div className="mb-2 grid grid-cols-2 gap-2 text-[11px]">
                                <label className="text-gray-400 flex items-center gap-2">
                                    <input
                                        type="checkbox"
                                        checked={autoDryRunEnabled}
                                        onChange={(e) => setAutoDryRunEnabled(e.target.checked)}
                                        className="accent-blue-500"
                                    />
                                    {t('engineAutoDryRun')}
                                </label>
                                <select
                                    value={autoDryRunIntervalSec}
                                    onChange={(e) => setAutoDryRunIntervalSec(Number(e.target.value))}
                                    className="bg-gray-900 border border-gray-700 text-white rounded px-2 py-1"
                                >
                                    <option value={30}>30s</option>
                                    <option value={60}>60s</option>
                                    <option value={120}>120s</option>
                                    <option value={300}>300s</option>
                                </select>
                            </div>

                            <div className="grid grid-cols-2 gap-2">
                                <button
                                    onClick={() => handleRunEngine(false)}
                                    disabled={engineLoading || strategyUpdating || profileUpdating}
                                    className="text-xs px-3 py-2 rounded border border-blue-700 text-blue-200 hover:bg-blue-900/40 disabled:opacity-50"
                                >
                                    {engineLoading ? '...' : t('engineDryRun')}
                                </button>
                                <button
                                    onClick={() => handleRunEngine(true)}
                                    disabled={engineLoading || strategyUpdating || profileUpdating}
                                    className="text-xs px-3 py-2 rounded border border-emerald-700 text-emerald-200 hover:bg-emerald-900/40 disabled:opacity-50"
                                >
                                    {engineLoading ? '...' : t('engineExecute')}
                                </button>
                            </div>

                            {engineMessage && (
                                <p className="mt-2 text-[11px] text-gray-300">{engineMessage}</p>
                            )}

                            {autoDryRunEnabled && (
                                <div className="mt-2 rounded-lg border border-blue-900/60 bg-blue-950/25 p-2">
                                    <div className="flex items-center justify-between mb-1">
                                        <span className="text-[10px] text-blue-300/80">{t('engineNextAutoRun')}</span>
                                        <span className={`text-sm font-mono font-semibold ${autoCountdownUrgent ? 'text-yellow-300 animate-pulse' : 'text-blue-200'}`}>
                                            {formatCountdown(autoCountdownSec ?? safeAutoIntervalSec)}
                                        </span>
                                    </div>
                                    <div className="h-1.5 w-full rounded bg-gray-800 overflow-hidden">
                                        <div
                                            className={`h-full transition-all duration-700 ease-linear ${autoCountdownUrgent ? 'bg-yellow-400 animate-pulse' : 'bg-blue-500/80'}`}
                                            style={{ width: `${autoProgressPercent}%` }}
                                        />
                                    </div>
                                    <p className="mt-1 text-[10px] text-gray-400">
                                        {t('engineAutoModeActive')} · {t('engineInterval')} {safeAutoIntervalSec}s{lastAutoRunAt ? ` · ${t('engineLastRun')} ${lastAutoRunAt}` : ''}
                                    </p>
                                </div>
                            )}

                            {engineResult && (
                                <div className="mt-2 space-y-1 text-[11px]">
                                    <p className="text-gray-300">
                                        {t('engineStatus')}: <span className="font-semibold text-white">{engineResult.status}</span>
                                    </p>
                                    <p className="text-gray-400">{engineResult.reason}</p>
                                    {!!engineResult.riskCheck?.reasons?.length && (
                                        <ul className="list-disc list-inside text-yellow-300/90 space-y-0.5">
                                            {engineResult.riskCheck.reasons.map((reason, index) => (
                                                <li key={`${reason}-${index}`}>{reason}</li>
                                            ))}
                                        </ul>
                                    )}
                                </div>
                            )}

                            <div className="mt-3 rounded-lg border border-gray-800 bg-gray-900/70 p-2">
                                <div className="flex items-center justify-between">
                                    <h4 className="text-[11px] font-semibold text-gray-200 uppercase tracking-wide">{t('scannerStatus')}</h4>
                                    <div className="flex items-center gap-2">
                                        <div className="flex items-center gap-1 bg-gray-800/70 rounded p-1">
                                            <button
                                                onClick={() => setScannerFilter('ALL')}
                                                className={`text-[10px] px-1.5 py-0.5 rounded ${scannerFilter === 'ALL' ? 'bg-gray-700 text-white' : 'text-gray-400 hover:text-white'}`}
                                            >
                                                {t('scannerFilterAll')}
                                            </button>
                                            <button
                                                onClick={() => setScannerFilter('VALID')}
                                                className={`text-[10px] px-1.5 py-0.5 rounded ${scannerFilter === 'VALID' ? 'bg-gray-700 text-white' : 'text-gray-400 hover:text-white'}`}
                                            >
                                                {t('scannerFilterValid')}
                                            </button>
                                            <button
                                                onClick={() => setScannerFilter('REJECTED')}
                                                className={`text-[10px] px-1.5 py-0.5 rounded ${scannerFilter === 'REJECTED' ? 'bg-gray-700 text-white' : 'text-gray-400 hover:text-white'}`}
                                            >
                                                {t('scannerFilterRejected')}
                                            </button>
                                        </div>
                                        <button
                                            onClick={fetchScannerStatus}
                                            disabled={scannerLoading}
                                            className="text-[10px] px-2 py-1 rounded border border-gray-700 text-gray-300 hover:bg-gray-800 disabled:opacity-50"
                                        >
                                            {scannerLoading ? '...' : t('scannerRefresh')}
                                        </button>
                                    </div>
                                </div>

                                <div className="mt-2 flex items-center justify-between text-[10px] text-gray-400">
                                    <span>{t('scannerStrategy')}: <span className="text-gray-200">{scannerStatus?.activeStrategy || '—'}</span></span>
                                    <span>{t('scannerSelected')}: <span className="text-blue-300">{scannerStatus?.selectedTrade?.replace('_', '/') || t('scannerNone')}</span></span>
                                </div>

                                <div className="mt-2 max-h-44 overflow-y-auto space-y-1 pr-1">
                                    {!filteredScannerRows.length ? (
                                        <p className="text-[10px] text-gray-500">{t('scannerNoResults')}</p>
                                    ) : filteredScannerRows.map((row, index) => (
                                        <div
                                            key={`${row.pair}-${index}`}
                                            className={`rounded border p-2 ${selectedScannerPair === row.pair
                                                ? 'border-blue-800 bg-blue-950/20'
                                                : 'border-gray-800 bg-gray-950/50'
                                                }`}
                                        >
                                            <div className="flex items-center justify-between text-[11px]">
                                                <div className="flex items-center gap-2">
                                                    <span className="font-mono text-gray-200">{formatInstrumentLabel(row.pair)}</span>
                                                    {bestScannerPair === row.pair && (
                                                        <span className="text-[10px] px-1.5 py-0.5 rounded border border-emerald-700 bg-emerald-900/40 text-emerald-300">
                                                            {t('scannerBest')}
                                                        </span>
                                                    )}
                                                    {selectedScannerPair === row.pair && (
                                                        <span className="text-[10px] px-1.5 py-0.5 rounded border border-blue-700 bg-blue-900/40 text-blue-300">
                                                            {t('scannerSelectedBadge')}
                                                        </span>
                                                    )}
                                                </div>
                                                <span className={`${row.decision === 'BUY' ? 'text-emerald-300' : row.decision === 'SELL' ? 'text-red-300' : 'text-yellow-300'}`}>
                                                    {row.decision}
                                                </span>
                                            </div>
                                            <div className="mt-1 grid grid-cols-3 gap-2 text-[10px] text-gray-400">
                                                <span>{t('scannerScore')}: <span className="text-gray-200">{row.score == null ? '—' : row.score.toFixed(2)}</span></span>
                                                <span>RR: <span className="text-gray-200">{row.rr?.toFixed?.(2) ?? '0.00'}</span></span>
                                                <span>{t('scannerSpread')}: <span className="text-gray-200">{row.spread?.toFixed?.(2) ?? '0.00'}</span></span>
                                            </div>
                                            {(row.appliedStrategyId || row.recommendedStrategyId) && (
                                                <p className="mt-1 text-[10px] text-blue-300/90 line-clamp-2">
                                                    {t('scannerStrategy')}: {row.appliedStrategyId || row.recommendedStrategyId}
                                                    {typeof row.recommendationConfidence === 'number' ? ` (${Math.round(row.recommendationConfidence * 100)}%)` : ''}
                                                </p>
                                            )}
                                            {row.rejected && row.rejectionReasons?.length > 0 && (
                                                <p className="mt-1 text-[10px] text-yellow-300/90 line-clamp-2">
                                                    {row.rejectionReasonCode ? `${row.rejectionReasonCode}: ` : ''}
                                                    {localizeScannerReason(row.rejectionReasons[0])}
                                                </p>
                                            )}
                                        </div>
                                    ))}
                                </div>
                            </div>
                        </div>

                        <div className="mb-4 p-3 border border-gray-800 rounded-lg bg-gray-950/40">
                            <h3 className="text-xs font-semibold text-gray-200 uppercase tracking-wide mb-2">{t('orderTicketTitle')}</h3>
                            <div className="grid grid-cols-2 gap-2 text-[11px]">
                                <label className="text-gray-400">{t('sideLabel')}</label>
                                <select
                                    value={orderTicket.side}
                                    onChange={(e) => setOrderTicket((prev) => ({ ...prev, side: e.target.value as 'BUY' | 'SELL' }))}
                                    className="bg-gray-900 border border-gray-700 text-white rounded px-2 py-1"
                                >
                                    <option value="BUY">BUY</option>
                                    <option value="SELL">SELL</option>
                                </select>

                                <label className="text-gray-400">{t('typeLabel')}</label>
                                <select
                                    value={orderTicket.orderType}
                                    onChange={(e) => setOrderTicket((prev) => ({ ...prev, orderType: e.target.value as TicketOrderType }))}
                                    className="bg-gray-900 border border-gray-700 text-white rounded px-2 py-1"
                                >
                                    <option value="MARKET">MARKET</option>
                                    <option value="LIMIT">LIMIT</option>
                                    <option value="STOP">STOP</option>
                                </select>

                                <label className="text-gray-400">{t('unitsLabel')}</label>
                                <input
                                    value={orderTicket.units}
                                    onChange={(e) => setOrderTicket((prev) => ({ ...prev, units: e.target.value }))}
                                    className="bg-gray-900 border border-gray-700 text-white rounded px-2 py-1"
                                />

                                <label className="text-gray-400">{t('entryLabel')}</label>
                                <input
                                    value={orderTicket.entryPrice}
                                    onChange={(e) => setOrderTicket((prev) => ({ ...prev, entryPrice: e.target.value }))}
                                    disabled={orderTicket.orderType === 'MARKET'}
                                    className="bg-gray-900 border border-gray-700 text-white rounded px-2 py-1 disabled:opacity-50"
                                />

                                <label className="text-gray-400">SL</label>
                                <input
                                    value={orderTicket.stopLoss}
                                    onChange={(e) => setOrderTicket((prev) => ({ ...prev, stopLoss: e.target.value }))}
                                    className="bg-gray-900 border border-gray-700 text-white rounded px-2 py-1"
                                />

                                <label className="text-gray-400">TP</label>
                                <input
                                    value={orderTicket.takeProfit}
                                    onChange={(e) => setOrderTicket((prev) => ({ ...prev, takeProfit: e.target.value }))}
                                    className="bg-gray-900 border border-gray-700 text-white rounded px-2 py-1"
                                />
                            </div>

                            <button
                                onClick={handlePlaceOrder}
                                disabled={placingOrder}
                                className="mt-3 w-full text-xs px-3 py-2 rounded border border-blue-700 text-blue-200 hover:bg-blue-900/40 disabled:opacity-50"
                            >
                                {placingOrder ? t('placingOrder') : t('placeOrder')}
                            </button>

                            {orderMessage && (
                                <p className="mt-2 text-[11px] text-gray-300">{orderMessage}</p>
                            )}
                        </div>
                            </>
                        )}

                        {rightPanelTab === 'news' && (
                        <div className="mb-0 p-3 border border-gray-800 rounded-lg bg-gray-950/40">
                            <div className="flex items-center justify-between mb-2">
                                <h3 className="text-xs font-semibold text-gray-200 uppercase tracking-wide">{t('newsImpactTitle')}</h3>
                                <button
                                    onClick={() => fetchNewsImpact(true)}
                                    disabled={newsLoading}
                                    className="text-[11px] px-2 py-1 rounded border border-blue-800 text-blue-300 hover:bg-blue-900/40 disabled:opacity-50"
                                >
                                    {newsLoading ? '...' : t('scannerRefresh')}
                                </button>
                            </div>

                            {newsImpact ? (
                                <div className="space-y-2">
                                    <p className="text-[11px] text-gray-300">{newsImpact.summary}</p>
                                    <div className="grid grid-cols-3 gap-2 text-[11px]">
                                        <div className="rounded bg-gray-900 p-2 text-center">
                                            <p className="text-gray-500">{t('newsUp')}</p>
                                            <p className="text-emerald-400 font-semibold">{newsImpact.upsideProbability}%</p>
                                        </div>
                                        <div className="rounded bg-gray-900 p-2 text-center">
                                            <p className="text-gray-500">{t('newsDown')}</p>
                                            <p className="text-red-400 font-semibold">{newsImpact.downsideProbability}%</p>
                                        </div>
                                        <div className="rounded bg-gray-900 p-2 text-center">
                                            <p className="text-gray-500">{t('newsReversal')}</p>
                                            <p className="text-yellow-300 font-semibold">{newsImpact.reversalRisk}%</p>
                                        </div>
                                    </div>

                                    <p className="text-[10px] text-gray-500">
                                        {newsImpact.cached ? t('newsCached') : t('newsFresh')} · {t('newsUpdated')} {new Date(newsImpact.generatedAt).toLocaleTimeString()}
                                    </p>

                                    <div className="space-y-1 max-h-24 overflow-y-auto pr-1">
                                        {newsImpact.headlines.slice(0, 3).map((item, index) => (
                                            <a
                                                key={`${item.link}-${index}`}
                                                href={item.link}
                                                target="_blank"
                                                rel="noopener noreferrer"
                                                className="block text-[11px] text-blue-300 hover:text-blue-200 line-clamp-2"
                                            >
                                                • {item.title}
                                            </a>
                                        ))}
                                    </div>
                                </div>
                            ) : (
                                <p className="text-[11px] text-gray-500">{t('newsEmpty')}</p>
                            )}
                        </div>
                        )}

                        {rightPanelTab === 'workspace' && (
                        <>
                        <div className="flex items-center gap-1 mb-3 overflow-x-auto mt-3">
                            <button onClick={() => setWorkspaceTab('trades')} className={`text-xs px-2.5 py-1.5 rounded ${workspaceTab === 'trades' ? 'bg-gray-700 text-white' : 'text-gray-400 hover:text-white'}`}>
                                {t('workspaceTrades')} {trades.length}
                            </button>
                            <button onClick={() => setWorkspaceTab('orders')} className={`text-xs px-2.5 py-1.5 rounded ${workspaceTab === 'orders' ? 'bg-gray-700 text-white' : 'text-gray-400 hover:text-white'}`}>
                                {t('workspaceOrders')} {orders.length}
                            </button>
                            <button onClick={() => setWorkspaceTab('positions')} className={`text-xs px-2.5 py-1.5 rounded ${workspaceTab === 'positions' ? 'bg-gray-700 text-white' : 'text-gray-400 hover:text-white'}`}>
                                {t('workspacePositions')} {positions.length}
                            </button>
                            <button onClick={() => setWorkspaceTab('activity')} className={`text-xs px-2.5 py-1.5 rounded ${workspaceTab === 'activity' ? 'bg-gray-700 text-white' : 'text-gray-400 hover:text-white'}`}>
                                {t('workspaceActivity')} {activity.length}
                            </button>
                        </div>

                        <div className="max-h-56 overflow-y-auto border border-gray-800 rounded-lg">
                            {editingTradeId && (
                                <div className="p-3 border-b border-gray-800 bg-gray-950/60">
                                    <div className="flex items-center justify-between gap-2">
                                        <div>
                                            <p className="text-xs text-gray-200 font-semibold">Edit risk orders · {formatInstrumentLabel(editingTradeInstrument)}</p>
                                            <p className="text-[10px] text-gray-500">trade #{editingTradeId} · Leave empty to remove</p>
                                        </div>
                                        <div className="flex items-center gap-2">
                                            <button
                                                onClick={handleCancelRiskEdit}
                                                className="text-[11px] px-2 py-1 rounded border border-gray-700 text-gray-300 hover:bg-gray-800"
                                            >
                                                Cancel
                                            </button>
                                            <button
                                                onClick={handleSaveRisk}
                                                disabled={actionLoadingKey === `risk:${editingTradeId}`}
                                                className="text-[11px] px-2 py-1 rounded border border-emerald-700 text-emerald-200 hover:bg-emerald-900/30 disabled:opacity-50"
                                            >
                                                {actionLoadingKey === `risk:${editingTradeId}` ? '...' : 'Save'}
                                            </button>
                                        </div>
                                    </div>

                                    <div className="mt-2 grid grid-cols-3 gap-2 text-[11px]">
                                        <div>
                                            <label className="text-[10px] text-gray-500 uppercase tracking-wide">SL price</label>
                                            <input
                                                value={riskEditStopLoss}
                                                onChange={(e) => setRiskEditStopLoss(e.target.value)}
                                                className="mt-1 w-full bg-gray-900 border border-gray-700 text-white rounded px-2 py-1"
                                            />
                                        </div>
                                        <div>
                                            <label className="text-[10px] text-gray-500 uppercase tracking-wide">TP price</label>
                                            <input
                                                value={riskEditTakeProfit}
                                                onChange={(e) => setRiskEditTakeProfit(e.target.value)}
                                                className="mt-1 w-full bg-gray-900 border border-gray-700 text-white rounded px-2 py-1"
                                            />
                                        </div>
                                        <div>
                                            <label className="text-[10px] text-gray-500 uppercase tracking-wide">Trailing distance</label>
                                            <input
                                                value={riskEditTrailing}
                                                onChange={(e) => setRiskEditTrailing(e.target.value)}
                                                className="mt-1 w-full bg-gray-900 border border-gray-700 text-white rounded px-2 py-1"
                                            />
                                        </div>
                                    </div>
                                </div>
                            )}

                            {workspaceTab === 'trades' && (
                                <div>
                                    {trades.length === 0 ? <p className="text-xs text-gray-500 p-3">{t('workspaceNoOpenTrades')}</p> : trades.map((item) => (
                                        <div key={item.id} className="px-3 py-2 border-b border-gray-800/70 last:border-b-0 text-xs flex justify-between">
                                            <div>
                                                <p className="text-white font-mono">{formatInstrumentLabel(item.instrument)}</p>
                                                <p className={parseFloat(item.unrealizedPL || '0') >= 0 ? 'text-emerald-400' : 'text-red-400'}>{parseFloat(item.unrealizedPL || '0').toFixed(2)}</p>
                                            </div>
                                            <div className="flex items-center gap-2">
                                                <button
                                                    onClick={() => beginEditRisk(item.id, item.instrument)}
                                                    disabled={actionLoadingKey === `risk:${item.id}` || actionLoadingKey === `trade:${item.id}`}
                                                    className="text-[11px] px-2 py-1 rounded border border-blue-800 text-blue-300 hover:bg-blue-900/30 disabled:opacity-50"
                                                >
                                                    Edit
                                                </button>
                                                <button
                                                    onClick={() => handleCloseTrade(item.id, item.instrument)}
                                                    disabled={actionLoadingKey === `trade:${item.id}` || actionLoadingKey === `risk:${item.id}`}
                                                    className="text-[11px] px-2 py-1 rounded border border-red-800 text-red-300 hover:bg-red-900/40 disabled:opacity-50"
                                                >
                                                    {actionLoadingKey === `trade:${item.id}` ? '...' : t('workspaceClose')}
                                                </button>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            )}

                            {workspaceTab === 'orders' && (
                                <div>
                                    {orders.length === 0 ? <p className="text-xs text-gray-500 p-3">{t('workspaceNoPendingOrders')}</p> : orders.map((item) => (
                                        <div key={item.id} className="px-3 py-2 border-b border-gray-800/70 last:border-b-0 text-xs flex justify-between">
                                            <div>
                                                <p className="text-white font-mono">{formatInstrumentLabel(item.instrument)}</p>
                                                <p className="text-gray-400">{item.type}{item.displayPrice ? ` @ ${item.displayPrice}` : ''}</p>
                                                {item.tradeId ? (
                                                    <p className="text-[10px] text-gray-500">trade #{item.tradeId}</p>
                                                ) : null}
                                            </div>
                                            <button
                                                onClick={() => handleCancelOrder(item.id, item.instrument)}
                                                disabled={actionLoadingKey === `order:${item.id}`}
                                                className="text-[11px] px-2 py-1 rounded border border-yellow-700 text-yellow-300 hover:bg-yellow-900/30 disabled:opacity-50"
                                            >
                                                {actionLoadingKey === `order:${item.id}` ? '...' : t('workspaceCancel')}
                                            </button>
                                        </div>
                                    ))}
                                </div>
                            )}

                            {workspaceTab === 'positions' && (
                                <div>
                                    {positions.length === 0 ? (
                                        <p className="text-xs text-gray-500 p-3">{t('workspaceNoOpenPositions')}</p>
                                    ) : positions.map((item) => {
                                        const longUnits = Number(item.long?.units || 0);
                                        const shortUnits = Number(item.short?.units || 0);
                                        const netUnits = longUnits - shortUnits;
                                        const direction = netUnits > 0 ? 'LONG' : netUnits < 0 ? 'SHORT' : 'FLAT';
                                        const pl = parseFloat(item.unrealizedPL || '0');

                                        return (
                                            <div key={item.instrument} className="px-3 py-2 border-b border-gray-800/70 last:border-b-0 text-xs flex justify-between gap-3">
                                                <div>
                                                    <p className="text-white font-mono">{formatInstrumentLabel(item.instrument)}</p>
                                                    <p className="text-[11px] text-gray-400">{direction} · net={netUnits} · long={longUnits} · short={shortUnits}</p>
                                                </div>
                                                <div className="flex items-center gap-2">
                                                    <span className={pl >= 0 ? 'text-emerald-400' : 'text-red-400'}>{pl.toFixed(2)}</span>
                                                    <button
                                                        onClick={() => handleClosePosition(item.instrument)}
                                                        disabled={actionLoadingKey === `position:${item.instrument}`}
                                                        className="text-[11px] px-2 py-1 rounded border border-red-800 text-red-300 hover:bg-red-900/40 disabled:opacity-50"
                                                    >
                                                        {actionLoadingKey === `position:${item.instrument}` ? '...' : t('workspaceClose')}
                                                    </button>
                                                </div>
                                            </div>
                                        );
                                    })}
                                </div>
                            )}

                            {workspaceTab === 'activity' && (
                                <div>
                                    {activity.length === 0 ? <p className="text-xs text-gray-500 p-3">{t('workspaceNoActivity')}</p> : activity.map((item) => (
                                        <div key={item.id} className="px-3 py-2 border-b border-gray-800/70 last:border-b-0 text-xs">
                                            <p className="text-gray-200">{item.type}{item.instrument ? ` · ${formatInstrumentLabel(item.instrument)}` : ''}</p>
                                            {item.details ? (
                                                <p className="text-[11px] text-gray-400 line-clamp-2">{item.details}</p>
                                            ) : null}
                                            <p className="text-gray-500">{item.time ? new Date(item.time).toLocaleString() : '—'}</p>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                        </>
                        )}
                </div>
            </div>
        </div>
    );
}
