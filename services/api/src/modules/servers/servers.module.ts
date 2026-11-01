import { Module } from "@nestjs/common"
import { ServersController } from "./servers.controller"
import { ServersService } from "./servers.service"

/** Server / VPS connector: encrypted host credentials + deployed-app health probes. */
@Module({
  controllers: [ServersController],
  providers: [ServersService],
  exports: [ServersService],
})
export class ServersModule {}