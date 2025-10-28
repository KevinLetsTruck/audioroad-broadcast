-- CreateTable
CREATE TABLE "ShowCommercial" (
    "id" TEXT NOT NULL,
    "showId" TEXT NOT NULL,
    "audioAssetId" TEXT NOT NULL,
    "slot" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ShowCommercial_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ShowCommercial_showId_idx" ON "ShowCommercial"("showId");

-- CreateIndex
CREATE UNIQUE INDEX "ShowCommercial_showId_slot_key" ON "ShowCommercial"("showId", "slot");

-- AddForeignKey
ALTER TABLE "ShowCommercial" ADD CONSTRAINT "ShowCommercial_showId_fkey" FOREIGN KEY ("showId") REFERENCES "Show"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ShowCommercial" ADD CONSTRAINT "ShowCommercial_audioAssetId_fkey" FOREIGN KEY ("audioAssetId") REFERENCES "AudioAsset"("id") ON DELETE CASCADE ON UPDATE CASCADE;

