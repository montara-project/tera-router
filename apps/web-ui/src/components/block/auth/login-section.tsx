import { Link, useRouter } from '@tanstack/react-router'
import { GalleryVerticalEnd } from 'lucide-react'
import { useState } from 'react'
import { toast } from 'sonner'

import { Button } from '@/components/ui/button'
import { Field, FieldGroup } from '@/components/ui/field'
import { InputOTP, REGEXP_ONLY_DIGITS } from '@/components/ui/input-otp'
import { Label } from '@/components/ui/label'
import { useAppForm } from '@/hooks/form'
import { SignInSchema } from '@/lib/api/dtos/auth/schema'
import { signInWithEmail } from '@/lib/auth/email-auth'
import { cn } from '@/lib/utils'

export default function LoginSection({ className, ...props }: React.ComponentProps<'div'>) {
  const { navigate } = useRouter()
  const [isLoading, setIsLoading] = useState(false)
  // Set once the password checked out on an account with two-factor auth on.
  const [needsCode, setNeedsCode] = useState(false)
  const [otp, setOtp] = useState('')

  const form = useAppForm({
    defaultValues: {
      email: '',
      password: '',
    },
    validators: {
      onSubmit: SignInSchema,
      onChange: SignInSchema,
    },
    onSubmit: async ({ value }) => {
      setIsLoading(true)

      try {
        const res = await signInWithEmail({ ...value, otp: needsCode ? otp : undefined })
        if (res && 'totpRequired' in res) {
          setNeedsCode(true)
          return
        }
        navigate({ to: '/dashboard' })
      } catch (error) {
        const message = error instanceof Error ? error.message : 'An error occurred'
        toast.error(message)
        setOtp('')
        if (!needsCode) form.reset()
      } finally {
        setIsLoading(false)
      }
    },
  })

  const cancelCode = () => {
    setNeedsCode(false)
    setOtp('')
    form.reset()
  }

  return (
    <div className={cn('flex flex-col gap-6', className)} {...props}>
      <FieldGroup>
        <div className="flex flex-col items-center gap-2 text-center">
          <Link to="/" className="flex flex-col items-center gap-2 font-medium">
            <div className="flex size-8 items-center justify-center rounded-md">
              <GalleryVerticalEnd className="size-6" />
            </div>
            <span className="sr-only">Tera Router</span>
          </Link>
          <h1 className="text-xl font-bold">Welcome to Tera Router.</h1>
        </div>

        <form
          className="flex flex-col gap-6"
          onSubmit={(e) => {
            e.preventDefault()
            form.handleSubmit()
          }}
        >
          {needsCode ? (
            <Field>
              <Label htmlFor="otp">Authentication code</Label>
              <InputOTP
                id="otp"
                value={otp}
                onChange={setOtp}
                maxLength={6}
                pattern={REGEXP_ONLY_DIGITS}
                autoFocus
              >
                <InputOTP.Group>
                  <InputOTP.Slot index={0} />
                  <InputOTP.Slot index={1} />
                  <InputOTP.Slot index={2} />
                </InputOTP.Group>
                <InputOTP.Separator />
                <InputOTP.Group>
                  <InputOTP.Slot index={3} />
                  <InputOTP.Slot index={4} />
                  <InputOTP.Slot index={5} />
                </InputOTP.Group>
              </InputOTP>
              <p className="text-muted-foreground text-sm">
                Enter the 6-digit code from your authenticator app.
              </p>
            </Field>
          ) : (
            <>
              <form.AppField
                name="email"
                children={(field) => (
                  <field.TextField label="Email" placeholder="type your email" />
                )}
              />

              <form.AppField
                name="password"
                children={(field) => (
                  <field.PasswordField label="Password" placeholder="type your password" />
                )}
              />
            </>
          )}

          <Field>
            <Button type="submit" disabled={isLoading || (needsCode && otp.length !== 6)}>
              {isLoading ? 'Signing in...' : needsCode ? 'Verify' : 'Login'}
            </Button>
            {needsCode && (
              <Button type="button" variant="ghost" onClick={cancelCode} disabled={isLoading}>
                Back
              </Button>
            )}
          </Field>
        </form>
      </FieldGroup>
    </div>
  )
}
