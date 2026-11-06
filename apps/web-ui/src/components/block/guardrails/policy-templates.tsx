import { IconChevronRight, IconSparkles } from '@tabler/icons-react'

import type { GuardrailsPolicyConfig } from '@/lib/api/models/guardrails'

import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'

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
        masking_strategy: 'redact',
        min_confidence: 0.7,
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
      pii: { enabled: true, scan_output: true },
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
      pii: { enabled: true, scan_output: true },
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
      <DialogContent className="w-full max-w-xl gap-0 p-0">
        <DialogHeader className="mb-0 gap-0.5 border-b border-border px-5 py-3.5">
          <DialogTitle className="flex items-center gap-2 text-[15px]">
            <IconSparkles className="text-primary size-4 shrink-0" aria-hidden />
            Start from a template
          </DialogTitle>
          <DialogDescription className="text-[13px]">
            Replaces the current detector settings
          </DialogDescription>
        </DialogHeader>

        <div className="max-h-[60vh] overflow-y-auto overscroll-contain p-4">
          <ul className="divide-y divide-border overflow-hidden rounded-md border border-border">
            {TEMPLATES.map((template) => (
              <li key={template.name}>
                <button
                  type="button"
                  onClick={() => {
                    onApply(template.config)
                    onOpenChange(false)
                  }}
                  className="hover:bg-muted/40 flex w-full cursor-pointer items-center gap-3 px-4 py-3 text-left transition-colors"
                >
                  <span className="min-w-0 flex-1 space-y-0.5">
                    <span className="block text-[13px] font-medium text-foreground">
                      {template.name}
                    </span>
                    <span className="text-muted-foreground block text-xs leading-relaxed">
                      {template.description}
                    </span>
                  </span>
                  <IconChevronRight
                    className="text-muted-foreground size-4 shrink-0"
                    stroke={1.75}
                    aria-hidden
                  />
                </button>
              </li>
            ))}
          </ul>
        </div>

        <DialogFooter className="mb-0 border-t border-border bg-muted/40 px-5 py-3.5">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
