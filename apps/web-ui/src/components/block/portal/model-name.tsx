import { ProviderAvatar } from '@/components/block/providers/provider-avatar'

interface ModelNameProps {
  provider: string
  apiKind?: string
  model: string
  /** Makes the model name a button, e.g. to open the request detail dialog. */
  onOpen?: () => void
}

export default function ModelName({ provider, apiKind, model, onOpen }: ModelNameProps) {
  return (
    <span className="flex min-w-0 items-center gap-2.5">
      <ProviderAvatar slug={provider} apiKind={apiKind} size="xs" className="size-5" />
      <span className="min-w-0">
        {onOpen ? (
          <button
            type="button"
            onClick={onOpen}
            title={model}
            aria-label={`Open request details for ${model}`}
            className="block max-w-full truncate text-left font-mono text-[12.5px] underline-offset-2 hover:underline"
          >
            {model}
          </button>
        ) : (
          <span className="block truncate font-mono text-[12.5px]" title={model}>
            {model}
          </span>
        )}
        <span className="block truncate text-[11.5px] text-muted-foreground">{provider}</span>
      </span>
    </span>
  )
}
