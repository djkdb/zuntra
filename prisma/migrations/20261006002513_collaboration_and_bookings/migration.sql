-- AlterTable
ALTER TABLE "Day" ADD COLUMN     "city" TEXT,
ADD COLUMN     "cityLat" DOUBLE PRECISION,
ADD COLUMN     "cityLng" DOUBLE PRECISION;

-- AlterTable
ALTER TABLE "Expense" ADD COLUMN     "paidById" TEXT;

-- AlterTable
ALTER TABLE "ItineraryItem" ADD COLUMN     "bookingRef" TEXT,
ADD COLUMN     "isFixed" BOOLEAN NOT NULL DEFAULT false;

-- CreateTable
CREATE TABLE "TripInvite" (
    "id" TEXT NOT NULL,
    "tripId" TEXT NOT NULL,
    "token" TEXT NOT NULL,
    "role" "TripMemberRole" NOT NULL DEFAULT 'EDITOR',
    "createdById" TEXT,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "revokedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TripInvite_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TripParticipant" (
    "id" TEXT NOT NULL,
    "tripId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "userId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TripParticipant_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ExpenseShare" (
    "expenseId" TEXT NOT NULL,
    "participantId" TEXT NOT NULL,

    CONSTRAINT "ExpenseShare_pkey" PRIMARY KEY ("expenseId","participantId")
);

-- CreateIndex
CREATE UNIQUE INDEX "TripInvite_token_key" ON "TripInvite"("token");

-- CreateIndex
CREATE INDEX "TripInvite_tripId_idx" ON "TripInvite"("tripId");

-- CreateIndex
CREATE INDEX "TripParticipant_tripId_idx" ON "TripParticipant"("tripId");

-- CreateIndex
CREATE UNIQUE INDEX "TripParticipant_tripId_userId_key" ON "TripParticipant"("tripId", "userId");

-- CreateIndex
CREATE INDEX "ExpenseShare_participantId_idx" ON "ExpenseShare"("participantId");

-- AddForeignKey
ALTER TABLE "TripInvite" ADD CONSTRAINT "TripInvite_tripId_fkey" FOREIGN KEY ("tripId") REFERENCES "Trip"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TripInvite" ADD CONSTRAINT "TripInvite_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TripParticipant" ADD CONSTRAINT "TripParticipant_tripId_fkey" FOREIGN KEY ("tripId") REFERENCES "Trip"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TripParticipant" ADD CONSTRAINT "TripParticipant_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ExpenseShare" ADD CONSTRAINT "ExpenseShare_expenseId_fkey" FOREIGN KEY ("expenseId") REFERENCES "Expense"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ExpenseShare" ADD CONSTRAINT "ExpenseShare_participantId_fkey" FOREIGN KEY ("participantId") REFERENCES "TripParticipant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Expense" ADD CONSTRAINT "Expense_paidById_fkey" FOREIGN KEY ("paidById") REFERENCES "TripParticipant"("id") ON DELETE SET NULL ON UPDATE CASCADE;
