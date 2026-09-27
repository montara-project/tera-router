import { IconSparkles } from '@tabler/icons-react'

import type { GuardrailsPolicyConfig } from '@/lib/api/models/guardrails'

import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'

const PRIMARY_BUTTON_CLASS =
  'bg-emerald-600 text-white hover:bg-emerald-600/90 dark:bg-emerald-600 dark:hover:bg-emerald-600/90'

export type PartialPolicyConfig = Partial<{
  [K in keyof GuardrailsPolicyConfig]: Partial<GuardrailsPolicyConfig[K]>
}>

export const TEMPLATES: {
  name: string
  description: string
  config: PartialPolicyConfig
}[] = [
  {
    name: 'Indonesia PII',
    description:
      'Mask Indonesian identifiers (NIK, NPWP, passport) plus generic PII (email, phone, card) using replace strategy at min_score 0.7.',
    config: {
      pii: {
        enabled: true,
        entities: [
          'ID_NIK',
          'ID_NPWP',
          'ID_PASSPORT',
          'EMAIL_ADDRESS',
          'PHONE_NUMBER',
          'CREDIT_CARD',
        ],
        maskingStrategy: 'redact',
        minConfidence: 0.7,
      },
    },
  },
  {
    name: 'Strict safety',
    description:
      'Block on any PII match, block prompt injection at medium severity, and allow only programming/general-help topics.',
    config: {
      pii: { enabled: true, entities: [] },
      injection: { enabled: true, severity: 'medium', action: 'block' },
      topics: {
        enabled: true,
        mode: 'allow',
        topics: ['programming', 'general help'],
        action: 'block',
      },
    },
  },
  {
    name: 'Compliance audit (log-only)',
    description:
      'Every detector enabled at action=log_only — useful as a dry run before tightening to warn/block.',
    config: {
      pii: { enabled: true, scanOutput: true },
      injection: { enabled: true, severity: 'low', action: 'log' },
      topics: { enabled: true, action: 'log' },
      toxicity: { enabled: true, action: 'log' },
      bias: { enabled: true, action: 'log' },
    },
  },
  {
    name: 'Public chatbot',
    description:
      'Redact PII (both directions), block prompt injection, scope topics to programming/general help.',
    config: {
      pii: { enabled: true, scanOutput: true },
      injection: { enabled: true, severity: 'high', action: 'block' },
      topics: {
        enabled: true,
        mode: 'allow',
        topics: ['programming', 'general help'],
        action: 'block',
      },
    },
  },
  {
    name: 'Compliance — alerts only',
    description:
      'Lightweight log_only profile for environments that want visibility without breaking traffic.',
    config: {
      pii: { enabled: true },
      injection: { enabled: true, action: 'log' },
      toxicity: { enabled: true, action: 'log' },
    },
  },
]

interface TemplateDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onApply: (partial: PartialPolicyConfig) => void
}

export default function TemplateDialog({ open, onOpenChange, onApply }: TemplateDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="w-full max-w-lg gap-0 p-0">
        <DialogHeader className="mb-0 border-b border-border px-6 py-4">
          <DialogTitle className="text-base">Start from a template</DialogTitle>
        </DialogHeader>

        <div className="max-h-[60vh] space-y-2.5 overflow-y-auto px-6 py-5">
          {TEMPLATES.map((template) => (
            <button
              key={template.name}
              type="button"
              onClick={() => {
                onApply(template.config)
                onOpenChange(false)
              }}
              className="w-full cursor-pointer rounded-lg border border-border bg-card p-3.5 text-left transition-colors hover:border-emerald-600/50 hover:bg-accent/40"
            >
              <p className="flex items-center gap-1.5 text-sm font-semibold text-foreground">
                <IconSparkles className="h-4 w-4 text-emerald-500" />
                {template.name}
              </p>
              <p className="text-muted-foreground mt-1 text-xs leading-relaxed">
                {template.description}
              </p>
            </button>
          ))}
        </div>

        <DialogFooter className="mb-0 border-t border-border px-6 py-4">
          <Button className={PRIMARY_BUTTON_CLASS} onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
