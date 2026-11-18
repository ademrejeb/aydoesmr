import { Module } from "@nestjs/common"
import { AiModule } from "../ai/ai.module"
import { PoliciesModule } from "../policies/policies.module"
import { AgentFactoryController } from "./agent-factory.controller"
import { AgentFactoryService } from "./agent-factory.service"

@Module({
  imports: [AiModule, PoliciesModule],
  controllers: [AgentFactoryController],
  providers: [AgentFactoryService],
  exports: [AgentFactoryService],
})
export class AgentFactoryModule {}
