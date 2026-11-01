"use client"

import { useCallback, useEffect, useState } from "react"
import { api, type OrgMember } from "@/lib/api"
import { useAuth } from "@/lib/auth-context"
import { type Dictionary } from "@/lib/i18n"
import { Avatar } from "@/components/ui/avatar"
import { Button } from "@/components/ui/button"
import { Modal } from "@/components/ui/modal"

export function InviteModal({ token, orgId, onClose, t }: { token: string; orgId: string; onClose: () => void; t: Dictionary }) {
  const [email, setEmail] = useState("")
  const [role, setRole] = useState("MEMBER")
  const [invites, setInvites] = useState<Awaited<ReturnType<typeof api.listInvites>>>([])
  const [sent, setSent] = useState(false)
  const [busy, setBusy] = useState(false)

  const refresh = useCallback(() => {
    api.listInvites(token, orgId).then(setInvites).catch(() => {})
  }, [token, orgId])

  useEffect(() => { void refresh() }, [refresh])

  const send = async () => {
    if (!email.trim()) return
    setBusy(true)
    try {
      await api.inviteMember(token, orgId, { email: email.trim(), role })
      setEmail("")
      setSent(true)
      setTimeout(() => setSent(false), 2500)
      void refresh()
    } catch { /* ignore */ } finally { setBusy(false) }
  }

  const revoke = async (inviteId: string) => {
    await api.revokeInvite(token, orgId, inviteId).catch(() => {})
    void refresh()
  }

  return (
    <Modal open onClose={onClose} title={t.invite.title} closeLabel={t.common.close} size="md">
      <div className="space-y-4">
        <div className="flex gap-2">
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder={t.invite.email_placeholder}
            className="input min-w-0 flex-1"
          />
          <select
            value={role}
            onChange={(e) => setRole(e.target.value)}
            aria-label={t.invite.role}
            className="shrink-0 rounded-lg border border-border bg-background px-2 py-2 text-xs focus:outline-none focus:ring-2 focus:ring-ring"
          >
            <option value="ADMIN">ADMIN</option>
            <option value="MANAGER">MANAGER</option>
            <option value="MEMBER">MEMBER</option>
            <option value="VIEWER">VIEWER</option>
          </select>
          <Button onClick={() => void send()} disabled={busy || !email.trim()} className="shrink-0">
            {t.invite.send_invite}
          </Button>
        </div>
        {sent && <p className="text-xs font-medium text-success">{t.invite.sent}</p>}

        <div>
          <p className="mb-2 text-[10px] font-semibold uppercase text-muted-foreground">{t.invite.invites}</p>
          <div className="max-h-60 space-y-1 overflow-y-auto pe-1">
            {invites.filter((i) => i.status === "PENDING").length === 0 && (
              <p className="px-3 py-4 text-center text-xs text-muted-foreground">{t.invite.no_invites}</p>
            )}
            {invites.filter((i) => i.status === "PENDING").map((inv) => (
              <div key={inv.id} className="flex items-center justify-between gap-2 rounded-lg border border-border px-3 py-2">
                <div className="min-w-0">
                  <p className="truncate text-xs font-semibold" dir="ltr">{inv.email}</p>
                  <p className="text-[10px] text-muted-foreground">{inv.role}</p>
                </div>
                <Button variant="outline" size="sm" onClick={() => void revoke(inv.id)} className="text-danger">
                  {t.invite.revoke}
                </Button>
              </div>
            ))}
          </div>
        </div>
      </div>
    </Modal>
  )
}

export function NewConversationModal({
  members,
  onClose,
  onPick,
  onLoadMembers,
  t,
}: {
  members: OrgMember[]
  onClose: () => void
  onPick: (m: OrgMember) => void
  onLoadMembers: () => void
  t: Dictionary
}) {
  useEffect(() => { onLoadMembers() }, [onLoadMembers])
  const { user } = useAuth()
  const others = members.filter((m) => m.user.id !== user?.id)
  return (
    <Modal open onClose={onClose} title={t.messages.new_message} closeLabel={t.common.close} size="sm">
      {others.length === 0 && <p className="py-4 text-center text-xs text-muted-foreground">{t.messages.all_members}</p>}
      <div className="max-h-80 space-y-1 overflow-y-auto">
        {others.map((m) => (
          <button
            key={m.user.id}
            onClick={() => onPick(m)}
            className="flex w-full items-center gap-3 rounded-xl px-3 py-2 text-start hover:bg-accent cursor-pointer"
          >
            <Avatar name={m.user.fullName ?? ""} size="sm" src={m.user.avatarUrl} />
            <div className="min-w-0">
              <p className="truncate text-xs font-semibold">{m.user.fullName ?? m.user.email}</p>
              <p className="truncate text-[10px] text-muted-foreground">{m.role}</p>
            </div>
          </button>
        ))}
      </div>
    </Modal>
  )
}

export function NewGroupModal({
  members,
  onClose,
  onCreate,
  onLoadMembers,
  t,
}: {
  members: OrgMember[]
  onClose: () => void
  onCreate: (name: string, memberIds: string[]) => void
  onLoadMembers: () => void
  t: Dictionary
}) {
  const [name, setName] = useState("")
  const [selected, setSelected] = useState<string[]>([])
  useEffect(() => { onLoadMembers() }, [onLoadMembers])
  const { user } = useAuth()
  const others = members.filter((m) => m.user.id !== user?.id)

  const toggle = (id: string) =>
    setSelected((prev) => prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id])

  return (
    <Modal
      open
      onClose={onClose}
      title={t.messages.new_group}
      closeLabel={t.common.close}
      size="sm"
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>{t.common.cancel}</Button>
          <Button onClick={() => onCreate(name.trim(), selected)} disabled={!name.trim() || selected.length === 0}>
            {t.messages.start}
          </Button>
        </>
      }
    >
      <input
        value={name}
        onChange={(e) => setName(e.target.value)}
        placeholder={t.messages.group_name}
        className="input mb-4"
        autoFocus
      />
      <p className="mb-1.5 text-[10px] font-semibold uppercase text-muted-foreground">{t.messages.select_members}</p>
      <div className="max-h-56 space-y-1 overflow-y-auto pe-1">
        {others.map((m) => (
          <label key={m.user.id} className="flex cursor-pointer items-center gap-3 rounded-xl px-2 py-1.5 hover:bg-accent">
            <input
              type="checkbox"
              checked={selected.includes(m.user.id)}
              onChange={() => toggle(m.user.id)}
              className="h-3.5 w-3.5 shrink-0 accent-primary"
            />
            <Avatar name={m.user.fullName ?? ""} size="xs" src={m.user.avatarUrl} />
            <span className="min-w-0 truncate text-xs font-medium">{m.user.fullName ?? m.user.email}</span>
          </label>
        ))}
      </div>
    </Modal>
  )
}