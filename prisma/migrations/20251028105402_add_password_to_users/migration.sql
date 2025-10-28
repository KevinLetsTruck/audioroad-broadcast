-- AlterTable
ALTER TABLE "BroadcastUser" ADD COLUMN "password" TEXT NOT NULL DEFAULT 'changeme123';

-- Update the default for new rows (optional, can be removed if you want to enforce password on creation)
ALTER TABLE "BroadcastUser" ALTER COLUMN "password" DROP DEFAULT;

