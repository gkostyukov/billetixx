-- AlterTable
ALTER TABLE "CreditCard" ADD COLUMN     "autopayAccountId" TEXT;

-- AddForeignKey
ALTER TABLE "CreditCard" ADD CONSTRAINT "CreditCard_autopayAccountId_fkey" FOREIGN KEY ("autopayAccountId") REFERENCES "BankAccount"("id") ON DELETE SET NULL ON UPDATE CASCADE;
