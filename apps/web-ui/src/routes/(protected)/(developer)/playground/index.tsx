import { IconAlertTriangle, IconEraser, IconMessageChatbot, IconRefresh } from '@tabler/icons-react'
import { useMutation, useQuery } from '@tanstack/react-query'
import { createFileRoute } from '@tanstack/react-router'
import { useState } from 'react'

import EmptyState from '@/components/block/common/empty-state'
import SectionCard from '@/components/block/common/section-card'
import {
  ChatComposer,
  ChatMessageList,
  useChat,
  useStickToBottom,
} from '@/components/block/playground/chat'
import ModelPicker, { groupPlaygroundModels } from '@/components/block/playground/model-picker'
import { Button } from '@/components/ui/button'
import { queries } from '@/lib/api/queries'

export const Route = createFileRoute('/(protected)/(developer)/playground/')({
  component: PlaygroundRoute,
})

const SUGGESTIONS = ['Say hello in one short sentence.', 'Explain what you are in two sentences.']

function PlaygroundRoute() {
  const modelsQuery = useQuery(queries.playground.models())
  const models = modelsQuery.data?.data ?? []
  const [picked, setPicked] = useState('')
  // Until the user picks, default to the first listed id (aliases lead).
  const model = picked || (groupPlaygroundModels(models)[0]?.ids[0] ?? '')

  const chat = useMutation(queries.playground.chat())
  const { messages, sending, send, clear } = useChat((id, history, onDelta) =>
    chat.mutateAsync({ model: id, messages: history, onDelta })
  )
  const scrollRef = useStickToBottom(messages.length)

  const renderBody = () => {
    if (modelsQuery.isError) {
      return (
        <EmptyState
          className="flex-1"
          icon={IconAlertTriangle}
          title="Couldn't load models"
          description={modelsQuery.error.message || 'The model list request failed.'}
          action={
            <Button size="sm" variant="outline" onClick={() => modelsQuery.refetch()}>
              <IconRefresh /> Try again
            </Button>
          }
        />
      )
    }
    if (!modelsQuery.isLoading && models.length === 0) {
      return (
        <EmptyState
          className="flex-1"
          icon={IconMessageChatbot}
          title="No models to chat with"
          description="Connect a provider and fetch its models, or create a model alias or chain."
        />
      )
    }
    if (messages.length === 0) {
      return (
        <div className="flex flex-1 flex-col items-center justify-center gap-3 px-6 text-center">
          <div className="flex size-12 items-center justify-center rounded-full bg-muted">
            <IconMessageChatbot className="size-6 text-muted-foreground" />
          </div>
          <div className="max-w-sm">
            <p className="text-sm font-medium">Chat through the router</p>
            <p className="mt-1 text-xs text-pretty text-muted-foreground">
              Requests route exactly like client traffic, so aliases and chains fall back the same
              way. Usage is metered as “playground”.
            </p>
          </div>
          <div className="flex flex-wrap justify-center gap-2">
            {SUGGESTIONS.map((suggestion) => (
              <Button
                key={suggestion}
                variant="outline"
                size="sm"
                className="rounded-full"
                disabled={!model}
                onClick={() => send(model, suggestion)}
              >
                {suggestion}
              </Button>
            ))}
          </div>
        </div>
      )
    }
    return <ChatMessageList messages={messages} />
  }

  return (
    <SectionCard
      title="Playground"
      description="Chat with any provider model, model alias, or chain through the gateway."
      toolbar={
        <Button
          variant="outline"
          size="icon"
          aria-label="Clear conversation"
          title="Clear conversation"
          disabled={messages.length === 0 || sending}
          onClick={clear}
        >
          <IconEraser />
        </Button>
      }
    >
      <div className="flex h-[calc(100dvh-15rem)] min-h-96 flex-col">
        <div ref={scrollRef} className="scrollbar-seamless flex-1 overflow-y-auto">
          <div className="flex min-h-full flex-col">{renderBody()}</div>
        </div>
        <div className="mx-auto w-full max-w-2xl pt-3">
          <ChatComposer
            toolbar={
              <ModelPicker
                models={models}
                value={model}
                onChange={setPicked}
                loading={modelsQuery.isLoading}
                disabled={sending}
              />
            }
            placeholder={model ? `Message ${model}…` : 'Choose a model to start'}
            sending={sending || !model}
            onSend={(text) => send(model, text)}
          />
        </div>
      </div>
    </SectionCard>
  )
}
