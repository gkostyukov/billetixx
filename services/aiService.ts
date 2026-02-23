import OpenAI from 'openai';
import path from 'path';
import { promises as fs } from 'fs';
import { MODEL_CONFIG } from '../config/models';
import type { StructuredMarketData, AiTradeDecision } from './types';

const SYSTEM_PROMPT = `You are a professional intraday forex analyst.
Follow these strict rules:
1. Trade only in direction of H1 trend.
2. Do not trade against strong impulsive moves.
3. Minimum Risk:Reward = 1.5.
4. Never enter directly into resistance/support.
5. If market structure is unclear, return: NO_TRADE.
Return structured JSON only:
{
  "decision": "BUY" | "SELL" | "NO_TRADE",
  "entry": number,
  "stop_loss": number,
  "take_profit": number,
  "reasoning": string
}`;

function safeParseJson(content: string): any {
  const trimmed = content.trim();
  const withoutFence = trimmed
    .replace(/^```json\s*/i, '')
    .replace(/^```\s*/i, '')
    .replace(/```$/i, '')
    .trim();

  return JSON.parse(withoutFence);
}

function noTrade(reasoning: string): AiTradeDecision {
  return {
    decision: 'NO_TRADE',
    entry: 0,
    stop_loss: 0,
    take_profit: 0,
    reasoning,
  };
}

async function appendDecisionLog(payload: Record<string, unknown>) {
  try {
    const logsDir = path.join(process.cwd(), 'logs');
    const filePath = path.join(logsDir, 'ai-decisions.log');
    await fs.mkdir(logsDir, { recursive: true });
    await fs.appendFile(filePath, `${JSON.stringify(payload)}\n`, 'utf-8');
  } catch (error) {
    console.error('Failed to append AI decision log:', error);
  }
}

function buildModelChain(): string[] {
  const primary = process.env.TRADING_ANALYSIS_MODEL || MODEL_CONFIG.analysisModel || 'gpt-5';
  const fallbackRaw = process.env.TRADING_ANALYSIS_FALLBACKS || 'gpt-4.1,gpt-4o';
  const fallbacks = fallbackRaw
    .split(',')
    .map((value) => value.trim())
    .filter(Boolean);

  return Array.from(new Set([primary, ...fallbacks]));
}

export async function requestTradeDecision(structuredData: StructuredMarketData): Promise<AiTradeDecision> {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    const decision = noTrade('OPENAI_API_KEY is missing. Defaulting to NO_TRADE.');
    await appendDecisionLog({ ts: new Date().toISOString(), model: MODEL_CONFIG.analysisModel, structuredData, decision });
    return decision;
  }

  const openai = new OpenAI({ apiKey });

  let decision: AiTradeDecision = noTrade('Model response malformed. Defaulting to NO_TRADE.');

  try {
    const modelChain = buildModelChain();
    let completion: OpenAI.Chat.Completions.ChatCompletion | null = null;
    let modelUsed: string | null = null;
    const modelErrors: string[] = [];

    for (const model of modelChain) {
      try {
        completion = await openai.chat.completions.create({
          model,
          temperature: 0.1,
          messages: [
            { role: 'system', content: SYSTEM_PROMPT },
            { role: 'user', content: JSON.stringify(structuredData) },
          ],
          max_tokens: 400,
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

    const raw = completion.choices[0]?.message?.content || '';
    const parsed = safeParseJson(raw);

    const parsedDecision = String(parsed?.decision || '').toUpperCase();
    const entry = Number(parsed?.entry || 0);
    const stopLoss = Number(parsed?.stop_loss || 0);
    const takeProfit = Number(parsed?.take_profit || 0);
    const reasoning = String(parsed?.reasoning || '').trim();

    if (!['BUY', 'SELL', 'NO_TRADE'].includes(parsedDecision)) {
      decision = noTrade('Invalid decision field from model.');
    } else if (parsedDecision === 'NO_TRADE') {
      decision = noTrade(reasoning || 'Model returned NO_TRADE.');
    } else if (!Number.isFinite(entry) || !Number.isFinite(stopLoss) || !Number.isFinite(takeProfit) || !reasoning) {
      decision = noTrade('Missing numeric fields or reasoning.');
    } else if (reasoning.length < 12) {
      decision = noTrade('Confidence unclear from reasoning.');
    } else {
      decision = {
        decision: parsedDecision as 'BUY' | 'SELL',
        entry,
        stop_loss: stopLoss,
        take_profit: takeProfit,
        reasoning,
      };
    }
    await appendDecisionLog({
      ts: new Date().toISOString(),
      event: 'analysis_model_used',
      model: modelUsed,
      pair: structuredData.pair,
    });
  } catch (error: any) {
    console.error('AI decision error:', error);
    decision = noTrade(`AI call failed. ${error?.message || 'Defaulting to NO_TRADE.'}`);
  }

  await appendDecisionLog({
    ts: new Date().toISOString(),
    model: MODEL_CONFIG.analysisModel,
    pair: structuredData.pair,
    decision,
    structuredData,
  });

  return decision;
}
