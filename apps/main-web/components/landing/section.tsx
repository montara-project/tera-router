// Page frame borrowed from blueprint-style landing pages: every band sits
// between two dotted vertical rails, and each band opens with a dotted
// horizontal rule that pins a node where it crosses the rails.

import { version } from '../../package.json'

const RAIL = 'mx-auto max-w-7xl border-x border-dotted border-dot'

export const GITHUB_URL = 'https://github.com/montara-project/tera-router'
export const DOCS_URL = 'https://docs.terarouter.xyz'

// release-it bumps this package.json and tags `v${version}` on every release.
export const VERSION = `v${version}`
export const RELEASE_URL = `${GITHUB_URL}/releases/tag/${VERSION}`

export const primaryButton =
  'inline-flex cursor-pointer items-center justify-center gap-2 rounded-lg bg-accent-strong px-4 py-2.5 text-sm font-medium text-on-accent shadow-[inset_0_1px_0_rgb(255_255_255/0.18),0_1px_2px_rgb(0_0_0/0.15)] transition-[filter] duration-200 hover:brightness-110'

export const secondaryButton =
  'inline-flex cursor-pointer items-center justify-center gap-2 rounded-lg border border-line bg-surface px-4 py-2.5 text-sm font-medium text-ink elev-1 transition-colors duration-200 hover:bg-raised'

export function Divider() {
  return (
    // overflow-x-clip: when the rails sit on the viewport edge, the outer half
    // of each node would otherwise add a few px of horizontal scroll.
    <div aria-hidden className="overflow-x-clip border-t border-dotted border-dot">
      <div className="relative mx-auto max-w-7xl">
        <span className="absolute -top-1 -left-[3.5px] size-[7px] rounded-full bg-dot" />
        <span className="absolute -top-1 -right-[3.5px] size-[7px] rounded-full bg-dot" />
      </div>
    </div>
  )
}

type SectionProps = {
  id?: string
  /** Renders the band dark in both themes. */
  dark?: boolean
  className?: string
  children: React.ReactNode
}

export function Section({ id, dark = false, className = '', children }: SectionProps) {
  return (
    <section className={dark ? 'dark bg-band text-ink' : ''} id={id}>
      <Divider />
      <div className={`${RAIL} px-5 py-20 sm:px-12 sm:py-28 ${className}`}>{children}</div>
    </section>
  )
}

export function Rail({
  className = '',
  children,
}: {
  className?: string
  children: React.ReactNode
}) {
  return <div className={`${RAIL} ${className}`}>{children}</div>
}

type SectionHeadingProps = {
  title: React.ReactNode
  description: string
  children?: React.ReactNode
}

export function SectionHeading({ title, description, children }: SectionHeadingProps) {
  return (
    <div className="grid items-end gap-8 lg:grid-cols-[1.15fr_1fr] lg:gap-16">
      <h2 className="font-display text-4xl leading-[1.05] font-medium tracking-[-0.035em] text-balance sm:text-5xl">
        {title}
      </h2>
      <div>
        <p className="text-lg leading-relaxed text-pretty text-faint">{description}</p>
        {children}
      </div>
    </div>
  )
}
