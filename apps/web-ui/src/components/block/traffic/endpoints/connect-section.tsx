import { IconArrowUpRight, IconServer } from '@tabler/icons-react'
import { CheckIcon, CopyIcon } from 'lucide-react'
import { useRef } from 'react'

import IconBadge from '@/components/block/common/icon-badge'
import { Button } from '@/components/ui/button'
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardHeading,
  CardTitle,
} from '@/components/ui/card'
import { Input, InputWrapper } from '@/components/ui/input'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip'
import { env } from '@/config/env'
import { useCopyToClipboard } from '@/hooks/use-copy-to-clipboard'

import { Icons } from '../../common/icons'
import ConnectApp from './connect-app'

export default function ConnectSection() {
  const { copy, copied } = useCopyToClipboard()
  const inputRef = useRef<HTMLInputElement>(null)

  const handleCopy = () => {
    if (inputRef.current) {
      copy(inputRef.current.value)
    }
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center gap-3.5">
          <IconBadge
            icon={IconServer}
            variant="soft"
            className="h-10 w-10"
            iconClassName="h-5 w-5"
          />
          <CardHeading>
            <CardTitle>Connect an application</CardTitle>
            <CardDescription>
              Copy an endpoint, then authenticate requests with a key from{' '}
              <u>{env.VITE_APP_NAME}</u>.
            </CardDescription>
          </CardHeading>
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        <span className="flex items-center gap-1.5 text-[11px] font-medium tracking-[0.14em] text-muted-foreground uppercase">
          <IconServer className="h-3.5 w-3.5 text-emerald-600 dark:text-emerald-300" />
          Primary Endpoint
        </span>
        <InputWrapper variant="xl">
          <Input
            type="text"
            readOnly
            placeholder="Copy to clipboard"
            defaultValue={env.VITE_API_URL}
            className="font-mono text-sm"
            ref={inputRef}
          />
          <TooltipProvider delayDuration={0}>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  onClick={handleCopy}
                  variant="secondary"
                  disabled={copied}
                  className="-me-3.5"
                >
                  {copied ? (
                    <CheckIcon className="size-4 text-green-600" />
                  ) : (
                    <>
                      <CopyIcon strokeWidth={1.5} className="size-4 text-white" />
                      Copy
                    </>
                  )}
                </Button>
              </TooltipTrigger>
              <TooltipContent className="px-2 py-1 text-xs">Copy to clipboard</TooltipContent>
            </Tooltip>
          </TooltipProvider>
        </InputWrapper>
        <p className="text-sm text-muted-foreground">
          Point your applications at this URL. All providers are accessible through this single
          endpoint.
        </p>
      </CardContent>
      <CardFooter className="bg-muted/50 py-5 rounded-b-xl">
        <div className="flex w-full items-center justify-between gap-4">
          <ConnectApp
            icon={Icons.keys}
            title="Add an API key"
            description="Create or copy a key to authenticate your application."
            tone="accent"
          />
          <Button>
            <span>Manage Keys</span>
            <IconArrowUpRight className="size-4" />
          </Button>
        </div>
      </CardFooter>
    </Card>
  )
}
