import { IconArrowRight, IconClockShield, IconPlus, IconX } from '@tabler/icons-react'
import { useMutation, useQuery } from '@tanstack/react-query'
import { format, parse } from 'date-fns'
import { toast } from 'sonner'

import type { RestrictedAccess } from '@/lib/api/models/restricted-access'

import DatePickerInput from '@/components/block/common/date-picker-input'
import IconBadge from '@/components/block/common/icon-badge'
import TimePickerInput from '@/components/block/common/time-picker-input'
import SettingRow from '@/components/block/settings/setting-row'
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
import { Switch } from '@/components/ui/switch'
import { useAppForm } from '@/hooks/form'
import { toastAxiosError } from '@/lib/api/axios-error'
import { queries } from '@/lib/api/queries'
import { TIMEZONE_OPTIONS } from '@/lib/constants/timezone'
import { cn } from '@/lib/utils'

export default function RestrictedAccessCard() {
  const { data, isLoading } = useQuery(queries.restrictedAccess.get())
  const stored = data?.data

  let statusLabel = stored?.enabled ? 'On' : 'Off'
  if (isLoading) statusLabel = '…'

  return (
    <Card className="bg-background">
      <CardHeader className="py-4">
        <div className="flex w-full items-center justify-between gap-4">
          <div className="flex min-w-0 items-center gap-3.5">
            <IconBadge
              icon={IconClockShield}
              variant="soft"
              className="h-10 w-10 shrink-0"
              iconClassName="h-5 w-5"
            />
            <CardHeading>
              <CardTitle>Restricted Access</CardTitle>
              <CardDescription>
                During this period only the listed addresses can reach the server; everyone else
                gets 403. /health stays open.
              </CardDescription>
            </CardHeading>
          </div>
          <span
            className={cn(
              'inline-flex shrink-0 items-center rounded-md px-2.5 py-1.5 text-xs font-semibold',
              stored?.enabled ? 'bg-emerald-950 text-emerald-400' : 'bg-muted text-muted-foreground'
            )}
          >
            {statusLabel}
          </span>
        </div>
      </CardHeader>

      <CardContent className="p-0">
        {stored && <RestrictedAccessForm key={JSON.stringify(stored)} stored={stored} />}
      </CardContent>
    </Card>
  )
}

const DATE_FORMAT = 'yyyy-MM-dd'

// Stored dates are plain calendar days; parse them as local midnight so the
// picker shows the same day in every browser timezone.
const toDate = (s: string) => (s ? parse(s, DATE_FORMAT, new Date()) : undefined)
const fromDate = (d: Date | undefined) => (d ? format(d, DATE_FORMAT) : '')

function PeriodRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="grid gap-1.5 sm:grid-cols-[7.5rem_1fr] sm:items-center sm:gap-4">
      <p className="text-sm font-medium text-foreground">{label}</p>
      <div className="flex flex-wrap items-center gap-2">{children}</div>
    </div>
  )
}

function RangeArrow() {
  return <IconArrowRight aria-hidden className="text-muted-foreground hidden size-4 sm:block" />
}

