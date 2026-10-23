import { IconEdit, IconReplace } from '@tabler/icons-react'

import type { Models } from '@/lib/api/models'

import IconBadge from '@/components/block/common/icon-badge'
import { Badge, BadgeDot } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import DialogContent, {
  Dialog,
  DialogBody,
  DialogDescription,
  DialogTitle,
} from '@/components/ui/dialog'

import { contextWindowLabel } from './alias-form-dialog'

interface AliasDetailDialogProps {
  alias: Models.ModelAlias | null
  onOpenChange: (open: boolean) => void
  onEdit: (alias: Models.ModelAlias) => void
}

/** Read-only view of one alias pool and its fallback order. */
export default function AliasDetailDialog({ alias, onOpenChange, onEdit }: AliasDetailDialogProps) {
  const targets = alias?.targets ?? []
  const activeCount = targets.filter((t) => t.active).length

  return (
    <Dialog open={Boolean(alias)} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl p-0">
        <div className="border-border border-b px-6 pt-5 pb-4">
          <div className="flex items-start gap-3">
            <IconBadge icon={IconReplace} iconClassName="size-5" />
            <div className="min-w-0 flex-1">
              <DialogTitle className="truncate text-base">{alias?.name}</DialogTitle>
              <DialogDescription>
                Context window: {contextWindowLabel(alias?.context_window ?? 0)}
              </DialogDescription>
            </div>
            <Badge variant={alias?.active ? 'success' : 'secondary'} appearance="light" size="sm">
              <BadgeDot />
              {alias?.active ? 'Active' : 'Inactive'}
            </Badge>
          </div>
        </div>

        <DialogBody className="space-y-5 px-6 py-5">
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <p className="text-muted-foreground text-xs font-semibold uppercase tracking-wide">
                Fallback order
              </p>
              <span className="text-muted-foreground text-xs">
                {activeCount} of {targets.length} active
              </span>
            </div>

            {targets.length === 0 ? (
              <p className="border-border text-muted-foreground rounded-lg border border-dashed px-3 py-4 text-center text-xs">
                No targets in this pool.
              </p>
            ) : (
              targets.map((target, i) => (
                <div
                  key={target.id || i}
                  title={target.active ? undefined : 'Inactive — skipped by the router'}
                  className={`flex items-center gap-2 rounded-lg border px-3 py-2 ${
                    target.active ? 'border-border' : 'border-dashed border-border/60 opacity-60'
                  }`}
                >
                  <span className="flex size-6 shrink-0 items-center justify-center rounded-md bg-emerald-50 text-xs font-semibold tabular-nums text-emerald-600 ring-1 ring-emerald-200/60 dark:bg-emerald-950/40 dark:text-emerald-300 dark:ring-emerald-900/50">
                    {i + 1}
                  </span>
                  <span className="text-muted-foreground min-w-0 truncate text-sm">
                    {target.provider}
                  </span>
                  <span className="text-muted-foreground/60">/</span>
                  <span
                    className={`min-w-0 flex-1 truncate font-mono text-xs font-medium ${target.active ? '' : 'line-through'}`}
                  >
                    {target.model}
                  </span>
                  <Badge
                    variant={target.active ? 'success' : 'secondary'}
                    appearance="light"
                    size="sm"
                  >
                    <BadgeDot />
                    {target.active ? 'Active' : 'Inactive'}
                  </Badge>
                </div>
              ))
            )}
          </div>

          <div className="border-border flex justify-end gap-2 border-t pt-4">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Close
            </Button>
            <Button type="button" onClick={() => alias && onEdit(alias)}>
              <IconEdit /> Edit
            </Button>
          </div>
        </DialogBody>
      </DialogContent>
    </Dialog>
  )
}
