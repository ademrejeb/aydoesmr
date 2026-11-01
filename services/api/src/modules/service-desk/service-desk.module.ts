import { Module } from "@nestjs/common"
import { AuditModule } from "../audit/audit.module"
import { ServiceDeskService } from "./service-desk.service"
import { ServiceDeskController } from "./service-desk.controller"
import { ServiceDeskPublicController } from "./service-desk-public.controller"

@Module({
  imports: [AuditModule],
  providers: [ServiceDeskService],
  controllers: [ServiceDeskController, ServiceDeskPublicController],
  exports: [ServiceDeskService],
})
export class ServiceDeskModule {}