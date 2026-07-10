-- CreateEnum
CREATE TYPE "MembershipRole" AS ENUM ('OWNER', 'ADMINISTRATOR', 'ANALYST', 'VIEWER', 'CLIENT_VIEWER');

-- CreateEnum
CREATE TYPE "QueryMode" AS ENUM ('VISUAL', 'EXPERT');

-- CreateEnum
CREATE TYPE "QueryTermType" AS ENUM ('INCLUDE', 'EXCLUDE', 'PHRASE', 'ALIAS', 'DOMAIN_INCLUDE', 'DOMAIN_EXCLUDE', 'SOURCE_TYPE_FILTER', 'LANGUAGE_FILTER', 'GEO_FILTER');

-- CreateEnum
CREATE TYPE "AdapterType" AS ENUM ('RSS', 'GOOGLE_NEWS_RSS', 'GDELT', 'NEWSAPI', 'CSV_UPLOAD', 'MANUAL_URL', 'MANUAL_CRAWL', 'EMAIL_FORWARD', 'GOOGLE_ALERTS_EMAIL', 'REDDIT', 'YOUTUBE', 'BLUESKY', 'MASTODON', 'SLACK', 'TEAMS', 'GMAIL');

-- CreateEnum
CREATE TYPE "SourceConnectionStatus" AS ENUM ('ACTIVE', 'PAUSED', 'DISABLED', 'ERROR');

-- CreateEnum
CREATE TYPE "SourceType" AS ENUM ('NATIONAL', 'REGIONAL', 'LOCAL', 'TRADE', 'COMMUNITY', 'BLOG', 'BROADCAST', 'WIRE', 'SOCIAL', 'UNKNOWN');

-- CreateEnum
CREATE TYPE "CoverageType" AS ENUM ('FEATURE', 'NEWS_STORY', 'INTERVIEW', 'PRODUCT_REVIEW', 'OPINION', 'ROUNDUP', 'LISTICLE', 'EVENT_COVERAGE', 'PRESS_RELEASE_REPRODUCTION', 'PASSING_MENTION', 'BROADCAST_TRANSCRIPT', 'SOCIAL_POST', 'OTHER');

-- CreateEnum
CREATE TYPE "Sentiment" AS ENUM ('POSITIVE', 'NEUTRAL', 'MIXED', 'NEGATIVE');

-- CreateEnum
CREATE TYPE "RelevanceLabel" AS ENUM ('RELEVANT', 'POSSIBLY_RELEVANT', 'IRRELEVANT');

-- CreateEnum
CREATE TYPE "Prominence" AS ENUM ('LEAD', 'SIGNIFICANT', 'PASSING', 'BRIEF_MENTION');

-- CreateEnum
CREATE TYPE "ReviewStatus" AS ENUM ('UNREVIEWED', 'APPROVED', 'REJECTED', 'EXCLUDED');

-- CreateEnum
CREATE TYPE "PlacementType" AS ENUM ('OWNED', 'EARNED', 'PAID', 'SYNDICATED');

-- CreateEnum
CREATE TYPE "AnalysisEngine" AS ENUM ('MOCK', 'CLAUDE');

-- CreateEnum
CREATE TYPE "IngestionJobStatus" AS ENUM ('QUEUED', 'RUNNING', 'SUCCESS', 'FAILED', 'RETRYING');

-- CreateEnum
CREATE TYPE "AlertTriggerType" AS ENUM ('HIGH_RELEVANCE', 'HIGH_RISK', 'NEGATIVE_SENTIMENT', 'MAJOR_PUBLICATION', 'EXEC_MENTION', 'COMPETITOR_SPIKE', 'VOLUME_SPIKE', 'SENTIMENT_DETERIORATION', 'TOPIC_PHRASE', 'JOURNALIST_INQUIRY', 'REGULATORY_LANGUAGE', 'MISINFORMATION_INDICATOR');

-- CreateEnum
CREATE TYPE "AlertChannel" AS ENUM ('IN_APP', 'EMAIL', 'SLACK', 'TEAMS');

-- CreateEnum
CREATE TYPE "AlertCadence" AS ENUM ('IMMEDIATE', 'HOURLY', 'DAILY', 'WEEKLY');

-- CreateEnum
CREATE TYPE "AlertDeliveryStatus" AS ENUM ('PENDING', 'DELIVERED', 'SUPPRESSED', 'FAILED', 'NOT_CONFIGURED');

