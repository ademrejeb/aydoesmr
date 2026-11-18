-- Factory pull requests (additive).
CREATE TABLE "FactoryPullRequest" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "runId" TEXT NOT NULL,
    "repositoryId" TEXT NOT NULL,
    "number" INTEGER NOT NULL,
    "title" TEXT NOT NULL,
    "body" TEXT,
    "sourceBranch" TEXT NOT NULL,
    "targetBranch" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'OPEN',
    "risk" TEXT,
    "changedFiles" JSONB NOT NULL DEFAULT '[]',
    "diffStats" JSONB NOT NULL DEFAULT '{}',
    "commitShas" JSONB NOT NULL DEFAULT '[]',
    "findings" JSONB NOT NULL DEFAULT '[]',
    "securityFindings" JSONB NOT NULL DEFAULT '[]',
    "checks" JSONB NOT NULL DEFAULT '[]',
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "mergedAt" TIMESTAMP(3),

    CONSTRAINT "FactoryPullRequest_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "FactoryPullRequest_runId_key" ON "FactoryPullRequest"("runId");

-- CreateIndex
CREATE INDEX "FactoryPullRequest_organizationId_status_createdAt_idx" ON "FactoryPullRequest"("organizationId", "status", "createdAt");

-- CreateIndex
CREATE INDEX "FactoryPullRequest_runId_idx" ON "FactoryPullRequest"("runId");

-- CreateIndex
CREATE UNIQUE INDEX "FactoryPullRequest_repositoryId_number_key" ON "FactoryPullRequest"("repositoryId", "number");


ALTER TABLE "FactoryPullRequest" ADD CONSTRAINT "FactoryPullRequest_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FactoryPullRequest" ADD CONSTRAINT "FactoryPullRequest_runId_fkey" FOREIGN KEY ("runId") REFERENCES "FactoryRun"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FactoryPullRequest" ADD CONSTRAINT "FactoryPullRequest_repositoryId_fkey" FOREIGN KEY ("repositoryId") REFERENCES "GitRepository"("id") ON DELETE CASCADE ON UPDATE CASCADE;

