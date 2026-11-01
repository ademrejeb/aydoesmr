import { Module } from "@nestjs/common"
import { PlannerController } from "./planner.controller"
import { PlannerService } from "./planner.service"
import { AgileModule } from "../agile/agile.module"
import { AiModule } from "../ai/ai.module"

/** Sprint planner: cahier de charge → AI-generated backlog → sprint & tickets. */
@Module({
  imports: [AgileModule, AiModule],
  controllers: [PlannerController],
  providers: [PlannerService],
})
export class PlannerModule {}