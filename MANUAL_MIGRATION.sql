-- Manual Database Migration
-- Run this to add BroadcastConfig and BroadcastSession tables

-- BroadcastConfig table
CREATE TABLE IF NOT EXISTS "BroadcastConfig" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "showId" TEXT NOT NULL UNIQUE,
    "serverUrl" TEXT NOT NULL,
    "port" INTEGER NOT NULL,
    "password" TEXT NOT NULL,
    "mountPoint" TEXT,
    "streamName" TEXT,
    "genre" TEXT,
    "bitrate" INTEGER NOT NULL DEFAULT 256,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL
);

CREATE INDEX IF NOT EXISTS "BroadcastConfig_showId_idx" ON "BroadcastConfig"("showId");

-- BroadcastSession table
CREATE TABLE IF NOT EXISTS "BroadcastSession" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "episodeId" TEXT NOT NULL,
    "startTime" TIMESTAMP(3) NOT NULL,
    "endTime" TIMESTAMP(3),
    "bytesStreamed" BIGINT NOT NULL DEFAULT 0,
    "recordingUrl" TEXT,
    "disconnections" INTEGER NOT NULL DEFAULT 0,
    "avgBitrate" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL
);

CREATE INDEX IF NOT EXISTS "BroadcastSession_episodeId_idx" ON "BroadcastSession"("episodeId");
CREATE INDEX IF NOT EXISTS "BroadcastSession_startTime_idx" ON "BroadcastSession"("startTime");

