'use client';

import { useState, useEffect } from 'react';
import { useTranslations } from 'next-intl';
import { Link } from '@/i18n/routing';

interface AccountSummary {
    balance: string;
    NAV: string;
    unrealizedPL: string;
    marginUsed: string;
    marginAvailable: string;
    openTradeCount: number;
    currency: string;
}

interface OpenTrade {
    id: string;
    instrument: string;
    currentUnits: string;
    price: string;
    unrealizedPL: string;
    openTime: string;
}

interface PendingOrder {
    id: string;
    instrument: string;
    type: string;
    units?: string;
    price?: string;
    createTime?: string;
}

interface OpenPosition {
    instrument: string;
    pl: string;
    unrealizedPL: string;
    marginUsed: string;
    long?: { units: string; averagePrice?: string };
    short?: { units: string; averagePrice?: string };
}

interface ActivityItem {
    id: string;
    type: string;
    instrument?: string | null;
    time?: string | null;
    details?: string | null;
}

interface ScannerPairRow {
    pair: string;
    decision: 'BUY' | 'SELL' | 'NO_TRADE';
    score: number | null;
    rr: number;
    spread: number;
    rejected: boolean;
    rejectionReasons: string[];
}

interface ScannerStatusResponse {
    activeStrategy: string;
    scannedPairs: ScannerPairRow[];
    selectedTrade: string | null;
}

type DashboardTab = 'trades' | 'orders' | 'positions' | 'activity';
type ScannerFilter = 'ALL' | 'VALID' | 'REJECTED';

