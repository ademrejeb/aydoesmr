import { Module } from "@nestjs/common"
import { PassportModule } from "@nestjs/passport"
import { AuthService } from "./auth.service"
import { AuthController } from "./auth.controller"
import { JwtStrategy } from "./jwt.strategy"
import { OrganizationsModule } from "../organizations/organizations.module"

@Module({
  imports: [PassportModule.register({ defaultStrategy: "jwt" }), OrganizationsModule],
  providers: [AuthService, JwtStrategy],
  controllers: [AuthController],
  exports: [AuthService],
})
export class AuthModule {}