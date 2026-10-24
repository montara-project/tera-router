import { InputOTP, REGEXP_ONLY_DIGITS } from '@/components/ui/input-otp'

/** Six-digit authenticator code input (TOTP enroll, disable, key reveal). */
export default function TotpCodeInput({
  value,
  onChange,
  id,
  autoFocus,
}: {
  value: string
  onChange: (value: string) => void
  id: string
  autoFocus?: boolean
}) {
  return (
    <InputOTP
      id={id}
      value={value}
      onChange={onChange}
      maxLength={6}
      pattern={REGEXP_ONLY_DIGITS}
      aria-label="Authentication code"
      autoFocus={autoFocus}
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
  )
}
