import { Module } from "@nestjs/common"
import { AiActionsController } from "./ai-actions.controller"
import { AiActionsService } from "./ai-actions.service"
import { AiModule } from "../ai/ai.module"
import { GitModule } from "../git/git.module"

/** Predefined AI actions: Dockerfile, pipeline and scan-fix optimization across the app. */
@Module({
  imports: [AiModule, GitModule],
  controllers: [AiActionsController],
  providers: [AiActionsService],
})
export class AiActionsModule {}