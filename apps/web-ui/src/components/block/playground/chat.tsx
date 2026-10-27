import { useState } from 'react'
import { toast } from 'sonner'

import type { Models } from '@/lib/api/models'

import SkillMarkdown from '@/components/block/traffic/skills/skill-markdown'
import PromptBar from '@/components/ui/prompt-bar'
import StreamingText from '@/components/ui/streaming-text'
import ThinkingState, { type ThinkingRow } from '@/components/ui/thinking-state'
import { axiosErrorMessage } from '@/lib/api/axios-error'

// The streamed chat shared by the provider model test sheet and the
// Playground page: conversation state, the message list, and the composer.

export type ChatMessage = {
  role: 'user' | 'assistant'
  content: string
  /** the model id the turn was sent to */
  model: string
  /** pending: no token yet; streaming: tokens arriving; error: failed turn */
  state?: 'pending' | 'streaming' | 'error'
  error?: string
  meta?: {
    status: number
    latencyMs: number
    inputTokens: number
    outputTokens: number
    /** what served the turn (the result's model field), when it differs */
    servedBy?: string
  }
}

/** Sends one conversation and streams the reply; resolves with the result. */
export type ChatRun = (
  model: string,
  messages: Models.ModelTestMessage[],
  onDelta: (text: string) => void
) => Promise<Models.ModelTestResult>

export function useChat(run: ChatRun) {
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [sending, setSending] = useState(false)

  // Every update targets the assistant turn appended by send, always last.
  const patchLast = (patch: (m: ChatMessage) => ChatMessage) =>
    setMessages((prev) => [...prev.slice(0, -1), patch(prev[prev.length - 1])])

  const send = async (model: string, raw: string) => {
    const content = raw.trim()
    if (!content || !model || sending) return

    // Errors are excluded from the forwarded history so one failed turn does
    // not poison the rest of the conversation.
    const history: Models.ModelTestMessage[] = messages
      .filter((m) => m.state !== 'error')
      .map((m) => ({ role: m.role, content: m.content }))
    history.push({ role: 'user', content })

    setSending(true)
    setMessages((prev) => [
      ...prev,
      { role: 'user', content, model },
      { role: 'assistant', content: '', model, state: 'pending' },
    ])

    try {
      const result = await run(model, history, (text) =>
        patchLast((m) => ({ ...m, state: 'streaming', content: m.content + text }))
      )
      const meta = {
        status: result.status,
        latencyMs: result.latency_ms,
        inputTokens: result.input_tokens,
        outputTokens: result.output_tokens,
        servedBy:
          result.model && result.model !== model && !model.startsWith(`${result.model}/`)
            ? result.model
            : undefined,
      }
      patchLast((m) =>
        result.ok
          ? { ...m, state: undefined, content: result.content, meta }
          : {
              ...m,
              state: 'error',
              error: result.detail || 'The model returned an error',
              meta,
            }
      )
    } catch (error) {
      patchLast((m) => ({ ...m, state: 'error', error: axiosErrorMessage(error as Error) }))
    } finally {
      setSending(false)
    }
  }

  return { messages, sending, send, clear: () => setMessages([]) }
}

export function ChatMessageList({ messages }: { messages: ChatMessage[] }) {
  return (
    <div className="mx-auto w-full max-w-2xl space-y-5 px-4 py-6" role="log" aria-live="polite">
      {messages.map((message, index) => (
        <ChatBubble key={index} message={message} />
      ))}
    </div>
  )
}

export function ChatComposer({
  placeholder,
  sending,
  onSend,
}: {
  placeholder: string
  sending: boolean
  onSend: (text: string) => void
}) {
  return (
    <>
      <PromptBar
        demo={false}
        tools={false}
        sweepOnSend
        disabled={sending}
        placeholder={placeholder}
        onSend={onSend}
      />
      <p className="mt-1.5 text-center text-[11px] text-muted-foreground/70">
        Enter to send · Shift+Enter for a new line
      </p>
    </>
  )
}

function ChatBubble({ message }: { message: ChatMessage }) {
  if (message.role === 'user') {
    return (
      <div className="flex justify-end">
        <div className="max-w-[85%] rounded-2xl bg-muted px-3.5 py-2.5 text-sm whitespace-pre-wrap">
          {message.content}
        </div>
      </div>
    )
  }

  const working = message.state === 'pending' || message.state === 'streaming'

  // The pending, streaming and settled turns render the same ThinkingState in
  // the same slot, so it keeps its state and settles in place.
  return (
    <div className="space-y-2">
      <ThinkingState
        working={working}
        active={message.state === 'pending' ? 'Waiting for response' : 'Streaming response'}
        done={
          message.state === 'error'
            ? 'Request failed'
            : `Responded in ${((message.meta?.latencyMs ?? 0) / 1000).toFixed(1)}s`
        }
        rows={traceRows(message)}
      />
      {message.state === 'error' ? (
        <div className="rounded-xl border border-destructive/30 bg-destructive/10 px-3.5 py-2.5 text-sm text-destructive">
          {message.error}
        </div>
      ) : message.state !== 'pending' ? (
        <StreamingText
          fill
          loop={false}
          streaming={working}
          text={message.content}
          renderText={(partial) => (
            <div className="[&>*:first-child]:mt-0 [&>*:last-child]:mb-0">
              <SkillMarkdown>{partial}</SkillMarkdown>
            </div>
          )}
          sources={[]}
          followUps={[]}
          actions={['copy']}
          onAction={() =>
            navigator.clipboard.writeText(message.content).then(
              () => toast.success('Copied to clipboard'),
              () => toast.error('Could not copy to clipboard')
            )
          }
        />
      ) : null}
    </div>
  )
}

/** The request trace shown inside the expandable ThinkingState. */
function traceRows(message: ChatMessage): ThinkingRow[] {
  const rows: ThinkingRow[] = [{ primary: 'Request sent', secondary: message.model, mono: true }]
  if (message.state === 'pending') return [...rows, { primary: 'Waiting for response' }]
  if (message.state === 'streaming') return [...rows, { primary: 'Receiving tokens' }]
  if (!message.meta) return rows
  const { status, latencyMs, inputTokens, outputTokens, servedBy } = message.meta
  return [
    ...rows,
    ...(servedBy ? [{ primary: 'Served by', secondary: servedBy, mono: true }] : []),
    { primary: 'Response received', secondary: `HTTP ${status} · ${latencyMs} ms` },
    { primary: 'Usage', secondary: `${inputTokens} in · ${outputTokens} out` },
  ]
}
