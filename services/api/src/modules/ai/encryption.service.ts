import { Injectable, Logger } from "@nestjs/common"
import { createCipheriv, createDecipheriv, randomBytes, createHash } from "crypto"

const IV_LENGTH = 12
const TAG_LENGTH = 16

/** AES-256-GCM encryption for AI provider API keys at rest. */
@Injectable()
export class EncryptionService {
  private readonly logger = new Logger(EncryptionService.name)
  private readonly key: Buffer

  constructor() {
    const configured = process.env.AI_ENCRYPTION_KEY ?? ""
    const hex = configured.replace(/\s+/g, "")
    const allZero = /^0{64}$/.test(hex)
    if (process.env.NODE_ENV === "production" && (allZero || !/^[0-9a-fA-F]{64}$/.test(hex))) {
      throw new Error(
        "AI_ENCRYPTION_KEY must be a unique 64-character hex key in production. " +
          "Generate one with: node -e \"console.log(require('crypto').randomBytes(32).toString('hex'))\""
      )
    }
    if (/^[0-9a-fA-F]{64}$/.test(hex)) {
      this.key = Buffer.from(hex, "hex")
      if (allZero) {
        this.logger.warn(
          "AI_ENCRYPTION_KEY is the public all-zero development key. Set a unique key before production."
        )
      }
    } else {
      this.key = createHash("sha256").update("techverse-ai-dev-fallback-key").digest()
      this.logger.warn(
        "AI_ENCRYPTION_KEY is missing or invalid — falling back to the development key. Set a 64-char hex key in production."
      )
    }
  }

  /** Encrypt a plaintext secret. Returns the ciphertext payload and a display hint (last 4 chars). */
  encrypt(plain: string): { cipher: string; hint: string } {
    const iv = randomBytes(IV_LENGTH)
    const cipher = createCipheriv("aes-256-gcm", this.key, iv)
    const encrypted = Buffer.concat([cipher.update(plain, "utf8"), cipher.final()])
    const tag = cipher.getAuthTag()
    const payload = [
      iv.toString("base64"),
      tag.toString("base64"),
      encrypted.toString("base64"),
    ].join(".")
    return { cipher: payload, hint: plain.slice(-4) }
  }

  decrypt(payload: string): string {
    try {
      const [iv, tag, data] = payload.split(".")
      const decipher = createDecipheriv("aes-256-gcm", this.key, Buffer.from(iv, "base64"))
      decipher.setAuthTag(Buffer.from(tag, "base64"))
      return Buffer.concat([decipher.update(Buffer.from(data, "base64")), decipher.final()]).toString("utf8")
    } catch (err) {
      this.logger.error(`Failed to decrypt AI provider key: ${(err as Error).message}`)
      return ""
    }
  }
}