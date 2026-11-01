-- Git integration for DevRepository
ALTER TABLE "DevRepository"
  ADD COLUMN "provider" TEXT NOT NULL DEFAULT 'other',
  ADD COLUMN "token" TEXT,
  ADD COLUMN "webhookSecret" TEXT,
  ADD COLUMN "scanOnPush" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN "lastSyncAt" TIMESTAMP(3),
  ADD COLUMN "lastCommitSha" TEXT;

CREATE INDEX "DevRepository_projectId_idx" ON "DevRepository"("projectId");

UPDATE "DevRepository" SET "provider" = 'github'
  WHERE "url" ILIKE '%github.com%';
UPDATE "DevRepository" SET "provider" = 'gitlab'
  WHERE "url" ILIKE '%gitlab.com%';
UPDATE "DevRepository" SET "provider" = 'bitbucket'
  WHERE "url" ILIKE '%bitbucket.org%';