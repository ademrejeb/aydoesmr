import { Module } from "@nestjs/common"
import { AgentFactoryModule } from "../agent-factory/agent-factory.module"
import { AiModule } from "../ai/ai.module"
import { GitModule } from "../git/git.module"
import { PoliciesModule } from "../policies/policies.module"
import { FactoryController } from "./factory.controller"
import { FactoryService } from "./factory.service"

@Module({
  imports: [AiModule, AgentFactoryModule, GitModule, PoliciesModule],
  controllers: [FactoryController],
  providers: [FactoryService],
  exports: [FactoryService],
})
export class FactoryModule {}