function RestrictedAccessForm({ stored }: { stored: RestrictedAccess }) {
  const updateMutation = useMutation(queries.restrictedAccess.update())

  const form = useAppForm({
    defaultValues: {
      ...stored,
      timezone: stored.timezone || Intl.DateTimeFormat().resolvedOptions().timeZone,
      allowed_ips: stored.allowed_ips.length > 0 ? stored.allowed_ips : [''],
    },
    onSubmit: async ({ value }) => {
      try {
        await updateMutation.mutateAsync({
          ...value,
          allowed_ips: value.allowed_ips.map((ip) => ip.trim()).filter(Boolean),
        })
        toast.success('Restricted access updated')
      } catch (error) {
        toastAxiosError(error)
      }
    },
  })

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault()
        form.handleSubmit()
      }}
      className="divide-y divide-border border-t border-border"
    >
      <form.AppField name="enabled">
        {(field) => (
          <SettingRow
            title="Enabled"
            description="Apply the period and allowlist below. Saved changes take effect immediately."
          >
            <Switch
              aria-label="Enable restricted access"
              checked={field.state.value}
              onCheckedChange={field.handleChange}
            />
          </SettingRow>
        )}
      </form.AppField>

      <div className="flex flex-col gap-4 px-5 py-4">
        <div>
          <p className="text-sm font-medium text-foreground">Period</p>
          <p className="text-muted-foreground mt-0.5 text-xs">
            Leave dates or times empty to not limit that side. Daily hours may run past midnight.
          </p>
        </div>

        <PeriodRow label="Dates">
          <form.AppField name="start_date">
            {(field) => (
              <DatePickerInput
                date={toDate(field.state.value)}
                onDateChange={(d) => field.handleChange(fromDate(d))}
                placeholder="Any start date"
              />
            )}
          </form.AppField>
          <RangeArrow />
          <form.Subscribe selector={(s) => s.values.start_date}>
            {(startDate) => (
              <form.AppField name="end_date">
                {(field) => (
                  <DatePickerInput
                    date={toDate(field.state.value)}
                    onDateChange={(d) => field.handleChange(fromDate(d))}
                    placeholder="Any end date"
                    minDate={toDate(startDate)}
                  />
                )}
              </form.AppField>
            )}
          </form.Subscribe>
        </PeriodRow>

        <PeriodRow label="Daily hours">
          <form.AppField name="start_time">
            {(field) => (
              <TimePickerInput
                time={field.state.value || undefined}
                onTimeChange={(t) => field.handleChange(t ?? '')}
                placeholder="Any start time"
              />
            )}
          </form.AppField>
          <RangeArrow />
          <form.AppField name="end_time">
            {(field) => (
              <TimePickerInput
                time={field.state.value || undefined}
                onTimeChange={(t) => field.handleChange(t ?? '')}
                placeholder="Any end time"
              />
            )}
          </form.AppField>
        </PeriodRow>

        <PeriodRow label="Timezone">
          <div className="w-62.5">
            <form.AppField name="timezone">
              {(field) => (
                <field.ComboboxField
                  label="Timezone"
                  hideLabel
                  placeholder="Asia/Jakarta"
                  options={TIMEZONE_OPTIONS}
                  defaultValues={field.state.value ? [field.state.value] : []}
                />
              )}
            </form.AppField>
          </div>
        </PeriodRow>
      </div>

      <form.AppField name="allowed_ips" mode="array">
        {(field) => (
          <div className="flex flex-col gap-3 px-5 py-4">
            <div>
              <p className="text-sm font-medium text-foreground">Allowed IPs</p>
              <p className="text-muted-foreground mt-0.5 text-xs">
                An address or CIDR range per field. Your own address must be on the list to enable.
              </p>
            </div>
            {/* Fields fill the row first, then wrap. */}
            <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
              {field.state.value.map((_, i) => (
                <div key={`allowed-ip-${i}`} className="flex items-center gap-1">
                  <form.AppField name={`allowed_ips[${i}]`}>
                    {(subField) => (
                      <Input
                        value={subField.state.value}
                        onChange={(e) => subField.handleChange(e.target.value)}
                        onBlur={subField.handleBlur}
                        aria-label={`Allowed IP ${i + 1}`}
                        placeholder="203.0.113.7 or 10.0.0.0/8"
                        className="w-62.5 font-mono"
                      />
                    )}
                  </form.AppField>
                  <Button
                    size="icon"
                    variant="ghost"
                    type="button"
                    className="hover:text-destructive size-8"
                    aria-label={`Remove allowed IP ${i + 1}`}
                    onClick={() => field.removeValue(i)}
                  >
                    <IconX className="size-4" />
                  </Button>
                </div>
              ))}
              <Button
                type="button"
                variant="outline"
                className="border-dashed"
                onClick={() => field.pushValue('')}
              >
                <IconPlus /> Add IP
              </Button>
            </div>
          </div>
        )}
      </form.AppField>

      <div className="flex justify-end px-5 py-4">
        <Button type="submit" disabled={updateMutation.isPending}>
          Save changes
        </Button>
      </div>
    </form>
  )
}
