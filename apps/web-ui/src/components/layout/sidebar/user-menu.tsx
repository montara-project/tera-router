'use client'

import { IconLogout, IconRotate } from '@tabler/icons-react'
import { useState } from 'react'

import type { Models } from '@/lib/api/models'

import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Skeleton } from '@/components/ui/skeleton'
import { services } from '@/lib/api/services'
import { clearAuthTokens } from '@/lib/auth/token-storage'

type UserMenuProps = {
  /** The signed-in user from GET /v1/auth/me; undefined while it loads. */
  user?: Models.User | null
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

/** Top-bar avatar with the profile summary and sign-out. */
export default function UserMenu({ user, userError, onRetryUser }: UserMenuProps) {
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

  if (!user && !userError) {
    return <Skeleton className="size-8 rounded-full" />
  }

  const name = user?.fullname ?? ''
  const email = user?.email ?? ''

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          aria-label="Account menu"
          className="cursor-pointer rounded-full focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
        >
          <Avatar className="size-8 border border-border">
            <AvatarFallback className="bg-muted text-xs font-medium">
              {user ? getInitials(name) : '?'}
            </AvatarFallback>
          </Avatar>
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent className="min-w-56 rounded-lg" align="end" sideOffset={6}>
        {user ? (
          <DropdownMenuLabel className="font-normal">
            <div className="grid text-sm leading-tight">
              <span className="truncate font-medium">{name}</span>
              <span className="text-muted-foreground truncate text-xs">{email}</span>
            </div>
          </DropdownMenuLabel>
        ) : (
          <DropdownMenuItem onClick={onRetryUser}>
            <IconRotate />
            Couldn't load your profile. Try again
          </DropdownMenuItem>
        )}
        <DropdownMenuSeparator />
        <DropdownMenuItem variant="destructive" disabled={signingOut} onClick={handleSignOut}>
          <IconLogout />
          {signingOut ? 'Logging out…' : 'Log out'}
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
