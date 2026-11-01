-- CreateTable
CREATE TABLE "AiActionRun" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "providerId" TEXT,
    "providerName" TEXT,
    "model" TEXT,
    "action" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'completed',
    "input" JSONB NOT NULL,
    "output" JSONB,
    "applied" BOOLEAN NOT NULL DEFAULT false,
    "appliedAt" TIMESTAMP(3),
    "error" TEXT,
    "durationMs" INTEGER,
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AiActionRun_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "AiActionRun_organizationId_idx" ON "AiActionRun"("organizationId");

-- CreateIndex
CREATE INDEX "AiActionRun_organizationId_createdAt_idx" ON "AiActionRun"("organizationId", "createdAt");

-- CreateIndex
CREATE INDEX "AiActionRun_action_idx" ON "AiActionRun"("action");

-- AddForeignKey
ALTER TABLE "AiActionRun" ADD CONSTRAINT "AiActionRun_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AiActionRun" ADD CONSTRAINT "AiActionRun_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
