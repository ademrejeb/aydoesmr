-- CreateEnum
CREATE TYPE "PayrollRunStatus" AS ENUM ('PENDING', 'PAID');

-- CreateTable
CREATE TABLE "PayrollRun" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "month" TEXT NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'MAD',
    "status" "PayrollRunStatus" NOT NULL DEFAULT 'PENDING',
    "grossTotal" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "netTotal" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "entries" JSONB NOT NULL DEFAULT '[]',
    "createdById" TEXT,
    "paidAt" TIMESTAMP(3),
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PayrollRun_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "PayrollRun_organizationId_status_idx" ON "PayrollRun"("organizationId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "PayrollRun_organizationId_month_key" ON "PayrollRun"("organizationId", "month");

-- AddForeignKey
ALTER TABLE "PayrollRun" ADD CONSTRAINT "PayrollRun_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PayrollRun" ADD CONSTRAINT "PayrollRun_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
