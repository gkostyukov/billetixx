/*
  Warnings:

  - You are about to drop the column `method` on the `Payment` table. All the data in the column will be lost.
  - You are about to drop the column `paymentDate` on the `Payment` table. All the data in the column will be lost.
  - You are about to drop the column `title` on the `Payment` table. All the data in the column will be lost.
  - Made the column `description` on table `Payment` required. This step will fail if there are existing NULL values in that column.

*/
-- AlterTable
ALTER TABLE "Payment" DROP COLUMN "method",
DROP COLUMN "paymentDate",
DROP COLUMN "title",
ADD COLUMN     "active" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "autopay" BOOLEAN DEFAULT false,
ADD COLUMN     "balance" DOUBLE PRECISION DEFAULT 0,
ADD COLUMN     "billId" TEXT,
ADD COLUMN     "comment" TEXT,
ADD COLUMN     "dueDate" TIMESTAMP(3),
ADD COLUMN     "fromSource" TEXT,
ADD COLUMN     "isIncome" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "minPayment" DOUBLE PRECISION DEFAULT 0,
ADD COLUMN     "paid" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "sourceRefId" TEXT,
ADD COLUMN     "sourceType" TEXT,
ALTER COLUMN "amount" SET DEFAULT 0,
ALTER COLUMN "description" SET NOT NULL,
ALTER COLUMN "description" SET DEFAULT '';
