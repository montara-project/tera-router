type SectionHeadingProps = {
  kicker: string
  title: string
  description: string
}

export function SectionHeading({ kicker, title, description }: SectionHeadingProps) {
  return (
    <div className="mx-auto max-w-2xl text-center">
      <p className="flex items-center justify-center gap-3 font-mono text-xs font-semibold tracking-[0.2em] text-accent-soft uppercase">
        <span aria-hidden className="h-px w-8 bg-gradient-to-r from-transparent to-accent/70" />
        {kicker}
        <span aria-hidden className="h-px w-8 bg-gradient-to-l from-transparent to-accent/70" />
      </p>
      <h2 className="mt-4 text-balance text-3xl font-semibold tracking-tight sm:text-4xl">
        {title}
      </h2>
      <p className="mt-4 text-pretty text-base leading-relaxed text-dim">{description}</p>
    </div>
  )
}
