import { Module } from "@nestjs/common"
import { AiModule } from "../ai/ai.module"
import { AgentFactoryController } from "./agent-factory.controller"
import { AgentFactoryService } from "./agent-factory.service"

@Module({
  imports: [AiModule],
  controllers: [AgentFactoryController],
  providers: [AgentFactoryService],
})
export class AgentFactoryModule {}
