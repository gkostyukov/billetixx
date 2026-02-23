import { PrismaClient } from '@prisma/client'
import bcrypt from 'bcryptjs'

const prisma = new PrismaClient()

async function main() {
  const hashedPassword = await bcrypt.hash('demo123', 10)

  // Upsert demo user with OANDA practice credentials
  const user = await prisma.user.upsert({
    where: { email: 'demo@billetixx.com' },
    update: {
      oandaEnvironment: 'practice',
      oandaPracticeAccountId: process.env.OANDA_ACCOUNT_ID || '101-001-38594761-001',
      oandaPracticeToken: process.env.OANDA_PRACTICE_TOKEN || '5b32850a33ebe2688a2521d1f50fd0d8-0f5cea5c42703c78353aaf1956d060be',
    },
    create: {
      email: 'demo@billetixx.com',
      name: 'Demo User',
      password: hashedPassword,
      oandaEnvironment: 'practice',
      oandaPracticeAccountId: process.env.OANDA_ACCOUNT_ID || '101-001-38594761-001',
      oandaPracticeToken: process.env.OANDA_PRACTICE_TOKEN || '5b32850a33ebe2688a2521d1f50fd0d8-0f5cea5c42703c78353aaf1956d060be',
    },
  })

  console.log('Demo user ready:', user.email)

  // Seed sample trade signals for the demo user
  await prisma.tradeSignal.createMany({
    data: [
      {
        userId: user.id,
        instrument: 'EUR_USD',
        timeframe: 'M15',
        action: 'BUY',
        entryPrice: 1.0845,
        stopLoss: 1.0810,
        takeProfit: 1.0920,
        rationale: 'Bullish engulfing pattern on M15. RSI recovering from oversold territory (28→42). Strong support at 1.0840. Risk/reward 1:2.1. Recommend BUY on next candle open with tight stop below support.',
        status: 'open',
      },
      {
        userId: user.id,
        instrument: 'GBP_USD',
        timeframe: 'M15',
        action: 'SELL',
        entryPrice: 1.2670,
        stopLoss: 1.2700,
        takeProfit: 1.2600,
        rationale: 'Double top formation confirmed at 1.2680 resistance. MACD bearish crossover. Momentum weak. Recommend SELL with stop above recent high. Target previous support at 1.2600.',
        status: 'closed',
      },
      {
        userId: user.id,
        instrument: 'USD_JPY',
        timeframe: 'M15',
        action: 'WAIT',
        entryPrice: null,
        stopLoss: null,
        takeProfit: null,
        rationale: 'Price consolidating inside 148.20–148.80 range. No clear directional bias. Recommend waiting for breakout confirmation before entering. Watch for news catalyst.',
        status: 'cancelled',
      },
    ],
  })

  console.log('Seed data created successfully!')
}

main()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
