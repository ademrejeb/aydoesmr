-- Baseline migration for schema that was previously applied with `prisma db push`
-- (development DB) instead of a committed migration. Recorded so that the
-- migration history matches the database without requiring a destructive reset.

-- AlterTable
ALTER TABLE "public"."DevIssue" ADD COLUMN     "codeSnippet" TEXT,
ADD COLUMN     "fix" JSONB;

-- CreateTable
CREATE TABLE "public"."DevAnalysisConfig" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "projectId" TEXT,
    "config" JSONB DEFAULT '{}',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "DevAnalysisConfig_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "DevAnalysisConfig_organizationId_idx" ON "public"."DevAnalysisConfig"("organizationId" ASC);

-- CreateIndex
CREATE UNIQUE INDEX "DevAnalysisConfig_organizationId_projectId_key" ON "public"."DevAnalysisConfig"("organizationId" ASC, "projectId" ASC);

-- AddForeignKey
ALTER TABLE "public"."DevAnalysisConfig" ADD CONSTRAINT "DevAnalysisConfig_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "public"."Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."DevAnalysisConfig" ADD CONSTRAINT "DevAnalysisConfig_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "public"."Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;