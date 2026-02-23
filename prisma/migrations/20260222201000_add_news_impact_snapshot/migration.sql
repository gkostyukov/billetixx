CREATE TABLE IF NOT EXISTS "NewsImpactSnapshot" (
    "id" TEXT NOT NULL,
    "instrument" TEXT NOT NULL,
    "timeframe" TEXT NOT NULL DEFAULT 'M15',
    "upsideProbability" INTEGER NOT NULL,
    "downsideProbability" INTEGER NOT NULL,
    "reversalRisk" INTEGER NOT NULL,
    "marketBias" TEXT NOT NULL,
    "summary" TEXT NOT NULL,
    "headlinesJson" TEXT NOT NULL,
    "generatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "NewsImpactSnapshot_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "NewsImpactSnapshot_instrument_timeframe_expiresAt_idx"
ON "NewsImpactSnapshot"("instrument", "timeframe", "expiresAt");
