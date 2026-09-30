import { AxiosError } from 'axios'
import { toast } from 'sonner'

interface ErrorItem {
  code: string
  field: string
  message: string
  param: string
}

export function axiosErrorMessage(error: Error): string {
  if (error instanceof AxiosError) {
    const errors: ErrorItem[] = error.response?.data?.errors
    const message = error.response?.data?.message

    if (errors && errors.length > 0) {
      const errorMessages = errors.map((error) => error.message).join('\n')
      return `${message || 'Validation failed'}:\n${errorMessages}`
    }

    return message || 'An error unknown occurred'
  }

  return error.message
}

export function throwAxiosError(error: Error) {
  throw new Error(axiosErrorMessage(error))
}

/** Toast the message extracted by {@link throwAxiosError}. */
export function toastAxiosError(error: unknown) {
  try {
    throwAxiosError(error as Error)
  } catch (e) {
    toast.error(e instanceof Error ? e.message : 'An error occurred')
  }
}
