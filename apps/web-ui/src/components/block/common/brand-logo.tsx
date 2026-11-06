import { useBranding } from '@/hooks/use-branding'
import { cn } from '@/lib/utils'

/**
 * The instance logo on a light tile, as in the sidebar header. The tile keeps
 * a dark logo (the default mark) visible on the dark theme.
 */
export default function BrandLogo({ className }: { className?: string }) {
  const { logo } = useBranding()
  return (
    <span
      className={cn(
        'flex size-[22px] shrink-0 items-center justify-center rounded-[5.5px] bg-neutral-100 p-[3px]',
        className
      )}
    >
      <img src={logo} alt="" width={16} height={16} />
    </span>
  )
}
