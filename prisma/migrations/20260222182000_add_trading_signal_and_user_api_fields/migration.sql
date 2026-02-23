ALTER TABLE "User"
ADD COLUMN IF NOT EXISTS "oandaEnvironment" TEXT NOT NULL DEFAULT 'practice',
ADD COLUMN IF NOT EXISTS "oandaPracticeAccountId" TEXT,
ADD COLUMN IF NOT EXISTS "oandaPracticeToken" TEXT,
ADD COLUMN IF NOT EXISTS "oandaLiveAccountId" TEXT,
ADD COLUMN IF NOT EXISTS "oandaLiveToken" TEXT,
ADD COLUMN IF NOT EXISTS "openaiApiKey" TEXT;

CREATE TABLE IF NOT EXISTS "TradeSignal" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "instrument" TEXT NOT NULL,
    "timeframe" TEXT NOT NULL DEFAULT 'M15',
    "action" TEXT NOT NULL,
    "entryPrice" DOUBLE PRECISION,
    "stopLoss" DOUBLE PRECISION,
    "takeProfit" DOUBLE PRECISION,
    "rationale" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'open',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "TradeSignal_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "TradeSignal_userId_createdAt_idx"
ON "TradeSignal"("userId", "createdAt");

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1
        FROM pg_constraint
        WHERE conname = 'TradeSignal_userId_fkey'
    ) THEN
        ALTER TABLE "TradeSignal"
        ADD CONSTRAINT "TradeSignal_userId_fkey"
        FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
    END IF;
END $$;
