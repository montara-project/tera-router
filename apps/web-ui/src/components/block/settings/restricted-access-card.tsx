import { IconShieldLock } from '@tabler/icons-react'
import { useMutation, useQuery } from '@tanstack/react-query'
import { useState } from 'react'
import { toast } from 'sonner'

import type { RestrictedAccess } from '@/lib/api/models/restricted-access'

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
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import { Textarea } from '@/components/ui/textarea'
import { toastAxiosError } from '@/lib/api/axios-error'
import { queries } from '@/lib/api/queries'

export default function RestrictedAccessCard() {
  const { data } = useQuery(queries.restrictedAccess.get())
  const stored = data?.data

  return (
    <Card className="bg-background">
      <CardHeader className="h-20">
        <div className="flex min-w-0 items-center gap-3.5">
          <IconBadge
            icon={IconShieldLock}
            variant="soft"
            className="h-10 w-10"
            iconClassName="h-5 w-5"
          />
          <CardHeading>
            <CardTitle>Restricted Access</CardTitle>
            <CardDescription>
              During this period only the listed addresses can reach the server; everyone else gets
              403. /health stays open. Leave dates or times empty to not limit that side.
            </CardDescription>
          </CardHeading>
        </div>
      </CardHeader>

      <CardContent className="p-0">
        {stored && <RestrictedAccessForm key={JSON.stringify(stored)} stored={stored} />}
      </CardContent>
    </Card>
  )
}

function RestrictedAccessForm({ stored }: { stored: RestrictedAccess }) {
  const updateMutation = useMutation(queries.restrictedAccess.update())
  const [form, setForm] = useState({
    ...stored,
    timezone: stored.timezone || Intl.DateTimeFormat().resolvedOptions().timeZone,
  })
  const [ips, setIps] = useState(stored.allowed_ips.join('\n'))

  const set = (patch: Partial<RestrictedAccess>) => setForm((f) => ({ ...f, ...patch }))

  const save = (e: React.FormEvent) => {
    e.preventDefault()
    const allowed_ips = ips
      .split(/[\s,]+/)
      .map((ip) => ip.trim())
      .filter(Boolean)
    updateMutation.mutate(
      { ...form, timezone: form.timezone.trim(), allowed_ips },
      {
        onSuccess: () => toast.success('Restricted access updated'),
        onError: toastAxiosError,
      }
    )
  }

  return (
    <form onSubmit={save} className="flex flex-col gap-4 border-t border-border px-5 py-4">
      <div className="flex items-center gap-3">
        <Switch
          id="restricted-enabled"
          checked={form.enabled}
          onCheckedChange={(enabled) => set({ enabled })}
        />
        <Label htmlFor="restricted-enabled">Enabled</Label>
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="restricted-start-date">Start date</Label>
          <Input
            id="restricted-start-date"
            type="date"
            value={form.start_date}
            onChange={(e) => set({ start_date: e.target.value })}
          />
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="restricted-end-date">End date</Label>
          <Input
            id="restricted-end-date"
            type="date"
            value={form.end_date}
            onChange={(e) => set({ end_date: e.target.value })}
          />
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="restricted-start-time">Start time (daily)</Label>
          <Input
            id="restricted-start-time"
            type="time"
            value={form.start_time}
            onChange={(e) => set({ start_time: e.target.value })}
          />
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="restricted-end-time">End time (daily)</Label>
          <Input
            id="restricted-end-time"
            type="time"
            value={form.end_time}
            onChange={(e) => set({ end_time: e.target.value })}
          />
        </div>
      </div>

      <div className="flex flex-col gap-1.5">
        <Label htmlFor="restricted-timezone">Timezone</Label>
        <Input
          id="restricted-timezone"
          value={form.timezone}
          onChange={(e) => set({ timezone: e.target.value })}
          placeholder="Asia/Jakarta"
          className="w-56 font-mono"
        />
      </div>

      <div className="flex flex-col gap-1.5">
        <Label htmlFor="restricted-ips">Allowed IPs</Label>
        <Textarea
          id="restricted-ips"
          value={ips}
          onChange={(e) => setIps(e.target.value)}
          placeholder={'203.0.113.7\n10.0.0.0/8'}
          rows={4}
          className="font-mono"
        />
        <p className="text-muted-foreground text-xs">
          One address or CIDR range per line. Your own address must be on the list to enable.
        </p>
      </div>

      <div>
        <Button type="submit" disabled={updateMutation.isPending}>
          Save
        </Button>
      </div>
    </form>
  )
}
