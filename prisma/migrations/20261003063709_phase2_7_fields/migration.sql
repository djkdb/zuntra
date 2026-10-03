-- AlterTable
ALTER TABLE "AIAction" ADD COLUMN     "expiresAt" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "AIMessage" ADD COLUMN     "meta" JSONB;

-- AlterTable
ALTER TABLE "Trip" ADD COLUMN     "destinationLat" DOUBLE PRECISION,
ADD COLUMN     "destinationLng" DOUBLE PRECISION;

-- AlterTable
ALTER TABLE "TripPhoto" ADD COLUMN     "contentType" TEXT NOT NULL DEFAULT 'image/webp',
ADD COLUMN     "sizeBytes" INTEGER NOT NULL DEFAULT 0;
