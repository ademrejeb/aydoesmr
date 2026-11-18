-- Isolated command runner, cost accounting and project knowledge (additive).

ALTER TYPE "FactoryGateStatus" ADD VALUE IF NOT EXISTS 'SKIPPED';

CREATE TYPE "FactoryCommandStatus" AS ENUM ('QUEUED', 'RUNNING', 'PASSED', 'FAILED', 'BLOCKED', 'TIMEOUT', 'CANCELLED');

CREATE TABLE "FactoryCommandRun" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "runId" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "command" TEXT NOT NULL,
    "runner" TEXT NOT NULL,
    "status" "FactoryCommandStatus" NOT NULL DEFAULT 'QUEUED',
    "exitCode" INTEGER,
    "output" TEXT,
    "durationMs" INTEGER,
    "error" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "startedAt" TIMESTAMP(3),
    "completedAt" TIMESTAMP(3),

    CONSTRAINT "FactoryCommandRun_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FactoryCostEvent" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "runId" TEXT,
    "taskId" TEXT,
    "kind" TEXT NOT NULL,
    "provider" TEXT,
    "model" TEXT,
    "inputTokens" INTEGER NOT NULL DEFAULT 0,
    "outputTokens" INTEGER NOT NULL DEFAULT 0,
    "totalTokens" INTEGER NOT NULL DEFAULT 0,
    "estimatedCostUsd" DOUBLE PRECISION,
    "durationMs" INTEGER,
    "metadata" JSONB NOT NULL DEFAULT '{}',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "FactoryCostEvent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ProjectKnowledge" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "projectId" TEXT,
    "title" TEXT NOT NULL,
    "category" TEXT NOT NULL DEFAULT 'architecture',
    "content" TEXT NOT NULL,
    "source" TEXT,
    "version" INTEGER NOT NULL DEFAULT 1,
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ProjectKnowledge_pkey" PRIMARY KEY ("id")
);


CREATE INDEX "FactoryCommandRun_organizationId_createdAt_idx" ON "FactoryCommandRun"("organizationId", "createdAt");

-- CreateIndex
CREATE INDEX "FactoryCommandRun_runId_kind_createdAt_idx" ON "FactoryCommandRun"("runId", "kind", "createdAt");

-- CreateIndex
CREATE INDEX "FactoryCostEvent_organizationId_createdAt_idx" ON "FactoryCostEvent"("organizationId", "createdAt");

-- CreateIndex
CREATE INDEX "FactoryCostEvent_runId_createdAt_idx" ON "FactoryCostEvent"("runId", "createdAt");

-- CreateIndex
CREATE INDEX "ProjectKnowledge_organizationId_projectId_category_idx" ON "ProjectKnowledge"("organizationId", "projectId", "category");


ALTER TABLE "FactoryCommandRun" ADD CONSTRAINT "FactoryCommandRun_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FactoryCommandRun" ADD CONSTRAINT "FactoryCommandRun_runId_fkey" FOREIGN KEY ("runId") REFERENCES "FactoryRun"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FactoryCostEvent" ADD CONSTRAINT "FactoryCostEvent_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FactoryCostEvent" ADD CONSTRAINT "FactoryCostEvent_runId_fkey" FOREIGN KEY ("runId") REFERENCES "FactoryRun"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProjectKnowledge" ADD CONSTRAINT "ProjectKnowledge_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProjectKnowledge" ADD CONSTRAINT "ProjectKnowledge_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;


ALTER TABLE "FactoryPlan" ADD COLUMN "knowledgeRefs" JSONB NOT NULL DEFAULT '[]';
