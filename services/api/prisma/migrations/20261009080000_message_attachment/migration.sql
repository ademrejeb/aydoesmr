-- AlterTable
ALTER TABLE "FileAttachment" ADD COLUMN "messageId" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "FileAttachment_messageId_key" ON "FileAttachment"("messageId");

-- AddForeignKey
ALTER TABLE "FileAttachment" ADD CONSTRAINT "FileAttachment_messageId_fkey" FOREIGN KEY ("messageId") REFERENCES "Message"("id") ON DELETE CASCADE ON UPDATE CASCADE;