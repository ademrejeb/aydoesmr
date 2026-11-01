-- CreateEnum
CREATE TYPE "ServicePriority" AS ENUM ('P1', 'P2', 'P3', 'P4');

-- CreateEnum
CREATE TYPE "ServiceRequestStatus" AS ENUM ('SUBMITTED', 'PENDING_APPROVAL', 'APPROVED', 'REJECTED', 'IN_PROGRESS', 'FULFILLED', 'CANCELLED', 'CLOSED');

-- CreateEnum
CREATE TYPE "IncidentStatus" AS ENUM ('NEW', 'IN_PROGRESS', 'RESOLVED', 'CLOSED');

-- CreateEnum
CREATE TYPE "ServiceEntityType" AS ENUM ('REQUEST', 'INCIDENT', 'ARTICLE');

-- CreateTable
CREATE TABLE "ServiceItem" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "icon" TEXT,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "requiresApproval" BOOLEAN NOT NULL DEFAULT true,
    "estimatedDays" INTEGER,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "formSchema" JSONB NOT NULL DEFAULT '[]',
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ServiceItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ServiceRequest" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "number" TEXT NOT NULL,
    "itemId" TEXT,
    "title" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "status" "ServiceRequestStatus" NOT NULL DEFAULT 'SUBMITTED',
    "priority" "ServicePriority" NOT NULL DEFAULT 'P3',
    "formData" JSONB NOT NULL DEFAULT '{}',
    "requesterId" TEXT,
    "requesterEmail" TEXT,
    "requesterName" TEXT,
    "assigneeId" TEXT,
    "approverId" TEXT,
    "decisionNote" TEXT,
    "rating" INTEGER,
    "submittedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "approvedAt" TIMESTAMP(3),
    "resolvedAt" TIMESTAMP(3),
    "closedAt" TIMESTAMP(3),
    "targetAt" TIMESTAMP(3),
    "dueAt" TIMESTAMP(3),
    "source" TEXT NOT NULL DEFAULT 'portal',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ServiceRequest_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Incident" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "number" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "status" "IncidentStatus" NOT NULL DEFAULT 'NEW',
    "priority" "ServicePriority" NOT NULL DEFAULT 'P3',
    "category" TEXT,
    "assigneeId" TEXT,
    "requesterId" TEXT,
    "requesterEmail" TEXT,
    "requesterName" TEXT,
    "linkedRequestId" TEXT,
    "resolution" TEXT,
    "rootCause" TEXT,
    "firstRespondedAt" TIMESTAMP(3),
    "resolvedAt" TIMESTAMP(3),
    "closedAt" TIMESTAMP(3),
    "responseDueAt" TIMESTAMP(3),
    "resolveDueAt" TIMESTAMP(3),
    "responseBreached" BOOLEAN NOT NULL DEFAULT false,
    "resolveBreached" BOOLEAN NOT NULL DEFAULT false,
    "reopenCount" INTEGER NOT NULL DEFAULT 0,
    "source" TEXT NOT NULL DEFAULT 'portal',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Incident_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "KnowledgeArticle" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "summary" TEXT,
    "body" TEXT NOT NULL,
    "category" TEXT NOT NULL DEFAULT 'GENERAL',
    "tags" JSONB NOT NULL DEFAULT '[]',
    "views" INTEGER NOT NULL DEFAULT 0,
    "helpful" INTEGER NOT NULL DEFAULT 0,
    "notHelpful" INTEGER NOT NULL DEFAULT 0,
    "published" BOOLEAN NOT NULL DEFAULT true,
    "incidentId" TEXT,
    "authorId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "KnowledgeArticle_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ServiceComment" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "entityType" "ServiceEntityType" NOT NULL,
    "entityId" TEXT NOT NULL,
    "authorId" TEXT,
    "authorName" TEXT,
    "body" TEXT NOT NULL,
    "internal" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ServiceComment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ServiceSlaPolicy" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "priority" "ServicePriority" NOT NULL,
    "name" TEXT NOT NULL,
    "responseMinutes" INTEGER NOT NULL,
    "resolveMinutes" INTEGER NOT NULL,
    "businessHoursOnly" BOOLEAN NOT NULL DEFAULT false,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ServiceSlaPolicy_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ServiceItem_organizationId_active_idx" ON "ServiceItem"("organizationId", "active");

