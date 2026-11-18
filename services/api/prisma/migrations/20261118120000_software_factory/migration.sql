-- Software factory + governance policy foundation.
-- Additive only: no existing table or column is modified or dropped.

CREATE TYPE "PolicyEffect" AS ENUM ('ALLOW', 'DENY', 'REQUIRE_APPROVAL', 'WARN');
CREATE TYPE "FactoryRunStatus" AS ENUM ('QUEUED', 'TRIAGED', 'PLANNED', 'WAITING_APPROVAL', 'EXECUTING', 'QUALITY_CHECK', 'WAITING_REVIEW', 'READY_TO_MERGE', 'MERGED', 'FAILED', 'BLOCKED', 'CANCELLED');
CREATE TYPE "FactoryApprovalStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED');
CREATE TYPE "FactoryGateStatus" AS ENUM ('PENDING', 'PASSED', 'FAILED', 'BLOCKED');

CREATE TABLE "PolicyRule" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "projectId" TEXT,
    "repositoryId" TEXT,
    "key" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "category" TEXT NOT NULL DEFAULT 'agent',
    "effect" "PolicyEffect" NOT NULL,
    "priority" INTEGER NOT NULL DEFAULT 100,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "scope" TEXT NOT NULL DEFAULT 'ORGANIZATION',
    "subject" TEXT NOT NULL,
    "conditions" JSONB NOT NULL DEFAULT '[]',
    "actions" JSONB NOT NULL DEFAULT '{}',
    "version" INTEGER NOT NULL DEFAULT 1,
    "createdById" TEXT,
    "updatedById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PolicyRule_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PolicyRuleVersion" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "ruleId" TEXT NOT NULL,
    "version" INTEGER NOT NULL,
    "snapshot" JSONB NOT NULL,
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PolicyRuleVersion_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PolicyEvaluation" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "projectId" TEXT,
    "runId" TEXT,
    "subject" TEXT NOT NULL,
    "action" TEXT,
    "decision" TEXT NOT NULL,
    "allowed" BOOLEAN NOT NULL,
    "reasons" JSONB NOT NULL DEFAULT '[]',
    "context" JSONB NOT NULL DEFAULT '{}',
    "ruleIds" JSONB NOT NULL DEFAULT '[]',
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PolicyEvaluation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AgentProfile" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "role" TEXT NOT NULL,
    "description" TEXT,
    "instructions" TEXT,
    "connectionId" TEXT,
    "modelProviderId" TEXT,
    "model" TEXT,
    "capabilities" JSONB NOT NULL DEFAULT '[]',
    "allowedTools" JSONB NOT NULL DEFAULT '[]',
    "permissions" JSONB NOT NULL DEFAULT '{}',
    "budgetTokens" INTEGER NOT NULL DEFAULT 20000,
    "timeoutSeconds" INTEGER NOT NULL DEFAULT 120,
    "maxRetries" INTEGER NOT NULL DEFAULT 1,
    "version" INTEGER NOT NULL DEFAULT 1,
    "status" TEXT NOT NULL DEFAULT 'active',
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AgentProfile_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FactoryIssueProfile" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "taskId" TEXT NOT NULL,
    "classification" TEXT NOT NULL,
    "labels" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "complexity" INTEGER NOT NULL DEFAULT 1,
    "risk" TEXT NOT NULL DEFAULT 'low',
    "autonomous" BOOLEAN NOT NULL DEFAULT false,
    "confidence" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "missingAcceptanceCriteria" BOOLEAN NOT NULL DEFAULT false,
    "duplicateOfIds" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "suggestedPriority" TEXT,
    "suggestedAgentRole" TEXT,
    "rationale" JSONB NOT NULL DEFAULT '[]',
    "analyzedBy" TEXT NOT NULL DEFAULT 'heuristic',
    "model" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "FactoryIssueProfile_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FactoryRun" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "taskId" TEXT NOT NULL,
    "repositoryId" TEXT,
    "agentProfileId" TEXT,
    "connectionId" TEXT,
    "status" "FactoryRunStatus" NOT NULL DEFAULT 'QUEUED',
    "stage" TEXT NOT NULL DEFAULT 'TRIAGE',
    "correlationId" TEXT NOT NULL,
    "idempotencyKey" TEXT NOT NULL,
    "branch" TEXT,
    "baseBranch" TEXT,
    "commitSha" TEXT,
    "planVersion" INTEGER,
    "error" TEXT,
    "metadata" JSONB NOT NULL DEFAULT '{}',
    "createdById" TEXT,
    "startedAt" TIMESTAMP(3),
    "completedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "FactoryRun_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FactoryPlan" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "runId" TEXT NOT NULL,
    "version" INTEGER NOT NULL DEFAULT 1,
    "status" TEXT NOT NULL DEFAULT 'GENERATED',
    "summary" TEXT NOT NULL,
    "steps" JSONB NOT NULL DEFAULT '[]',
    "files" JSONB NOT NULL DEFAULT '[]',
    "tests" JSONB NOT NULL DEFAULT '[]',
    "acceptanceCriteria" JSONB NOT NULL DEFAULT '[]',
    "risks" JSONB NOT NULL DEFAULT '[]',
    "outOfScope" JSONB NOT NULL DEFAULT '[]',
    "approvalRequired" BOOLEAN NOT NULL DEFAULT true,
    "generatedBy" TEXT NOT NULL DEFAULT 'heuristic',
    "model" TEXT,
    "reasoning" TEXT,
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "FactoryPlan_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FactoryEvent" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "runId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "actorId" TEXT,
    "correlationId" TEXT NOT NULL,
    "payload" JSONB NOT NULL DEFAULT '{}',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "FactoryEvent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FactoryApproval" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "runId" TEXT NOT NULL,
    "stage" TEXT NOT NULL,
    "status" "FactoryApprovalStatus" NOT NULL DEFAULT 'PENDING',
    "requestedRole" TEXT,
    "requestedById" TEXT,
    "decidedById" TEXT,
    "reason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "decidedAt" TIMESTAMP(3),

    CONSTRAINT "FactoryApproval_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FactoryQualityGate" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "runId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "status" "FactoryGateStatus" NOT NULL DEFAULT 'PENDING',
    "detail" TEXT,
    "evidence" JSONB NOT NULL DEFAULT '{}',
    "scanId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "FactoryQualityGate_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "PolicyRule_organizationId_subject_enabled_idx" ON "PolicyRule"("organizationId", "subject", "enabled");

