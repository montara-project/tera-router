import type { Components } from 'react-markdown'

import Markdown from 'react-markdown'
import remarkGfm from 'remark-gfm'

// Tailwind styling per element, in place of a typography plugin. `node` is
// react-markdown's AST node; it must not reach the DOM.
const MARKDOWN_COMPONENTS: Components = {
  h1: ({ node: _node, ...props }) => (
    <h1 className="mt-6 mb-3 text-xl font-semibold first:mt-0" {...props} />
  ),
  h2: ({ node: _node, ...props }) => (
    <h2 className="mt-6 mb-3 border-b border-border pb-1.5 text-base font-semibold" {...props} />
  ),
  h3: ({ node: _node, ...props }) => <h3 className="mt-5 mb-2 text-sm font-semibold" {...props} />,
  p: ({ node: _node, ...props }) => <p className="my-3 text-sm leading-6" {...props} />,
  ul: ({ node: _node, ...props }) => (
    <ul className="my-3 list-disc space-y-1 ps-5 text-sm leading-6" {...props} />
  ),
  ol: ({ node: _node, ...props }) => (
    <ol className="my-3 list-decimal space-y-1 ps-5 text-sm leading-6" {...props} />
  ),
  a: ({ node: _node, children, ...props }) => (
    <a
      className="font-medium text-primary underline underline-offset-2"
      target="_blank"
      rel="noopener noreferrer"
      {...props}
    >
      {children}
    </a>
  ),
  code: ({ node: _node, ...props }) => (
    <code className="rounded bg-muted px-1 py-0.5 font-mono text-[0.85em]" {...props} />
  ),
  pre: ({ node: _node, ...props }) => (
    <pre
      className="my-3 overflow-x-auto rounded-lg border border-border bg-muted/60 p-3 font-mono text-xs leading-5 [&>code]:bg-transparent [&>code]:p-0"
      {...props}
    />
  ),
  table: ({ node: _node, ...props }) => (
    <div className="my-3 overflow-x-auto rounded-lg border border-border">
      <table className="w-full text-left text-sm" {...props} />
    </div>
  ),
  th: ({ node: _node, ...props }) => (
    <th className="bg-muted/60 px-3 py-2 text-xs font-semibold" {...props} />
  ),
  td: ({ node: _node, ...props }) => (
    <td className="border-t border-border px-3 py-2 align-top" {...props} />
  ),
  blockquote: ({ node: _node, ...props }) => (
    <blockquote className="my-3 border-s-2 border-border ps-3 text-muted-foreground" {...props} />
  ),
}

export default function SkillMarkdown({ children }: { children: string }) {
  return (
    <Markdown remarkPlugins={[remarkGfm]} components={MARKDOWN_COMPONENTS}>
      {children}
    </Markdown>
  )
}
