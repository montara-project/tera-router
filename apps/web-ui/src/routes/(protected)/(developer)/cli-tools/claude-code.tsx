import { createFileRoute } from '@tanstack/react-router'

import ClaudeCodeDetail from '@/components/block/cli-tools/claude-code-detail'

export const Route = createFileRoute('/(protected)/(developer)/cli-tools/claude-code')({
  component: ClaudeCodeDetail,
})
