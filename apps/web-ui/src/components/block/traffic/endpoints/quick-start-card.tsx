import {
  IconArrowUpRight,
  IconBrandNodejs,
  IconBrandPython,
  IconCheck,
  IconCopy,
  IconRocket,
  IconTerminal,
  IconTerminal2,
  IconVariable,
} from '@tabler/icons-react'
import { Link } from '@tanstack/react-router'

import SectionCardPanel from '@/components/block/common/section-card-panel'
import { Button } from '@/components/ui/button'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { useCopyToClipboard } from '@/hooks/use-copy-to-clipboard'

interface Snippet {
  value: string
  label: string
  icon: React.ElementType
  /** language chip on the code block */
  lang: string
  /** builds the snippet for the router's origin */
  code: (origin: string) => string
}

const SNIPPETS: Snippet[] = [
  {
    value: 'curl',
    icon: IconTerminal,
    lang: 'shell',
    label: 'cURL',
    code: (origin) =>
      [
        `curl ${origin}/v1/chat/completions \\`,
        '  -H "Authorization: Bearer $API_KEY" \\',
        '  -H "Content-Type: application/json" \\',
        "  -d '{",
        '    "model": "provider/model-id",',
        '    "messages": [{"role": "user", "content": "Hello"}]',
        "  }'",
      ].join('\n'),
  },
  {
    value: 'python',
    icon: IconBrandPython,
    lang: 'python',
    label: 'Python',
    code: (origin) =>
      [
        'from openai import OpenAI',
        '',
        `client = OpenAI(base_url="${origin}/v1", api_key="$API_KEY")`,
        'resp = client.chat.completions.create(',
        '    model="provider/model-id",',
        '    messages=[{"role": "user", "content": "Hello"}],',
        ')',
        'print(resp.choices[0].message.content)',
      ].join('\n'),
  },
  {
    value: 'node',
    icon: IconBrandNodejs,
    lang: 'javascript',
    label: 'Node.js',
    code: (origin) =>
      [
        'import OpenAI from "openai";',
        '',
        `const client = new OpenAI({ baseURL: "${origin}/v1", apiKey: process.env.API_KEY });`,
        'const resp = await client.chat.completions.create({',
        '  model: "provider/model-id",',
        '  messages: [{ role: "user", content: "Hello" }],',
        '});',
        'console.log(resp.choices[0].message.content);',
      ].join('\n'),
  },
  {
    value: 'claude-code',
    icon: IconTerminal2,
    lang: 'shell',
    label: 'Claude Code',
    code: (origin) =>
      [
        `export ANTHROPIC_BASE_URL="${origin}"`,
        'export ANTHROPIC_AUTH_TOKEN="$API_KEY"',
        'claude',
      ].join('\n'),
  },
  {
    value: 'environment',
    icon: IconVariable,
    lang: 'shell',
    label: 'Environment',
    code: (origin) =>
      [
        `export OPENAI_BASE_URL="${origin}/v1"`,
        'export OPENAI_API_KEY="$API_KEY"',
        `export ANTHROPIC_BASE_URL="${origin}"`,
        'export ANTHROPIC_AUTH_TOKEN="$API_KEY"',
      ].join('\n'),
  },
]

interface QuickStartCardProps {
  baseUrl: string
}

export default function QuickStartCard({ baseUrl }: QuickStartCardProps) {
  return (
    <SectionCardPanel title="Quick start" icon={IconRocket}>
      <Tabs defaultValue="curl">
        <TabsList variant="line" size="md" className="gap-1 overflow-x-auto px-2">
          {SNIPPETS.map(({ value, label, icon: Icon }) => (
            <TabsTrigger
              key={value}
              value={value}
              className="px-3 data-[state=active]:text-foreground"
            >
              <Icon aria-hidden />
              {label}
            </TabsTrigger>
          ))}
        </TabsList>
        <div className="space-y-2 p-4">
          {SNIPPETS.map((s) => (
            <TabsContent key={s.value} value={s.value} className="mt-0">
              <CodeBlock label={s.label} lang={s.lang} code={s.code(baseUrl)} />
            </TabsContent>
          ))}
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="text-xs text-muted-foreground">
              Use any model ID from{' '}
              <code className="font-mono text-foreground">GET /v1/models</code>.
            </p>
            <Link
              to="/cli-tools"
              className="text-primary inline-flex h-6 items-center gap-1 rounded-sm text-xs font-medium hover:underline"
            >
              Set up other CLI tools
              <IconArrowUpRight className="size-3.5" aria-hidden />
            </Link>
          </div>
        </div>
      </Tabs>
    </SectionCardPanel>
  )
}

function CodeBlock({ label, lang, code }: { label: string; lang: string; code: string }) {
  const { copy, copied } = useCopyToClipboard()

  return (
    <div className="overflow-hidden rounded-md border border-border bg-background">
      <div className="flex items-center gap-2 border-b border-border bg-muted/40 py-1 ps-3.5 pe-1.5">
        <span className="text-xs font-medium text-muted-foreground">{label}</span>
        <span className="rounded-sm border border-border bg-card px-1.5 font-mono text-[10.5px] text-muted-foreground uppercase">
          {lang}
        </span>
        <Button
          variant="ghost"
          size="icon"
          className="ms-auto size-7"
          aria-label={copied ? `${label} snippet copied` : `Copy ${label} snippet`}
          onClick={() => copy(code)}
        >
          {copied ? <IconCheck className="size-3.5" /> : <IconCopy className="size-3.5" />}
        </Button>
      </div>
      <pre className="overflow-x-auto px-3.5 py-3 font-mono text-xs leading-relaxed text-foreground">
        <code>{code}</code>
      </pre>
    </div>
  )
}
