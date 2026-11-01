import { Injectable, Logger } from "@nestjs/common"
import { GetObjectCommand, PutObjectCommand, S3Client } from "@aws-sdk/client-s3"
import { createReadStream, mkdirSync, writeFileSync } from "node:fs"
import { join, resolve, basename, extname } from "node:path"
import { randomUUID } from "node:crypto"

export interface SavedAttachment {
  storageKey: string
  downloadPath: string
  mimeType: string
  name: string
  size: number
  width: number | null
  height: number | null
}

@Injectable()
export class StorageService {
  private readonly logger = new Logger(StorageService.name)
  private readonly driver: "local" | "s3"
  private readonly s3: S3Client | null = null
  private readonly bucket: string
  private readonly baseDir: string
  private readonly configuredEndpoint: string | null

  constructor() {
    this.driver = (process.env.STORAGE_DRIVER ?? "local").toLowerCase() === "s3" ? "s3" : "local"
    this.bucket = process.env.S3_BUCKET ?? "techverse-attachments"
    this.baseDir = resolve(process.env.UPLOAD_DIR ?? join(process.cwd(), "storage", "attachments"))
    this.configuredEndpoint = process.env.S3_ENDPOINT ?? null
    if (this.driver === "s3") {
      const endpoint = this.configuredEndpoint
      this.s3 = new S3Client({
        region: process.env.S3_REGION ?? "us-east-1",
        endpoint: endpoint || undefined,
        credentials: {
          accessKeyId: process.env.S3_ACCESS_KEY_ID ?? "",
          secretAccessKey: process.env.S3_SECRET_ACCESS_KEY ?? "",
        },
        forcePathStyle: process.env.S3_FORCE_PATH_STYLE === "true",
      })
      this.logger.log(`Storage driver: s3 (bucket=${this.bucket}${endpoint ? ` endpoint=${endpoint}` : ""})`)
    } else {
      this.logger.log(`Storage driver: local (dir=${this.baseDir})`)
    }
  }

  get driverName(): "local" | "s3" {
    return this.driver
  }

  get displayConfig(): { driver: string; bucket?: string; endpoint?: string | null } {
    return this.driver === "s3"
      ? { driver: "s3", bucket: this.bucket, endpoint: this.configuredEndpoint }
      : { driver: "local" }
  }

  async save(orgId: string, data: Buffer, originalName: string, mimeType: string): Promise<SavedAttachment> {
    const ext = extname(basename(originalName) || "file").slice(0, 16).toLowerCase()
    const key = `${orgId}/${randomUUID()}${ext}`
    if (this.driver === "s3") {
      await this.s3!.send(new PutObjectCommand({ Bucket: this.bucket, Key: key, Body: data, ContentType: mimeType || "application/octet-stream" }))
    } else {
      mkdirSync(join(this.baseDir, orgId), { recursive: true })
      writeFileSync(join(this.baseDir, key), data)
    }
    const downloadPath = `/api/organizations/${orgId}/files/${encodeURIComponent(key)}/download`
    return { storageKey: key, downloadPath, mimeType, name: originalName || "file", size: data.byteLength, width: null, height: null }
  }

  async stream(key: string): Promise<{ stream: NodeJS.ReadableStream; contentType?: string }> {
    if (this.driver === "s3") {
      const out = await this.s3!.send(new GetObjectCommand({ Bucket: this.bucket, Key: key }))
      return { stream: out.Body as NodeJS.ReadableStream, contentType: out.ContentType }
    }
    return { stream: createReadStream(join(this.baseDir, key)) }
  }

  async remove(key: string): Promise<void> {
    try {
      if (this.driver === "s3") {
        const { DeleteObjectCommand } = await import("@aws-sdk/client-s3")
        await this.s3!.send(new DeleteObjectCommand({ Bucket: this.bucket, Key: key }))
      }
    } catch {
      /* best-effort cleanup */
    }
  }
}