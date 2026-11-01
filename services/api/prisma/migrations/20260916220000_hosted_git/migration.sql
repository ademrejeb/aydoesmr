-- Hosted Git hosting: platform-managed repositories + push access tokens
CREATE TABLE "GitRepository" (
  "id"             TEXT NOT NULL,
  "organizationId" TEXT NOT NULL,
  "projectId"      TEXT,
  "name"           TEXT NOT NULL,
  "description"    TEXT,
  "visibility"     TEXT NOT NULL DEFAULT 'private',
  "storagePath"    TEXT NOT NULL,
  "defaultBranch"  TEXT NOT NULL DEFAULT 'main',
  "sizeKb"         INTEGER NOT NULL DEFAULT 0,
  "fileCount"      INTEGER NOT NULL DEFAULT 0,
  "lastCommitSha"  TEXT,
  "lastPushAt"     TIMESTAMP(3),
  "createdAt"      TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"      TIMESTAMP(3) NOT NULL,
  CONSTRAINT "GitRepository_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "GitToken" (
  "id"             TEXT NOT NULL,
  "organizationId" TEXT NOT NULL,
  "userId"         TEXT NOT NULL,
  "name"           TEXT NOT NULL,
  "tokenHash"      TEXT NOT NULL,
  "prefix"         TEXT NOT NULL,
  "lastUsedAt"     TIMESTAMP(3),
  "createdAt"      TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "revokedAt"      TIMESTAMP(3),
  CONSTRAINT "GitToken_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "GitRepository_organizationId_name_key" ON "GitRepository"("organizationId", "name");
CREATE INDEX "GitRepository_organizationId_idx" ON "GitRepository"("organizationId");
CREATE INDEX "GitToken_organizationId_idx" ON "GitToken"("organizationId");
CREATE INDEX "GitToken_tokenHash_idx" ON "GitToken"("tokenHash");

ALTER TABLE "GitRepository" ADD CONSTRAINT "GitRepository_organizationId_fkey"
  FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "GitRepository" ADD CONSTRAINT "GitRepository_projectId_fkey"
  FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "GitToken" ADD CONSTRAINT "GitToken_organizationId_fkey"
  FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "GitToken" ADD CONSTRAINT "GitToken_userId_fkey"
  FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;