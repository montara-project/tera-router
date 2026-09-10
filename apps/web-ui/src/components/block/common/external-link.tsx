'use client'

import { IconExternalLink } from '@tabler/icons-react'
import { Link } from '@tanstack/react-router'

import { Button } from '@/components/ui/button'

interface ExternalLinkProps {
  label?: string
  link: string | null | undefined
}

export default function ExternalLink({ label = 'Visit', link }: ExternalLinkProps) {
  if (!link) {
    return '-'
  }

  return (
    <Button mode="link" underline="solid" asChild>
      <Link to={link} target="_blank">
        {label}
        <IconExternalLink />
      </Link>
    </Button>
  )
}
