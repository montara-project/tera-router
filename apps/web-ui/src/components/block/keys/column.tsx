import type { ColumnDef } from '@tanstack/react-table'

import {
  IconArrowRight,
  IconEye,
  IconEyeOff,
  IconLink,
  IconRefresh,
  IconTrash,
} from '@tabler/icons-react'
import { useMutation } from '@tanstack/react-query'
import { Link } from '@tanstack/react-router'
import React, { useMemo, useState } from 'react'
import { toast } from 'sonner'

import type { Models } from '@/lib/api/models'
import type { BaseColumnProps } from '@/types/column'

import { features } from '@/components/block/common/react-table'
import SimpleAlertDialog from '@/components/block/common/simple-alert-dialog'
import KeySecretDialog from '@/components/block/keys/key-secret-dialog'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { Skeleton } from '@/components/ui/skeleton'
import { useReauthDialog } from '@/hooks/use-reauth-dialog'
import { toastAxiosError } from '@/lib/api/axios-error'
import { queries } from '@/lib/api/queries'
import { formatDate } from '@/lib/date'
import { selectAllState } from '@/lib/utils'

type ColumnType = ColumnDef<typeof features, Models.ApiKey, unknown>

const STATUS_DOTS: Record<Models.ApiKeyStatus, string> = {
  active: 'bg-emerald-500 text-emerald-500',
  disabled: 'bg-zinc-400 text-zinc-400',
  restricted: 'bg-amber-500 text-amber-500',
}

function KeyIdentifierCell({ record }: { record: Models.ApiKey }) {
  return (
    <div className="flex items-center gap-2">
      <IconLink className="h-4 w-4 shrink-0 text-muted-foreground" />
      <code className="font-mono text-sm">{record.key_preview}</code>
    </div>
  )
}

export function KeysColumn({ loading }: BaseColumnProps) {
  const columns = useMemo<ColumnType[]>(() => {
    return [
      {
        id: 'select',
        header: ({ table }) => (
          <div className="flex items-center gap-2.5">
            <Checkbox
              aria-label="Select all keys"
              checked={selectAllState(
                table.getIsAllPageRowsSelected(),
                table.getIsSomePageRowsSelected()
              )}
              onCheckedChange={(value) => table.toggleAllPageRowsSelected(!!value)}
              size="sm"
            />
            <span className="text-muted-foreground text-xs whitespace-nowrap">
              keys ({table.getFilteredRowModel().rows.length})
            </span>
          </div>
        ),
        cell: ({ row }) => (
          <Checkbox
            aria-label={`Select ${row.original.name}`}
            checked={row.getIsSelected()}
            onCheckedChange={(value) => row.toggleSelected(!!value)}
            size="sm"
          />
        ),
        enableSorting: false,
        size: 70,
      },
      {
        accessorKey: 'name',
        header: 'Key',
        size: 140,
        cell: ({ row }) => {
          return loading ? (
            <Skeleton className="h-5 w-full" />
          ) : (
            <div>
              <div className="flex items-center gap-2">
                <span className="font-medium">{row.original.name}</span>
                <span
                  className={`inline-flex items-center gap-1.5 text-xs font-medium ${STATUS_DOTS[row.original.status].split(' ')[1]}`}
                >
                  <span
                    className={`size-1.5 rounded-full ${STATUS_DOTS[row.original.status].split(' ')[0]}`}
                  />
                  {row.original.status.charAt(0).toUpperCase() + row.original.status.slice(1)}
                </span>
              </div>
              <div className="text-muted-foreground mt-0.5 text-xs">
                Created {formatDate(row.original.created_at)}
              </div>
            </div>
          )
        },
      },
      {
        accessorKey: 'key_preview',
        header: 'Identifier',
        size: 210,
        cell: ({ row }) => {
          return loading ? (
            <Skeleton className="h-5 w-full" />
          ) : (
            <KeyIdentifierCell record={row.original} />
          )
        },
      },
      {
        accessorKey: 'plan_label',
        header: 'Access',
        size: 150,
        cell: ({ row }) => {
          return loading ? (
            <Skeleton className="h-5 w-full" />
          ) : (
            <div className="text-sm">
              <span className="font-semibold">{row.original.plan_label}</span>
              <span className="text-muted-foreground"> · {row.original.plan_note}</span>
            </div>
          )
        },
      },
      {
        accessorKey: 'actions',
        header: 'Actions',
        cell: ({ row }) => {
          return loading ? (
            <Skeleton className="h-5 w-full" />
          ) : (
            <ActionCell record={row.original} />
          )
        },
        size: 100,
      },
      {
        id: 'details',
        header: '',
        cell: ({ row }) => {
          return loading ? (
            <Skeleton className="h-5 w-full" />
          ) : (
            <Button asChild variant="outline">
              <Link params={{ keyId: row.original.id }} to="/keys/$keyId">
                <span>Details</span>
                <IconArrowRight />
              </Link>
            </Button>
          )
        },
        size: 110,
      },
    ]
  }, [loading])

  return columns
}

