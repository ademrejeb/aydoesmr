-- CreateTable
CREATE TABLE "CompanyOffDay" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "date" TIMESTAMP(3) NOT NULL,
    "name" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CompanyOffDay_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "CompanyOffDay_organizationId_date_key" ON "CompanyOffDay"("organizationId", "date");

-- CreateIndex
CREATE INDEX "CompanyOffDay_organizationId_date_idx" ON "CompanyOffDay"("organizationId", "date");

-- AddForeignKey
ALTER TABLE "CompanyOffDay" ADD CONSTRAINT "CompanyOffDay_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;