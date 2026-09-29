type CodeBlockProps = {
  label: string
  lines: string[]
  className?: string
}

export function CodeBlock({ label, lines, className = '' }: CodeBlockProps) {
  return (
    <div className={`overflow-hidden rounded-xl border border-line bg-[#0a0e1d] ${className}`}>
      <div className="flex items-center gap-2 border-b border-line px-4 py-2.5">
        <span aria-hidden className="size-2.5 rounded-full bg-[#f55036]" />
        <span aria-hidden className="size-2.5 rounded-full bg-[#f5bf4f]" />
        <span aria-hidden className="size-2.5 rounded-full bg-[#22c55e]" />
        <span className="ml-2 font-mono text-xs text-faint">{label}</span>
      </div>
      <pre className="overflow-x-auto p-4 font-mono text-[13px] leading-relaxed">
        <code>
          {lines.map((line, i) => {
            const tone = line.startsWith('←')
              ? 'text-accent-soft'
              : line.startsWith('$')
                ? 'text-ink'
                : 'text-slate-300'
            return (
              <span className={`block whitespace-pre ${tone}`} key={i}>
                {line}
              </span>
            )
          })}
        </code>
      </pre>
    </div>
  )
}
