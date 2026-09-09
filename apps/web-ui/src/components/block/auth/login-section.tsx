import { Link, useRouter } from '@tanstack/react-router'
import { GalleryVerticalEnd } from 'lucide-react'
import { useState } from 'react'
import { toast } from 'sonner'

import { Button } from '@/components/ui/button'
import { Field, FieldGroup } from '@/components/ui/field'
import { useAppForm } from '@/hooks/form'
import { SignInSchema } from '@/lib/api/dtos/auth/schema'
import { cn } from '@/lib/utils'

export default function LoginSection({ className, ...props }: React.ComponentProps<'div'>) {
  const { navigate } = useRouter()
  const [isLoading, setIsLoading] = useState(false)

  const form = useAppForm({
    defaultValues: {
      email: '',
      password: '',
    },
    validators: {
      onSubmit: SignInSchema,
      onChange: SignInSchema,
    },
    onSubmit: async () => {
      setIsLoading(true)

      try {
        // await signInWithEmail(value)
        navigate({ to: '/dashboard' })
      } catch (error) {
        const message = error instanceof Error ? error.message : 'An error occurred'
        toast.error(message)
      } finally {
        setIsLoading(false)
        form.reset()
      }
    },
  })

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
          <form.AppField
            name="email"
            children={(field) => <field.TextField label="Email" placeholder="type your email" />}
          />

          <form.AppField
            name="password"
            children={(field) => (
              <field.PasswordField label="Password" placeholder="type your password" />
            )}
          />

          <Field>
            <Button type="submit" disabled={isLoading}>
              {isLoading ? 'Signing in...' : 'Login'}
            </Button>
          </Field>
        </form>
      </FieldGroup>
    </div>
  )
}
