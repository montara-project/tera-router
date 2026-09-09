import { IconArrowUpRight, IconKey, IconServer } from '@tabler/icons-react'
import { CheckIcon, CopyIcon } from 'lucide-react'
import { useRef } from 'react'

import { Button } from '@/components/ui/button'
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { Input, InputWrapper } from '@/components/ui/input'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip'
import { env } from '@/config/env'
import { useCopyToClipboard } from '@/hooks/use-copy-to-clipboard'

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
        <CardTitle>Connect an application</CardTitle>
        <CardDescription>
          Copy an endpoint, then authenticate requests with a key from <u>{env.VITE_APP_NAME}</u>.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex items-center gap-2">
          <IconServer size={20} className="text-emerald-500" />
          <span className="text-sm text-muted-foreground">Primary Endpoint</span>
        </div>
        <div className="w-full">
          <InputWrapper variant="xl">
            <Input
              type="email"
              placeholder="Copy to clipboard"
              defaultValue={env.VITE_API_URL}
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
                      <CheckIcon className="text-green-600" size={16} />
                    ) : (
                      <>
                        <CopyIcon strokeWidth={1.5} className="text-white" size={16} />
                        Copy
                      </>
                    )}
                  </Button>
                </TooltipTrigger>
                <TooltipContent className="px-2 py-1 text-xs">Copy to clipboard</TooltipContent>
              </Tooltip>
            </TooltipProvider>
          </InputWrapper>
        </div>

        <p className="text-sm text-muted-foreground">
          Point your applications at this URL. All providers are accessible through this single
          endpoint.
        </p>
      </CardContent>
      <CardFooter className="py-5 bg-muted/50 rounded-b-xl">
        <div className="w-full flex justify-between items-center">
          <div className="flex items-center gap-4">
            <Button mode="icon" variant="mono" className="h-10 w-10">
              <IconKey size={24} />
            </Button>
            <div className="flex flex-col gap-1 justify-center">
              <span className="text-sm text-neutral-100">Add an API key</span>
              <span className="text-xs text-muted-foreground">
                Create or copy a key to authenticate your application.
              </span>
            </div>
          </div>
          <Button>
            <span>Manage Keys</span>
            <IconArrowUpRight size={16} />
          </Button>
        </div>
      </CardFooter>
    </Card>
  )
}
