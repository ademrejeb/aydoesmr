import { Module } from "@nestjs/common"
import { PipelinesService } from "./pipelines.service"
import { PoliciesModule } from "../policies/policies.module"
import { PipelinesController } from "./pipelines.controller"

@Module({
  imports: [PoliciesModule],
  providers: [PipelinesService],
  controllers: [PipelinesController],
  exports: [PipelinesService],
})
export class PipelinesModule {}