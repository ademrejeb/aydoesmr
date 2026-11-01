-- CreateTable
CREATE TABLE "SprintPlan" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "fileName" TEXT NOT NULL,
    "mimeType" TEXT NOT NULL,
    "charCount" INTEGER NOT NULL DEFAULT 0,
    "status" TEXT NOT NULL DEFAULT 'GENERATED',
    "error" TEXT,
    "tickets" JSONB,
    "projectId" TEXT,
    "teamId" TEXT,
    "sprintName" TEXT,
    "sprintId" TEXT,
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SprintPlan_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "SprintPlan_organizationId_idx" ON "SprintPlan"("organizationId");

-- CreateIndex
CREATE INDEX "SprintPlan_organizationId_createdAt_idx" ON "SprintPlan"("organizationId", "createdAt");

-- AddForeignKey
ALTER TABLE "SprintPlan" ADD CONSTRAINT "SprintPlan_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SprintPlan" ADD CONSTRAINT "SprintPlan_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
