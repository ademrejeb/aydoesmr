import { Module, forwardRef } from "@nestjs/common"
import { TasksService } from "./tasks.service"
import { TasksController } from "./tasks.controller"
import { AgileModule } from "../agile/agile.module"

@Module({
  imports: [forwardRef(() => AgileModule)],
  providers: [TasksService],
  controllers: [TasksController],
  exports: [TasksService],
})
export class TasksModule {}