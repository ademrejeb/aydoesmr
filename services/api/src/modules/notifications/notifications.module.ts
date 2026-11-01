import { Global, Module } from "@nestjs/common"
import { EventEmitterModule } from "@nestjs/event-emitter"
import { NotificationsService } from "./notifications.service"
import { NotificationsController } from "./notifications.controller"

@Global()
@Module({
  imports: [EventEmitterModule.forRoot()],
  providers: [NotificationsService],
  controllers: [NotificationsController],
  exports: [NotificationsService],
})
export class NotificationsModule {}