import { IconEraser, IconMessageChatbot, IconX } from '@tabler/icons-react'
import { useMutation } from '@tanstack/react-query'
import { AnimatePresence, MotionConfig, motion, type Transition, type Variants } from 'motion/react'
import { useEffect, useRef } from 'react'

import { ChatComposer, ChatMessageList, useChat } from '@/components/block/playground/chat'
import { Button } from '@/components/ui/button'
import {
  Sheet,
  SheetClose,
  SheetContent,
  SheetDescription,
  SheetOverlay,
  SheetPortal,
  SheetTitle,
} from '@/components/ui/sheet'
import { queries } from '@/lib/api/queries'

const SUGGESTIONS = ['Say hello in one short sentence.', 'Reply with exactly: OK']

// Open/close choreography: the panel slides on the iOS-sheet decel curve
// (deterministic timing reads steadier than a spring under heavy content),
// the overlay cross-fades with it, and the panel contents rise in a small
// top-to-bottom stagger. Leaving is a touch faster than entering, and
// MotionConfig (reducedMotion="user") drops the transforms for users who
// prefer reduced motion.
const PANEL_ENTER: Transition = { duration: 0.32, ease: [0.32, 0.72, 0, 1] }
const PANEL_EXIT: Transition = { duration: 0.24, ease: [0.4, 0, 1, 1] }
const OVERLAY_ENTER: Transition = { duration: 0.2 }
const OVERLAY_EXIT: Transition = { duration: 0.18 }

const sectionRise: Variants = {
  hidden: { opacity: 0, y: 8 },
  shown: (step: number) => ({
    opacity: 1,
    y: 0,
    transition: { delay: 0.03 + step * 0.04, duration: 0.25, ease: 'easeOut' },
  }),
}

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
  const scrollRef = useRef<HTMLDivElement>(null)

  // Catalog tests are keyed by slug (POST /v1/providers/:slug/models/test);
  // the route id may still carry the "prov-" display prefix, so never send it
  // there. Custom providers are keyed by their uuid row.
  const test = useMutation(
    variant === 'catalog'
      ? queries.providers.catalogModelTest(providerSlug)
      : queries.providers.customModelTest(providerId)
  )
  const {
    messages,
    sending,
    send: sendTo,
    clear,
  } = useChat((model, history, onDelta) => test.mutateAsync({ model, messages: history, onDelta }))
  const send = (text: string) => sendTo(modelId, text)

  // Keep the newest turn in view as the conversation grows.
  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight })
  }, [messages])

  const composite = providerSlug ? `${providerSlug}/${modelId}` : modelId

  return (
    <MotionConfig reducedMotion="user">
      <Sheet open={open} onOpenChange={onOpenChange}>
        <AnimatePresence>
          {open && (
            <SheetPortal forceMount>
              <SheetOverlay
                asChild
                forceMount
                className="data-closed:animate-none data-open:animate-none"
              >
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1, transition: OVERLAY_ENTER }}
                  exit={{ opacity: 0, transition: OVERLAY_EXIT }}
                />
              </SheetOverlay>
              <SheetContent
                asChild
                forceMount
                showCloseButton={false}
                showOverlay={false}
                size={size}
                className="gap-0 bg-background transition-none transform-gpu data-closed:animate-none data-open:animate-none data-[side=right]:w-full"
              >
                <motion.div
                  initial={{ x: '100%' }}
                  animate={{ x: 0, transition: PANEL_ENTER }}
                  exit={{ x: '100%', transition: PANEL_EXIT }}
                >
                  <motion.header
                    variants={sectionRise}
                    custom={0}
                    initial="hidden"
                    animate="shown"
                    className="flex flex-row items-center justify-between gap-2 border-b p-4"
                  >
                    <div className="min-w-0">
                      <SheetTitle className="truncate text-sm font-semibold">{modelId}</SheetTitle>
                      <SheetDescription className="truncate text-xs">
                        {composite} · test playground
                      </SheetDescription>
                    </div>
                    <div className="flex shrink-0 items-center gap-1">
                      <Button
                        size="icon"
                        variant="ghost"
                        className="size-8"
                        aria-label="Clear conversation"
                        disabled={messages.length === 0 || sending}
                        onClick={clear}
                      >
                        <IconEraser />
                      </Button>
                      <SheetClose asChild>
                        <Button size="icon" variant="ghost" className="size-8" aria-label="Close">
                          <IconX />
                        </Button>
                      </SheetClose>
                    </div>
                  </motion.header>

                  <motion.div
                    ref={scrollRef}
                    variants={sectionRise}
                    custom={1}
                    initial="hidden"
                    animate="shown"
                    className="flex-1 overflow-y-auto"
                  >
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
                      <ChatMessageList messages={messages} />
                    )}
                  </motion.div>

                  <motion.div
                    variants={sectionRise}
                    custom={2}
                    initial="hidden"
                    animate="shown"
                    className="border-t p-3"
                  >
                    <ChatComposer
                      placeholder={`Message ${modelId}…`}
                      sending={sending}
                      onSend={send}
                    />
                  </motion.div>
                </motion.div>
              </SheetContent>
            </SheetPortal>
          )}
        </AnimatePresence>
      </Sheet>
    </MotionConfig>
  )
}
