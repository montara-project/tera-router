import { IconClipboard, IconTrash } from '@tabler/icons-react'
import { useMutation, useQuery } from '@tanstack/react-query'
import { createFileRoute } from '@tanstack/react-router'
import { toast } from 'sonner'

import SectionCard from '@/components/block/common/section-card'
import ConsoleLog from '@/components/block/console/console-log'
import { Button } from '@/components/ui/button'
import { queries } from '@/lib/api/queries'

export const Route = createFileRoute('/(protected)/(developer)/console/')({
  component: RouteComponent,
})

function RouteComponent() {
  const { data } = useQuery(queries.console.get())
  const entries = data?.data ?? []

  const clearMutation = useMutation(queries.console.clear())

  const handleCopy = () => {
    const text = entries
      .map((entry) => `${entry.time} ${entry.level.toUpperCase()} ${entry.message}`)
      .join('\n')
    navigator.clipboard
      .writeText(text)
      .then(() => toast.success('Console log copied'))
      .catch(() => toast.error('Failed to copy console log'))
  }

  return (
    <SectionCard
      title="Console Log"
      description={`${entries.length} lines · live`}
      toolbar={
        <>
          <Button type="button" variant="outline" size="sm" onClick={handleCopy}>
            <IconClipboard className="h-4 w-4" />
            Copy
          </Button>
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={clearMutation.isPending}
            onClick={() =>
              clearMutation.mutate(undefined, {
                onSuccess: () => toast.success('Console cleared'),
                onError: () => toast.error('Failed to clear console'),
              })
            }
          >
            <IconTrash className="h-4 w-4" />
            Clear
          </Button>
        </>
      }
    >
      <ConsoleLog entries={entries} />
    </SectionCard>
  )
}
