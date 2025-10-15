-- CreateTable
CREATE TABLE "BroadcastUser" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "role" TEXT NOT NULL,
    "showId" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "BroadcastUser_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Show" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "hostId" TEXT NOT NULL,
    "hostName" TEXT NOT NULL,
    "description" TEXT,
    "schedule" JSONB NOT NULL,
    "logoUrl" TEXT,
    "color" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Show_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Episode" (
    "id" TEXT NOT NULL,
    "showId" TEXT NOT NULL,
    "episodeNumber" INTEGER NOT NULL,
    "title" TEXT NOT NULL,
    "date" TIMESTAMP(3) NOT NULL,
    "scheduledStart" TIMESTAMP(3) NOT NULL,
    "scheduledEnd" TIMESTAMP(3) NOT NULL,
    "actualStart" TIMESTAMP(3),
    "actualEnd" TIMESTAMP(3),
    "status" TEXT NOT NULL,
    "recordingUrl" TEXT,
    "transcriptUrl" TEXT,
    "duration" INTEGER,
    "description" TEXT,
    "notes" TEXT,
    "tags" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Episode_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Caller" (
    "id" TEXT NOT NULL,
    "phoneNumber" TEXT NOT NULL,
    "name" TEXT,
    "email" TEXT,
    "location" TEXT,
    "timezone" TEXT,
    "truckerType" TEXT,
    "company" TEXT,
    "yearsExperience" INTEGER,
    "firstCallDate" TIMESTAMP(3) NOT NULL,
    "lastCallDate" TIMESTAMP(3) NOT NULL,
    "totalCalls" INTEGER NOT NULL DEFAULT 0,
    "featuredCalls" INTEGER NOT NULL DEFAULT 0,
    "aiSummary" TEXT,
    "commonTopics" JSONB,
    "sentiment" TEXT,
    "isBlocked" BOOLEAN NOT NULL DEFAULT false,
    "isFavorite" BOOLEAN NOT NULL DEFAULT false,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Caller_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Call" (
    "id" TEXT NOT NULL,
    "episodeId" TEXT NOT NULL,
    "callerId" TEXT NOT NULL,
    "twilioCallSid" TEXT NOT NULL,
    "twilioConferenceSid" TEXT,
    "status" TEXT NOT NULL,
    "incomingAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "queuedAt" TIMESTAMP(3),
    "screenedAt" TIMESTAMP(3),
    "approvedAt" TIMESTAMP(3),
    "onAirAt" TIMESTAMP(3),
    "endedAt" TIMESTAMP(3),
    "queueDuration" INTEGER,
    "screenDuration" INTEGER,
    "airDuration" INTEGER,
    "totalDuration" INTEGER,
    "topic" TEXT,
    "priority" TEXT NOT NULL DEFAULT 'normal',
    "screenerUserId" TEXT,
    "screenerNotes" TEXT,
    "recordingUrl" TEXT,
    "recordingSid" TEXT,
    "transcriptText" TEXT,
    "transcriptUrl" TEXT,
    "aiSummary" TEXT,
    "aiKeyPoints" JSONB,
    "aiSentiment" TEXT,
    "aiTopics" JSONB,
    "audioQuality" INTEGER,
    "contentRating" INTEGER,
    "hostRating" INTEGER,
    "featured" BOOLEAN NOT NULL DEFAULT false,
    "hasClips" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Call_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CallerDocument" (
    "id" TEXT NOT NULL,
    "callerId" TEXT NOT NULL,
    "callId" TEXT,
    "documentType" TEXT NOT NULL,
    "fileName" TEXT NOT NULL,
    "fileUrl" TEXT NOT NULL,
    "fileSize" INTEGER NOT NULL,
    "mimeType" TEXT NOT NULL,
    "uploadedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "uploadMethod" TEXT NOT NULL DEFAULT 'portal',
    "analyzed" BOOLEAN NOT NULL DEFAULT false,
    "analyzedAt" TIMESTAMP(3),
    "aiAnalysis" JSONB,
    "aiSummary" TEXT,
    "aiKeyFindings" JSONB,
    "aiRecommendations" JSONB,
    "aiConfidence" DOUBLE PRECISION,
    "manualNotes" TEXT,
    "reviewedBy" TEXT,
    "reviewedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CallerDocument_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AudioAsset" (
    "id" TEXT NOT NULL,
    "showId" TEXT,
    "name" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "fileUrl" TEXT NOT NULL,
    "duration" INTEGER NOT NULL,
    "fileSize" INTEGER NOT NULL,
    "category" TEXT,
    "tags" JSONB,
    "color" TEXT,
    "hotkey" TEXT,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AudioAsset_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Clip" (
    "id" TEXT NOT NULL,
    "episodeId" TEXT NOT NULL,
    "callId" TEXT,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "type" TEXT NOT NULL,
    "startTime" INTEGER,
    "endTime" INTEGER,
    "duration" INTEGER NOT NULL,
    "audioUrl" TEXT,
    "videoUrl" TEXT,
    "thumbnailUrl" TEXT,
    "waveformUrl" TEXT,
    "aiCaption" TEXT,
    "aiHashtags" JSONB,
    "aiTranscript" TEXT,
    "aiSuggestions" JSONB,
    "status" TEXT NOT NULL DEFAULT 'draft',
    "platforms" JSONB,
    "scheduledFor" TIMESTAMP(3),
    "publishedAt" TIMESTAMP(3),
    "views" INTEGER NOT NULL DEFAULT 0,
    "likes" INTEGER NOT NULL DEFAULT 0,
    "shares" INTEGER NOT NULL DEFAULT 0,
    "comments" INTEGER NOT NULL DEFAULT 0,
    "createdBy" TEXT,
    "approvedBy" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Clip_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ChatMessage" (
    "id" TEXT NOT NULL,
    "episodeId" TEXT NOT NULL,
    "senderId" TEXT NOT NULL,
    "senderName" TEXT NOT NULL,
    "senderRole" TEXT NOT NULL,
    "recipientId" TEXT,
    "recipientRole" TEXT,
    "messageType" TEXT NOT NULL DEFAULT 'text',
    "message" TEXT NOT NULL,
    "twilioSid" TEXT,
    "twilioChannelSid" TEXT,
    "attachmentUrl" TEXT,
    "attachmentType" TEXT,
    "isRead" BOOLEAN NOT NULL DEFAULT false,
    "readAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ChatMessage_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ShowMetrics" (
    "id" TEXT NOT NULL,
    "episodeId" TEXT NOT NULL,
    "totalCalls" INTEGER NOT NULL DEFAULT 0,
    "answeredCalls" INTEGER NOT NULL DEFAULT 0,
    "missedCalls" INTEGER NOT NULL DEFAULT 0,
    "avgWaitTime" INTEGER,
    "avgCallDuration" INTEGER,
    "uniqueCallers" INTEGER NOT NULL DEFAULT 0,
    "newCallers" INTEGER NOT NULL DEFAULT 0,
    "returningCallers" INTEGER NOT NULL DEFAULT 0,
    "clipsCreated" INTEGER NOT NULL DEFAULT 0,
    "featuredCalls" INTEGER NOT NULL DEFAULT 0,
    "actualDuration" INTEGER,
    "scheduledDuration" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ShowMetrics_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SystemLog" (
    "id" TEXT NOT NULL,
    "level" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "metadata" JSONB,
    "userId" TEXT,
    "episodeId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SystemLog_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "BroadcastUser_email_key" ON "BroadcastUser"("email");

-- CreateIndex
CREATE INDEX "BroadcastUser_email_idx" ON "BroadcastUser"("email");

-- CreateIndex
CREATE INDEX "BroadcastUser_role_idx" ON "BroadcastUser"("role");

-- CreateIndex
CREATE INDEX "BroadcastUser_showId_idx" ON "BroadcastUser"("showId");

-- CreateIndex
CREATE UNIQUE INDEX "Show_slug_key" ON "Show"("slug");

-- CreateIndex
CREATE INDEX "Show_slug_idx" ON "Show"("slug");

-- CreateIndex
CREATE INDEX "Show_isActive_idx" ON "Show"("isActive");

-- CreateIndex
CREATE INDEX "Episode_showId_date_idx" ON "Episode"("showId", "date");

-- CreateIndex
CREATE INDEX "Episode_status_idx" ON "Episode"("status");

-- CreateIndex
CREATE INDEX "Episode_scheduledStart_idx" ON "Episode"("scheduledStart");

-- CreateIndex
CREATE UNIQUE INDEX "Episode_showId_episodeNumber_key" ON "Episode"("showId", "episodeNumber");

-- CreateIndex
CREATE UNIQUE INDEX "Caller_phoneNumber_key" ON "Caller"("phoneNumber");

-- CreateIndex
CREATE INDEX "Caller_phoneNumber_idx" ON "Caller"("phoneNumber");

-- CreateIndex
CREATE INDEX "Caller_name_idx" ON "Caller"("name");

-- CreateIndex
CREATE INDEX "Caller_lastCallDate_idx" ON "Caller"("lastCallDate");

-- CreateIndex
CREATE UNIQUE INDEX "Call_twilioCallSid_key" ON "Call"("twilioCallSid");

-- CreateIndex
CREATE INDEX "Call_episodeId_status_idx" ON "Call"("episodeId", "status");

-- CreateIndex
CREATE INDEX "Call_callerId_idx" ON "Call"("callerId");

-- CreateIndex
CREATE INDEX "Call_status_idx" ON "Call"("status");

-- CreateIndex
CREATE INDEX "Call_incomingAt_idx" ON "Call"("incomingAt");

-- CreateIndex
CREATE INDEX "Call_featured_idx" ON "Call"("featured");

-- CreateIndex
CREATE INDEX "CallerDocument_callerId_idx" ON "CallerDocument"("callerId");

-- CreateIndex
CREATE INDEX "CallerDocument_documentType_idx" ON "CallerDocument"("documentType");

-- CreateIndex
CREATE INDEX "CallerDocument_analyzed_idx" ON "CallerDocument"("analyzed");

-- CreateIndex
CREATE INDEX "CallerDocument_uploadedAt_idx" ON "CallerDocument"("uploadedAt");

-- CreateIndex
CREATE INDEX "AudioAsset_showId_type_idx" ON "AudioAsset"("showId", "type");

-- CreateIndex
CREATE INDEX "AudioAsset_type_isActive_idx" ON "AudioAsset"("type", "isActive");

-- CreateIndex
CREATE INDEX "Clip_episodeId_idx" ON "Clip"("episodeId");

-- CreateIndex
CREATE INDEX "Clip_type_status_idx" ON "Clip"("type", "status");

-- CreateIndex
CREATE INDEX "Clip_status_idx" ON "Clip"("status");

-- CreateIndex
CREATE INDEX "Clip_scheduledFor_idx" ON "Clip"("scheduledFor");

-- CreateIndex
CREATE INDEX "ChatMessage_episodeId_createdAt_idx" ON "ChatMessage"("episodeId", "createdAt");

-- CreateIndex
CREATE INDEX "ChatMessage_senderId_idx" ON "ChatMessage"("senderId");

-- CreateIndex
CREATE INDEX "ChatMessage_recipientId_isRead_idx" ON "ChatMessage"("recipientId", "isRead");

-- CreateIndex
CREATE UNIQUE INDEX "ShowMetrics_episodeId_key" ON "ShowMetrics"("episodeId");

-- CreateIndex
CREATE INDEX "ShowMetrics_episodeId_idx" ON "ShowMetrics"("episodeId");

-- CreateIndex
CREATE INDEX "SystemLog_level_createdAt_idx" ON "SystemLog"("level", "createdAt");

-- CreateIndex
CREATE INDEX "SystemLog_category_idx" ON "SystemLog"("category");

-- CreateIndex
CREATE INDEX "SystemLog_episodeId_idx" ON "SystemLog"("episodeId");

-- AddForeignKey
ALTER TABLE "Episode" ADD CONSTRAINT "Episode_showId_fkey" FOREIGN KEY ("showId") REFERENCES "Show"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Call" ADD CONSTRAINT "Call_episodeId_fkey" FOREIGN KEY ("episodeId") REFERENCES "Episode"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Call" ADD CONSTRAINT "Call_callerId_fkey" FOREIGN KEY ("callerId") REFERENCES "Caller"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CallerDocument" ADD CONSTRAINT "CallerDocument_callerId_fkey" FOREIGN KEY ("callerId") REFERENCES "Caller"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AudioAsset" ADD CONSTRAINT "AudioAsset_showId_fkey" FOREIGN KEY ("showId") REFERENCES "Show"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Clip" ADD CONSTRAINT "Clip_episodeId_fkey" FOREIGN KEY ("episodeId") REFERENCES "Episode"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ChatMessage" ADD CONSTRAINT "ChatMessage_episodeId_fkey" FOREIGN KEY ("episodeId") REFERENCES "Episode"("id") ON DELETE CASCADE ON UPDATE CASCADE;
