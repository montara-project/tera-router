import { IconArrowUp, IconEraser, IconMessageChatbot } from '@tabler/icons-react'
import { useMutation } from '@tanstack/react-query'
import { useEffect, useRef, useState } from 'react'

import type { Models } from '@/lib/api/models'

import { Button } from '@/components/ui/button'
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet'
import { Textarea } from '@/components/ui/textarea'
import { axiosErrorMessage } from '@/lib/api/axios-error'
import { queries } from '@/lib/api/queries'

type TestMessage = {
  role: 'user' | 'assistant'
  content: string
  /** error replies carry the failure reason in place of the model output */
  state?: 'pending' | 'error'
  error?: string
  meta?: { status: number; latencyMs: number; inputTokens: number; outputTokens: number }
}

const SUGGESTIONS = ['Say hello in one short sentence.', 'Reply with exactly: OK']

export default function ModelTestSheet({
  open,
  onOpenChange,
  variant,
  providerId,
  providerSlug,
  modelId,
  size = 'lg',
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  /** catalog providers are keyed by slug; customs by their uuid */
  variant: 'catalog' | 'custom'
  providerId: string
  providerSlug: string
  modelId: string
  size?: 'sm' | 'md' | 'lg' | 'xl'
}) {
  const [messages, setMessages] = useState<TestMessage[]>([])
  const [input, setInput] = useState('')
  const scrollRef = useRef<HTMLDivElement>(null)

  const test = useMutation(
    variant === 'catalog'
      ? queries.providers.catalogModelTest(providerId)
      : queries.providers.customModelTest(providerId)
  )
  const sending = test.isPending

  // Keep the newest turn in view as the conversation grows.
  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight })
  }, [messages])

  const composite = providerSlug ? `${providerSlug}/${modelId}` : modelId

  const send = async (raw: string) => {
    const content = raw.trim()
    if (!content || sending) return

    // Errors are excluded from the forwarded history so one failed turn does
    // not poison the rest of the conversation.
    const history: Models.ModelTestMessage[] = messages
      .filter((m) => m.state !== 'error')
      .map((m) => ({ role: m.role, content: m.content }))
    history.push({ role: 'user', content })

    setInput('')
    setMessages((prev) => [
      ...prev,
      { role: 'user', content },
      { role: 'assistant', content: '', state: 'pending' },
    ])

    try {
      const res = await test.mutateAsync({ model: modelId, messages: history })
      const result = res.data
      setMessages((prev) => [
        ...prev.slice(0, -1),
        result.ok
          ? {
              role: 'assistant' as const,
              content: result.content,
              meta: {
                status: result.status,
                latencyMs: result.latency_ms,
                inputTokens: result.input_tokens,
                outputTokens: result.output_tokens,
              },
            }
          : {
              role: 'assistant' as const,
              content: '',
              state: 'error' as const,
              error: result.detail || 'The model returned an error',
              meta: {
                status: result.status,
                latencyMs: result.latency_ms,
                inputTokens: result.input_tokens,
                outputTokens: result.output_tokens,
              },
            },
      ])
    } catch (error) {
      setMessages((prev) => [
        ...prev.slice(0, -1),
        {
          role: 'assistant',
          content: '',
          state: 'error',
          error: axiosErrorMessage(error as Error),
        },
      ])
    }
  }

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        size={size}
        className="flex flex-col gap-0 bg-background duration-300 ease-out data-[side=right]:w-full data-[side=right]:data-open:slide-in-from-right data-[side=right]:data-closed:slide-out-to-right"
      >
        <SheetHeader className="flex-row items-center justify-between gap-2 border-b pr-14">
          <div className="min-w-0">
            <SheetTitle className="truncate text-sm font-semibold">{modelId}</SheetTitle>
            <SheetDescription className="truncate text-xs">
              {composite} · test playground
            </SheetDescription>
          </div>
          <Button
            size="icon"
            variant="ghost"
            className="size-8 shrink-0"
            aria-label="Clear conversation"
            disabled={messages.length === 0 || sending}
            onClick={() => setMessages([])}
          >
            <IconEraser />
          </Button>
        </SheetHeader>

        <div ref={scrollRef} className="flex-1 overflow-y-auto">
          {messages.length === 0 ? (
            <div className="flex h-full flex-col items-center justify-center gap-3 px-6 text-center">
              <div className="flex size-12 items-center justify-center rounded-full bg-muted">
                <IconMessageChatbot className="size-6 text-muted-foreground" />
              </div>
              <div>
                <p className="text-sm font-medium">Test this model</p>
                <p className="mt-1 text-xs text-muted-foreground">
                  Send a message to check that {modelId} responds through its provider.
                </p>
              </div>
              <div className="flex flex-wrap justify-center gap-2">
                {SUGGESTIONS.map((suggestion) => (
                  <Button
                    key={suggestion}
                    variant="outline"
                    size="sm"
                    className="rounded-full"
                    onClick={() => send(suggestion)}
                  >
                    {suggestion}
                  </Button>
                ))}
              </div>
            </div>
          ) : (
            <div
              className="mx-auto w-full max-w-2xl space-y-5 px-4 py-6"
              role="log"
              aria-live="polite"
            >
              {messages.map((message, index) =>
                message.role === 'user' ? (
                  <div key={index} className="flex justify-end">
                    <div className="max-w-[85%] rounded-2xl bg-muted px-3.5 py-2.5 text-sm whitespace-pre-wrap">
                      {message.content}
                    </div>
                  </div>
                ) : (
                  <div key={index} className="space-y-1.5">
                    {message.state === 'pending' ? (
                      <div
                        className="flex items-center gap-1 py-2"
                        role="status"
                        aria-label="Waiting for response"
                      >
                        <span className="size-1.5 animate-bounce rounded-full bg-muted-foreground/60" />
                        <span className="size-1.5 animate-bounce rounded-full bg-muted-foreground/60 [animation-delay:150ms]" />
                        <span className="size-1.5 animate-bounce rounded-full bg-muted-foreground/60 [animation-delay:300ms]" />
                      </div>
                    ) : message.state === 'error' ? (
                      <div className="rounded-xl border border-destructive/30 bg-destructive/10 px-3.5 py-2.5 text-sm text-destructive">
                        {message.error}
                      </div>
                    ) : (
                      <p className="text-sm leading-relaxed whitespace-pre-wrap">
                        {message.content}
                      </p>
                    )}
                    {message.meta ? (
                      <p className="text-xs tabular-nums text-muted-foreground/80">
                        {message.meta.latencyMs} ms · {message.meta.inputTokens} in ·{' '}
                        {message.meta.outputTokens} out
                        {message.state === 'error' ? ` · HTTP ${message.meta.status}` : ''}
                      </p>
                    ) : null}
                  </div>
                )
              )}
            </div>
          )}
        </div>

        <div className="border-t p-3">
          <form
            className="flex items-end gap-2 rounded-2xl border bg-background px-3 py-2 shadow-xs focus-within:border-ring/60"
            onSubmit={(event) => {
              event.preventDefault()
              send(input)
            }}
          >
            <Textarea
              value={input}
              onChange={(event) => setInput(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === 'Enter' && !event.shiftKey && !event.nativeEvent.isComposing) {
                  event.preventDefault()
                  send(input)
                }
              }}
              placeholder={`Message ${modelId}…`}
              rows={1}
              aria-label="Test message"
              className="max-h-40 min-h-8 resize-none border-0 bg-transparent px-0 py-1 shadow-none focus-visible:border-0 focus-visible:ring-0"
            />
            <Button
              type="submit"
              size="icon"
              className="size-8 shrink-0 rounded-full"
              disabled={!input.trim() || sending}
              aria-label="Send message"
            >
              <IconArrowUp />
            </Button>
          </form>
          <p className="mt-1.5 text-center text-[11px] text-muted-foreground/70">
            Enter to send · Shift+Enter for a new line
          </p>
        </div>
      </SheetContent>
    </Sheet>
  )
}
