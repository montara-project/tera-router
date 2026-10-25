import { IconLoader2 } from '@tabler/icons-react'
import { revalidateLogic } from '@tanstack/react-form'
import { useRouter } from '@tanstack/react-router'
import { useState } from 'react'

import { Button } from '@/components/ui/button'
import { Field, FieldError, FieldGroup } from '@/components/ui/field'
import { InputOTP, REGEXP_ONLY_DIGITS } from '@/components/ui/input-otp'
import { Label } from '@/components/ui/label'
import { useAppForm } from '@/hooks/form'
import { useBranding } from '@/hooks/use-branding'
import { SignInSchema } from '@/lib/api/dtos/auth/schema'
import { signInWithEmail } from '@/lib/auth/email-auth'
import { cn } from '@/lib/utils'

const SUBMIT_LABELS = {
  signIn: { idle: 'Sign in', pending: 'Signing in…' },
  verify: { idle: 'Verify', pending: 'Verifying…' },
} as const

export default function LoginSection({ className, ...props }: React.ComponentProps<'div'>) {
  const { navigate } = useRouter()
  const branding = useBranding()
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  // Set once the password checked out on an account with two-factor auth on.
  const [needsCode, setNeedsCode] = useState(false)
  const [otp, setOtp] = useState('')

  const form = useAppForm({
    defaultValues: {
      email: '',
      password: '',
    },
    // Stay quiet until the first submit, then revalidate as the user fixes things.
    validationLogic: revalidateLogic({ mode: 'submit', modeAfterSubmission: 'change' }),
    validators: {
      onDynamic: SignInSchema,
    },
    onSubmit: async ({ value }) => {
      setIsLoading(true)
      setError(null)

      try {
        const res = await signInWithEmail({ ...value, otp: needsCode ? otp : undefined })
        if (res && 'totpRequired' in res) {
          setNeedsCode(true)
          return
        }
        navigate({ to: '/dashboard' })
      } catch (error) {
        setError(error instanceof Error ? error.message : 'An error occurred')
        setOtp('')
        if (!needsCode) {
          // Keep the email; only the password needs retyping.
          form.setFieldValue('password', '', { dontValidate: true })
          document.getElementById('password')?.focus()
        }
      } finally {
        setIsLoading(false)
      }
    },
  })

  const cancelCode = () => {
    setNeedsCode(false)
    setOtp('')
    setError(null)
    form.setFieldValue('password', '', { dontValidate: true })
  }

  const labels = needsCode ? SUBMIT_LABELS.verify : SUBMIT_LABELS.signIn
  const submitLabel = isLoading ? labels.pending : labels.idle

  return (
    <div className={cn('flex flex-col gap-6', className)} {...props}>
      <FieldGroup>
        <div className="flex flex-col items-center gap-3 text-center">
          <div className="flex size-10 items-center justify-center rounded-lg bg-neutral-100 p-1">
            <img src={branding.logo} alt="" width={32} height={32} className="rounded-md" />
          </div>
          <h1 className="text-xl font-bold">Welcome to {branding.name}.</h1>
          {branding.tagline && <p className="text-muted-foreground text-sm">{branding.tagline}</p>}
        </div>

        <form
          className="flex flex-col gap-6"
          noValidate
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
                aria-invalid={!!error}
                autoFocus
                containerClassName="w-full"
              >
                <InputOTP.Group className="flex-1">
                  <InputOTP.Slot index={0} className="flex-1" />
                  <InputOTP.Slot index={1} className="flex-1" />
                  <InputOTP.Slot index={2} className="flex-1" />
                </InputOTP.Group>
                <InputOTP.Separator />
                <InputOTP.Group className="flex-1">
                  <InputOTP.Slot index={3} className="flex-1" />
                  <InputOTP.Slot index={4} className="flex-1" />
                  <InputOTP.Slot index={5} className="flex-1" />
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
                  <field.TextField
                    label="Email"
                    placeholder="type your email"
                    type="email"
                    autoComplete="username"
                  />
                )}
              />

              <form.AppField
                name="password"
                children={(field) => (
                  <field.PasswordField
                    label="Password"
                    placeholder="type your password"
                    autoComplete="current-password"
                  />
                )}
              />
            </>
          )}

          <Field>
            {error && <FieldError>{error}</FieldError>}
            <Button type="submit" disabled={isLoading || (needsCode && otp.length !== 6)}>
              {isLoading && <IconLoader2 className="size-4 animate-spin" />}
              {submitLabel}
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
