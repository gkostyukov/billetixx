import { NextRequest, NextResponse } from 'next/server';
import OpenAI from 'openai';
import { Prisma } from '@prisma/client';
import { prisma } from '@/lib/prisma';
import { auth } from '@/lib/auth';

type TradeAction = 'BUY' | 'SELL' | 'WAIT';
type StrategyId = 'h1_trend_m15_pullback' | 'breakout_v1' | 'flat_range_v1';

function parsePrice(text: string, pattern: RegExp): number | null {
    const match = text.match(pattern);
    if (!match?.[1]) return null;
    const normalized = String(match[1]).replace(',', '.');
    const parsed = Number(normalized);
    return Number.isFinite(parsed) ? parsed : null;
}

function detectAction(analysis: string): TradeAction {
    if (/(\bBUY\b|\bLONG\b|\bBULLISH\b|ПОКУПКА)/i.test(analysis)) return 'BUY';
    if (/(\bSELL\b|\bSHORT\b|\bBEARISH\b|ПРОДАЖА)/i.test(analysis)) return 'SELL';
    if (/(\bWAIT\b|\bFLAT\b|\bSIDEWAYS\b|ОЖИДАНИЕ|БЕЗ СДЕЛКИ)/i.test(analysis)) return 'WAIT';
    return 'WAIT';
}

function buildModelChain(): string[] {
    const primary = process.env.TRADING_ANALYSIS_MODEL || 'gpt-5';
    const fallbackRaw = process.env.TRADING_ANALYSIS_FALLBACKS || 'gpt-4.1,gpt-4o';
    const fallbacks = fallbackRaw
        .split(',')
        .map((value) => value.trim())
        .filter(Boolean);

    return Array.from(new Set([primary, ...fallbacks]));
}

function detectRecommendedStrategy(analysis: string): { id: StrategyId; reason: string } {
    const text = (analysis || '').toLowerCase();

    if (/(flat|range|sideways|mean reversion|боковик|флэт|флет|диапазон)/i.test(text)) {
        return {
            id: 'flat_range_v1',
            reason: 'Range/flat market context detected in analysis.',
        };
    }

    if (/(breakout|пробой|импульсный пробой)/i.test(text)) {
        return {
            id: 'breakout_v1',
            reason: 'Breakout context detected in analysis.',
        };
    }

    return {
        id: 'h1_trend_m15_pullback',
        reason: 'Trend/pullback context selected as default strategy.',
    };
}

