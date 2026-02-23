'use client';

import { useState, useEffect } from 'react';
import TradingChart from '@/components/TradingChart';

export default function TradingDashboard() {
    const [instrument, setInstrument] = useState('EUR_USD');
    const [pricing, setPricing] = useState<any>(null);
    const [aiAnalysis, setAiAnalysis] = useState<string | null>(null);
    const [isAnalyzing, setIsAnalyzing] = useState(false);
    const [error, setError] = useState<string | null>(null);

    // Fetch Pricing
    useEffect(() => {
        const fetchPricing = async () => {
            try {
                const res = await fetch(`/api/oanda/pricing?instruments=${instrument}`);
                const data = await res.json();
                if (data && data.prices && data.prices.length > 0) {
                    setPricing(data.prices[0]);
                }
            } catch (err) {
                console.error('Failed to fetch pricing', err);
            }
        };

        fetchPricing();
        const interval = setInterval(fetchPricing, 5000); // Polling every 5 sec
        return () => clearInterval(interval);
    }, [instrument]);

    const handleAIAnalysis = async () => {
        setIsAnalyzing(true);
        setAiAnalysis(null);
        setError(null);

        try {
            // Re-fetch latest candles for AI Context
            const candlesRes = await fetch(`/api/oanda/candles?instrument=${instrument}&granularity=M15&count=200`);
            const candlesData = await candlesRes.json();

            const aiRes = await fetch('/api/ai/analyze', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    chartData: candlesData.candles,
                    pricing: pricing,
                    instrument,
                    timeframe: 'M15',
                }),
            });

            const aiData = await aiRes.json();
            if (aiData.error) {
                throw new Error(aiData.error);
            }
            setAiAnalysis(aiData.analysis);
        } catch (err: any) {
            setError(err.message);
        } finally {
            setIsAnalyzing(false);
        }
    };

    return (
        <div className="container mx-auto p-4 space-y-6">
            <div className="flex justify-between items-center bg-gray-900 p-4 rounded-lg shadow-md border border-gray-800">
                <div>
                    <h1 className="text-2xl font-bold text-white tracking-tight">Трейдинг: {instrument.replace('_', '/')}</h1>
                    <p className="text-gray-400 text-sm mt-1">Только демо-режим (Practice)</p>
                </div>

                {pricing && (
                    <div className="flex space-x-6 text-right">
                        <div>
                            <p className="text-gray-500 text-xs uppercase font-medium">Bid</p>
                            <p className="text-red-400 font-mono text-xl">{pricing.bids[0]?.price}</p>
                        </div>
                        <div>
                            <p className="text-gray-500 text-xs uppercase font-medium">Ask</p>
                            <p className="text-green-400 font-mono text-xl">{pricing.asks[0]?.price}</p>
                        </div>
                    </div>
                )}
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                <div className="lg:col-span-2">
                    <TradingChart instrument={instrument} />
                </div>

                <div className="bg-gray-900 p-6 rounded-lg shadow-md border border-gray-800 flex flex-col h-full">
                    <h2 className="text-lg font-semibold text-white mb-4 border-b border-gray-700 pb-2 flex items-center">
                        <svg className="w-5 h-5 mr-2 text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 10V3L4 14h7v7l9-11h-7z"></path></svg>
                        ИИ-Аналитик (OpenAI)
                    </h2>

                    <button
                        onClick={handleAIAnalysis}
                        disabled={isAnalyzing}
                        className={`w-full py-3 px-4 rounded-md font-medium text-white shadow-sm transition-colors
              ${isAnalyzing
                                ? 'bg-blue-600/50 cursor-not-allowed'
                                : 'bg-blue-600 hover:bg-blue-700 hover:shadow-lg active:scale-95'
                            }`}
                    >
                        {isAnalyzing ? 'Анализ рынка...' : 'Запросить торговый сценарий'}
                    </button>

                    {error && (
                        <div className="mt-4 p-3 bg-red-900/50 border border-red-800 text-red-200 rounded-md text-sm">
                            Ошибка: {error}
                        </div>
                    )}

                    <div className="flex-1 mt-4 overflow-y-auto">
                        {aiAnalysis ? (
                            <div className="bg-gray-800 p-4 rounded-md text-sm text-gray-200 whitespace-pre-wrap leading-relaxed shadow-inner border border-gray-700 h-full">
                                {aiAnalysis}
                            </div>
                        ) : (
                            <div className="h-full flex flex-col items-center justify-center text-gray-500 space-y-3 py-12">
                                <svg className="w-12 h-12 text-gray-700" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1" d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z"></path></svg>
                                <p className="text-center text-sm px-4">Нажмите кнопку выше, чтобы получить ИИ-сценарий торговли на основе таймфрейма M15.</p>
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
}
