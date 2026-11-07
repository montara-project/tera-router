import {
  IconArrowRight,
  IconClipboard,
  IconFaceId,
  IconKey,
  IconLoader2,
  IconLock,
  IconMail,
  IconShieldCheck,
} from '@tabler/icons-react'
import { revalidateLogic } from '@tanstack/react-form'
import { useRouter } from '@tanstack/react-router'
import { useEffect, useState } from 'react'

import { Button } from '@/components/ui/button'
import { Field, FieldError } from '@/components/ui/field'
import { Input, InputWrapper } from '@/components/ui/input'
import { InputOTP, REGEXP_ONLY_DIGITS } from '@/components/ui/input-otp'
import { Label } from '@/components/ui/label'
import { useAppForm } from '@/hooks/form'
import { useBranding } from '@/hooks/use-branding'
import { SignInSchema } from '@/lib/api/dtos/auth/schema'
import { signInWithEmail } from '@/lib/auth/email-auth'
import { passkeysSupported, signInWithPasskey } from '@/lib/auth/passkey'
import { cn } from '@/lib/utils'

import { BrandRow, useGatewayHealth } from './brand-panel'

const SUBMIT_LABELS = {
  signIn: { idle: 'Continue', pending: 'Signing in…' },
  verify: { idle: 'Verify and continue', pending: 'Verifying…' },
} as const

/** TOTP codes change on 30-second boundaries (server: internal/lib/totp, period = 30). */
const TOTP_PERIOD = 30

const totpSecondsLeft = () => TOTP_PERIOD - (Math.floor(Date.now() / 1000) % TOTP_PERIOD)

/**
 * Seconds until the authenticator shows its next code. The clock is read on
 * every render, so the value is current the moment the code step appears; the
 * interval only re-renders once a second while it is active.
 */
function useTotpSecondsLeft(active: boolean) {
  const [, setTick] = useState(0)
  useEffect(() => {
    if (!active) return
    const timer = window.setInterval(() => setTick((n) => n + 1), 1000)
    return () => window.clearInterval(timer)
  }, [active])
  return totpSecondsLeft()
}

const canReadClipboard = () => typeof navigator !== 'undefined' && !!navigator.clipboard?.readText

interface LoginSectionProps extends React.ComponentProps<'div'> {
  /** The email awaiting a TOTP code, or null once back on the password step. */
  onTwoFactorChange?: (email: string | null) => void
}

