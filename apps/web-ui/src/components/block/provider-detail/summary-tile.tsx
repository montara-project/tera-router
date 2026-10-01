import { Card, CardContent } from '@/components/ui/card'

export default function SummaryTile({
  label,
  value,
  mono = false,
}: {
  label: string
  value: string
  mono?: boolean
}) {
  return (
    <Card className="bg-background">
      <CardContent className="p-4">
        <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          {label}
        </p>
        <p className={`mt-2 break-all text-sm ${mono ? 'font-mono' : 'font-medium'}`}>
          {value || '—'}
        </p>
      </CardContent>
    </Card>
  )
}
