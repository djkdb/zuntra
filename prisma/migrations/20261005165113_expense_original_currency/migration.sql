-- AlterTable
ALTER TABLE "Expense" ADD COLUMN     "fxRate" DECIMAL(18,8),
ADD COLUMN     "originalAmount" DECIMAL(12,2),
ADD COLUMN     "originalCurrency" CHAR(3);
