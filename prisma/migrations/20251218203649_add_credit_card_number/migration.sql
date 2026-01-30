/*
  Warnings:

  - You are about to drop the column `currentBalance` on the `CreditCard` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE "CreditCard" DROP COLUMN "currentBalance",
ADD COLUMN     "active" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "apr" DOUBLE PRECISION DEFAULT 0,
ADD COLUMN     "autopay" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "availableCredit" DOUBLE PRECISION DEFAULT 0,
ADD COLUMN     "balance" DOUBLE PRECISION NOT NULL DEFAULT 0,
ADD COLUMN     "minPayment" DOUBLE PRECISION DEFAULT 0,
ADD COLUMN     "nextDueDate" TIMESTAMP(3),
ADD COLUMN     "notes" TEXT,
ADD COLUMN     "number" TEXT,
ADD COLUMN     "rewardsProgram" TEXT,
ADD COLUMN     "statementBalance" DOUBLE PRECISION DEFAULT 0;
