'use client';

import { useState, useEffect } from 'react';
import { useTranslations } from 'next-intl';
import { useRouter } from '@/i18n/routing';

interface SignalOrderLink {
    id: string;
    status: string;
    createdAt: string;
}

interface TradeSignal {
    id: string;
    instrument: string;
    timeframe: string;
    action: string;
    entryPrice: number | null;
    stopLoss: number | null;
    takeProfit: number | null;
    rationale: string;
    status: string;
    createdAt: string;
    orderLinks?: SignalOrderLink[];
}

const ACTION_COLORS: Record<string, string> = {
    BUY: 'bg-emerald-900/50 text-emerald-400 border-emerald-800',
    SELL: 'bg-red-900/50 text-red-400 border-red-800',
    WAIT: 'bg-yellow-900/50 text-yellow-400 border-yellow-800',
};

const STATUS_COLORS: Record<string, string> = {
    open: 'text-blue-400',
    closed: 'text-gray-500',
    cancelled: 'text-gray-600',
};

export default function AnalyticsPage() {
    const t = useTranslations('Analytics');
    const router = useRouter();
    const [signals, setSignals] = useState<TradeSignal[]>([]);
    const [selected, setSelected] = useState<TradeSignal | null>(null);
    const searchParams = typeof window !== 'undefined' ? new URLSearchParams(window.location.search) : null;
    const preselectSignalId = searchParams?.get('signalId');
    const [loading, setLoading] = useState(true);
    const [filterAction, setFilterAction] = useState<string>('ALL');
    const [filterStatus, setFilterStatus] = useState<string>('ALL');

    const fetchSignals = async () => {
        try {
            const res = await fetch('/api/signals');
            const data = await res.json();
            if (data.signals) setSignals(data.signals);
        } catch (err) {
            console.error('Failed to fetch signals', err);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => { fetchSignals(); }, []);

    useEffect(() => {
        if (!preselectSignalId || signals.length === 0) return;
        const hit = signals.find((s) => s.id === preselectSignalId);
        if (hit) setSelected(hit);
    }, [preselectSignalId, signals]);

    const filtered = signals.filter(s => {
        if (filterAction !== 'ALL' && s.action !== filterAction) return false;
        if (filterStatus !== 'ALL' && s.status !== filterStatus) return false;
        return true;
    });

    const updateStatus = async (id: string, status: string) => {
        await fetch('/api/signals', {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ id, status }),
        });
        fetchSignals();
        setSelected(prev => prev?.id === id ? { ...prev, status } : prev);
    };

    return (
        <div className="container mx-auto p-4 space-y-6">
            {/* Header */}
            <div className="flex items-center justify-between flex-wrap gap-4">
                <div>
                    <h1 className="text-2xl font-bold text-white">{t('title')}</h1>
                    <p className="text-gray-400 text-sm mt-1">{t('subtitle')}</p>
                </div>
                <button
                    onClick={() => router.push('/trading')}
                    className="bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold px-4 py-2 rounded-lg transition-colors flex items-center gap-2">
                    <span>⚡</span> {t('newAnalysis')}
                </button>
            </div>

            {/* Filters */}
            <div className="flex flex-wrap gap-3">
                <div className="flex gap-1 bg-gray-900 border border-gray-800 rounded-lg p-1">
                    {['ALL', 'BUY', 'SELL', 'WAIT'].map(a => (
                        <button key={a} onClick={() => setFilterAction(a)}
                            className={`text-xs font-medium px-3 py-1.5 rounded-md transition-colors ${filterAction === a ? 'bg-gray-700 text-white' : 'text-gray-400 hover:text-white'}`}>
                            {a}
                        </button>
                    ))}
                </div>
                <div className="flex gap-1 bg-gray-900 border border-gray-800 rounded-lg p-1">
                    {['ALL', 'open', 'closed', 'cancelled'].map(s => (
                        <button key={s} onClick={() => setFilterStatus(s)}
                            className={`text-xs font-medium px-3 py-1.5 rounded-md transition-colors capitalize ${filterStatus === s ? 'bg-gray-700 text-white' : 'text-gray-400 hover:text-white'}`}>
                            {s}
                        </button>
                    ))}
                </div>
            </div>

            {/* Signal Cards Grid */}
            {loading ? (
                <div className="flex items-center justify-center py-20">
                    <div className="w-8 h-8 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
                </div>
            ) : filtered.length === 0 ? (
                <div className="text-center py-20 text-gray-500">
                    <div className="text-4xl mb-3">🔍</div>
                    <p className="text-sm">{t('noSignals')}</p>
                </div>
            ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
                    {filtered.map(signal => (
                        <div key={signal.id}
                            onClick={() => setSelected(signal)}
                            className={`bg-gray-900 border rounded-xl p-5 cursor-pointer hover:border-blue-700 hover:bg-gray-800/60 transition-all group ${
                                (signal.orderLinks?.length || 0) > 0 ? 'border-emerald-700/60' : 'border-gray-800'
                            }`}>
                            {/* Card Header */}
                            <div className="flex items-center justify-between mb-3">
                                <span className="font-mono font-bold text-white text-lg">
                                    {signal.instrument.replace('_', '/')}
                                </span>
                                <div className="flex items-center gap-2">
                                    <span className={`text-xs font-bold px-2 py-1 rounded-full border ${ACTION_COLORS[signal.action] || 'bg-gray-700 text-gray-300 border-gray-600'}`}>
                                        {signal.action === 'BUY' ? '▲' : signal.action === 'SELL' ? '▼' : '⏸'} {signal.action}
                                    </span>
                                    <span className={`text-xs capitalize ${STATUS_COLORS[signal.status] || 'text-gray-400'}`}>
                                        ● {signal.status}
                                    </span>
                                </div>
                            </div>

                            {/* Price Levels */}
                            <div className="grid grid-cols-3 gap-2 mb-3 text-xs">
                                <div className="bg-gray-800 rounded-lg p-2 text-center">
                                    <p className="text-gray-500 mb-1">{t('entry')}</p>
                                    <p className="font-mono text-white">{signal.entryPrice?.toFixed(5) ?? '–'}</p>
                                </div>
                                <div className="bg-gray-800 rounded-lg p-2 text-center">
                                    <p className="text-red-500 mb-1">{t('stopLoss')}</p>
                                    <p className="font-mono text-red-400">{signal.stopLoss?.toFixed(5) ?? '–'}</p>
                                </div>
                                <div className="bg-gray-800 rounded-lg p-2 text-center">
                                    <p className="text-emerald-500 mb-1">{t('takeProfit')}</p>
                                    <p className="font-mono text-emerald-400">{signal.takeProfit?.toFixed(5) ?? '–'}</p>
                                </div>
                            </div>

                            {/* Rationale Preview */}
                            <p className="text-gray-400 text-xs leading-relaxed line-clamp-2 mb-3">
                                {signal.rationale}
                            </p>

                            {/* Footer */}
                            <div className="flex items-center justify-between text-xs text-gray-600">
                                <span>{signal.timeframe}</span>
                                <span>{new Date(signal.createdAt).toLocaleString()}</span>
                            </div>

                            {(signal.orderLinks?.length || 0) > 0 && (
                                <div className="mt-2 text-[11px] text-emerald-400">
                                    Orders: {signal.orderLinks?.length}
                                </div>
                            )}

                            <div className="mt-3 text-xs text-blue-500 opacity-0 group-hover:opacity-100 transition-opacity">
                                {t('clickToExpand')} →
                            </div>
                        </div>
                    ))}
                </div>
            )}

            {/* Detail Modal */}
            {selected && (
                <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-4"
                    onClick={() => setSelected(null)}>
                    <div className="bg-gray-900 border border-gray-700 rounded-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto shadow-2xl"
                        onClick={e => e.stopPropagation()}>
                        {/* Modal Header */}
                        <div className="flex items-center justify-between p-6 border-b border-gray-800">
                            <div className="flex items-center gap-3">
                                <span className="font-mono font-bold text-white text-xl">
                                    {selected.instrument.replace('_', '/')}
                                </span>
                                <span className={`text-sm font-bold px-3 py-1 rounded-full border ${ACTION_COLORS[selected.action] || ''}`}>
                                    {selected.action === 'BUY' ? '▲' : selected.action === 'SELL' ? '▼' : '⏸'} {selected.action}
                                </span>
                                <span className="text-xs text-gray-500 bg-gray-800 px-2 py-1 rounded">{selected.timeframe}</span>
                            </div>
                            <button onClick={() => setSelected(null)}
                                className="text-gray-500 hover:text-white text-xl leading-none">✕</button>
                        </div>

                        {/* Price Levels */}
                        <div className="grid grid-cols-3 gap-4 p-6 border-b border-gray-800">
                            <div className="text-center">
                                <p className="text-xs text-gray-500 uppercase mb-1">{t('entry')}</p>
                                <p className="font-mono text-white text-lg">{selected.entryPrice?.toFixed(5) ?? '–'}</p>
                            </div>
                            <div className="text-center">
                                <p className="text-xs text-red-500 uppercase mb-1">{t('stopLoss')}</p>
                                <p className="font-mono text-red-400 text-lg">{selected.stopLoss?.toFixed(5) ?? '–'}</p>
                            </div>
                            <div className="text-center">
                                <p className="text-xs text-emerald-500 uppercase mb-1">{t('takeProfit')}</p>
                                <p className="font-mono text-emerald-400 text-lg">{selected.takeProfit?.toFixed(5) ?? '–'}</p>
                            </div>
                        </div>

                        {/* Full Rationale */}
                        <div className="p-6">
                            <h3 className="text-sm font-semibold text-gray-300 mb-3 uppercase tracking-wide">{t('rationale')}</h3>
                            <div className="bg-gray-800 rounded-xl p-4 text-sm text-gray-200 leading-relaxed whitespace-pre-wrap border border-gray-700">
                                {selected.rationale}
                            </div>
                        </div>

                        {/* Status Controls */}
                        <div className="p-6 border-t border-gray-800 flex items-center gap-3 flex-wrap">
                            <button
                                onClick={() => router.push(`/trading?signalId=${selected.id}`)}
                                className="text-xs font-medium px-3 py-1.5 rounded-lg border border-emerald-700 bg-emerald-900/30 text-emerald-300 hover:bg-emerald-900/50"
                            >
                                {t('tradeThisTicket')}
                            </button>
                            <span className="text-xs text-gray-500">{t('updateStatus')}:</span>
                            {['open', 'closed', 'cancelled'].map(s => (
                                <button key={s} onClick={() => updateStatus(selected.id, s)}
                                    className={`text-xs font-medium px-3 py-1.5 rounded-lg border transition-colors capitalize ${selected.status === s
                                        ? 'border-blue-600 bg-blue-900/40 text-blue-300'
                                        : 'border-gray-700 bg-gray-800 text-gray-400 hover:border-gray-500'
                                        }`}>
                                    {s}
                                </button>
                            ))}
                            <span className="ml-auto text-xs text-gray-600">
                                {new Date(selected.createdAt).toLocaleString()}
                            </span>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