export async function POST(request: NextRequest) {
    const session = await auth();
    if (!session?.user?.id) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const user = await prisma.user.findUnique({
        where: { id: session.user.id },
        select: { openaiApiKey: true }
    });

    const apiKey = user?.openaiApiKey || process.env.OPENAI_API_KEY;

    if (!apiKey) {
        return NextResponse.json({ error: 'Missing OpenAI API Key' }, { status: 403 });
    }

    const openai = new OpenAI({ apiKey });

    try {
        const { chartData, pricing, instrument, timeframe, locale } = await request.json();

        if (!instrument) {
            return NextResponse.json({ error: 'Missing instrument' }, { status: 400 });
        }

        const acceptLanguage = String(request.headers.get('accept-language') || '').toLowerCase();
        const normalizedLocale = String(locale || '').toLowerCase();
        const wantsRussian = normalizedLocale.startsWith('ru')
            ? true
            : normalizedLocale.startsWith('en')
                ? false
                : acceptLanguage.includes('ru');

        const systemPrompt = wantsRussian
            ? `Ты профессиональный AI-ассистент трейдера.
Проанализируй текущую рыночную ситуацию для ${instrument} на таймфрейме ${timeframe}.
Данные свечей и текущие цены предоставлены в формате JSON.
На основе этих данных:
1. Оцени текущий тренд.
2. Найди уровни поддержки и сопротивления.
3. Предложи сценарий: Bullish (Покупка), Bearish (Продажа) или Flat (Ожидание).
4. Укажи обоснование, стоп-лосс (SL) и тейк-профит (TP) при необходимости.
Пиши ответ на русском языке. Ответ должен быть кратким и четким.`
            : `You are a professional trader assistant.
Analyze the current market situation for ${instrument} on timeframe ${timeframe}.
Candles and current prices are provided as JSON.
Based on this data:
1) Assess the current trend.
2) Identify support and resistance.
3) Provide a scenario: Bullish (Buy), Bearish (Sell) or Flat (Wait).
4) Provide reasoning, Stop Loss (SL) and Take Profit (TP) if appropriate.
Write the answer in English. Keep it concise and clear.`;

        if (!Array.isArray(chartData) || chartData.length === 0) {
            return NextResponse.json({ error: 'Missing candle data for analysis' }, { status: 400 });
        }

        const userPrompt = wantsRussian
            ? `Текущие данные рынка:
Pricing: ${JSON.stringify(pricing)}
Candles (последние 10): ${JSON.stringify(chartData.slice(-10))}

Сделай анализ и дай рекомендацию.`
            : `Current market data:
Pricing: ${JSON.stringify(pricing)}
Candles (last 10): ${JSON.stringify(chartData.slice(-10))}

Provide your analysis and recommendation.`;

        const modelChain = buildModelChain();
        let completion: OpenAI.Chat.Completions.ChatCompletion | null = null;
        let modelUsed: string | null = null;
        const modelErrors: string[] = [];

        for (const model of modelChain) {
            try {
                completion = await openai.chat.completions.create({
                    model,
                    messages: [
                        { role: 'system', content: systemPrompt },
                        { role: 'user', content: userPrompt }
                    ],
                    temperature: 0.2,
                    max_tokens: 500,
                });
                modelUsed = model;
                break;
            } catch (modelError: any) {
                const status = modelError?.status;
                const message = modelError?.message || 'unknown model error';
                modelErrors.push(`${model}: ${message}`);

                if (status === 401 || status === 403) {
                    throw modelError;
                }
            }
        }

        if (!completion) {
            throw new Error(`All analysis models failed. ${modelErrors.join(' | ')}`);
        }

        const analysis = completion.choices[0].message.content || 'AI did not return analysis text.';
        const recommendedStrategy = detectRecommendedStrategy(analysis);

        const action = detectAction(analysis);
        const entryPrice = parsePrice(analysis, /(?:entry|вход)\s*[:=\-]?\s*([0-9]+[\.,]?[0-9]*)/i)
            ?? (pricing?.asks?.[0]?.price ? Number(pricing.asks[0].price) : null);
        const stopLoss = parsePrice(analysis, /(?:stop\s*-?\s*loss|\bsl\b|стоп\s*-?\s*лосс)\s*[:=\-]?\s*([0-9]+[\.,]?[0-9]*)/i);
        const takeProfit = parsePrice(analysis, /(?:take\s*-?\s*profit|\btp\b|тейк\s*-?\s*профит)\s*[:=\-]?\s*([0-9]+[\.,]?[0-9]*)/i);

        const signal = await prisma.tradeSignal.create({
            data: {
                userId: session.user.id,
                instrument,
                timeframe: timeframe || 'M15',
                action,
                entryPrice,
                stopLoss,
                takeProfit,
                rationale: analysis,
                status: 'open',
            },
        });

        const recommendedOrders = action === 'WAIT'
            ? []
            : [{
                signalId: signal.id,
                instrument: signal.instrument,
                action: signal.action,
                entryPrice: signal.entryPrice,
                stopLoss: signal.stopLoss,
                takeProfit: signal.takeProfit,
                timeframe: signal.timeframe,
            }];

        return NextResponse.json({
            analysis,
            signal,
            recommendedOrders,
            modelUsed,
            recommendedStrategyId: recommendedStrategy.id,
            recommendedStrategyReason: recommendedStrategy.reason,
        });
    } catch (error: any) {
        console.error('OpenAI Analysis Error:', error?.message || error);

        if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2021') {
            return NextResponse.json(
                { error: 'Database is missing required trading tables. Run: npx prisma db push' },
                { status: 500 }
            );
        }

        if (error?.status === 401 || error?.status === 403) {
            return NextResponse.json(
                { error: 'OpenAI API key is invalid or has insufficient permissions for analysis models' },
                { status: 403 }
            );
        }

        return NextResponse.json(
            { error: `Failed to generate AI analysis: ${error?.message || 'unknown error'}` },
            { status: 500 }
        );
    }
}
