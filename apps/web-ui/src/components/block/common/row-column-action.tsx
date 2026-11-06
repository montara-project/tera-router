'use client'

import { IconDots, IconEye, IconPencil, IconTrash } from '@tabler/icons-react'

import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'

interface RowColumnActionProps {
  /** What the row is, for the item labels: "Edit chain", "Delete chain". */
  noun?: string
  /** The row's name, for the trigger's accessible name: "Actions for coding". */
  name?: string
  onShow?: () => void
  onEdit?: () => void
  onDelete?: () => void
  /** Extra items, listed after Edit and before the destructive group. */
  dropdown?: React.ReactNode
}

/** One "…" button per table row that opens the row's actions. */
export default function RowColumnAction({
  noun,
  name,
  onShow,
  onEdit,
  onDelete,
  dropdown,
}: RowColumnActionProps) {
  const label = (verb: string) => (noun ? `${verb} ${noun}` : verb)

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          mode="icon"
          size="sm"
          aria-label={name ? `Actions for ${name}` : 'Row actions'}
        >
          <IconDots aria-hidden />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="min-w-44">
        <DropdownMenuGroup>
          {onShow && (
            <DropdownMenuItem onClick={onShow}>
              <IconEye />
              {label('View')}
            </DropdownMenuItem>
          )}
          {onEdit && (
            <DropdownMenuItem onClick={onEdit}>
              <IconPencil />
              {label('Edit')}
            </DropdownMenuItem>
          )}
          {dropdown}
        </DropdownMenuGroup>

        {onDelete && (
          <>
            {(onShow || onEdit || dropdown) && <DropdownMenuSeparator />}
            <DropdownMenuItem variant="destructive" onClick={onDelete}>
              <IconTrash />
              {label('Delete')}
            </DropdownMenuItem>
          </>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
