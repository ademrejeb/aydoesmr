import { Module } from "@nestjs/common"
import { ConfigModule, ConfigService } from "@nestjs/config"
import { JwtModule } from "@nestjs/jwt"
import { SignOptions } from "jsonwebtoken"
import { APP_GUARD } from "@nestjs/core"
import { PrismaModule } from "./prisma/prisma.module"
import { JwtAuthGuard } from "./common/guards/jwt-auth.guard"
import { AuthModule } from "./modules/auth/auth.module"
import { OrganizationsModule } from "./modules/organizations/organizations.module"
import { TeamsModule } from "./modules/teams/teams.module"
import { ProjectsModule } from "./modules/projects/projects.module"
import { TasksModule } from "./modules/tasks/tasks.module"
import { AgileModule } from "./modules/agile/agile.module"
import { DevelopmentModule } from "./modules/development/development.module"
import { GitModule } from "./modules/git/git.module"
import { PipelinesModule } from "./modules/pipelines/pipelines.module"
import { AiModule } from "./modules/ai/ai.module"
import { AiActionsModule } from "./modules/ai-actions/ai-actions.module"
import { AgentFactoryModule } from "./modules/agent-factory/agent-factory.module"
import { PlannerModule } from "./modules/planner/planner.module"
import { NotificationsModule } from "./modules/notifications/notifications.module"
import { ConversationsModule } from "./modules/conversations/conversations.module"
import { TimesheetsModule } from "./modules/timesheets/timesheets.module"
import { PayrollModule } from "./modules/payroll/payroll.module"
import { ServersModule } from "./modules/servers/servers.module"
import { ServiceDeskModule } from "./modules/service-desk/service-desk.module"
import { MailModule } from "./mail/mail.module"
import { HealthModule } from "./health/health.module"
import { RealtimeModule } from "./realtime/realtime.module"
import { StorageModule } from "./storage/storage.module"

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    JwtModule.registerAsync({
      global: true,
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        secret: config.get<string>("JWT_SECRET", "dev-secret-change-me-in-production"),
        signOptions: { expiresIn: config.get<string>("JWT_ACCESS_TTL", "900s") as SignOptions["expiresIn"] },
      }),
    }),
    PrismaModule,
    MailModule,
    AuthModule,
    OrganizationsModule,
    TeamsModule,
    ProjectsModule,
    TasksModule,
    AgileModule,
    DevelopmentModule,
    GitModule,
    PipelinesModule,
    AiModule,
    AiActionsModule,
    AgentFactoryModule,
    PlannerModule,
    NotificationsModule,
    ConversationsModule,
    TimesheetsModule,
    ServersModule,
    ServiceDeskModule,
    PayrollModule,
    HealthModule,
    StorageModule,
    RealtimeModule,
  ],
  providers: [
    {
      provide: APP_GUARD,
      useClass: JwtAuthGuard,
    },
  ],
})
export class AppModule {}