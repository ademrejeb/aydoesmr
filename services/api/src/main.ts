import { NestFactory } from "@nestjs/core"
import { ValidationPipe } from "@nestjs/common"
import { ConfigService } from "@nestjs/config"
import { DocumentBuilder, SwaggerModule } from "@nestjs/swagger"
import * as express from "express"
import { AppModule } from "./app.module"
import { securityHeaders } from "./common/security/headers"
import { authRateKey, rateLimit } from "./common/security/rate-limit"

function parseOrigins(value: string | undefined): string[] {
  return (value ?? "")
    .split(",")
    .map((entry) => entry.trim())
    .filter(Boolean)
}

async function bootstrap() {
  const app = await NestFactory.create(AppModule, { bodyParser: false })
  const config = app.get(ConfigService)
  const nodeEnv = config.get<string>("NODE_ENV")
  const isProduction = nodeEnv === "production"

  // Refuse to boot with a dev JWT secret in production.
  if (isProduction && (!config.get<string>("JWT_SECRET") || config.get<string>("JWT_SECRET") === "dev-secret-change-me-in-production")) {
    console.error(
      "[techverse:api] FATAL: JWT_SECRET is missing or still the development default. " +
        "Set JWT_SECRET before starting with NODE_ENV=production."
    )
    process.exit(1)
  }

  // Behind a load balancer / reverse proxy, trust the first hop so rate
  // limiting and audit logs see real client IPs instead of the proxy's.
  if (config.get<string>("TRUST_PROXY") === "true") {
    app.getHttpAdapter().getInstance().set("trust proxy", 1)
  }

  // JSON for the REST API; raw passthrough for Git Smart-HTTP pack payloads;
  // plain text for CSV timesheet imports.
  app.use(express.json({ limit: "10mb" }))
  app.use(express.text({ type: ["text/csv", "text/plain", "text/csv; charset=utf-8"], limit: "5mb" }))
  app.use(
    express.raw({
      type: ["application/x-git-upload-pack-request", "application/x-git-receive-pack-request"],
      limit: "512mb",
    })
  )

  app.use(securityHeaders())

  app.use(
    rateLimit({
      windowMs: 60_000,
      max: Number(config.get<string>("GLOBAL_RATE_LIMIT", "1200")),
      name: "global",
    })
  )

  // Credential endpoints get a much tighter budget; keyed per IP + email so a
  // single noisy account cannot starve everyone else behind one NAT.
  const authLimiter = rateLimit({
    windowMs: 60_000,
    max: Number(config.get<string>("AUTH_RATE_LIMIT", "30")),
    name: "auth",
    keyBy: authRateKey,
  })
  app.use("/api/auth/login", authLimiter)
  app.use("/api/auth/register", authLimiter)
  app.use("/api/auth/refresh", authLimiter)

  // Swagger: open in development, opt-in in production (SWAGGER_ENABLED=true).
  if (!isProduction || config.get<string>("SWAGGER_ENABLED") === "true") {
    const swaggerConfig = new DocumentBuilder()
      .setTitle("TechVerse API")
      .setDescription(
        "TechVerse — collaboration, development workspace & TechDebt-AI code-analysis platform. " +
          "Org-scoped API: pass `X-Organization-Id` and a Bearer token."
      )
      .setVersion("0.1.0")
      .addBearerAuth()
      .addApiKey(
        { type: "apiKey", name: "X-Organization-Id", in: "header", description: "Active organization id" },
        "X-Organization-Id"
      )
      .build()
    const swaggerDocument = SwaggerModule.createDocument(app, swaggerConfig)
    SwaggerModule.setup("api/docs", app, swaggerDocument, {
      swaggerOptions: { persistAuthorization: true, displayRequestDuration: true },
    })
  }

  app.setGlobalPrefix("api")

  // Strict CORS allowlist — never reflect arbitrary origins with credentials.
  // `CORS_ORIGIN` is a comma-separated list (see .env).
  const allowlist = parseOrigins(config.get<string>("CORS_ORIGIN", "http://localhost:3000"))
  const devOrigin = /^http:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/
  app.enableCors({
    origin: (origin: string | undefined, callback: (err: Error | null, allow?: boolean) => void) => {
      if (!origin) return callback(null, true) // curl / server-to-server
      if (allowlist.includes(origin)) return callback(null, true)
      if (!isProduction && devOrigin.test(origin)) return callback(null, true)
      return callback(null, false) // no CORS headers, browser blocks it
    },
    credentials: true,
    methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization", "X-Organization-Id", "X-Request-Id"],
    exposedHeaders: [
      "X-Total-Rows",
      "X-Page",
      "X-RateLimit-Limit",
      "X-RateLimit-Remaining",
      "X-RateLimit-Reset",
      "Retry-After",
    ],
    maxAge: 600,
  })

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      transform: true,
      forbidNonWhitelisted: false,
    })
  )

  const port = config.get<number>("PORT", 3001)

  await app.listen(port)
  console.log(`[techverse:api] listening on http://localhost:${port}/api`)
  if (!isProduction) console.log(`[techverse:api] swagger ui: http://localhost:${port}/api/docs`)
}

bootstrap()