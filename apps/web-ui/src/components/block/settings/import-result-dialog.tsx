import type { LegacyImportResult } from '@/lib/api/models/backup'

import SimpleDialog from '@/components/block/common/simple-dialog'

const CREATED_LABELS: Record<string, string> = {
  custom_providers: 'Custom providers',
  accounts: 'Accounts',
  api_keys: 'API keys',
  chains: 'Chains',
  aliases: 'Model aliases',
  proxy_pools: 'Proxy pools',
}

const SOURCE_LABELS: Record<LegacyImportResult['source'], string> = {
  '9router': '9router',
  omniroute: 'OmniRoute',
}

interface ImportResultDialogProps {
  result: LegacyImportResult | null
  onClose: () => void
}

/** Summary of a 9router / OmniRoute import: what was created and what was skipped. */
export default function ImportResultDialog({ result, onClose }: ImportResultDialogProps) {
  return (
    <SimpleDialog
      open={result !== null}
      onOpenChange={(open) => !open && onClose()}
      title={result ? `${SOURCE_LABELS[result.source]} import complete` : ''}
      description="Existing rows were kept; the backup's duplicates were skipped."
      size="lg"
    >
      {result && (
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
            {Object.entries(CREATED_LABELS).map(([key, label]) => (
              <div key={key} className="bg-muted/40 rounded-lg border border-border px-3 py-2">
                <p className="text-muted-foreground text-xs">{label}</p>
                <p className="text-lg font-semibold">{result.created[key] ?? 0}</p>
              </div>
            ))}
          </div>

          {result.skipped.length > 0 && (
            <div className="space-y-2">
              <p className="text-sm font-medium">Skipped ({result.skipped.length})</p>
              <ul className="max-h-64 space-y-1.5 overflow-y-auto rounded-lg border border-border p-3">
                {result.skipped.map((item, i) => (
                  <li key={`${item.kind}-${item.name}-${i}`} className="text-xs leading-relaxed">
                    <span className="text-muted-foreground font-mono">{item.kind}</span>{' '}
                    <span className="font-medium">{item.name}</span>
                    <span className="text-muted-foreground"> — {item.reason}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}
    </SimpleDialog>
  )
}