-- CreateIndex
CREATE INDEX "ServiceItem_organizationId_category_idx" ON "ServiceItem"("organizationId", "category");

-- CreateIndex
CREATE INDEX "ServiceRequest_organizationId_status_idx" ON "ServiceRequest"("organizationId", "status");

-- CreateIndex
CREATE INDEX "ServiceRequest_organizationId_createdAt_idx" ON "ServiceRequest"("organizationId", "createdAt");

-- CreateIndex
CREATE INDEX "ServiceRequest_assigneeId_idx" ON "ServiceRequest"("assigneeId");

-- CreateIndex
CREATE INDEX "ServiceRequest_requesterId_idx" ON "ServiceRequest"("requesterId");

-- CreateIndex
CREATE UNIQUE INDEX "ServiceRequest_organizationId_number_key" ON "ServiceRequest"("organizationId", "number");

-- CreateIndex
CREATE INDEX "Incident_organizationId_status_idx" ON "Incident"("organizationId", "status");

-- CreateIndex
CREATE INDEX "Incident_organizationId_createdAt_idx" ON "Incident"("organizationId", "createdAt");

-- CreateIndex
CREATE INDEX "Incident_assigneeId_idx" ON "Incident"("assigneeId");

-- CreateIndex
CREATE UNIQUE INDEX "Incident_organizationId_number_key" ON "Incident"("organizationId", "number");

-- CreateIndex
CREATE INDEX "KnowledgeArticle_organizationId_category_idx" ON "KnowledgeArticle"("organizationId", "category");

-- CreateIndex
CREATE UNIQUE INDEX "KnowledgeArticle_organizationId_slug_key" ON "KnowledgeArticle"("organizationId", "slug");

-- CreateIndex
CREATE INDEX "ServiceComment_organizationId_entityType_entityId_idx" ON "ServiceComment"("organizationId", "entityType", "entityId");

-- CreateIndex
CREATE INDEX "ServiceComment_entityType_entityId_idx" ON "ServiceComment"("entityType", "entityId");

-- CreateIndex
CREATE UNIQUE INDEX "ServiceSlaPolicy_organizationId_priority_key" ON "ServiceSlaPolicy"("organizationId", "priority");

-- AddForeignKey
ALTER TABLE "ServiceItem" ADD CONSTRAINT "ServiceItem_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ServiceItem" ADD CONSTRAINT "ServiceItem_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ServiceRequest" ADD CONSTRAINT "ServiceRequest_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ServiceRequest" ADD CONSTRAINT "ServiceRequest_itemId_fkey" FOREIGN KEY ("itemId") REFERENCES "ServiceItem"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ServiceRequest" ADD CONSTRAINT "ServiceRequest_requesterId_fkey" FOREIGN KEY ("requesterId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ServiceRequest" ADD CONSTRAINT "ServiceRequest_assigneeId_fkey" FOREIGN KEY ("assigneeId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ServiceRequest" ADD CONSTRAINT "ServiceRequest_approverId_fkey" FOREIGN KEY ("approverId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Incident" ADD CONSTRAINT "Incident_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Incident" ADD CONSTRAINT "Incident_assigneeId_fkey" FOREIGN KEY ("assigneeId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Incident" ADD CONSTRAINT "Incident_requesterId_fkey" FOREIGN KEY ("requesterId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Incident" ADD CONSTRAINT "Incident_linkedRequestId_fkey" FOREIGN KEY ("linkedRequestId") REFERENCES "ServiceRequest"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "KnowledgeArticle" ADD CONSTRAINT "KnowledgeArticle_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "KnowledgeArticle" ADD CONSTRAINT "KnowledgeArticle_authorId_fkey" FOREIGN KEY ("authorId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ServiceComment" ADD CONSTRAINT "ServiceComment_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ServiceComment" ADD CONSTRAINT "ServiceComment_authorId_fkey" FOREIGN KEY ("authorId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ServiceSlaPolicy" ADD CONSTRAINT "ServiceSlaPolicy_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;
