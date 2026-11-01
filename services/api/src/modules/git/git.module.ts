import { Module } from "@nestjs/common"
import { GitService } from "./git.service"
import { GitController } from "./git.controller"
import { GitHttpController } from "./git-http.controller"
import { GitAuthGuard } from "./git-auth.guard"

@Module({
  providers: [GitService, GitAuthGuard],
  controllers: [GitController, GitHttpController],
  exports: [GitService],
})
export class GitModule {}