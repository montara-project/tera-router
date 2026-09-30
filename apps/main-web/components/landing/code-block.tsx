type Token = { text: string; cls: string }

const FLAG = /-{1,2}[A-Za-z][\w-]*/

function tokenizeRest(rest: string, out: Token[]) {
  // strings first ("…" or '…'), then flags inside the remainder
  for (const part of rest.split(/("[^"]*"|'[^']*')/g)) {
    if (!part) continue
    if (part.startsWith('"') || part.startsWith("'")) {
      out.push({ text: part, cls: 'text-amber-400/90' })
      continue
    }
    for (const piece of part.split(new RegExp(`(${FLAG.source})`, 'g'))) {
      if (!piece) continue
      out.push(
        FLAG.test(piece) && piece.startsWith('-')
          ? { text: piece, cls: 'text-neutral-400' }
          : { text: piece, cls: 'text-neutral-300' }
      )
    }
  }
}

function tokenize(line: string): Token[] {
  if (line.startsWith('←')) return [{ text: line, cls: 'text-accent-soft' }]
  if (line.trim().startsWith('#')) return [{ text: line, cls: 'text-faint italic' }]
  if (line.startsWith('$')) {
    const out: Token[] = [{ text: '$ ', cls: 'text-accent-soft' }]
    tokenizeRest(line.slice(2), out)
    return out
  }
  const out: Token[] = []
  tokenizeRest(line, out)
  return out
}

type CodeBlockProps = {
  label: string
  lines: string[]
  className?: string
}

export function CodeBlock({ label, lines, className = '' }: CodeBlockProps) {
  return (
    <div
      className={`sheen overflow-hidden rounded-xl border border-code-line bg-code ${className}`}
    >
      <div className="flex items-center gap-2 border-b border-code-line px-4 py-2.5">
        <span aria-hidden className="size-2.5 rounded-full bg-[#f55036]" />
        <span aria-hidden className="size-2.5 rounded-full bg-[#f5bf4f]" />
        <span aria-hidden className="size-2.5 rounded-full bg-[#22c55e]" />
        <span className="ml-2 font-mono text-xs text-neutral-500">{label}</span>
      </div>
      <pre className="overflow-x-auto p-4 font-mono text-[13px] leading-relaxed">
        <code>
          {lines.map((line, i) => (
            <span className="block whitespace-pre" key={i}>
              {tokenize(line).map((token, j) => (
                <span className={token.cls} key={j}>
                  {token.text}
                </span>
              ))}
            </span>
          ))}
        </code>
      </pre>
    </div>
  )
}
