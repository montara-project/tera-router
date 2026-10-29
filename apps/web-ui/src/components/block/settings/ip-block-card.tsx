import { IconBan, IconTrash } from '@tabler/icons-react'
import { useMutation, useQuery } from '@tanstack/react-query'
import { formatDistanceToNow } from 'date-fns'
import { useState } from 'react'
import { toast } from 'sonner'

import IconBadge from '@/components/block/common/icon-badge'
import { Button } from '@/components/ui/button'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardHeading,
  CardTitle,
} from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { toastAxiosError } from '@/lib/api/axios-error'
import { queries } from '@/lib/api/queries'

export default function IPBlockCard() {
  const { data, isLoading } = useQuery(queries.ipBlocks.list())
  const blocks = data?.data ?? []

  const createMutation = useMutation(queries.ipBlocks.create())
  const removeMutation = useMutation(queries.ipBlocks.remove())

  const [cidr, setCidr] = useState('')
  const [reason, setReason] = useState('')

  const add = (e: React.FormEvent) => {
    e.preventDefault()
    createMutation.mutate(
      { cidr: cidr.trim(), reason: reason.trim() },
      {
        onSuccess: () => {
          toast.success('Address blocked')
          setCidr('')
          setReason('')
        },
        onError: toastAxiosError,
      }
    )
  }

  return (
    <Card className="bg-background">
      <CardHeader className="py-4">
        <div className="flex min-w-0 items-center gap-3.5">
          <IconBadge
            icon={IconBan}
            variant="soft"
            className="h-10 w-10 shrink-0"
            iconClassName="h-5 w-5"
          />
          <CardHeading>
            <CardTitle>Blocked IPs</CardTitle>
            <CardDescription>
              Requests from these addresses get 403. An address with 10 failed sign-ins in 15
              minutes is blocked for 15 minutes automatically.
            </CardDescription>
          </CardHeading>
        </div>
      </CardHeader>

      <CardContent className="p-0">
        <form
          onSubmit={add}
          className="flex flex-wrap items-center gap-3 border-t border-border px-5 py-4"
        >
          <Input
            value={cidr}
            onChange={(e) => setCidr(e.target.value)}
            placeholder="203.0.113.7 or 10.0.0.0/8"
            aria-label="IP address or CIDR range"
            className="w-56 font-mono"
          />
          <Input
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder="Reason (optional)"
            aria-label="Reason"
            className="min-w-40 flex-1"
          />
          <Button type="submit" disabled={!cidr.trim() || createMutation.isPending}>
            Block
          </Button>
        </form>

        {isLoading ? null : blocks.length === 0 ? (
          <p className="text-muted-foreground border-t border-border px-5 py-4 text-sm">
            No blocked addresses.
          </p>
        ) : (
          <ul className="divide-y divide-border border-t border-border">
            {blocks.map((block) => (
              <li key={block.id} className="flex items-center justify-between gap-4 px-5 py-3">
                <div className="min-w-0">
                  <p className="text-foreground font-mono text-sm">{block.cidr}</p>
                  <p className="text-muted-foreground mt-0.5 truncate text-xs">
                    {block.expires_at
                      ? `Lifts ${formatDistanceToNow(new Date(block.expires_at), { addSuffix: true })}`
                      : 'Permanent'}
                    {block.reason && ` · ${block.reason}`}
                  </p>
                </div>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  aria-label={`Unblock ${block.cidr}`}
                  disabled={removeMutation.isPending}
                  onClick={() =>
                    removeMutation.mutate(block.id, {
                      onSuccess: () => toast.success('Block removed'),
                      onError: toastAxiosError,
                    })
                  }
                >
                  <IconTrash className="h-4 w-4" />
                  Unblock
                </Button>
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  )
}
