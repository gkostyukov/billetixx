-- AlterTable
ALTER TABLE "Bill" ADD COLUMN     "active" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "balance" DOUBLE PRECISION,
ADD COLUMN     "comment" TEXT,
ADD COLUMN     "dueDayOfMonth" INTEGER,
ADD COLUMN     "fromSource" TEXT,
ADD COLUMN     "fullyPaid" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "minPayment" DOUBLE PRECISION;