-- CreateEnum
CREATE TYPE "ReportTemplateType" AS ENUM ('DAILY_BRIEF', 'WEEKLY_COVERAGE', 'MONTHLY_PR', 'CAMPAIGN_WRAP', 'CRISIS_BRIEF', 'EXEC_COMPETITOR');

-- CreateEnum
CREATE TYPE "ReportStatus" AS ENUM ('DRAFT', 'FINAL');

-- CreateEnum
CREATE TYPE "ManualMetricType" AS ENUM ('REACH', 'AVE');

-- CreateEnum
CREATE TYPE "ManualMetricConfidence" AS ENUM ('KNOWN', 'ESTIMATED', 'UNAVAILABLE');

-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "locale" TEXT NOT NULL DEFAULT 'en',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Organization" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "country" TEXT NOT NULL DEFAULT 'CA',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Organization_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Membership" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "role" "MembershipRole" NOT NULL DEFAULT 'ANALYST',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Membership_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Project" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "isDemo" BOOLEAN NOT NULL DEFAULT false,
    "timezone" TEXT NOT NULL DEFAULT 'America/Toronto',
    "languages" TEXT[] DEFAULT ARRAY['en']::TEXT[],
    "regions" TEXT[] DEFAULT ARRAY['CA']::TEXT[],
    "focusCities" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "crisisTerms" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Project_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ProjectMembership" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "role" "MembershipRole",
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ProjectMembership_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Brand" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "aliases" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "websites" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "handles" JSONB,
    "executives" JSONB,
    "products" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "campaigns" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "isPrimary" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Brand_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Competitor" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "brandId" TEXT NOT NULL,
    "displayOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Competitor_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MonitoringQuery" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "mode" "QueryMode" NOT NULL DEFAULT 'VISUAL',
    "booleanExpression" TEXT NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT false,
    "lastTestedAt" TIMESTAMP(3),
    "lastTestResultCount" INTEGER,
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MonitoringQuery_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "QueryTerm" (
    "id" TEXT NOT NULL,
    "monitoringQueryId" TEXT NOT NULL,
    "termType" "QueryTermType" NOT NULL,
    "value" TEXT NOT NULL,
    "language" TEXT NOT NULL DEFAULT 'any',
    "position" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "QueryTerm_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SourceConnection" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "monitoringQueryId" TEXT,
    "adapterType" "AdapterType" NOT NULL,
    "name" TEXT NOT NULL,
    "config" JSONB NOT NULL,
    "status" "SourceConnectionStatus" NOT NULL DEFAULT 'ACTIVE',
    "pollingFrequencyMins" INTEGER NOT NULL DEFAULT 60,
    "lastPolledAt" TIMESTAMP(3),
    "lastError" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SourceConnection_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Source" (
    "id" TEXT NOT NULL,
    "projectId" TEXT,
    "domain" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "sourceType" "SourceType" NOT NULL DEFAULT 'UNKNOWN',
    "country" TEXT,
    "province" TEXT,
    "language" TEXT,
    "isCanadian" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Source_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "IngestionJob" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "sourceConnectionId" TEXT NOT NULL,
    "status" "IngestionJobStatus" NOT NULL DEFAULT 'QUEUED',
    "startedAt" TIMESTAMP(3),
    "finishedAt" TIMESTAMP(3),
    "itemsFetched" INTEGER NOT NULL DEFAULT 0,
    "itemsNew" INTEGER NOT NULL DEFAULT 0,
    "errorMessage" TEXT,
    "attempt" INTEGER NOT NULL DEFAULT 1,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "IngestionJob_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Mention" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "monitoringQueryId" TEXT,
    "sourceConnectionId" TEXT,
    "sourceId" TEXT,
    "duplicateClusterId" TEXT,
    "provider" TEXT NOT NULL,
    "providerRecordId" TEXT,
    "canonicalUrl" TEXT NOT NULL,
    "originalUrl" TEXT NOT NULL,
    "sourceName" TEXT NOT NULL,
    "sourceDomain" TEXT NOT NULL,
    "sourceType" "SourceType" NOT NULL DEFAULT 'UNKNOWN',
    "headline" TEXT NOT NULL,
    "excerpt" TEXT,
    "bodyText" TEXT,
    "author" TEXT,
    "publishedAt" TIMESTAMP(3) NOT NULL,
    "fetchedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "language" TEXT NOT NULL DEFAULT 'en',
    "country" TEXT,
    "province" TEXT,
    "imageUrl" TEXT,
    "keywordMatches" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "matchedQuery" TEXT,
    "entities" JSONB,
    "brandsMentioned" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "spokespeopleMentioned" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "competitorsMentioned" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "coverageType" "CoverageType",
    "placementType" "PlacementType",
    "topicLabels" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "campaignLabels" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "reviewStatus" "ReviewStatus" NOT NULL DEFAULT 'UNREVIEWED',
    "analystNotes" TEXT,
    "aiErrorFlagged" BOOLEAN NOT NULL DEFAULT false,
    "isDemo" BOOLEAN NOT NULL DEFAULT false,
    "rawProviderMetadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Mention_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DuplicateCluster" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "canonicalMentionId" TEXT,
    "fingerprint" TEXT NOT NULL,
    "memberCount" INTEGER NOT NULL DEFAULT 1,
    "isSyndicated" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "DuplicateCluster_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AnalysisResult" (
    "id" TEXT NOT NULL,
    "mentionId" TEXT NOT NULL,
    "engine" "AnalysisEngine" NOT NULL,
    "modelName" TEXT,
    "relevanceLabel" "RelevanceLabel" NOT NULL,
    "relevanceScore" DOUBLE PRECISION NOT NULL,
    "relevanceReason" TEXT NOT NULL,
    "sentiment" "Sentiment" NOT NULL,
    "sentimentConfidence" DOUBLE PRECISION NOT NULL,
    "sentimentEvidence" TEXT,
    "sentimentSubjectIsBrand" BOOLEAN NOT NULL DEFAULT true,
    "coverageType" "CoverageType" NOT NULL,
    "prominence" "Prominence" NOT NULL,
    "prominenceExplanation" TEXT,
    "riskScore" INTEGER NOT NULL,
    "riskLevel" TEXT NOT NULL,
    "riskReasons" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "emergingNarrative" TEXT,
    "recommendedUrgency" TEXT,
    "topics" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "secondaryTopics" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "executiveSummary" TEXT NOT NULL,
    "rawModelResponse" JSONB,
    "schemaVersion" INTEGER NOT NULL DEFAULT 1,
    "correctedByUserId" TEXT,
    "correctedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AnalysisResult_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Topic" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "isSystemGenerated" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Topic_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Tag" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "color" TEXT NOT NULL DEFAULT '#64748b',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Tag_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MentionTag" (
    "id" TEXT NOT NULL,
    "mentionId" TEXT NOT NULL,
    "tagId" TEXT NOT NULL,

    CONSTRAINT "MentionTag_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "KeyMessage" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "text" TEXT NOT NULL,
    "aliases" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "KeyMessage_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MessageMatch" (
    "id" TEXT NOT NULL,
    "mentionId" TEXT NOT NULL,
    "keyMessageId" TEXT NOT NULL,
    "matchStrength" TEXT NOT NULL,
    "confidence" DOUBLE PRECISION NOT NULL,
    "supportingExcerpt" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "MessageMatch_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AuditLog" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT,
    "projectId" TEXT,
    "userId" TEXT,
    "entityType" TEXT NOT NULL,
    "entityId" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "previousValue" JSONB,
    "newValue" JSONB,
    "reason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AuditLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AlertRule" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "triggerType" "AlertTriggerType" NOT NULL,
    "config" JSONB NOT NULL,
    "deliveryChannels" "AlertChannel"[],
    "slackWebhookUrl" TEXT,
    "teamsWebhookUrl" TEXT,
    "emailRecipients" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "cadence" "AlertCadence" NOT NULL DEFAULT 'IMMEDIATE',
    "quietHoursStart" INTEGER,
    "quietHoursEnd" INTEGER,
    "timezone" TEXT NOT NULL DEFAULT 'America/Toronto',
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AlertRule_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AlertEvent" (
    "id" TEXT NOT NULL,
    "alertRuleId" TEXT NOT NULL,
    "mentionId" TEXT,
    "triggeredAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "payload" JSONB NOT NULL,
    "deliveredAt" TIMESTAMP(3),
    "deliveryStatus" "AlertDeliveryStatus" NOT NULL DEFAULT 'PENDING',
    "suppressedDuplicateOfId" TEXT,

    CONSTRAINT "AlertEvent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Digest" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "cadence" "AlertCadence" NOT NULL DEFAULT 'DAILY',
    "recipients" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "config" JSONB,
    "lastSentAt" TIMESTAMP(3),
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Digest_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Report" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "templateType" "ReportTemplateType" NOT NULL,
    "title" TEXT NOT NULL,
    "dateRangeStart" TIMESTAMP(3) NOT NULL,
    "dateRangeEnd" TIMESTAMP(3) NOT NULL,
    "generatedById" TEXT,
    "status" "ReportStatus" NOT NULL DEFAULT 'DRAFT',
    "shareToken" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Report_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ReportSection" (
    "id" TEXT NOT NULL,
    "reportId" TEXT NOT NULL,
    "sectionType" TEXT NOT NULL,
    "order" INTEGER NOT NULL DEFAULT 0,
    "content" JSONB NOT NULL,
    "commentary" TEXT,

    CONSTRAINT "ReportSection_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SavedFilter" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "filterJson" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SavedFilter_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ManualMetric" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "mentionId" TEXT,
    "metricType" "ManualMetricType" NOT NULL,
    "value" DOUBLE PRECISION NOT NULL,
    "confidence" "ManualMetricConfidence" NOT NULL DEFAULT 'ESTIMATED',
    "source" TEXT,
    "isLegacyAVE" BOOLEAN NOT NULL DEFAULT false,
    "enteredById" TEXT,
    "enteredAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ManualMetric_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "APIUsage" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "projectId" TEXT,
    "provider" TEXT NOT NULL,
    "callsUsed" INTEGER NOT NULL DEFAULT 0,
    "tokensUsed" INTEGER NOT NULL DEFAULT 0,
    "estimatedCostUsd" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "date" DATE NOT NULL,

    CONSTRAINT "APIUsage_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE INDEX "User_email_idx" ON "User"("email");

-- CreateIndex
CREATE UNIQUE INDEX "Organization_slug_key" ON "Organization"("slug");

-- CreateIndex
CREATE INDEX "Membership_organizationId_idx" ON "Membership"("organizationId");

-- CreateIndex
CREATE UNIQUE INDEX "Membership_userId_organizationId_key" ON "Membership"("userId", "organizationId");

-- CreateIndex
CREATE INDEX "Project_organizationId_idx" ON "Project"("organizationId");

-- CreateIndex
CREATE INDEX "ProjectMembership_projectId_idx" ON "ProjectMembership"("projectId");

-- CreateIndex
CREATE UNIQUE INDEX "ProjectMembership_userId_projectId_key" ON "ProjectMembership"("userId", "projectId");

-- CreateIndex
CREATE INDEX "Brand_projectId_idx" ON "Brand"("projectId");

-- CreateIndex
CREATE INDEX "Competitor_projectId_idx" ON "Competitor"("projectId");

-- CreateIndex
CREATE UNIQUE INDEX "Competitor_projectId_brandId_key" ON "Competitor"("projectId", "brandId");

-- CreateIndex
CREATE INDEX "MonitoringQuery_projectId_isActive_idx" ON "MonitoringQuery"("projectId", "isActive");

-- CreateIndex
CREATE INDEX "QueryTerm_monitoringQueryId_idx" ON "QueryTerm"("monitoringQueryId");

-- CreateIndex
CREATE INDEX "SourceConnection_projectId_status_idx" ON "SourceConnection"("projectId", "status");

-- CreateIndex
CREATE INDEX "Source_projectId_idx" ON "Source"("projectId");

-- CreateIndex
CREATE UNIQUE INDEX "Source_domain_projectId_key" ON "Source"("domain", "projectId");

-- CreateIndex
CREATE INDEX "IngestionJob_sourceConnectionId_createdAt_idx" ON "IngestionJob"("sourceConnectionId", "createdAt");

-- CreateIndex
CREATE INDEX "IngestionJob_projectId_status_idx" ON "IngestionJob"("projectId", "status");

-- CreateIndex
CREATE INDEX "Mention_projectId_publishedAt_idx" ON "Mention"("projectId", "publishedAt");

-- CreateIndex
CREATE INDEX "Mention_canonicalUrl_idx" ON "Mention"("canonicalUrl");

-- CreateIndex
CREATE INDEX "Mention_duplicateClusterId_idx" ON "Mention"("duplicateClusterId");

-- CreateIndex
CREATE INDEX "Mention_projectId_reviewStatus_idx" ON "Mention"("projectId", "reviewStatus");

-- CreateIndex
CREATE INDEX "Mention_projectId_isDemo_idx" ON "Mention"("projectId", "isDemo");

-- CreateIndex
CREATE INDEX "DuplicateCluster_projectId_fingerprint_idx" ON "DuplicateCluster"("projectId", "fingerprint");

-- CreateIndex
CREATE UNIQUE INDEX "AnalysisResult_mentionId_key" ON "AnalysisResult"("mentionId");

-- CreateIndex
CREATE INDEX "AnalysisResult_sentiment_idx" ON "AnalysisResult"("sentiment");

-- CreateIndex
CREATE INDEX "AnalysisResult_riskScore_idx" ON "AnalysisResult"("riskScore");

-- CreateIndex
CREATE INDEX "AnalysisResult_relevanceLabel_idx" ON "AnalysisResult"("relevanceLabel");

-- CreateIndex
CREATE UNIQUE INDEX "Topic_projectId_name_key" ON "Topic"("projectId", "name");

-- CreateIndex
CREATE UNIQUE INDEX "Tag_projectId_name_key" ON "Tag"("projectId", "name");

-- CreateIndex
CREATE UNIQUE INDEX "MentionTag_mentionId_tagId_key" ON "MentionTag"("mentionId", "tagId");

-- CreateIndex
CREATE INDEX "KeyMessage_projectId_idx" ON "KeyMessage"("projectId");

-- CreateIndex
CREATE UNIQUE INDEX "MessageMatch_mentionId_keyMessageId_key" ON "MessageMatch"("mentionId", "keyMessageId");

-- CreateIndex
CREATE INDEX "AuditLog_projectId_createdAt_idx" ON "AuditLog"("projectId", "createdAt");

-- CreateIndex
CREATE INDEX "AuditLog_entityType_entityId_idx" ON "AuditLog"("entityType", "entityId");

-- CreateIndex
CREATE INDEX "AlertRule_projectId_isActive_idx" ON "AlertRule"("projectId", "isActive");

-- CreateIndex
CREATE INDEX "AlertEvent_alertRuleId_triggeredAt_idx" ON "AlertEvent"("alertRuleId", "triggeredAt");

-- CreateIndex
CREATE INDEX "Digest_projectId_idx" ON "Digest"("projectId");

-- CreateIndex
CREATE UNIQUE INDEX "Report_shareToken_key" ON "Report"("shareToken");

-- CreateIndex
CREATE INDEX "Report_projectId_templateType_idx" ON "Report"("projectId", "templateType");

-- CreateIndex
CREATE INDEX "ReportSection_reportId_order_idx" ON "ReportSection"("reportId", "order");

-- CreateIndex
CREATE INDEX "SavedFilter_projectId_userId_idx" ON "SavedFilter"("projectId", "userId");

-- CreateIndex
CREATE INDEX "ManualMetric_projectId_idx" ON "ManualMetric"("projectId");

-- CreateIndex
CREATE INDEX "APIUsage_organizationId_date_idx" ON "APIUsage"("organizationId", "date");

-- CreateIndex
CREATE UNIQUE INDEX "APIUsage_organizationId_projectId_provider_date_key" ON "APIUsage"("organizationId", "projectId", "provider", "date");

-- AddForeignKey
ALTER TABLE "Membership" ADD CONSTRAINT "Membership_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Membership" ADD CONSTRAINT "Membership_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Project" ADD CONSTRAINT "Project_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProjectMembership" ADD CONSTRAINT "ProjectMembership_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProjectMembership" ADD CONSTRAINT "ProjectMembership_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Brand" ADD CONSTRAINT "Brand_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Competitor" ADD CONSTRAINT "Competitor_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Competitor" ADD CONSTRAINT "Competitor_brandId_fkey" FOREIGN KEY ("brandId") REFERENCES "Brand"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MonitoringQuery" ADD CONSTRAINT "MonitoringQuery_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MonitoringQuery" ADD CONSTRAINT "MonitoringQuery_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "QueryTerm" ADD CONSTRAINT "QueryTerm_monitoringQueryId_fkey" FOREIGN KEY ("monitoringQueryId") REFERENCES "MonitoringQuery"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SourceConnection" ADD CONSTRAINT "SourceConnection_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SourceConnection" ADD CONSTRAINT "SourceConnection_monitoringQueryId_fkey" FOREIGN KEY ("monitoringQueryId") REFERENCES "MonitoringQuery"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Source" ADD CONSTRAINT "Source_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "IngestionJob" ADD CONSTRAINT "IngestionJob_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "IngestionJob" ADD CONSTRAINT "IngestionJob_sourceConnectionId_fkey" FOREIGN KEY ("sourceConnectionId") REFERENCES "SourceConnection"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Mention" ADD CONSTRAINT "Mention_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Mention" ADD CONSTRAINT "Mention_monitoringQueryId_fkey" FOREIGN KEY ("monitoringQueryId") REFERENCES "MonitoringQuery"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Mention" ADD CONSTRAINT "Mention_sourceConnectionId_fkey" FOREIGN KEY ("sourceConnectionId") REFERENCES "SourceConnection"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Mention" ADD CONSTRAINT "Mention_sourceId_fkey" FOREIGN KEY ("sourceId") REFERENCES "Source"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Mention" ADD CONSTRAINT "Mention_duplicateClusterId_fkey" FOREIGN KEY ("duplicateClusterId") REFERENCES "DuplicateCluster"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DuplicateCluster" ADD CONSTRAINT "DuplicateCluster_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DuplicateCluster" ADD CONSTRAINT "DuplicateCluster_canonicalMentionId_fkey" FOREIGN KEY ("canonicalMentionId") REFERENCES "Mention"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AnalysisResult" ADD CONSTRAINT "AnalysisResult_mentionId_fkey" FOREIGN KEY ("mentionId") REFERENCES "Mention"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Topic" ADD CONSTRAINT "Topic_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Tag" ADD CONSTRAINT "Tag_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MentionTag" ADD CONSTRAINT "MentionTag_mentionId_fkey" FOREIGN KEY ("mentionId") REFERENCES "Mention"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MentionTag" ADD CONSTRAINT "MentionTag_tagId_fkey" FOREIGN KEY ("tagId") REFERENCES "Tag"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "KeyMessage" ADD CONSTRAINT "KeyMessage_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MessageMatch" ADD CONSTRAINT "MessageMatch_mentionId_fkey" FOREIGN KEY ("mentionId") REFERENCES "Mention"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MessageMatch" ADD CONSTRAINT "MessageMatch_keyMessageId_fkey" FOREIGN KEY ("keyMessageId") REFERENCES "KeyMessage"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AuditLog" ADD CONSTRAINT "AuditLog_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AuditLog" ADD CONSTRAINT "AuditLog_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AuditLog" ADD CONSTRAINT "AuditLog_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AlertRule" ADD CONSTRAINT "AlertRule_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AlertEvent" ADD CONSTRAINT "AlertEvent_alertRuleId_fkey" FOREIGN KEY ("alertRuleId") REFERENCES "AlertRule"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AlertEvent" ADD CONSTRAINT "AlertEvent_mentionId_fkey" FOREIGN KEY ("mentionId") REFERENCES "Mention"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AlertEvent" ADD CONSTRAINT "AlertEvent_suppressedDuplicateOfId_fkey" FOREIGN KEY ("suppressedDuplicateOfId") REFERENCES "AlertEvent"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Digest" ADD CONSTRAINT "Digest_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Report" ADD CONSTRAINT "Report_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Report" ADD CONSTRAINT "Report_generatedById_fkey" FOREIGN KEY ("generatedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ReportSection" ADD CONSTRAINT "ReportSection_reportId_fkey" FOREIGN KEY ("reportId") REFERENCES "Report"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SavedFilter" ADD CONSTRAINT "SavedFilter_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SavedFilter" ADD CONSTRAINT "SavedFilter_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ManualMetric" ADD CONSTRAINT "ManualMetric_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ManualMetric" ADD CONSTRAINT "ManualMetric_mentionId_fkey" FOREIGN KEY ("mentionId") REFERENCES "Mention"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ManualMetric" ADD CONSTRAINT "ManualMetric_enteredById_fkey" FOREIGN KEY ("enteredById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "APIUsage" ADD CONSTRAINT "APIUsage_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;
