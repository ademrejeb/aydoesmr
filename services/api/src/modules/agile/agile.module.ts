import { Module } from "@nestjs/common"
import { AgileService } from "./agile.service"
import { AgileController } from "./agile.controller"

@Module({
  controllers: [AgileController],
  providers: [AgileService],
  exports: [AgileService],
})
export class AgileModule {}