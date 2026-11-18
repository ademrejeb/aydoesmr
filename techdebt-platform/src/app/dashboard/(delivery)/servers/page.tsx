"use client"

import { useCallback, useEffect, useState } from "react"
import {
  ExternalLink,
  FolderKanban,
  Loader2,
  Pencil,
  Plus,
  RefreshCw,
  Server,
  Trash2,
  Wifi,
  WifiOff,
} from "lucide-react"
import { useAuth } from "@/lib/auth-context"
import { api, type DeployedApp, type ServerConnection, type ServerProtocol } from "@/lib/api"
import { useI18n } from "@/lib/i18n"
import { useToast } from "@/lib/toast-context"
import { timeAgo } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Modal } from "@/components/ui/modal"
import { EmptyState } from "@/components/ui/empty-state"
import { Skeleton } from "@/components/ui/skeleton"
import { Tooltip } from "@/components/ui/tooltip"

const DEFAULT_PORTS: Record<ServerProtocol, number> = { ssh: 22, ftp: 21, npm: 443 }
const PROTOCOLS: ServerProtocol[] = ["ssh", "ftp", "npm"]

function errMsg(e: unknown): string {
  if (e instanceof Error) return e.message
  if (typeof e === "object" && e !== null && "message" in e) return String((e as { message: unknown }).message)
  return "Error"
}

function ReachabilityBadge({ server }: { server: ServerConnection }) {
  const { t } = useI18n()
  if (server.lastProbeOk === null) {
    return <Badge variant="outline">{t.servers.never_tested}</Badge>
  }
  if (server.lastProbeOk) {
    return (
      <Badge variant="success" dot>
        {t.servers.reachable}
      </Badge>
    )
  }
  return (
    <Tooltip tip={server.lastProbeError ? `${t.servers.probe_error}: ${server.lastProbeError}` : t.servers.unreachable}>
      <span>
        <Badge variant="danger" dot>
          {t.servers.unreachable}
        </Badge>
      </span>
    </Tooltip>
  )
}

function AppStatusBadge({ app }: { app: DeployedApp }) {
  const { t } = useI18n()
  if (app.lastStatus === null) {
    return <Badge variant="outline">{t.servers.never_tested}</Badge>
  }
  return (
    <Badge variant={app.lastStatus === "ok" ? "success" : "danger"} dot>
      {app.lastStatus === "ok" ? t.servers.app_ok : t.servers.app_fail}
    </Badge>
  )
}

