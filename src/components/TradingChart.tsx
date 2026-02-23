'use client';

import { useEffect, useRef, useState } from 'react';
import { createChart, ColorType, IChartApi, ISeriesApi } from 'lightweight-charts';

interface TradingChartProps {
    instrument: string;
}

export default function TradingChart({ instrument }: TradingChartProps) {
    const chartContainerRef = useRef<HTMLDivElement>(null);
    const chartRef = useRef<IChartApi | null>(null);
    const seriesRef = useRef<ISeriesApi<"Candlestick"> | null>(null);

    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        if (!chartContainerRef.current) return;

        const handleResize = () => {
            chartRef.current?.applyOptions({ width: chartContainerRef.current?.clientWidth });
        };

        const chart = createChart(chartContainerRef.current, {
            layout: {
                background: { type: ColorType.Solid, color: '#1A1A1A' },
                textColor: '#D9D9D9',
            },
            grid: {
                vertLines: { color: '#2B2B2B' },
                horzLines: { color: '#2B2B2B' },
            },
            width: chartContainerRef.current.clientWidth,
            height: 400,
            timeScale: {
                timeVisible: true,
                secondsVisible: false,
            },
        });

        chartRef.current = chart;
        const candlestickSeries = chart.addCandlestickSeries({
            upColor: '#26a69a',
            downColor: '#ef5350',
            borderVisible: false,
            wickUpColor: '#26a69a',
            wickDownColor: '#ef5350',
        });
        seriesRef.current = candlestickSeries;

        window.addEventListener('resize', handleResize);

        const fetchCandles = async () => {
            try {
                setLoading(true);
                const res = await fetch(`/api/oanda/candles?instrument=${instrument}&granularity=M15&count=200`);
                if (!res.ok) {
                    const errorText = await res.text();
                    throw new Error(`HTTP ${res.status}: ${errorText}`);
                }

                const text = await res.text();
                let data;
                try {
                    data = JSON.parse(text);
                } catch (e) {
                    throw new Error(`Invalid JSON: ${text}`);
                }

                // Transform Oanda data to lightweight-charts format
                const formattedData = data.candles
                    .filter((c: any) => c.complete)
                    .map((c: any) => ({
                        time: new Date(c.time).getTime() / 1000,
                        open: parseFloat(c.mid.o),
                        high: parseFloat(c.mid.h),
                        low: parseFloat(c.mid.l),
                        close: parseFloat(c.mid.c),
                    }));

                candlestickSeries.setData(formattedData);
                setError(null);
            } catch (err: any) {
                setError(err.message);
            } finally {
                setLoading(false);
            }
        };

        fetchCandles();

        return () => {
            window.removeEventListener('resize', handleResize);
            chart.remove();
        };
    }, [instrument]);

    return (
        <div className="relative w-full border border-gray-700 rounded-lg overflow-hidden shadow-lg">
            <div
                ref={chartContainerRef}
                className="w-full"
            />
            {loading && (
                <div className="absolute inset-0 flex items-center justify-center bg-black/50 text-white">
                    Загрузка графика...
                </div>
            )}
            {error && (
                <div className="absolute inset-0 flex items-center justify-center bg-black/80 text-red-500">
                    Ошибка: {error}
                </div>
            )}
        </div>
    );
}