export default function DashboardPage() {
    const t = useTranslations('Dashboard');
    const [account, setAccount] = useState<AccountSummary | null>(null);
    const [trades, setTrades] = useState<OpenTrade[]>([]);
    const [orders, setOrders] = useState<PendingOrder[]>([]);
    const [positions, setPositions] = useState<OpenPosition[]>([]);
    const [activity, setActivity] = useState<ActivityItem[]>([]);
    const [activeTab, setActiveTab] = useState<DashboardTab>('trades');
    const [actionLoadingKey, setActionLoadingKey] = useState<string | null>(null);
    const [actionError, setActionError] = useState<string | null>(null);
    const [scannerStatus, setScannerStatus] = useState<ScannerStatusResponse | null>(null);
    const [scannerLoading, setScannerLoading] = useState(false);
    const [scannerFilter, setScannerFilter] = useState<ScannerFilter>('ALL');
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    const localizeScannerReason = (reason: string) => {
        if (!reason) return reason;
        if (reason === 'Strategy decision is NO_TRADE.') return t('scannerReasonStrategyNoTrade');
        if (reason === 'Market data is incomplete.') return t('scannerReasonMarketDataIncomplete');
        return reason;
    };

    const fetchScannerStatus = async () => {
        setScannerLoading(true);
        try {
            const res = await fetch('/api/scanner-status');
            if (!res.ok) return;
            const data = await res.json();
            setScannerStatus(data);
        } catch (err) {
            console.error('Dashboard scanner status error:', err);
        } finally {
            setScannerLoading(false);
        }
    };

    const fetchData = async () => {
        try {
            const workspaceRes = await fetch('/api/oanda/workspace');

            if (workspaceRes.status === 403) {
                setError('missingKeys');
                setLoading(false);
                return;
            }

            const workspaceData = await workspaceRes.json();

            if (workspaceData?.account) {
                const a = workspaceData.account;
                setAccount({
                    balance: parseFloat(a.balance).toFixed(2),
                    NAV: parseFloat(a.NAV).toFixed(2),
                    unrealizedPL: parseFloat(a.unrealizedPL).toFixed(2),
                    marginUsed: parseFloat(a.marginUsed).toFixed(2),
                    marginAvailable: parseFloat(a.marginAvailable).toFixed(2),
                    openTradeCount: a.openTradeCount,
                    currency: a.currency,
                });
            }

            setTrades(workspaceData?.trades || []);
            setOrders(workspaceData?.orders || []);
            setPositions(workspaceData?.positions || []);
            setActivity(workspaceData?.activity || []);
        } catch (err) {
            console.error('Dashboard fetch error:', err);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchData();
        fetchScannerStatus();
        const interval = setInterval(fetchData, 10000);
        const scannerInterval = setInterval(fetchScannerStatus, 10000);
        return () => {
            clearInterval(interval);
            clearInterval(scannerInterval);
        };
    }, []);

    const plColor = (pl: string) =>
        parseFloat(pl) >= 0 ? 'text-emerald-400' : 'text-red-400';

    const badgeClassForOrderType = (type: string) => {
        const t = String(type || '').toUpperCase();
        if (t.includes('TAKE_PROFIT')) return 'border-emerald-700 bg-emerald-900/30 text-emerald-300';
        if (t.includes('STOP_LOSS')) return 'border-red-700 bg-red-900/30 text-red-300';
        if (t.includes('TRAILING')) return 'border-yellow-700 bg-yellow-900/20 text-yellow-300';
        if (t.includes('LIMIT')) return 'border-blue-700 bg-blue-900/20 text-blue-300';
        if (t.includes('STOP')) return 'border-orange-700 bg-orange-900/20 text-orange-300';
        return 'border-gray-700 bg-gray-900/40 text-gray-300';
    };

    const orderTypeLabel = (type: string) => String(type || '').toUpperCase();

    const tabButtonClass = (tab: DashboardTab) =>
        `text-sm font-medium px-3 py-2 rounded-md transition-colors ${activeTab === tab
            ? 'bg-gray-700 text-white'
            : 'text-gray-400 hover:text-white hover:bg-gray-800/60'
        }`;

    const sortedScannerPairs = [...(scannerStatus?.scannedPairs || [])].sort(
        (a, b) => (b.score ?? -1) - (a.score ?? -1),
    );
    const selectedScannerPair = scannerStatus?.selectedTrade || null;
    const bestCandidatePair =
        sortedScannerPairs.find((row) => !row.rejected && row.score != null)?.pair || null;
    const filteredScannerPairs = sortedScannerPairs.filter((row) => {
        if (scannerFilter === 'VALID') return !row.rejected;
        if (scannerFilter === 'REJECTED') return row.rejected;
        return true;
    });

    const handleCloseTrade = async (tradeId: string, instrument: string) => {
        const confirmed = window.confirm(t('confirmCloseTrade', { instrument: instrument.replace('_', '/') }));
        if (!confirmed) return;

        const key = `trade:${tradeId}`;
        setActionLoadingKey(key);
        setActionError(null);
        try {
            const res = await fetch('/api/oanda/trades/close', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ tradeId }),
            });
            const data = await res.json();
            if (!res.ok) throw new Error(data?.error || 'Failed to close trade');
            await fetchData();
        } catch (err: any) {
            setActionError(err?.message || 'Failed to close trade');
        } finally {
            setActionLoadingKey(null);
        }
    };

    const handleCancelOrder = async (orderId: string, instrument: string) => {
        const confirmed = window.confirm(t('confirmCancelOrder', { instrument: instrument.replace('_', '/') }));
        if (!confirmed) return;

        const key = `order:${orderId}`;
        setActionLoadingKey(key);
        setActionError(null);
        try {
            const res = await fetch('/api/oanda/orders/cancel', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ orderId }),
            });
            const data = await res.json();
            if (!res.ok) throw new Error(data?.error || 'Failed to cancel order');
            await fetchData();
        } catch (err: any) {
            setActionError(err?.message || 'Failed to cancel order');
        } finally {
            setActionLoadingKey(null);
        }
    };

    if (loading) {
        return (
            <div className="flex items-center justify-center min-h-[60vh]">
                <div className="flex flex-col items-center gap-3">
                    <div className="w-8 h-8 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
                    <p className="text-gray-400 text-sm">{t('loading')}</p>
                </div>
            </div>
        );
    }

    if (error === 'missingKeys') {
        return (
            <div className="container mx-auto p-6 max-w-lg mt-20 text-center">
                <div className="bg-yellow-900/40 border border-yellow-700 rounded-xl p-8">
                    <div className="text-4xl mb-4">🔑</div>
                    <h2 className="text-xl font-bold text-yellow-200 mb-2">{t('missingKeys')}</h2>
                    <p className="text-yellow-300/70 text-sm mb-6">{t('missingKeysDesc')}</p>
                    <Link href="/settings/api"
                        className="inline-block bg-blue-600 hover:bg-blue-700 text-white font-semibold px-6 py-2 rounded-lg transition-colors">
                        {t('goToSettings')}
                    </Link>
                </div>
            </div>
        );
    }

    return (
        <div className="container mx-auto p-4 space-y-6">
            {/* Header */}
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-2xl font-bold text-white">{t('title')}</h1>
                    <p className="text-gray-400 text-sm mt-1">{t('subtitle')}</p>
                </div>
                <span className="text-xs text-gray-500 bg-gray-800 px-3 py-1 rounded-full">
                    {t('autoRefresh')}
                </span>
            </div>

            {/* Account Summary Cards */}
            {account && (
                <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4">
                    <div className="bg-gray-900 border border-gray-800 rounded-xl p-4">
                        <p className="text-xs text-gray-500 uppercase font-medium mb-1">{t('balance')}</p>
                        <p className="text-xl font-bold text-white font-mono">{account.balance}</p>
                        <p className="text-xs text-gray-600 mt-1">{account.currency}</p>
                    </div>
                    <div className="bg-gray-900 border border-gray-800 rounded-xl p-4">
                        <p className="text-xs text-gray-500 uppercase font-medium mb-1">{t('nav')}</p>
                        <p className="text-xl font-bold text-white font-mono">{account.NAV}</p>
                        <p className="text-xs text-gray-600 mt-1">{account.currency}</p>
                    </div>
                    <div className="bg-gray-900 border border-gray-800 rounded-xl p-4">
                        <p className="text-xs text-gray-500 uppercase font-medium mb-1">{t('unrealizedPL')}</p>
                        <p className={`text-xl font-bold font-mono ${plColor(account.unrealizedPL)}`}>
                            {parseFloat(account.unrealizedPL) >= 0 ? '+' : ''}{account.unrealizedPL}
                        </p>
                        <p className="text-xs text-gray-600 mt-1">{account.currency}</p>
                    </div>
                    <div className="bg-gray-900 border border-gray-800 rounded-xl p-4">
                        <p className="text-xs text-gray-500 uppercase font-medium mb-1">{t('marginUsed')}</p>
                        <p className="text-xl font-bold text-white font-mono">{account.marginUsed}</p>
                        <p className="text-xs text-gray-600 mt-1">{account.currency}</p>
                    </div>
                    <div className="bg-gray-900 border border-gray-800 rounded-xl p-4">
                        <p className="text-xs text-gray-500 uppercase font-medium mb-1">{t('openTrades')}</p>
                        <p className="text-xl font-bold text-blue-400 font-mono">{account.openTradeCount}</p>
                        <p className="text-xs text-gray-600 mt-1">{t('positions')}</p>
                    </div>
                </div>
            )}

            {/* OANDA-like Workspace Tabs */}
            <div className="bg-gray-900 border border-gray-800 rounded-xl overflow-hidden">
                <div className="px-6 py-4 border-b border-gray-800 flex items-center justify-between">
                    <div>
                        <h2 className="text-sm font-semibold text-white">{t('scannerStatus')}</h2>
                        <p className="text-xs text-gray-500 mt-1">
                            {t('scannerStrategy')}: <span className="text-gray-300">{scannerStatus?.activeStrategy || '—'}</span>
                            {' · '}
                            {t('scannerSelected')}: <span className="text-blue-300">{scannerStatus?.selectedTrade?.replace('_', '/') || t('scannerNone')}</span>
                        </p>
                    </div>
                    <div className="flex items-center gap-2">
                        <div className="flex items-center gap-1 bg-gray-800/60 rounded p-1">
                            <button
                                onClick={() => setScannerFilter('ALL')}
                                className={`text-[10px] px-2 py-1 rounded ${scannerFilter === 'ALL' ? 'bg-gray-700 text-white' : 'text-gray-400 hover:text-white'}`}
                            >
                                {t('scannerFilterAll')}
                            </button>
                            <button
                                onClick={() => setScannerFilter('VALID')}
                                className={`text-[10px] px-2 py-1 rounded ${scannerFilter === 'VALID' ? 'bg-gray-700 text-white' : 'text-gray-400 hover:text-white'}`}
                            >
                                {t('scannerFilterValid')}
                            </button>
                            <button
                                onClick={() => setScannerFilter('REJECTED')}
                                className={`text-[10px] px-2 py-1 rounded ${scannerFilter === 'REJECTED' ? 'bg-gray-700 text-white' : 'text-gray-400 hover:text-white'}`}
                            >
                                {t('scannerFilterRejected')}
                            </button>
                        </div>
                        <button
                            onClick={fetchScannerStatus}
                            disabled={scannerLoading}
                            className="text-xs px-2.5 py-1.5 rounded border border-gray-700 text-gray-300 hover:bg-gray-800 disabled:opacity-50"
                        >
                            {scannerLoading ? '...' : t('scannerRefresh')}
                        </button>
                    </div>
                </div>

                {!filteredScannerPairs.length ? (
                    <div className="py-8 text-center text-gray-500 text-sm">{t('scannerNoResults')}</div>
                ) : (
                    <div className="overflow-x-auto">
                        <table className="w-full text-sm">
                            <thead>
                                <tr className="text-xs text-gray-500 uppercase border-b border-gray-800">
                                    <th className="text-left px-6 py-3">{t('scannerPair')}</th>
                                    <th className="text-left px-6 py-3">{t('scannerDecision')}</th>
                                    <th className="text-right px-6 py-3">{t('scannerScore')}</th>
                                    <th className="text-right px-6 py-3">RR</th>
                                    <th className="text-right px-6 py-3">{t('scannerSpread')}</th>
                                    <th className="text-left px-6 py-3">{t('scannerReason')}</th>
                                </tr>
                            </thead>
                            <tbody>
                                {filteredScannerPairs.map((row) => (
                                        <tr
                                            key={row.pair}
                                            className={`border-b border-gray-800/50 transition-colors ${selectedScannerPair === row.pair
                                                ? 'bg-blue-950/25'
                                                : 'hover:bg-gray-800/30'
                                                }`}
                                        >
                                            <td className="px-6 py-4 font-mono font-semibold text-white">
                                                <div className="flex items-center gap-2">
                                                    <span>{row.pair.replace('_', '/')}</span>
                                                    {bestCandidatePair === row.pair && (
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
                                            </td>
                                            <td className="px-6 py-4">
                                                <span className={`text-xs font-bold px-2 py-1 rounded-full ${row.decision === 'BUY'
                                                    ? 'bg-emerald-900/50 text-emerald-400 border border-emerald-800'
                                                    : row.decision === 'SELL'
                                                        ? 'bg-red-900/50 text-red-400 border border-red-800'
                                                        : 'bg-yellow-900/50 text-yellow-300 border border-yellow-700'
                                                    }`}>
                                                    {row.decision}
                                                </span>
                                            </td>
                                            <td className="px-6 py-4 text-right font-mono text-gray-300">{row.score == null ? '—' : row.score.toFixed(2)}</td>
                                            <td className="px-6 py-4 text-right font-mono text-gray-300">{Number(row.rr || 0).toFixed(2)}</td>
                                            <td className="px-6 py-4 text-right font-mono text-gray-300">{Number(row.spread || 0).toFixed(2)}</td>
                                            <td className="px-6 py-4 text-xs text-yellow-300/90">{row.rejectionReasons?.[0] ? localizeScannerReason(row.rejectionReasons[0]) : '—'}</td>
                                        </tr>
                                    ))}
                            </tbody>
                        </table>
                    </div>
                )}
            </div>

            <div className="bg-gray-900 border border-gray-800 rounded-xl overflow-hidden">
                <div className="px-6 py-4 border-b border-gray-800 flex items-center justify-between">
                    <div className="flex items-center gap-2 flex-wrap">
                        <button onClick={() => setActiveTab('trades')} className={tabButtonClass('trades')}>
                            {t('tabTrades')} ({trades.length})
                        </button>
                        <button onClick={() => setActiveTab('orders')} className={tabButtonClass('orders')}>
                            {t('tabOrders')} ({orders.length})
                        </button>
                        <button onClick={() => setActiveTab('positions')} className={tabButtonClass('positions')}>
                            {t('tabPositions')} ({positions.length})
                        </button>
                        <button onClick={() => setActiveTab('activity')} className={tabButtonClass('activity')}>
                            {t('tabActivity')} ({activity.length})
                        </button>
                    </div>
                </div>

                {actionError && (
                    <div className="px-6 py-3 border-b border-gray-800 text-xs text-red-300 bg-red-900/20">
                        {actionError}
                    </div>
                )}

                {activeTab === 'trades' && trades.length === 0 ? (
                    <div className="py-16 text-center text-gray-500">
                        <div className="text-4xl mb-3">📭</div>
                        <p className="text-sm">{t('noTrades')}</p>
                    </div>
                ) : activeTab === 'trades' ? (
                    <div className="overflow-x-auto">
                        <table className="w-full text-sm">
                            <thead>
                                <tr className="text-xs text-gray-500 uppercase border-b border-gray-800">
                                    <th className="text-left px-6 py-3">{t('instrument')}</th>
                                    <th className="text-left px-6 py-3">{t('direction')}</th>
                                    <th className="text-right px-6 py-3">{t('units')}</th>
                                    <th className="text-right px-6 py-3">{t('openPrice')}</th>
                                    <th className="text-right px-6 py-3">{t('unrealizedPL')}</th>
                                    <th className="text-left px-6 py-3">{t('openTime')}</th>
                                    <th className="text-right px-6 py-3">Action</th>
                                </tr>
                            </thead>
                            <tbody>
                                {trades.map((trade) => {
                                    const units = parseFloat(trade.currentUnits);
                                    const isBuy = units > 0;
                                    return (
                                        <tr key={trade.id} className="border-b border-gray-800/50 hover:bg-gray-800/30 transition-colors">
                                            <td className="px-6 py-4 font-mono font-semibold text-white">
                                                {trade.instrument.replace('_', '/')}
                                            </td>
                                            <td className="px-6 py-4">
                                                <span className={`text-xs font-bold px-2 py-1 rounded-full ${isBuy
                                                    ? 'bg-emerald-900/50 text-emerald-400 border border-emerald-800'
                                                    : 'bg-red-900/50 text-red-400 border border-red-800'
                                                    }`}>
                                                    {isBuy ? '▲ BUY' : '▼ SELL'}
                                                </span>
                                            </td>
                                            <td className="px-6 py-4 text-right font-mono text-gray-300">
                                                {Math.abs(units).toLocaleString()}
                                            </td>
                                            <td className="px-6 py-4 text-right font-mono text-gray-300">
                                                {parseFloat(trade.price).toFixed(5)}
                                            </td>
                                            <td className={`px-6 py-4 text-right font-mono font-semibold ${plColor(trade.unrealizedPL)}`}>
                                                {parseFloat(trade.unrealizedPL) >= 0 ? '+' : ''}{parseFloat(trade.unrealizedPL).toFixed(2)}
                                            </td>
                                            <td className="px-6 py-4 text-gray-500 text-xs">
                                                {new Date(trade.openTime).toLocaleString()}
                                            </td>
                                            <td className="px-6 py-4 text-right">
                                                <button
                                                    onClick={() => handleCloseTrade(trade.id, trade.instrument)}
                                                    disabled={actionLoadingKey === `trade:${trade.id}`}
                                                    className="text-xs px-2.5 py-1 rounded border border-red-800 text-red-300 hover:bg-red-900/40 disabled:opacity-50"
                                                >
                                                    {actionLoadingKey === `trade:${trade.id}` ? '...' : 'Close'}
                                                </button>
                                            </td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                    </div>
                ) : activeTab === 'orders' && orders.length === 0 ? (
                    <div className="py-16 text-center text-gray-500">
                        <div className="text-4xl mb-3">🧾</div>
                        <p className="text-sm">No pending orders</p>
                    </div>
                ) : activeTab === 'orders' ? (
                    <div className="overflow-x-auto">
                        <table className="w-full text-sm">
                            <thead>
                                <tr className="text-xs text-gray-500 uppercase border-b border-gray-800">
                                    <th className="text-left px-6 py-3">Instrument</th>
                                    <th className="text-left px-6 py-3">Type</th>
                                    <th className="text-right px-6 py-3">Units</th>
                                    <th className="text-right px-6 py-3">Price</th>
                                    <th className="text-left px-6 py-3">Created</th>
                                    <th className="text-right px-6 py-3">Action</th>
                                </tr>
                            </thead>
                            <tbody>
                                {orders.map((order) => (
                                    <tr key={order.id} className="border-b border-gray-800/50 hover:bg-gray-800/30 transition-colors">
                                        <td className="px-6 py-4 font-mono font-semibold text-white">{order.instrument?.replace('_', '/')}</td>
                                        <td className="px-6 py-4 text-gray-300">{order.type}</td>
                                        <td className="px-6 py-4 text-right font-mono text-gray-300">{order.units ? Math.abs(parseFloat(order.units)).toLocaleString() : '—'}</td>
                                        <td className="px-6 py-4 text-right font-mono text-gray-300">{order.price ? parseFloat(order.price).toFixed(5) : 'Market'}</td>
                                        <td className="px-6 py-4 text-gray-500 text-xs">{order.createTime ? new Date(order.createTime).toLocaleString() : '—'}</td>
                                        <td className="px-6 py-4 text-right">
                                            <button
                                                onClick={() => handleCancelOrder(order.id, order.instrument)}
                                                disabled={actionLoadingKey === `order:${order.id}`}
                                                className="text-xs px-2.5 py-1 rounded border border-yellow-700 text-yellow-300 hover:bg-yellow-900/30 disabled:opacity-50"
                                            >
                                                {actionLoadingKey === `order:${order.id}` ? '...' : 'Cancel'}
                                            </button>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                ) : activeTab === 'positions' && positions.length === 0 ? (
                    <div className="py-16 text-center text-gray-500">
                        <div className="text-4xl mb-3">📬</div>
                        <p className="text-sm">{t('noPositions')}</p>
                    </div>
                ) : activeTab === 'positions' ? (
                    <div className="overflow-x-auto">
                        <table className="w-full text-sm">
                            <thead>
                                <tr className="text-xs text-gray-500 uppercase border-b border-gray-800">
                                    <th className="text-left px-6 py-3">Instrument</th>
                                    <th className="text-right px-6 py-3">Long Units</th>
                                    <th className="text-right px-6 py-3">Short Units</th>
                                    <th className="text-right px-6 py-3">Unrealized P&L</th>
                                    <th className="text-right px-6 py-3">Margin Used</th>
                                </tr>
                            </thead>
                            <tbody>
                                {positions.map((position) => (
                                    <tr key={position.instrument} className="border-b border-gray-800/50 hover:bg-gray-800/30 transition-colors">
                                        <td className="px-6 py-4 font-mono font-semibold text-white">{position.instrument.replace('_', '/')}</td>
                                        <td className="px-6 py-4 text-right font-mono text-emerald-400">{position.long?.units || '0'}</td>
                                        <td className="px-6 py-4 text-right font-mono text-red-400">{position.short?.units || '0'}</td>
                                        <td className={`px-6 py-4 text-right font-mono font-semibold ${plColor(position.unrealizedPL || '0')}`}>
                                            {parseFloat(position.unrealizedPL || '0') >= 0 ? '+' : ''}{parseFloat(position.unrealizedPL || '0').toFixed(2)}
                                        </td>
                                        <td className="px-6 py-4 text-right font-mono text-gray-300">{parseFloat(position.marginUsed || '0').toFixed(2)}</td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                ) : activity.length === 0 ? (
                    <div className="py-16 text-center text-gray-500">
                        <div className="text-4xl mb-3">🕘</div>
                        <p className="text-sm">{t('noActivity')}</p>
                    </div>
                ) : (
                    <div className="overflow-x-auto">
                        <table className="w-full text-sm">
                            <thead>
                                <tr className="text-xs text-gray-500 uppercase border-b border-gray-800">
                                    <th className="text-left px-6 py-3">{t('activityEvent')}</th>
                                    <th className="text-left px-6 py-3">{t('activityDetails')}</th>
                                    <th className="text-left px-6 py-3">{t('activityTime')}</th>
                                </tr>
                            </thead>
                            <tbody>
                                {activity.map((item) => (
                                    <tr key={item.id} className="border-b border-gray-800/50 hover:bg-gray-800/30 transition-colors">
                                        <td className="px-6 py-4 text-gray-300">
                                            <span className={`inline-flex items-center text-[10px] px-1.5 py-0.5 rounded border ${badgeClassForOrderType(item.type)}`}>
                                                {orderTypeLabel(item.type)}
                                            </span>
                                            {item.instrument ? (
                                                <span className="ml-2 font-mono font-semibold text-white">{item.instrument.replace('_', '/')}</span>
                                            ) : null}
                                        </td>
                                        <td className="px-6 py-4 text-gray-400">{item.details || '—'}</td>
                                        <td className="px-6 py-4 text-gray-500 text-xs">{item.time ? new Date(item.time).toLocaleString() : '—'}</td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                )}
            </div>
        </div>
    );
}
