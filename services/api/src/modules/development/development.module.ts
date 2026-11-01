import { Module } from "@nestjs/common"
import { DevelopmentService } from "./development.service"
import { DevelopmentController, GitWebhookController } from "./development.controller"
import { AiModule } from "../ai/ai.module"

@Module({
  imports: [AiModule],
  providers: [DevelopmentService],
  controllers: [DevelopmentController, GitWebhookController],
  exports: [DevelopmentService],
})
export class DevelopmentModule {}