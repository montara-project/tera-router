'use client'

import { useEffect, useRef, useState } from 'react'

type Token = { text: string; cls: string }

// A flag starts a word: "-d", "--port", not the hyphen inside "tera-router".
const FLAG = /(?<![\w/.-])-{1,2}[A-Za-z][\w-]*/

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
  if (line.startsWith('←') || line.startsWith('✔')) return [{ text: line, cls: 'text-accent-soft' }]
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

/** Renders the first `shown` characters; the rest stays in layout but invisible. */
function renderTokens(tokens: Token[], shown: number) {
  let left = shown
  return tokens.map((token, i) => {
    const visible = token.text.slice(0, Math.max(left, 0))
    const hidden = token.text.slice(visible.length)
    left -= token.text.length
    return (
      <span className={token.cls} key={i}>
        {visible}
        {hidden && <span className="invisible">{hidden}</span>}
      </span>
    )
  })
}

const TYPE_MS = 22
const PAUSE_MS = 320
const PROMPT = 2 // "$ " appears at once, the command after it is typed

type TerminalProps = {
  label: string
  lines: string[]
  className?: string
}

/**
 * Terminal in the style of Magic UI's Terminal: once 30% of it is on screen,
 * `$ ` lines type out character by character and every other line fades in,
 * one after another. Every line is rendered from the start (invisible until
 * reached), so the card never changes height while it plays.
 */
export function Terminal({ label, lines, className = '' }: TerminalProps) {
  const ref = useRef<HTMLDivElement>(null)
  // -1 before it starts; lines.length once done.
  const [line, setLine] = useState(-1)
  const [chars, setChars] = useState(0)

  useEffect(() => {
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      setLine(lines.length)
      return
    }
    const el = ref.current
    if (!el) return
    const io = new IntersectionObserver(
      ([entry]) => {
        if (!entry?.isIntersecting) return
        setLine(0)
        io.disconnect()
      },
      { threshold: 0.3 }
    )
    io.observe(el)
    return () => io.disconnect()
  }, [lines.length])

  useEffect(() => {
    if (line < 0 || line >= lines.length) return
    const text = lines[line] ?? ''
    const typed = text.startsWith('$ ')
    const typing = typed && chars < text.length
    // Next character on this line, or move on to the next line.
    const delay = typing ? (chars ? TYPE_MS : 0) : typed ? PAUSE_MS : PAUSE_MS / 2
    const timer = setTimeout(() => {
      if (typing) {
        setChars((c) => Math.max(c + 1, PROMPT))
        return
      }
      setLine((l) => l + 1)
      setChars(0)
    }, delay)
    return () => clearTimeout(timer)
  }, [line, chars, lines])

  return (
    <div
      className={`terminal-island overflow-hidden rounded-xl border border-code-line bg-code ${className}`}
      ref={ref}
    >
      <div className="flex items-center gap-2 border-b border-code-line px-4 py-3">
        <span aria-hidden className="size-2.5 shrink-0 rounded-full bg-[#f55036]" />
        <span aria-hidden className="size-2.5 shrink-0 rounded-full bg-[#f5bf4f]" />
        <span aria-hidden className="size-2.5 shrink-0 rounded-full bg-[#22c55e]" />
        <span className="ml-2 truncate font-mono text-xs text-neutral-400">{label}</span>
      </div>
      <pre className="sr-only">{lines.join('\n')}</pre>
      <pre aria-hidden className="overflow-x-auto p-4 font-mono text-[13px] leading-relaxed">
        <code className="grid gap-y-0.5">
          {lines.map((text, i) => {
            const typed = text.startsWith('$ ')
            const tokens = tokenize(text)
            if (i > line) {
              return (
                <span className="invisible block whitespace-pre" key={i}>
                  {text || ' '}
                </span>
              )
            }
            if (typed) {
              const typing = i === line
              return (
                <span className="block whitespace-pre" key={i}>
                  {renderTokens(tokens, typing ? chars : text.length)}
                  {typing && chars < text.length && (
                    <span className="terminal-caret ml-px inline-block h-[1.1em] w-[0.55em] translate-y-[0.15em] bg-neutral-300" />
                  )}
                </span>
              )
            }
            return (
              <span className="terminal-line-in block whitespace-pre" key={i}>
                {text ? renderTokens(tokens, text.length) : ' '}
              </span>
            )
          })}
        </code>
      </pre>
    </div>
  )
}
