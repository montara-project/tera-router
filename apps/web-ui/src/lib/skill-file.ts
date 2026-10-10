/** Fields a skill file carries, shaped like the Create skill form. */
export type ParsedSkillFile = {
  name: string
  description: string
  prompt: string
}

/** Largest skill file accepted; a prompt beyond this is almost certainly the wrong file. */
export const MAX_SKILL_FILE_BYTES = 256 * 1024

/**
 * Parse a SKILL.md: optional YAML frontmatter holding `name` and
 * `description`, followed by the prompt. It reads the frontmatter this app
 * serves at /skills/<id>/SKILL.md and the common hand-written forms (plain,
 * quoted, and `>` / `|` block values) — not arbitrary YAML.
 * @param text the file content
 * @param filename used as the name when the frontmatter has none; the
 *   conventional "SKILL.md" says nothing, so it leaves the name empty
 */
export function parseSkillFile(text: string, filename: string): ParsedSkillFile {
  const source = text.replace(/^﻿/, '').replace(/\r\n?/g, '\n')
  const match = /^---\n([\s\S]*?)\n---[ \t]*(?:\n|$)/.exec(source)
  const fields = match ? parseFrontmatter(match[1]) : {}

  return {
    name: fields.name || filename.replace(/\.[^.]+$/, '').replace(/^skill$/i, ''),
    description: fields.description ?? '',
    prompt: (match ? source.slice(match[0].length) : source).trim(),
  }
}

function parseFrontmatter(block: string): Record<string, string> {
  const fields: Record<string, string> = {}
  const lines = block.split('\n')

  for (let i = 0; i < lines.length; i++) {
    const entry = /^([A-Za-z_][\w-]*):[ \t]*(.*)$/.exec(lines[i])
    if (!entry) continue
    const [, key, rest] = entry

    // Indented lines below a key belong to its value.
    const continuation: string[] = []
    while (i + 1 < lines.length && /^(\s+\S|\s*$)/.test(lines[i + 1])) {
      continuation.push(lines[++i].trim())
    }

    // `|` keeps line breaks; `>` and plain multi-line values fold into one line.
    const blockStyle = /^([|>])[+-]?\d*$/.exec(rest.trim())
    if (blockStyle) {
      fields[key] = continuation.join(blockStyle[1] === '|' ? '\n' : ' ').trim()
    } else {
      fields[key] = unquote([rest, ...continuation].join(' ').trim())
    }
  }
  return fields
}

function unquote(value: string): string {
  if (value.length >= 2 && value.startsWith('"') && value.endsWith('"')) {
    try {
      return String(JSON.parse(value))
    } catch {
      return value.slice(1, -1)
    }
  }
  if (value.length >= 2 && value.startsWith("'") && value.endsWith("'")) {
    return value.slice(1, -1).replace(/''/g, "'")
  }
  return value
}
