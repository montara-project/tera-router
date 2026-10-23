import { IconEye, IconReplace } from '@tabler/icons-react'
import { useMutation } from '@tanstack/react-query'
import pluralize from 'pluralize'
import React, { useState } from 'react'
import { toast } from 'sonner'

import type { Models } from '@/lib/api/models'

import RowColumnAction from '@/components/block/common/row-column-action'
import SimpleAlertDialog from '@/components/block/common/simple-alert-dialog'
import ChainGroup from '@/components/block/traffic/chains/chain-group'
import { Badge, BadgeDot } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { toastAxiosError } from '@/lib/api/axios-error'
import { queries } from '@/lib/api/queries'

import { contextWindowLabel } from './alias-form-dialog'

interface AliasRowProps {
  alias: Models.ModelAlias
  onShow: (alias: Models.ModelAlias) => void
  onEdit: (alias: Models.ModelAlias) => void
}

/** One alias in the list; the fallback targets only show in detail/edit. */
export default function AliasRow({ alias, onShow, onEdit }: AliasRowProps) {
  const [openDelete, setOpenDelete] = useState(false)

  const removeMutation = useMutation(queries.aliases.remove())

  const handleDelete = async () => {
    try {
      await removeMutation.mutateAsync(alias.name)
      toast.success('Alias deleted successfully')
      setOpenDelete(false)
    } catch (error) {
      toastAxiosError(error as Error)
    }
  }

  return (
    <React.Fragment>
      <div className="flex flex-wrap items-center gap-x-6 gap-y-3 px-4 py-3">
        <div className="min-w-0 flex-1">
          {/* Clients send the bare alias name as the model. */}
          <ChainGroup
            title={alias.name}
            description={alias.name}
            icon={IconReplace}
            tone="success"
          />
        </div>

        <span className="text-muted-foreground text-xs tabular-nums">
          {pluralize('target', alias.targets.length, true)} ·{' '}
          {contextWindowLabel(alias.context_window)}
        </span>

        <Badge variant={alias.active ? 'success' : 'secondary'} appearance="light" size="sm">
          <BadgeDot />
          {alias.active ? 'Active' : 'Inactive'}
        </Badge>

        <RowColumnAction
          onEdit={() => onEdit(alias)}
          onDelete={() => setOpenDelete(true)}
          actions={[
            <Button
              key="show"
              mode="link"
              underline="solid"
              className="dark:text-neutral-300"
              onClick={() => onShow(alias)}
            >
              <IconEye className="text-primary size-4 dark:text-neutral-300" />
              <span>Show</span>
            </Button>,
          ]}
        />
      </div>

      <SimpleAlertDialog
        title="Do you want to delete this alias?"
        description={`Keys and plans referencing ${alias.name} will no longer resolve.`}
        open={openDelete}
        onOpenChange={setOpenDelete}
        onConfirm={handleDelete}
        confirmText="Delete"
        variant="destructive"
      />
    </React.Fragment>
  )
}
