-- AlterTable
ALTER TABLE "ClientView" ADD COLUMN     "clientEmail" TEXT,
ADD COLUMN     "reminderSentAt" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "User" ADD COLUMN     "phone" TEXT;
