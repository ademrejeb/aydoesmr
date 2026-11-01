-- AlterTable
ALTER TABLE "DevIssue" ADD COLUMN     "suggestion" TEXT;

-- CreateTable
CREATE TABLE "ServerConnection" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "host" TEXT NOT NULL,
    "port" INTEGER NOT NULL DEFAULT 22,
    "protocol" TEXT NOT NULL DEFAULT 'ssh',
    "username" TEXT,
    "credentialEncrypted" TEXT,
    "credentialNonce" TEXT,
    "lastProbeAt" TIMESTAMP(3),
    "lastProbeOk" BOOLEAN,
    "lastProbeError" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ServerConnection_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DeployedApp" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "connectionId" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "probePath" TEXT,
    "probeMethod" TEXT,
    "lastCheckAt" TIMESTAMP(3),
    "lastStatus" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "DeployedApp_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ServerConnection_organizationId_idx" ON "ServerConnection"("organizationId");

-- CreateIndex
CREATE INDEX "DeployedApp_organizationId_idx" ON "DeployedApp"("organizationId");

-- CreateIndex
CREATE INDEX "DeployedApp_connectionId_idx" ON "DeployedApp"("connectionId");

-- AddForeignKey
ALTER TABLE "ServerConnection" ADD CONSTRAINT "ServerConnection_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DeployedApp" ADD CONSTRAINT "DeployedApp_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DeployedApp" ADD CONSTRAINT "DeployedApp_connectionId_fkey" FOREIGN KEY ("connectionId") REFERENCES "ServerConnection"("id") ON DELETE CASCADE ON UPDATE CASCADE;