-- CreateIndex
CREATE INDEX "PolicyRule_organizationId_projectId_idx" ON "PolicyRule"("organizationId", "projectId");

-- CreateIndex
CREATE UNIQUE INDEX "PolicyRule_organizationId_key_key" ON "PolicyRule"("organizationId", "key");

-- CreateIndex
CREATE INDEX "PolicyRuleVersion_organizationId_createdAt_idx" ON "PolicyRuleVersion"("organizationId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "PolicyRuleVersion_ruleId_version_key" ON "PolicyRuleVersion"("ruleId", "version");

-- CreateIndex
CREATE INDEX "PolicyEvaluation_organizationId_createdAt_idx" ON "PolicyEvaluation"("organizationId", "createdAt");

-- CreateIndex
CREATE INDEX "PolicyEvaluation_organizationId_subject_createdAt_idx" ON "PolicyEvaluation"("organizationId", "subject", "createdAt");

-- CreateIndex
CREATE INDEX "AgentProfile_organizationId_role_status_idx" ON "AgentProfile"("organizationId", "role", "status");

-- CreateIndex
CREATE UNIQUE INDEX "AgentProfile_organizationId_slug_key" ON "AgentProfile"("organizationId", "slug");

-- CreateIndex
CREATE UNIQUE INDEX "FactoryIssueProfile_taskId_key" ON "FactoryIssueProfile"("taskId");

-- CreateIndex
CREATE INDEX "FactoryIssueProfile_organizationId_classification_idx" ON "FactoryIssueProfile"("organizationId", "classification");

-- CreateIndex
CREATE INDEX "FactoryIssueProfile_organizationId_autonomous_idx" ON "FactoryIssueProfile"("organizationId", "autonomous");

-- CreateIndex
CREATE UNIQUE INDEX "FactoryRun_correlationId_key" ON "FactoryRun"("correlationId");

-- CreateIndex
CREATE INDEX "FactoryRun_organizationId_status_createdAt_idx" ON "FactoryRun"("organizationId", "status", "createdAt");

-- CreateIndex
CREATE INDEX "FactoryRun_organizationId_taskId_idx" ON "FactoryRun"("organizationId", "taskId");

-- CreateIndex
CREATE UNIQUE INDEX "FactoryRun_organizationId_idempotencyKey_key" ON "FactoryRun"("organizationId", "idempotencyKey");

-- CreateIndex
CREATE INDEX "FactoryPlan_organizationId_createdAt_idx" ON "FactoryPlan"("organizationId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "FactoryPlan_runId_version_key" ON "FactoryPlan"("runId", "version");

-- CreateIndex
CREATE INDEX "FactoryEvent_organizationId_createdAt_idx" ON "FactoryEvent"("organizationId", "createdAt");

-- CreateIndex
CREATE INDEX "FactoryEvent_runId_createdAt_idx" ON "FactoryEvent"("runId", "createdAt");

-- CreateIndex
CREATE INDEX "FactoryApproval_organizationId_status_createdAt_idx" ON "FactoryApproval"("organizationId", "status", "createdAt");

-- CreateIndex
CREATE INDEX "FactoryApproval_runId_stage_idx" ON "FactoryApproval"("runId", "stage");

-- CreateIndex
CREATE INDEX "FactoryQualityGate_organizationId_status_idx" ON "FactoryQualityGate"("organizationId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "FactoryQualityGate_runId_name_key" ON "FactoryQualityGate"("runId", "name");

ALTER TABLE "PolicyRule" ADD CONSTRAINT "PolicyRule_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PolicyRuleVersion" ADD CONSTRAINT "PolicyRuleVersion_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PolicyRuleVersion" ADD CONSTRAINT "PolicyRuleVersion_ruleId_fkey" FOREIGN KEY ("ruleId") REFERENCES "PolicyRule"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PolicyEvaluation" ADD CONSTRAINT "PolicyEvaluation_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AgentProfile" ADD CONSTRAINT "AgentProfile_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AgentProfile" ADD CONSTRAINT "AgentProfile_connectionId_fkey" FOREIGN KEY ("connectionId") REFERENCES "AgentConnection"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AgentProfile" ADD CONSTRAINT "AgentProfile_modelProviderId_fkey" FOREIGN KEY ("modelProviderId") REFERENCES "AiProvider"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FactoryIssueProfile" ADD CONSTRAINT "FactoryIssueProfile_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FactoryIssueProfile" ADD CONSTRAINT "FactoryIssueProfile_taskId_fkey" FOREIGN KEY ("taskId") REFERENCES "Task"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FactoryRun" ADD CONSTRAINT "FactoryRun_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FactoryRun" ADD CONSTRAINT "FactoryRun_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FactoryRun" ADD CONSTRAINT "FactoryRun_taskId_fkey" FOREIGN KEY ("taskId") REFERENCES "Task"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FactoryRun" ADD CONSTRAINT "FactoryRun_repositoryId_fkey" FOREIGN KEY ("repositoryId") REFERENCES "GitRepository"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FactoryRun" ADD CONSTRAINT "FactoryRun_agentProfileId_fkey" FOREIGN KEY ("agentProfileId") REFERENCES "AgentProfile"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FactoryRun" ADD CONSTRAINT "FactoryRun_connectionId_fkey" FOREIGN KEY ("connectionId") REFERENCES "AgentConnection"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FactoryPlan" ADD CONSTRAINT "FactoryPlan_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FactoryPlan" ADD CONSTRAINT "FactoryPlan_runId_fkey" FOREIGN KEY ("runId") REFERENCES "FactoryRun"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FactoryEvent" ADD CONSTRAINT "FactoryEvent_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FactoryEvent" ADD CONSTRAINT "FactoryEvent_runId_fkey" FOREIGN KEY ("runId") REFERENCES "FactoryRun"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FactoryApproval" ADD CONSTRAINT "FactoryApproval_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FactoryApproval" ADD CONSTRAINT "FactoryApproval_runId_fkey" FOREIGN KEY ("runId") REFERENCES "FactoryRun"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FactoryApproval" ADD CONSTRAINT "FactoryApproval_decidedById_fkey" FOREIGN KEY ("decidedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FactoryQualityGate" ADD CONSTRAINT "FactoryQualityGate_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FactoryQualityGate" ADD CONSTRAINT "FactoryQualityGate_runId_fkey" FOREIGN KEY ("runId") REFERENCES "FactoryRun"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FactoryQualityGate" ADD CONSTRAINT "FactoryQualityGate_scanId_fkey" FOREIGN KEY ("scanId") REFERENCES "DevScan"("id") ON DELETE SET NULL ON UPDATE CASCADE;

