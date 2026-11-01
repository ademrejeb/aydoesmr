import { Injectable, Logger } from "@nestjs/common"
import { ConfigService } from "@nestjs/config"
import { createTransport, type Transporter } from "nodemailer"
import { renderMail, type MailTemplate, type MailVariables } from "./mail.templates"

interface SmtpConfig {
  host: string
  port: number
  user?: string
  pass?: string
  from: string
  secure: boolean
}

@Injectable()
export class MailService {
  private readonly logger = new Logger(MailService.name)
  private readonly transport: Transporter | null
  private readonly configured: boolean
  private readonly from: string

  constructor(config: ConfigService) {
    const host = config.get<string>("SMTP_HOST")
    const port = parseInt(config.get<string>("SMTP_PORT") ?? "587", 10)
    this.from = config.get<string>("SMTP_FROM") ?? "TechVerse <no-reply@techverse.app>"

    if (host) {
      const smtp: SmtpConfig = {
        host,
        port,
        user: config.get<string>("SMTP_USER") ?? undefined,
        pass: config.get<string>("SMTP_PASS") ?? undefined,
        secure: port === 465,
        from: this.from,
      }
      this.transport = createTransport({
        host: smtp.host,
        port: smtp.port,
        secure: smtp.secure,
        auth: smtp.user ? { user: smtp.user, pass: smtp.pass } : undefined,
      })
      this.configured = true
      this.logger.log(`SMTP configured (${host}:${port})`)
    } else {
      this.transport = null
      this.configured = false
      this.logger.warn("SMTP not configured — emails will be logged instead of sent")
    }
  }

  get isConfigured(): boolean {
    return this.configured
  }

  async send(
    template: MailTemplate,
    to: string,
    vars: MailVariables,
    locale?: string
  ): Promise<{ delivered: boolean; to: string; template: string }> {
    const { subject, html } = renderMail(template, { ...vars, locale })
    if (!this.transport) {
      this.logger.log(`[DEV] email to=${to} subject="${subject}" body=${vars.preview ?? ""}`)
      return { delivered: false, to, template }
    }
    try {
      await this.transport.sendMail({
        from: this.from,
        to,
        subject: `[TechVerse] ${subject}`,
        html,
        text: vars.preview ?? subject,
      })
      return { delivered: true, to, template }
    } catch (err) {
      this.logger.error(`Failed to send ${template} to ${to}: ${(err as Error).message}`)
      return { delivered: false, to, template }
    }
  }

  /** Accept URL builder for the frontend (invite / task links). */
  link(path: string): string {
    const base = (process.env.FRONTEND_URL ?? "http://localhost:3000").replace(/\/$/, "")
    return `${base}${path.startsWith("/") ? path : `/${path}`}`
  }
}