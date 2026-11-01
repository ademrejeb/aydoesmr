import {
  IsIn,
  IsInt,
  IsObject,
  IsOptional,
  IsString,
  IsUrl,
  IsBoolean,
  Max,
  MaxLength,
  Min,
  MinLength,
} from "class-validator"

export const SERVER_PROTOCOLS = ["ssh", "ftp", "npm"] as const
export type ServerProtocol = (typeof SERVER_PROTOCOLS)[number]

export const SERVER_PROTOCOL_META: Record<ServerProtocol, { port: number; defaultPort: number; username: boolean; credential: boolean }> = {
  ssh: { port: 22, defaultPort: 22, username: true, credential: true },
  ftp: { port: 21, defaultPort: 21, username: true, credential: true },
  npm: { port: 443, defaultPort: 443, username: false, credential: true },
}

export const DEFAULT_PORTS: Record<ServerProtocol, number> = {
  ssh: 22,
  ftp: 21,
  npm: 443,
}

export class CreateServerDto {
  @IsString()
  @MinLength(1)
  @MaxLength(120)
  label!: string

  @IsString()
  @MinLength(1)
  @MaxLength(255)
  host!: string

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(65535)
  port?: number

  @IsOptional()
  @IsIn([...SERVER_PROTOCOLS])
  protocol?: ServerProtocol

  @IsOptional()
  @IsString()
  @MaxLength(120)
  username?: string

  @IsOptional()
  @IsString()
  @MaxLength(4096)
  credential?: string
}

export class UpdateServerDto {
  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(120)
  label?: string

  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(255)
  host?: string

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(65535)
  port?: number

  @IsOptional()
  @IsIn([...SERVER_PROTOCOLS])
  protocol?: ServerProtocol

  @IsOptional()
  @IsString()
  @MaxLength(120)
  username?: string

  @IsOptional()
  @IsString()
  @MaxLength(4096)
  credential?: string
}

export class CreateDeployedAppDto {
  @IsString()
  @MinLength(1)
  @MaxLength(120)
  label!: string

  @IsUrl({ require_tld: false })
  url!: string

  @IsOptional()
  @IsString()
  @MaxLength(255)
  probePath?: string

  @IsOptional()
  @IsIn(["GET", "POST"])
  probeMethod?: string
}

export class UpdateDeployedAppDto {
  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(120)
  label?: string

  @IsOptional()
  @IsUrl({ require_tld: false })
  url?: string

  @IsOptional()
  @IsString()
  @MaxLength(255)
  probePath?: string

  @IsOptional()
  @IsIn(["GET", "POST"])
  probeMethod?: string
}

// ------------------------------------------------------------------ //
//  Sandbox exec + IaC provisioning                                   //
// ------------------------------------------------------------------ //

export const PROVISION_TEMPLATES = ["docker", "nginx", "node", "portfolio"] as const
export type ProvisionTemplate = (typeof PROVISION_TEMPLATES)[number]

export class ExecCommandDto {
  @IsString()
  @MinLength(1)
  @MaxLength(4096)
  command!: string
}

export class ExecHealthDto {
  @IsOptional()
  @IsString()
  @MaxLength(255)
  host?: string

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(65535)
  port?: number

  @IsOptional()
  @IsString()
  @MaxLength(255)
  path?: string
}

export class ProvisionDto {
  @IsIn([...PROVISION_TEMPLATES])
  template!: ProvisionTemplate

  @IsString()
  @MinLength(1)
  @MaxLength(60)
  name!: string

  @IsOptional()
  @IsObject()
  options?: Record<string, string>
}

export class UpdateMemberTitleDto {
  @IsOptional()
  @IsString()
  @MaxLength(120)
  title?: string
}
