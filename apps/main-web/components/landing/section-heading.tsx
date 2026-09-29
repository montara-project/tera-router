type SectionHeadingProps = {
  kicker: string
  title: string
  description: string
}

export function SectionHeading({ kicker, title, description }: SectionHeadingProps) {
  return (
    <div className="mx-auto max-w-2xl text-center">
      <p className="font-mono text-xs font-semibold tracking-[0.2em] text-accent-soft uppercase">
        {kicker}
      </p>
      <h2 className="mt-3 text-3xl font-semibold tracking-tight sm:text-4xl">{title}</h2>
      <p className="mt-4 text-base leading-relaxed text-dim">{description}</p>
    </div>
  )
}
