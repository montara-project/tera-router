'use client'

import { IconLogout, IconRotate, IconSelector } from '@tabler/icons-react'
import { useState } from 'react'

import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { SidebarMenu, SidebarMenuButton, SidebarMenuItem } from '@/components/ui/sidebar'
import { Skeleton } from '@/components/ui/skeleton'
import { services } from '@/lib/api/services'
import { clearAuthTokens } from '@/lib/auth/token-storage'
import { type UserInfo } from '@/types/menu'

type NavUserProps = {
  /** The signed-in user; undefined while GET /v1/auth/me is loading. */
  user?: UserInfo
  /** True when the profile request failed and no user data is available. */
  userError?: boolean
  /** Refetches the profile request, wired to the error state's retry. */
  onRetryUser?: () => void
}

/** First letters of the first two name words, e.g. "Admin" → "AD". */
function getInitials(name: string) {
  const parts = name.trim().split(/\s+/).filter(Boolean)
  if (parts.length === 0) {
    return 'U'
  }
  return parts
    .slice(0, 2)
    .map((part) => part.charAt(0).toUpperCase())
    .join('')
}

export default function NavUser({ user, userError, onRetryUser }: NavUserProps) {
  const [signingOut, setSigningOut] = useState(false)

  // Ends the session on the server (every device, see POST /v1/auth/sign-out),
  // then drops the cookies and reloads to the login page so no cached data
  // outlives the session. A failed request still signs out locally.
  const handleSignOut = async () => {
    setSigningOut(true)
    try {
      await services.auth.signOut()
    } catch {
      // The server is unreachable or the session already ended.
    } finally {
      clearAuthTokens()
      window.location.href = '/'
    }
  }

  const name = user?.name ?? ''
  const email = user?.email ?? ''
  const initials = getInitials(name)

  if (userError) {
    return (
      <SidebarMenu>
        <SidebarMenuItem>
          <div className="px-2 py-1.5 text-xs text-destructive">Couldn't load your profile.</div>
          <SidebarMenuButton size="lg" onClick={onRetryUser}>
            <IconRotate />
            <span>Try again</span>
          </SidebarMenuButton>
        </SidebarMenuItem>
      </SidebarMenu>
    )
  }

  if (!user) {
    return (
      <SidebarMenu>
        <SidebarMenuItem>
          <SidebarMenuButton size="lg" disabled>
            <Skeleton className="size-8 rounded-lg" />
            <div className="grid flex-1 gap-1.5">
              <Skeleton className="h-3.5 w-24" />
              <Skeleton className="h-3 w-32" />
            </div>
          </SidebarMenuButton>
        </SidebarMenuItem>
      </SidebarMenu>
    )
  }

  return (
    <SidebarMenu>
      <SidebarMenuItem>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <SidebarMenuButton
              size="lg"
              className="data-[state=open]:bg-sidebar-accent data-[state=open]:text-sidebar-accent-foreground"
            >
              <Avatar className="h-8 w-8 rounded-lg">
                <AvatarImage src={user.avatar} alt={name} />
                <AvatarFallback className="rounded-lg">{initials}</AvatarFallback>
              </Avatar>
              <div className="grid flex-1 text-left text-sm leading-tight">
                <span className="truncate font-medium">{name}</span>
                <span className="truncate text-xs">{email}</span>
              </div>
              <IconSelector className="ml-auto size-4" />
            </SidebarMenuButton>
          </DropdownMenuTrigger>
          <DropdownMenuContent
            className="w-(--radix-dropdown-menu-trigger-width) min-w-56 rounded-lg"
            side="top"
            align="end"
            sideOffset={4}
          >
            <DropdownMenuLabel className="p-0 font-normal">
              <div className="flex items-center gap-2 px-1 py-1.5 text-left text-sm">
                <Avatar className="h-8 w-8 rounded-lg">
                  <AvatarImage src={user.avatar} alt={name} />
                  <AvatarFallback className="rounded-lg">{initials}</AvatarFallback>
                </Avatar>
                <div className="grid flex-1 text-left text-sm leading-tight">
                  <span className="truncate font-medium">{name}</span>
                  <span className="truncate text-xs">{email}</span>
                </div>
              </div>
            </DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuItem variant="destructive" disabled={signingOut} onClick={handleSignOut}>
              <IconLogout />
              {signingOut ? 'Logging out…' : 'Log out'}
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </SidebarMenuItem>
    </SidebarMenu>
  )
}
