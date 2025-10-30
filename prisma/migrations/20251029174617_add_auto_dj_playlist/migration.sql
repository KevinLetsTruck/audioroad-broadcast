-- CreateTable
CREATE TABLE "PlaylistTrack" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "artist" TEXT,
    "audioUrl" TEXT NOT NULL,
    "duration" INTEGER NOT NULL,
    "fileSize" INTEGER,
    "category" TEXT,
    "tags" JSONB,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "playCount" INTEGER NOT NULL DEFAULT 0,
    "lastPlayed" TIMESTAMP(3),
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PlaylistTrack_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "PlaylistTrack_isActive_sortOrder_idx" ON "PlaylistTrack"("isActive", "sortOrder");

-- CreateIndex
CREATE INDEX "PlaylistTrack_lastPlayed_idx" ON "PlaylistTrack"("lastPlayed");

