-- Automation discovery proposals (advisory, additive).
CREATE TABLE "AutomationProposal" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "fingerprint" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "frequency" INTEGER NOT NULL,
    "estimatedMinutesSaved" INTEGER NOT NULL,
    "complexity" TEXT NOT NULL,
    "risk" TEXT NOT NULL,
    "requiredPermissions" TEXT[],
    "proposedWorkflow" JSONB NOT NULL DEFAULT '{}',
    "evidence" JSONB NOT NULL DEFAULT '{}',
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "createdById" TEXT,
    "decidedById" TEXT,
    "decisionReason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "decidedAt" TIMESTAMP(3),

    CONSTRAINT "AutomationProposal_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "AutomationProposal_organizationId_status_frequency_idx" ON "AutomationProposal"("organizationId", "status", "frequency");

-- CreateIndex
CREATE UNIQUE INDEX "AutomationProposal_organizationId_fingerprint_key" ON "AutomationProposal"("organizationId", "fingerprint");

ALTER TABLE "AutomationProposal" ADD CONSTRAINT "AutomationProposal_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;