export default function ServersPage() {
  const { token, currentOrg } = useAuth()
  const { t, locale } = useI18n()
  const toast = useToast()

  const [servers, setServers] = useState<ServerConnection[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [editor, setEditor] = useState<{ server: ServerConnection | null } | null>(null)
  const [confirmDelete, setConfirmDelete] = useState<ServerConnection | null>(null)
  const [deleting, setDeleting] = useState(false)
  const [probingId, setProbingId] = useState<string | null>(null)
  const [appsFor, setAppsFor] = useState<ServerConnection | null>(null)

  const canManage = currentOrg?.role === "OWNER"

  const load = useCallback(async () => {
    if (!token || !currentOrg) {
      setLoading(false)
      return
    }
    try {
      setServers(await api.listServers(token, currentOrg.id))
      setError(null)
    } catch (e) {
      setError(errMsg(e))
    } finally {
      setLoading(false)
    }
  }, [token, currentOrg])

  useEffect(() => {
    load()
  }, [load])

  const handleProbe = async (s: ServerConnection) => {
    if (!token || !currentOrg) return
    setProbingId(s.id)
    try {
      const res = await api.testServer(token, currentOrg.id, s.id)
      if (res.ok) {
        toast.success(t.servers.probe_ok, `${s.host}:${s.port}`)
      } else {
        toast.error(t.servers.probe_fail, res.error ?? undefined)
      }
      setServers((prev) => prev.map((x) => (x.id === s.id ? res.server : x)))
    } catch (e) {
      toast.error(errMsg(e))
    } finally {
      setProbingId(null)
    }
  }

  const handleDelete = async () => {
    if (!token || !currentOrg || !confirmDelete) return
    setDeleting(true)
    try {
      await api.deleteServer(token, currentOrg.id, confirmDelete.id)
      toast.success(t.servers.deleted)
      setConfirmDelete(null)
      load()
    } catch (e) {
      toast.error(errMsg(e))
    } finally {
      setDeleting(false)
    }
  }

  return (
    <div className="mx-auto max-w-6xl space-y-6 p-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold">{t.servers.title}</h1>
          <p className="mt-1 text-sm text-muted-foreground">{t.servers.subtitle}</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Button variant="outline" size="sm" onClick={load}>
            <RefreshCw className="h-3.5 w-3.5 me-1.5" />
            {t.servers.refresh}
          </Button>
          {canManage && (
            <Button size="sm" onClick={() => setEditor({ server: null })}>
              <Plus className="h-3.5 w-3.5 me-1.5" />
              {t.servers.new_server}
            </Button>
          )}
        </div>
      </div>

      {error && (
        <div className="rounded-xl border border-destructive/30 bg-destructive/5 p-4 text-sm text-destructive">{error}</div>
      )}

      {loading ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <Skeleton key={i} className="h-44 w-full rounded-2xl" />
          ))}
        </div>
      ) : servers.length === 0 ? (
        <EmptyState
          icon={Server}
          title={t.servers.empty_title}
          description={t.servers.empty_desc}
          action={
            canManage ? (
              <Button size="sm" onClick={() => setEditor({ server: null })}>
                <Plus className="h-3.5 w-3.5 me-1.5" />
                {t.servers.new_server}
              </Button>
            ) : undefined
          }
        />
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {servers.map((s) => (
            <div key={s.id} className="flex flex-col gap-3 rounded-2xl border border-border bg-card p-5 shadow-sm transition-colors hover:border-primary/30">
              <div className="flex items-start justify-between gap-2">
                <div className="flex min-w-0 items-center gap-2.5">
                  <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
                    <Server className="h-4 w-4" />
                  </span>
                  <div className="min-w-0">
                    <p className="truncate text-sm font-semibold">{s.label}</p>
                    <p className="truncate font-mono text-xs text-muted-foreground" dir="ltr">
                      {s.username ? `${s.username}@` : ""}
                      {s.host}:{s.port}
                    </p>
                  </div>
                </div>
                <Badge variant="secondary">{t.servers.protocols[s.protocol] ?? s.protocol}</Badge>
              </div>

              <div className="flex flex-wrap items-center gap-1.5 text-xs">
                <ReachabilityBadge server={s} />
                {s.lastProbeAt ? (
                  <span className="text-muted-foreground">
                    {t.servers.last_probe}: {timeAgo(s.lastProbeAt, locale)}
                  </span>
                ) : null}
              </div>

              <div className="flex flex-wrap items-center gap-1.5 border-t border-border/60 pt-3">
                <Button
                  size="sm"
                  variant="secondary"
                  onClick={() => setAppsFor(s)}
                >
                  <FolderKanban className="h-3.5 w-3.5" />
                  {t.servers.apps}
                  {s._count?.apps ? ` (${s._count.apps})` : ""}
                </Button>
                {canManage && (
                  <>
                    <Button size="sm" variant="outline" disabled={probingId === s.id} onClick={() => handleProbe(s)}>
                      {probingId === s.id ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Wifi className="h-3.5 w-3.5" />}
                      {t.servers.probe_now}
                    </Button>
                    <div className="ms-auto flex items-center gap-1">
                      <button
                        onClick={() => setEditor({ server: s })}
                        aria-label={t.servers.edit}
                        className="flex h-7 w-7 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-accent hover:text-foreground cursor-pointer"
                      >
                        <Pencil className="h-3.5 w-3.5" />
                      </button>
                      <button
                        onClick={() => setConfirmDelete(s)}
                        aria-label={t.servers.delete}
                        className="flex h-7 w-7 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-danger/10 hover:text-danger cursor-pointer"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  </>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {canManage && (
        <p className="flex items-center gap-2 text-xs text-muted-foreground">
          <WifiOff className="h-3.5 w-3.5" />
          {t.servers.probe_note}
        </p>
      )}
      <p className="text-xs text-muted-foreground">{t.servers.role_note}</p>

      {editor && (
        <ServerFormModal
          key={editor.server?.id ?? "new"}
          server={editor.server}
          onClose={() => setEditor(null)}
          onSaved={(msg) => {
            toast.success(msg)
            setEditor(null)
            load()
          }}
        />
      )}

      {appsFor && (
        <AppsModal
          server={appsFor}
          onClose={() => setAppsFor(null)}
          onChanged={() => load()}
        />
      )}

      <Modal
        open={confirmDelete !== null}
        onClose={() => setConfirmDelete(null)}
        title={confirmDelete ? `${t.servers.delete}: ${confirmDelete.label}` : ""}
        closeLabel={t.servers.cancel}
        footer={
          <>
            <Button variant="outline" onClick={() => setConfirmDelete(null)}>
              {t.servers.cancel}
            </Button>
            <Button variant="destructive" onClick={handleDelete} disabled={deleting}>
              {deleting && <Loader2 className="h-4 w-4 animate-spin" />}
              {t.servers.delete}
            </Button>
          </>
        }
      >
        <p className="text-sm text-muted-foreground">{t.servers.delete_confirm}</p>
      </Modal>
    </div>
  )
}

function ServerFormModal({
  server,
  onClose,
  onSaved,
}: {
  server: ServerConnection | null
  onClose: () => void
  onSaved: (msg: string) => void
}) {
  const { token, currentOrg } = useAuth()
  const { t } = useI18n()
  const toast = useToast()
  const [label, setLabel] = useState(server?.label ?? "")
  const [host, setHost] = useState(server?.host ?? "")
  const [port, setPort] = useState<number>(server?.port ?? DEFAULT_PORTS[server?.protocol ?? "ssh"])
  const [protocol, setProtocol] = useState<ServerProtocol>(server?.protocol ?? "ssh")
  const [username, setUsername] = useState(server?.username ?? "")
  const [credential, setCredential] = useState("")
  const [busy, setBusy] = useState(false)

  const canSubmit = label.trim() && host.trim() && port > 0 && port < 65536 && !busy

  const changeProtocol = (p: ServerProtocol) => {
    setProtocol(p)
    setPort(DEFAULT_PORTS[p])
  }

  const submit = async () => {
    if (!token || !currentOrg || !canSubmit) return
    setBusy(true)
    try {
      const dto = {
        label: label.trim(),
        host: host.trim(),
        port,
        protocol,
        username: username.trim() || undefined,
        credential: credential.trim() || undefined,
      }
      if (server) {
        await api.updateServer(dto, token, currentOrg.id, server.id)
      } else {
        await api.createServer(dto, token, currentOrg.id)
      }
      onSaved(server ? t.servers.updated : t.servers.created)
    } catch (e) {
      toast.error(errMsg(e))
    } finally {
      setBusy(false)
    }
  }

  return (
    <Modal
      open
      onClose={onClose}
      title={server ? `${t.servers.edit}: ${server.label}` : t.servers.new_server}
      description={t.servers.subtitle}
      closeLabel={t.platform.close}
      size="lg"
      footer={
        <>
          <Button variant="outline" onClick={onClose}>
            {t.servers.cancel}
          </Button>
          <Button onClick={submit} disabled={!canSubmit}>
            {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
            {t.servers.save}
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        <div>
          <label className="mb-1 block text-xs font-medium text-muted-foreground">{t.servers.name}</label>
          <input value={label} onChange={(e) => setLabel(e.target.value)} placeholder={t.servers.name_placeholder} className="input" />
        </div>
        <div>
          <label className="mb-1 block text-xs font-medium text-muted-foreground">{t.servers.host}</label>
          <input value={host} onChange={(e) => setHost(e.target.value)} placeholder={t.servers.host_placeholder} className="input" dir="ltr" />
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          <div>
            <label className="mb-1 block text-xs font-medium text-muted-foreground">{t.servers.protocol}</label>
            <select
              value={protocol}
              onChange={(e) => changeProtocol(e.target.value as ServerProtocol)}
              className="input h-10 cursor-pointer"
            >
              {PROTOCOLS.map((p) => (
                <option key={p} value={p}>
                  {t.servers.protocols[p]}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-muted-foreground">{t.servers.port}</label>
            <input
              type="number"
              value={port}
              onChange={(e) => setPort(Number(e.target.value))}
              className="input"
              dir="ltr"
            />
          </div>
        </div>
        <div>
          <label className="mb-1 block text-xs font-medium text-muted-foreground">{t.servers.username}</label>
          <input value={username} onChange={(e) => setUsername(e.target.value)} placeholder={t.servers.username_placeholder} className="input" dir="ltr" />
        </div>
        <div>
          <label className="mb-1 block text-xs font-medium text-muted-foreground">{t.servers.credential}</label>
          <input
            type="password"
            value={credential}
            onChange={(e) => setCredential(e.target.value)}
            placeholder={server?.hasCredential ? t.servers.credential_configured : t.servers.credential_placeholder}
            className="input"
            dir="ltr"
            autoComplete="new-password"
          />
        </div>
      </div>
    </Modal>
  )
}

function AppsModal({
  server,
  onClose,
  onChanged,
}: {
  server: ServerConnection
  onClose: () => void
  onChanged: () => void
}) {
  const { token, currentOrg } = useAuth()
  const { t, locale } = useI18n()
  const toast = useToast()
  const [apps, setApps] = useState<DeployedApp[]>([])
  const [loading, setLoading] = useState(true)
  const [appEditor, setAppEditor] = useState<{ app: DeployedApp | null } | null>(null)
  const [confirmDelete, setConfirmDelete] = useState<DeployedApp | null>(null)
  const [deleting, setDeleting] = useState(false)
  const [testingId, setTestingId] = useState<string | null>(null)

  const canManage = currentOrg?.role === "OWNER"

  const load = useCallback(async () => {
    if (!token || !currentOrg) {
      setLoading(false)
      return
    }
    try {
      setApps(await api.listServerApps(token, currentOrg.id, server.id).catch(() => [] as DeployedApp[]))
    } finally {
      setLoading(false)
    }
  }, [token, currentOrg, server.id])

  useEffect(() => {
    load()
  }, [load])

  const handleTest = async (app: DeployedApp) => {
    if (!token || !currentOrg) return
    setTestingId(app.id)
    try {
      const res = await api.testServerApp(token, currentOrg.id, app.id)
      if (res.ok) toast.success(t.servers.app_probe_ok)
      else toast.error(t.servers.app_probe_fail, res.error ?? undefined)
      setApps((prev) => prev.map((a) => (a.id === app.id ? res.app : a)))
      onChanged()
    } catch (e) {
      toast.error(errMsg(e))
    } finally {
      setTestingId(null)
    }
  }

  const handleDelete = async () => {
    if (!token || !currentOrg || !confirmDelete) return
    setDeleting(true)
    try {
      await api.deleteServerApp(token, currentOrg.id, confirmDelete.id)
      toast.success(t.servers.app_deleted)
      setConfirmDelete(null)
      load()
      onChanged()
    } catch (e) {
      toast.error(errMsg(e))
    } finally {
      setDeleting(false)
    }
  }

  return (
    <Modal
      open
      onClose={onClose}
      title={`${t.servers.manage_apps}: ${server.label}`}
      description={server.host}
      closeLabel={t.platform.close}
      size="lg"
      footer={
        canManage ? (
          <Button size="sm" onClick={() => setAppEditor({ app: null })}>
            <Plus className="h-3.5 w-3.5 me-1.5" />
            {t.servers.add_app}
          </Button>
        ) : undefined
      }
    >
      {loading ? (
        <div className="space-y-2">
          {[0, 1, 2].map((i) => (
            <Skeleton key={i} className="h-16 w-full rounded-xl" />
          ))}
        </div>
      ) : apps.length === 0 ? (
        <EmptyState icon={ExternalLink} title={t.servers.no_apps} description={t.servers.subtitle} className="px-4 py-8" />
      ) : (
        <div className="space-y-2">
          {apps.map((app) => (
            <div key={app.id} className="flex flex-wrap items-center gap-3 rounded-xl border border-border bg-card px-4 py-3 shadow-sm card-hover">
              <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
                <ExternalLink className="h-3.5 w-3.5" />
              </span>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium">{app.label}</p>
                <p className="truncate font-mono text-xs text-muted-foreground" dir="ltr">
                  {app.url}
                  {app.probePath ? ` · ${app.probeMethod ?? "GET"} ${app.probePath}` : ""}
                </p>
              </div>
              <div className="flex shrink-0 flex-wrap items-center gap-1.5 text-xs">
                <AppStatusBadge app={app} />
                {app.lastCheckAt && <span className="text-muted-foreground">{timeAgo(app.lastCheckAt, locale)}</span>}
              </div>
              {canManage && (
                <div className="flex shrink-0 items-center gap-1">
                  <Button size="sm" variant="outline" disabled={testingId === app.id} onClick={() => handleTest(app)}>
                    {testingId === app.id ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Wifi className="h-3.5 w-3.5" />}
                    {t.servers.probe_now}
                  </Button>
                  <button
                    onClick={() => setAppEditor({ app })}
                    aria-label={t.servers.edit}
                    className="flex h-7 w-7 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-accent hover:text-foreground cursor-pointer"
                  >
                    <Pencil className="h-3.5 w-3.5" />
                  </button>
                  <button
                    onClick={() => setConfirmDelete(app)}
                    aria-label={t.servers.delete}
                    className="flex h-7 w-7 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-danger/10 hover:text-danger cursor-pointer"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {appEditor && (
        <AppFormModal
          key={appEditor.app?.id ?? "new"}
          app={appEditor.app}
          connectionId={server.id}
          onClose={() => setAppEditor(null)}
          onSaved={(msg) => {
            toast.success(msg)
            setAppEditor(null)
            load()
            onChanged()
          }}
        />
      )}

      <Modal
        open={confirmDelete !== null}
        onClose={() => setConfirmDelete(null)}
        title={confirmDelete ? `${t.servers.delete}: ${confirmDelete.label}` : ""}
        closeLabel={t.servers.cancel}
        footer={
          <>
            <Button variant="outline" onClick={() => setConfirmDelete(null)}>
              {t.servers.cancel}
            </Button>
            <Button variant="destructive" onClick={handleDelete} disabled={deleting}>
              {deleting && <Loader2 className="h-4 w-4 animate-spin" />}
              {t.servers.delete}
            </Button>
          </>
        }
      >
        <p className="text-sm text-muted-foreground">{t.servers.delete_confirm}</p>
      </Modal>
    </Modal>
  )
}

function AppFormModal({
  app,
  connectionId,
  onClose,
  onSaved,
}: {
  app: DeployedApp | null
  connectionId: string
  onClose: () => void
  onSaved: (msg: string) => void
}) {
  const { token, currentOrg } = useAuth()
  const { t } = useI18n()
  const toast = useToast()
  const [label, setLabel] = useState(app?.label ?? "")
  const [url, setUrl] = useState(app?.url ?? "")
  const [probePath, setProbePath] = useState(app?.probePath ?? "/")
  const [probeMethod, setProbeMethod] = useState<"GET" | "POST">(app?.probeMethod === "POST" ? "POST" : "GET")
  const [busy, setBusy] = useState(false)

  const canSubmit = label.trim() && url.trim() && !busy

  const submit = async () => {
    if (!token || !currentOrg || !canSubmit) return
    setBusy(true)
    try {
      const dto = {
        label: label.trim(),
        url: url.trim(),
        probePath: probePath.trim() || undefined,
        probeMethod,
      }
      if (app) {
        await api.updateServerApp(dto, token, currentOrg.id, app.id)
      } else {
        await api.createServerApp(dto, token, currentOrg.id, connectionId)
      }
      onSaved(app ? t.servers.app_updated : t.servers.app_created)
    } catch (e) {
      toast.error(errMsg(e))
    } finally {
      setBusy(false)
    }
  }

  return (
    <Modal
      open
      onClose={onClose}
      title={app ? `${t.servers.edit}: ${app.label}` : t.servers.add_app}
      closeLabel={t.platform.close}
      size="md"
      footer={
        <>
          <Button variant="outline" onClick={onClose}>
            {t.servers.cancel}
          </Button>
          <Button onClick={submit} disabled={!canSubmit}>
            {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
            {t.servers.save}
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        <div>
          <label className="mb-1 block text-xs font-medium text-muted-foreground">{t.servers.app_name}</label>
          <input value={label} onChange={(e) => setLabel(e.target.value)} placeholder={t.servers.app_name_placeholder} className="input" />
        </div>
        <div>
          <label className="mb-1 block text-xs font-medium text-muted-foreground">{t.servers.app_url}</label>
          <input value={url} onChange={(e) => setUrl(e.target.value)} placeholder={t.servers.app_url_placeholder} className="input" dir="ltr" />
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          <div>
            <label className="mb-1 block text-xs font-medium text-muted-foreground">{t.servers.probe_path}</label>
            <input value={probePath} onChange={(e) => setProbePath(e.target.value)} placeholder={t.servers.probe_path_placeholder} className="input" dir="ltr" />
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-muted-foreground">{t.servers.probe_method}</label>
            <select value={probeMethod} onChange={(e) => setProbeMethod(e.target.value as "GET" | "POST")} className="input h-10 cursor-pointer">
              <option value="GET">{t.servers.method_get}</option>
              <option value="POST">{t.servers.method_post}</option>
            </select>
          </div>
        </div>
      </div>
    </Modal>
  )
}