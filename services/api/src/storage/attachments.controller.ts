import {
  BadRequestException,
  Controller,
  Get,
  Param,
  Post,
  Res,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from "@nestjs/common"
import { FileInterceptor } from "@nestjs/platform-express"
import type { Response } from "express"
import { OrgRole } from "@prisma/client"
import { StorageService } from "./storage.service"
import { PrismaService } from "../prisma/prisma.service"
import { OrgGuard } from "../common/guards/org.guard"
import { MinRole } from "../common/decorators/roles.decorator"
import { CurrentUser } from "../common/decorators/current-user.decorator"
import type { AuthUser } from "../common/interfaces/authenticated-request.interface"

const MAX_BYTES = 10 * 1024 * 1024

@Controller("organizations/:id/files")
@UseGuards(OrgGuard)
@MinRole(OrgRole.MEMBER)
export class AttachmentsController {
  constructor(
    private readonly storage: StorageService,
    private readonly prisma: PrismaService
  ) {}

  @Get("storage-info")
  @MinRole(OrgRole.ADMIN)
  storageInfo() {
    return { ...this.storage.displayConfig, maxUploadBytes: MAX_BYTES }
  }

  @Post()
  @UseInterceptors(FileInterceptor("file", { limits: { fileSize: MAX_BYTES } }))
  async upload(
    @Param("id") orgId: string,
    @CurrentUser() user: AuthUser,
    @UploadedFile() file?: Express.Multer.File
  ) {
    if (!file?.buffer || file.buffer.byteLength === 0) throw new BadRequestException("file is required")
    const saved = await this.storage.save(orgId, file.buffer, file.originalname ?? "file", file.mimetype)
    const row = await this.prisma.fileAttachment.create({
      data: {
        organizationId: orgId,
        name: saved.name,
        mimeType: saved.mimeType,
        size: saved.size,
        storageKey: saved.storageKey,
        uploadedById: user.id,
      },
    })
    return {
      id: row.id,
      name: row.name,
      mimeType: row.mimeType,
      size: row.size,
      createdAt: row.createdAt,
      downloadPath: saved.downloadPath,
    }
  }

  @Get(":key/download")
  async download(
    @Param("id") orgId: string,
    @Param("key") key: string,
    @Res() res: Response
  ) {
    const row = await this.prisma.fileAttachment.findFirst({
      where: { organizationId: orgId, storageKey: key },
    })
    const { stream, contentType } = await this.storage.stream(key)
    const rawName = encodeURIComponent(row?.name ?? "file")
    res.set({
      "Content-Type": contentType ?? row?.mimeType ?? "application/octet-stream",
      "Content-Disposition": `inline; filename*=UTF-8''${rawName}`,
      "Cache-Control": "private, max-age=31536000, immutable",
      "X-Content-Type-Options": "nosniff",
      "Cross-Origin-Resource-Policy": "cross-origin",
    })
    stream.on("error", () => res.end())
    stream.pipe(res)
  }
}