export default function LoginSection({
  className,
  onTwoFactorChange,
  ...props
}: LoginSectionProps) {
  const { navigate } = useRouter()
  const branding = useBranding()
  const health = useGatewayHealth()
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
          onTwoFactorChange?.(value.email)
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

  const passkeySignIn = async () => {
    setIsLoading(true)
    setError(null)
    try {
      await signInWithPasskey()
      navigate({ to: '/dashboard' })
    } catch (error) {
      setError(error instanceof Error ? error.message : 'An error occurred')
    } finally {
      setIsLoading(false)
    }
  }

  const cancelCode = () => {
    setNeedsCode(false)
    setOtp('')
    setError(null)
    form.setFieldValue('password', '', { dontValidate: true })
    onTwoFactorChange?.(null)
  }

  const pasteCode = async () => {
    try {
      const digits = (await navigator.clipboard.readText()).replace(/\D/g, '')
      if (digits.length !== 6) {
        setError('The clipboard holds no 6-digit code. Type the code instead.')
        return
      }
      setError(null)
      setOtp(digits)
    } catch {
      setError('The browser blocked clipboard access. Type the code instead.')
    }
  }

  const secondsLeft = useTotpSecondsLeft(needsCode)

  const labels = needsCode ? SUBMIT_LABELS.verify : SUBMIT_LABELS.signIn
  const submitLabel = isLoading ? labels.pending : labels.idle
  const HeadIcon = needsCode ? IconShieldCheck : IconLock

  return (
    <div
      className={cn('flex w-full max-w-[400px] flex-col items-center gap-[18px]', className)}
      {...props}
    >
      {/* The brand panel is hidden on small screens; keep the product visible. */}
      <BrandRow name={branding.name} className="self-start lg:hidden" />

      <section className="w-full overflow-hidden rounded-lg border border-border bg-card">
        <header className="flex items-center gap-3 border-b border-border px-5 py-4">
          <span
            className={cn(
              'flex size-8 shrink-0 items-center justify-center rounded-md',
              needsCode ? 'bg-blue-500/15' : 'bg-orange-500/15'
            )}
          >
            <HeadIcon
              className={cn(
                'size-4',
                needsCode
                  ? 'text-blue-600 dark:text-blue-400'
                  : 'text-orange-600 dark:text-orange-400'
              )}
              aria-hidden
            />
          </span>
          <div className="min-w-0 flex-1">
            <h1 className="text-sm font-semibold text-foreground">
              {needsCode ? 'Two-factor authentication' : 'Sign in'}
            </h1>
            <p className="text-xs text-muted-foreground">
              {needsCode ? 'Step 2 of 2 · Enter the code' : 'Operator console access'}
            </p>
          </div>
          {(needsCode || health.version) && (
            <span className="font-mono text-[11px] text-muted-foreground/80">
              {needsCode ? 'TOTP' : health.version}
            </span>
          )}
        </header>

        <form
          // The design's compact fields: 12.5px labels sitting 6px above the input.
          className={cn(
            'flex flex-col p-5 [&_[data-slot=field]]:gap-1.5 [&_[data-slot=field-label]]:text-[12.5px]',
            needsCode ? 'gap-3' : 'gap-3.5'
          )}
          noValidate
          onSubmit={(e) => {
            e.preventDefault()
            form.handleSubmit()
          }}
        >
          {needsCode ? (
            <>
              <Field>
                <Label htmlFor="totp-email" className="text-[12.5px]">
                  Email
                </Label>
                <InputWrapper variant="md">
                  <IconMail aria-hidden />
                  <Input
                    id="totp-email"
                    value={form.state.values.email}
                    readOnly
                    // Shown for context, not a locked field: no grey read-only fill.
                    className="cursor-default! bg-transparent!"
                  />
                </InputWrapper>
              </Field>

              <Field className="gap-2!">
                <Label htmlFor="otp" className="text-[12.5px]">
                  Verification code
                </Label>
                <InputOTP
                  id="otp"
                  value={otp}
                  onChange={(value: string) => {
                    setOtp(value)
                    // Editing the code clears the last attempt's error and aria-invalid.
                    setError(null)
                  }}
                  maxLength={6}
                  pattern={REGEXP_ONLY_DIGITS}
                  aria-invalid={!!error}
                  autoFocus
                  autoComplete="one-time-code"
                  containerClassName="w-full"
                >
                  <InputOTP.Group className="w-full">
                    {Array.from({ length: 6 }, (_, i) => (
                      <InputOTP.Slot
                        key={i}
                        index={i}
                        // Empty boxes sit a shade back; the caret is the accent, as in the design.
                        className="h-[46px] flex-1 text-xl font-semibold data-[filled=false]:bg-muted/40 [&_.animate-caret-blink]:h-[22px] [&_.animate-caret-blink]:w-0.5 [&_.animate-caret-blink]:bg-orange-500"
                      />
                    ))}
                  </InputOTP.Group>
                </InputOTP>
              </Field>

              {canReadClipboard() && (
                <button
                  type="button"
                  onClick={() => void pasteCode()}
                  className="flex w-fit items-center gap-1.5 rounded-sm text-[11.5px] text-muted-foreground hover:text-foreground"
                >
                  <IconClipboard className="size-3 text-muted-foreground/80" aria-hidden />
                  Paste from authenticator
                </button>
              )}
            </>
          ) : (
            <>
              <form.AppField
                name="email"
                children={(field) => (
                  <field.TextField
                    label="Email"
                    placeholder="operator@tera.dev"
                    type="email"
                    autoComplete="username"
                    icon={IconMail}
                    variant="md"
                  />
                )}
              />

              <form.AppField
                name="password"
                children={(field) => (
                  <field.PasswordField
                    label="Password"
                    placeholder="Your password"
                    autoComplete="current-password"
                    icon={IconKey}
                    variant="md"
                  />
                )}
              />
            </>
          )}

          {error && <FieldError>{error}</FieldError>}

          <Button
            type="submit"
            className="h-[38px] w-full gap-[7px] bg-[#0a59b8] text-[13px] font-medium text-white hover:bg-[#0a59b8]/90"
            disabled={isLoading || (needsCode && otp.length !== 6)}
          >
            {isLoading && <IconLoader2 className="size-4 animate-spin" aria-hidden />}
            {submitLabel}
            {!isLoading && <IconArrowRight className="size-3.5" aria-hidden />}
          </Button>

          {!needsCode && passkeysSupported() && (
            <>
              <div className="flex items-center gap-2.5" aria-hidden>
                <span className="h-px flex-1 bg-border" />
                <span className="font-mono text-[10.5px] tracking-[0.6px] text-muted-foreground/80">
                  OR
                </span>
                <span className="h-px flex-1 bg-border" />
              </div>
              <Button
                type="button"
                variant="outline"
                className="h-9 w-full gap-2 bg-muted/40 text-[12.5px] font-medium"
                onClick={passkeySignIn}
                disabled={isLoading}
              >
                <IconFaceId className="size-3.5 text-orange-600 dark:text-orange-400" aria-hidden />
                Sign in with a passkey
              </Button>
            </>
          )}
        </form>

        <footer className="flex items-center gap-1.5 border-t border-border bg-muted/40 px-5 py-2.5">
          <IconShieldCheck className="size-3 text-muted-foreground/80" aria-hidden />
          <p className="text-[11.5px] text-muted-foreground">
            {needsCode
              ? `Code expires in 00:${String(secondsLeft).padStart(2, '0')}`
              : 'TOTP is asked after this step when it is on'}
          </p>
        </footer>
      </section>

      {needsCode && (
        <button
          type="button"
          onClick={cancelCode}
          disabled={isLoading}
          className="rounded-sm text-xs text-muted-foreground hover:text-foreground disabled:opacity-60"
        >
          Wrong account? Start over →
        </button>
      )}
    </div>
  )
}
