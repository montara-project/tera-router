import { IconCheck, IconCopy } from '@tabler/icons-react'
import { Fragment } from 'react'

import type { CliToolEnvVar, CliToolFile } from '@/lib/api/models/cli-tool'

import { Button } from '@/components/ui/button'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { useCopyToClipboard } from '@/hooks/use-copy-to-clipboard'

const KEY = 'text-sky-700 dark:text-sky-300'
const STRING = 'text-emerald-700 dark:text-emerald-300'

/** Colors keys and strings in one line of JSON, TOML, YAML or dotenv. */
function highlight(line: string): React.ReactNode {
  if (/^\s*\[/.test(line)) return <span className={KEY}>{line}</span>

  const out: React.ReactNode[] = []
  let rest = line
  const lead = /^(\s*)([A-Za-z_][\w.-]*)(\s*[=:])/.exec(rest)
  if (lead) {
    out.push(lead[1], <span className={KEY}>{lead[2]}</span>, lead[3])
    rest = rest.slice(lead[0].length)
  }
  const parts = rest.split(/("(?:[^"\\]|\\.)*")/)
  parts.forEach((part, i) => {
    if (i % 2 === 0) out.push(part)
    else out.push(<span className={/^\s*:/.test(parts[i + 1] ?? '') ? KEY : STRING}>{part}</span>)
  })
  return out.map((node, i) => <Fragment key={i}>{node}</Fragment>)
}

function Code({ content }: { content: string }) {
  return (
    <pre className="overflow-x-auto px-4 py-3.5 font-mono text-xs leading-relaxed text-foreground">
      <code>
        {content
          .replace(/\n$/, '')
          .split('\n')
          .map((line, i) => (
            <Fragment key={i}>
              {i > 0 && '\n'}
              {highlight(line)}
            </Fragment>
          ))}
      </code>
    </pre>
  )
}

function CopyButton({ value, label, what }: { value: string; label: string; what: string }) {
  const { copy, copied } = useCopyToClipboard()
  return (
    <Button
      variant="ghost"
      size="sm"
      className="h-7 gap-1.5 px-2 text-xs text-muted-foreground"
      aria-label={copied ? `${what} copied` : `${label} ${what}`}
      onClick={() => copy(value)}
    >
      {copied ? <IconCheck aria-hidden /> : <IconCopy aria-hidden />}
      {copied ? 'Copied' : label}
    </Button>
  )
}

const fileLabel = (f: CliToolFile) => (f.partial ? `${f.label} (partial)` : f.label)

/** The config files of a tool, one tab each when there are several. */
export function ConfigFiles({ files }: { files: CliToolFile[] }) {
  if (files.length === 0) return null

  if (files.length === 1) {
    const [file] = files
    return (
      <div className="overflow-hidden rounded-lg border border-border bg-background">
        <div className="flex items-center gap-2 border-b border-border py-1 ps-4 pe-1.5">
          <span
            className="min-w-0 font-mono text-xs break-all text-muted-foreground"
            title={file.path}
          >
            {file.display_path}
          </span>
          <span className="ms-auto">
            <CopyButton value={file.content} label="Copy" what={file.label} />
          </span>
        </div>
        <Code content={file.content} />
      </div>
    )
  }

  const all = files.map((f) => `# ${f.display_path}\n${f.content}`).join('\n')
  return (
    <Tabs
      defaultValue={files[0].path}
      className="overflow-hidden rounded-lg border border-border bg-background"
    >
      <div className="flex items-center gap-2 border-b border-border pe-1.5">
        <TabsList variant="line" size="sm" className="min-w-0 gap-1 overflow-x-auto border-0 px-2">
          {files.map((f) => (
            <TabsTrigger
              key={f.path}
              value={f.path}
              className="px-2 py-2.5 font-mono text-xs data-[state=active]:text-foreground"
            >
              {fileLabel(f)}
            </TabsTrigger>
          ))}
        </TabsList>
        <span className="ms-auto flex shrink-0 items-center">
          <CopyButton value={all} label="Copy all" what="every file" />
        </span>
      </div>
      {files.map((f) => (
        <TabsContent key={f.path} value={f.path} className="mt-0">
          <div className="flex items-center gap-2 border-b border-border py-1 ps-4 pe-1.5">
            <span
              className="min-w-0 font-mono text-xs break-all text-muted-foreground"
              title={f.path}
            >
              {f.display_path}
            </span>
            <span className="ms-auto">
              <CopyButton value={f.content} label="Copy" what={f.label} />
            </span>
          </div>
          <Code content={f.content} />
        </TabsContent>
      ))}
    </Tabs>
  )
}

/** Environment variables the tool reads, with the file each lives in. */
export function EnvTable({ vars }: { vars: CliToolEnvVar[] }) {
  if (vars.length === 0) return null
  return (
    <div className="relative overflow-x-auto rounded-lg border border-border">
      <table className="w-full min-w-[32rem] text-xs">
        <thead className="border-b border-border bg-muted/40 text-muted-foreground">
          <tr>
            <th className="px-4 py-2 text-left font-medium">Environment variable</th>
            <th className="px-4 py-2 text-left font-medium">Value</th>
            <th className="px-4 py-2 text-left font-medium">File</th>
            <th className="w-10">
              <span className="sr-only">Copy</span>
            </th>
          </tr>
        </thead>
        <tbody className="font-mono">
          {vars.map((v) => (
            <tr key={v.name} className="border-b border-border last:border-0">
              <td className="px-4 py-2 text-foreground">{v.name}</td>
              <td className="px-4 py-2 break-all text-muted-foreground">{v.value}</td>
              <td className="px-4 py-2 whitespace-nowrap text-muted-foreground">{v.file}</td>
              <td className="pe-1.5 text-right">
                <EnvCopy name={v.name} value={v.value} />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

function EnvCopy({ name, value }: { name: string; value: string }) {
  const { copy, copied } = useCopyToClipboard()
  return (
    <Button
      variant="ghost"
      mode="icon"
      size="sm"
      aria-label={copied ? `${name} copied` : `Copy ${name}`}
      onClick={() => copy(`${name}=${value}`)}
    >
      {copied ? <IconCheck aria-hidden /> : <IconCopy aria-hidden />}
    </Button>
  )
}
