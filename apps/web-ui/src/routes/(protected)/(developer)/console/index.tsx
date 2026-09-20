import { IconClipboard, IconTrash } from '@tabler/icons-react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { createFileRoute } from '@tanstack/react-router'
import { toast } from 'sonner'

import SectionCard from '@/components/block/common/section-card'
import ConsoleLog from '@/components/block/console/console-log'
import { Button } from '@/components/ui/button'
import { CONSOLE_QUERY_KEY, consoleQueries } from '@/lib/api/queries/console'
import { services } from '@/lib/api/services'

export const Route = createFileRoute('/(protected)/(developer)/console/')({
  component: RouteComponent,
})

function RouteComponent() {
  const queryClient = useQueryClient()

  const { data } = useQuery(consoleQueries.get())
  const entries = data?.data ?? []

  const clearMutation = useMutation({
    mutationFn: () => services.console.clear(),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: [CONSOLE_QUERY_KEY] }),
    onError: () => toast.error('Failed to clear console'),
  })

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
            onClick={() => clearMutation.mutate()}
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
