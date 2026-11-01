import { Module } from "@nestjs/common"
import { StorageService } from "./storage.service"
import { AttachmentsController } from "./attachments.controller"

@Module({
  providers: [StorageService],
  controllers: [AttachmentsController],
  exports: [StorageService],
})
export class StorageModule {}