import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

type HeadlineItem = {
    title: string;
    link: string;
    pubDate: string;
};

const POSITIVE_WORDS = [
    'rally', 'surge', 'rise', 'strong', 'beat', 'growth', 'hawkish', 'cooling inflation', 'rate cut optimism',
];

const NEGATIVE_WORDS = [
    'drop', 'fall', 'weak', 'miss', 'recession', 'selloff', 'dovish', 'hot inflation', 'rate hike risk',
];

const HIGH_IMPACT_WORDS = [
    'cpi', 'inflation', 'nfp', 'payrolls', 'rate decision', 'fed', 'ecb', 'boj', 'boe', 'fomc', 'gdp', 'pmi',
];

function clamp(value: number, min: number, max: number): number {
    return Math.min(max, Math.max(min, value));
}

function getTtlMinutes(timeframe: string): number {
    const tf = timeframe.toUpperCase();
    if (tf === 'M1' || tf === 'M5') return 10;
    if (tf === 'M15' || tf === 'M30') return 20;
    if (tf === 'H1' || tf === 'H4') return 45;
    return 60;
}

function instrumentToSearchTerms(instrument: string): string[] {
    const [base, quote] = instrument.split('_');
    return [
        `${base} ${quote} forex`,
        `${base} ${quote} central bank`,
    ];
}

function extractTagValue(itemXml: string, tag: string): string {
    const regex = new RegExp(`<${tag}>([\\s\\S]*?)</${tag}>`, 'i');
    const match = itemXml.match(regex);
    return match?.[1]?.trim() || '';
}

function parseRssItems(xml: string): HeadlineItem[] {
    const itemMatches = xml.match(/<item>[\s\S]*?<\/item>/gi) || [];
    return itemMatches
        .map((itemXml) => ({
            title: extractTagValue(itemXml, 'title').replace(/<!\[CDATA\[|\]\]>/g, ''),
            link: extractTagValue(itemXml, 'link'),
            pubDate: extractTagValue(itemXml, 'pubDate'),
        }))
        .filter((item) => item.title);
}

async function fetchGoogleNewsRss(query: string): Promise<HeadlineItem[]> {
    const url = `https://news.google.com/rss/search?q=${encodeURIComponent(query)}&hl=en-US&gl=US&ceid=US:en`;
    const response = await fetch(url, { next: { revalidate: 0 } });
    if (!response.ok) return [];
    const xml = await response.text();
    return parseRssItems(xml);
}

function analyzeHeadlines(headlines: HeadlineItem[]) {
    const now = Date.now();

    let positive = 0;
    let negative = 0;
    let highImpactCount = 0;

    for (const item of headlines) {
        const titleLower = item.title.toLowerCase();
        const pubTs = item.pubDate ? new Date(item.pubDate).getTime() : now;
        const hoursAgo = Math.max(0, (now - pubTs) / (1000 * 60 * 60));
        const recencyWeight = 1 / (1 + hoursAgo / 8);

        const posHits = POSITIVE_WORDS.filter((word) => titleLower.includes(word)).length;
        const negHits = NEGATIVE_WORDS.filter((word) => titleLower.includes(word)).length;
        const impactHits = HIGH_IMPACT_WORDS.filter((word) => titleLower.includes(word)).length;

        positive += posHits * recencyWeight;
        negative += negHits * recencyWeight;
        highImpactCount += impactHits;
    }

    const totalSentiment = positive + negative;
    const sentimentBalance = totalSentiment === 0 ? 0 : (positive - negative) / totalSentiment;
    const confidence = clamp(totalSentiment / 6, 0, 1);

    const upside = clamp(Math.round(50 + sentimentBalance * 30 * (0.5 + confidence)), 5, 95);
    const downside = 100 - upside;

    const mixedSignalPenalty = totalSentiment > 0
        ? Math.min(25, Math.round((Math.min(positive, negative) / totalSentiment) * 40))
        : 10;
    const impactPenalty = Math.min(20, highImpactCount * 2);
    const reversalRisk = clamp(20 + mixedSignalPenalty + impactPenalty, 5, 95);

    let marketBias = 'NEUTRAL';
    if (upside >= 58) marketBias = 'BULLISH';
    if (downside >= 58) marketBias = 'BEARISH';

    const summary =
        marketBias === 'BULLISH'
            ? 'Новостной фон умеренно позитивный: выше вероятность роста, но сохраняется риск резкого отката.'
            : marketBias === 'BEARISH'
                ? 'Новостной фон умеренно негативный: выше вероятность снижения, учитывайте риск обратного движения.'
                : 'Новостной фон смешанный: направленного преимущества нет, риск разворота повышен.';

    return {
        upsideProbability: upside,
        downsideProbability: downside,
        reversalRisk,
        marketBias,
        summary,
    };
}

export async function GET(request: NextRequest) {
    try {
        const session = await auth();
        if (!session?.user?.id) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const searchParams = request.nextUrl.searchParams;
        const instrument = (searchParams.get('instrument') || 'EUR_USD').toUpperCase();
        const timeframe = (searchParams.get('timeframe') || 'M15').toUpperCase();
        const forceRefresh = searchParams.get('refresh') === 'true';
        const now = new Date();

        if (!forceRefresh) {
            const cached = await prisma.newsImpactSnapshot.findFirst({
                where: {
                    instrument,
                    timeframe,
                    expiresAt: { gt: now },
                },
                orderBy: { generatedAt: 'desc' },
            });

            if (cached) {
                return NextResponse.json({
                    instrument,
                    timeframe,
                    cached: true,
                    generatedAt: cached.generatedAt,
                    expiresAt: cached.expiresAt,
                    upsideProbability: cached.upsideProbability,
                    downsideProbability: cached.downsideProbability,
                    reversalRisk: cached.reversalRisk,
                    marketBias: cached.marketBias,
                    summary: cached.summary,
                    headlines: JSON.parse(cached.headlinesJson),
                });
            }
        }

        const queries = instrumentToSearchTerms(instrument);
        const headlineResults = await Promise.all(queries.map((query) => fetchGoogleNewsRss(query)));
        const merged = headlineResults.flat();

        const dedupedHeadlines = Array.from(new Map(merged.map((item) => [item.title, item])).values()).slice(0, 20);
        const analytics = analyzeHeadlines(dedupedHeadlines);

        const ttlMinutes = getTtlMinutes(timeframe);
        const expiresAt = new Date(Date.now() + ttlMinutes * 60 * 1000);

        const snapshot = await prisma.newsImpactSnapshot.create({
            data: {
                instrument,
                timeframe,
                upsideProbability: analytics.upsideProbability,
                downsideProbability: analytics.downsideProbability,
                reversalRisk: analytics.reversalRisk,
                marketBias: analytics.marketBias,
                summary: analytics.summary,
                headlinesJson: JSON.stringify(dedupedHeadlines),
                generatedAt: now,
                expiresAt,
            },
        });

        return NextResponse.json({
            instrument,
            timeframe,
            cached: false,
            generatedAt: snapshot.generatedAt,
            expiresAt: snapshot.expiresAt,
            upsideProbability: snapshot.upsideProbability,
            downsideProbability: snapshot.downsideProbability,
            reversalRisk: snapshot.reversalRisk,
            marketBias: snapshot.marketBias,
            summary: snapshot.summary,
            headlines: dedupedHeadlines,
        });
    } catch (error: any) {
        console.error('News Impact Route Error:', error?.message || error);
        return NextResponse.json(
            { error: 'Failed to build news impact analytics' },
            { status: 500 }
        );
    }
}
