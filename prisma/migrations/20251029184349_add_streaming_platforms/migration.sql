-- CreateTable
CREATE TABLE "StreamingPlatform" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "streamKey" TEXT NOT NULL,
    "enabled" BOOLEAN NOT NULL DEFAULT false,
    "thirtyMinLimit" BOOLEAN NOT NULL DEFAULT true,
    "customUrl" TEXT,
    "lastUsed" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "StreamingPlatform_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "StreamingPlatform_name_key" ON "StreamingPlatform"("name");

-- CreateIndex
CREATE INDEX "StreamingPlatform_enabled_idx" ON "StreamingPlatform"("enabled");

