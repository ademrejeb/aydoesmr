"use client"

import { useEffect } from "react"
import { useRouter } from "next/navigation"
import { useAuth } from "@/lib/auth-context"
import { AppShell } from "@/components/platform/app-shell"
import { ChatProvider } from "@/lib/chat/chat-provider"

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const { token, loading } = useAuth()
  const router = useRouter()

  useEffect(() => {
    if (!loading && !token) router.replace("/login")
  }, [loading, token, router])

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="hero-gradient flex h-12 w-12 animate-pulse items-center justify-center rounded-2xl text-white font-black text-2xl">
          T
        </div>
      </div>
    )
  }

  if (!token) return null

  return (
    <ChatProvider>
      <AppShell>{children}</AppShell>
    </ChatProvider>
  )
}