interface ActionCellProps {
  record: Models.ApiKey
}

function ActionCell({ record }: ActionCellProps) {
  const [openDelete, setOpenDelete] = useState(false)
  const [openRotate, setOpenRotate] = useState(false)
  // One-time secret dialog payload; set from the rotate response, the only
  // moment the API returns the new plaintext key.
  const [rotatedKey, setRotatedKey] = useState<{ full_key: string } | null>(null)

  const toggleMutation = useMutation(queries.keys.toggleStatus())
  const deleteMutation = useMutation(queries.keys.delete())
  const rotateMutation = useMutation(queries.keys.rotate())
  const { confirm, dialog: reauthDialog } = useReauthDialog()

  const handleToggle = async () => {
    const disabled = record.status === 'active'
    try {
      await toggleMutation.mutateAsync({ id: record.id, disabled })
      toast.success(`Key ${disabled ? 'disabled' : 'enabled'}`)
    } catch (error) {
      toastAxiosError(error)
    }
  }

  const handleDelete = async () => {
    try {
      await deleteMutation.mutateAsync(record.id)
      toast.success('Key deleted')
      setOpenDelete(false)
    } catch (error) {
      toastAxiosError(error)
    }
  }

  // Rotating mints a new secret, so it re-authenticates. The new key is shown
  // once in the secret dialog; it cannot be recovered from the app afterwards.
  const handleRotate = async () => {
    setOpenRotate(false)
    const rotated = await confirm<{ full_key: string }>('rotate this API key', async (creds) => {
      const res = await rotateMutation.mutateAsync({ id: record.id, ...creds })
      return 'totp_required' in res.data
        ? { totpRequired: true }
        : { value: { full_key: res.data.full_key } }
    })
    if (!rotated) return
    setRotatedKey(rotated)
  }

  return (
    <React.Fragment>
      <div className="flex items-center gap-1">
        <Button
          aria-label={record.status === 'active' ? 'Disable key' : 'Enable key'}
          className="text-muted-foreground hover:text-foreground"
          disabled={toggleMutation.isPending}
          mode="icon"
          onClick={() => handleToggle()}
          size="icon"
          variant="ghost"
        >
          {record.status === 'active' ? <IconEyeOff /> : <IconEye />}
        </Button>
        <Button
          aria-label="Rotate key"
          className="text-muted-foreground hover:text-foreground"
          disabled={rotateMutation.isPending}
          mode="icon"
          onClick={() => setOpenRotate(true)}
          size="icon"
          variant="ghost"
        >
          <IconRefresh />
        </Button>
        <Button
          aria-label="Delete key"
          className="text-muted-foreground hover:text-foreground"
          mode="icon"
          onClick={() => setOpenDelete(true)}
          size="icon"
          variant="ghost"
        >
          <IconTrash />
        </Button>
      </div>

      <SimpleAlertDialog
        confirmText="Delete"
        description={`Key "${record.name}" will be permanently deleted. Applications using it will stop authenticating.`}
        onConfirm={handleDelete}
        onOpenChange={setOpenDelete}
        open={openDelete}
        title="Do you want to delete this key?"
        variant="destructive"
      />

      <SimpleAlertDialog
        confirmText="Rotate"
        description={`Key "${record.name}" gets a new secret. The current one stops authenticating immediately; update every application that uses it.`}
        onConfirm={() => void handleRotate()}
        onOpenChange={setOpenRotate}
        open={openRotate}
        title="Do you want to rotate this key?"
        variant="destructive"
      />
      <KeySecretDialog
        fullKey={rotatedKey?.full_key ?? ''}
        mode="rotated"
        name={record.name}
        onOpenChange={(open) => {
          if (!open) setRotatedKey(null)
        }}
        open={!!rotatedKey}
        planLabel={record.plan_label}
      />

      {reauthDialog}
    </React.Fragment>
  )
}
