'use client';

import { useEffect, useMemo, useState } from 'react';
import { useTranslations } from 'next-intl';

const DEFAULT_WATCHLIST = ['EUR_USD', 'GBP_USD', 'USD_JPY', 'AUD_USD', 'USD_CHF', 'USD_CAD'];

export default function TradingSettingsPage() {
  const t = useTranslations('Settings');

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  const [config, setConfig] = useState<any>(null);

  const watchlist = useMemo(() => {
    const raw = config?.watchlist;
    return Array.isArray(raw) && raw.length ? raw : DEFAULT_WATCHLIST;
  }, [config]);

  useEffect(() => {
    const load = async () => {
      try {
        const res = await fetch('/api/trading/config');
        const data = await res.json();
        if (data?.config) setConfig(data.config);
      } finally {
        setLoading(false);
      }
    };
    load();
  }, []);

  const togglePair = (pair: string) => {
    const set = new Set(watchlist);
    if (set.has(pair)) set.delete(pair);
    else set.add(pair);
    setConfig((prev: any) => ({ ...prev, watchlist: Array.from(set) }));
  };

  const save = async () => {
    setSaving(true);
    setMessage(null);
    try {
      const res = await fetch('/api/trading/config', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(config),
      });
      if (!res.ok) throw new Error('Save failed');
      setMessage('Saved');
      setTimeout(() => setMessage(null), 2500);
    } catch (e: any) {
      setMessage(e?.message || 'Save failed');
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <div className="p-8 text-center text-gray-400">Loading…</div>;

  return (
    <div className="max-w-3xl mx-auto p-6 space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight text-white">Trading / Scanner</h1>
        <p className="text-gray-400 mt-2">Per-user scanner settings. (UI only)</p>
      </div>

      <div className="bg-gray-900 border border-gray-800 rounded-lg p-6 space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm text-gray-300 mb-1">Active Strategy ID</label>
            <input
              value={config?.activeStrategyId || ''}
              onChange={(e) => setConfig((p: any) => ({ ...p, activeStrategyId: e.target.value }))}
              className="w-full bg-gray-950 border border-gray-700 text-white rounded-md p-3"
            />
          </div>
          <div>
            <label className="block text-sm text-gray-300 mb-1">Profile</label>
            <select
              value={config?.activeProfile || 'strict'}
              onChange={(e) => setConfig((p: any) => ({ ...p, activeProfile: e.target.value }))}
              className="w-full bg-gray-950 border border-gray-700 text-white rounded-md p-3"
            >
              <option value="strict">strict</option>
              <option value="soft">soft</option>
            </select>
          </div>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <div>
            <label className="block text-xs text-gray-400 mb-1">fixedUnits</label>
            <input
              type="number"
              value={config?.engine?.fixedUnits ?? 1000}
              onChange={(e) => setConfig((p: any) => ({ ...p, engine: { ...(p?.engine || {}), fixedUnits: Number(e.target.value) } }))}
              className="w-full bg-gray-950 border border-gray-700 text-white rounded-md p-2"
            />
          </div>
          <div>
            <label className="block text-xs text-gray-400 mb-1">riskPerTradeUsd</label>
            <input
              type="number"
              value={config?.engine?.riskPerTradeUsd ?? 10}
              onChange={(e) => setConfig((p: any) => ({ ...p, engine: { ...(p?.engine || {}), riskPerTradeUsd: Number(e.target.value) } }))}
              className="w-full bg-gray-950 border border-gray-700 text-white rounded-md p-2"
            />
          </div>
          <div>
            <label className="block text-xs text-gray-400 mb-1">minRiskReward</label>
            <input
              type="number"
              step="0.1"
              value={config?.engine?.minRiskReward ?? 1.2}
              onChange={(e) => setConfig((p: any) => ({ ...p, engine: { ...(p?.engine || {}), minRiskReward: Number(e.target.value) } }))}
              className="w-full bg-gray-950 border border-gray-700 text-white rounded-md p-2"
            />
          </div>
          <div>
            <label className="block text-xs text-gray-400 mb-1">maxSpreadToSlRatio</label>
            <input
              type="number"
              step="0.1"
              value={config?.engine?.maxSpreadToSlRatio ?? 0.6}
              onChange={(e) => setConfig((p: any) => ({ ...p, engine: { ...(p?.engine || {}), maxSpreadToSlRatio: Number(e.target.value) } }))}
              className="w-full bg-gray-950 border border-gray-700 text-white rounded-md p-2"
            />
          </div>
        </div>

        <div>
          <p className="text-sm text-gray-300 mb-2">Watchlist</p>
          <div className="flex flex-wrap gap-2">
            {Array.from(new Set([...DEFAULT_WATCHLIST, ...(watchlist || [])])).map((pair) => {
              const on = watchlist.includes(pair);
              return (
                <button
                  key={pair}
                  onClick={() => togglePair(pair)}
                  className={`text-xs px-2.5 py-1.5 rounded border ${on ? 'border-emerald-700 bg-emerald-900/30 text-emerald-200' : 'border-gray-700 bg-gray-950 text-gray-300'}`}
                >
                  {pair.replace('_', '/')}
                </button>
              );
            })}
          </div>
        </div>

        <div className="pt-2 flex items-center justify-between">
          <button
            onClick={save}
            disabled={saving}
            className="px-5 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm rounded-md disabled:opacity-50"
          >
            {saving ? '...' : 'Save'}
          </button>
          {message ? <span className="text-sm text-gray-300">{message}</span> : null}
        </div>
      </div>

      <p className="text-xs text-gray-500">
        Note: This page is intentionally minimal. We can add scoring weights + per-strategy profile params next.
      </p>
    </div>
  );
}
