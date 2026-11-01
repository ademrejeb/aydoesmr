import { Body, Controller, Get, Param, Post, Query, Req, Res, UseGuards } from "@nestjs/common"
import { type Request, type Response } from "express"
import { GitService } from "./git.service"
import { GitAuthGuard } from "./git-auth.guard"
import { Public } from "../../common/decorators/roles.decorator"
import { cleanRepoName } from "./git-host"

const SERVICE = {
  "git-upload-pack": {
    acceptWrite: false,
    advertType: "application/x-git-upload-pack-advertisement",
    resultType: "application/x-git-upload-pack-result",
  },
  "git-receive-pack": {
    acceptWrite: true,
    advertType: "application/x-git-receive-pack-advertisement",
    resultType: "application/x-git-receive-pack-result",
  },
} as const

type GitServiceName = keyof typeof SERVICE

const NO_CACHE = {
  "Cache-Control": "no-cache, max-age=0, must-revalidate",
  Pragma: "no-cache",
  Expires: "Fri, 01 Jan 1980 00:00:00 GMT",
}

const CHALLENGE = { "WWW-Authenticate": 'Basic realm="TechVerse Git"' }

interface GitRepoRow {
  id: string
  visibility: string
}

/** Smart HTTP git server — backend for `git clone/push http(s)://<host>/api/git/<org>/<repo>`. */
@Controller("git")
@Public()
@UseGuards(GitAuthGuard)
export class GitHttpController {
  constructor(private readonly git: GitService) {}

  @Get(":owner/:repo/info/refs")
  async infoRefs(
    @Param("owner") owner: string,
    @Param("repo") repoRaw: string,
    @Query("service") service: string,
    @Req() req: Request & { gitAnonymous?: boolean },
    @Res() res: Response
  ) {
    const svc = SERVICE[service as GitServiceName]
    if (!svc) return res.status(400).send("Unknown service")

    const repo = await this.git.locateByOwner(owner, cleanRepoName(repoRaw))
    if (!repo) return res.status(404).send("repository not found")
    if (this.reject(repo, svc.acceptWrite, !!req.gitAnonymous, res)) return

    try {
      const body = await this.git.serveInfoRefs(repo.id, service as GitServiceName)
      res.set({ "Content-Type": svc.advertType, ...NO_CACHE })
      return res.send(body)
    } catch (e) {
      return res.status(500).send((e as Error).message)
    }
  }

  @Post(":owner/:repo/git-upload-pack")
  uploadPack(
    @Param("owner") owner: string,
    @Param("repo") repoRaw: string,
    @Body() rawBody: unknown,
    @Req() req: Request & { gitAnonymous?: boolean },
    @Res() res: Response
  ) {
    return this.handleRpc(owner, repoRaw, "git-upload-pack", rawBody, req, res)
  }

  @Post(":owner/:repo/git-receive-pack")
  receivePack(
    @Param("owner") owner: string,
    @Param("repo") repoRaw: string,
    @Body() rawBody: unknown,
    @Req() req: Request & { gitAnonymous?: boolean },
    @Res() res: Response
  ) {
    return this.handleRpc(owner, repoRaw, "git-receive-pack", rawBody, req, res)
  }

  /**
   * Returns true (and sends a response) when the request must be denied.
   * Anonymous reads of public repos pass; anonymous reads of private repos and
   * all anonymous writes get a 401 challenge so git retries with credentials.
   */
  private reject(repo: GitRepoRow, acceptWrite: boolean, anonymous: boolean, res: Response): boolean {
    if (!anonymous) return false
    if (acceptWrite) {
      res.status(401).set(CHALLENGE).send("Authentication required")
      return true
    }
    if (repo.visibility !== "public") {
      res.status(401).set(CHALLENGE).send("Authentication required")
      return true
    }
    return false
  }

  private async handleRpc(
    owner: string,
    repoRaw: string,
    service: GitServiceName,
    rawBody: unknown,
    req: Request & { gitAnonymous?: boolean },
    res: Response
  ) {
    const svc = SERVICE[service]

    const repo = await this.git.locateByOwner(owner, cleanRepoName(repoRaw))
    if (!repo) return res.status(404).send("repository not found")
    if (this.reject(repo, svc.acceptWrite, !!req.gitAnonymous, res)) return

    const input = Buffer.isBuffer(rawBody) ? rawBody : Buffer.alloc(0)
    if (input.length === 0) return res.status(400).send("empty request")

    try {
      const out = await this.git.serveRpc(repo.id, service, input)
      res.set({ "Content-Type": svc.resultType, ...NO_CACHE })
      return res.send(out)
    } catch (e) {
      return res.status(500).send((e as Error).message)
    }
  }
}