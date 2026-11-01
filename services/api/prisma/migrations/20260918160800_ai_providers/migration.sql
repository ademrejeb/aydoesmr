-- CreateTable
CREATE TABLE "AiProvider" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "baseUrl" TEXT,
    "apiKeyEncrypted" TEXT,
    "apiKeyHint" TEXT,
    "models" JSONB NOT NULL DEFAULT '[]',
    "defaultModel" TEXT,
    "status" TEXT NOT NULL DEFAULT 'active',
    "lastTestAt" TIMESTAMP(3),
    "lastTestStatus" TEXT,
    "lastTestError" TEXT,
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AiProvider_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "AiProvider_organizationId_idx" ON "AiProvider"("organizationId");

-- CreateIndex
CREATE INDEX "AiProvider_organizationId_name_idx" ON "AiProvider"("organizationId", "name");

-- AddForeignKey
ALTER TABLE "AiProvider" ADD CONSTRAINT "AiProvider_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AiProvider" ADD CONSTRAINT "AiProvider_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
