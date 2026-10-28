import { AxiosError, type AxiosInstance } from 'axios'

/**
 * POST a JSON body and read the server-sent events off the fetch body,
 * handing each event's `data:` payload to onData. Resolves with the response
 * headers once the stream ends. A rejected request carries its JSON error as
 * a stream too, so it is decoded (OpenAI `{error: {message}}` envelopes
 * included) for axiosErrorMessage to read.
 */
export async function postEventStream(
  api: AxiosInstance,
  url: string,
  payload: unknown,
  onData: (data: string) => void
) {
  let res
  try {
    res = await api.post<ReadableStream<Uint8Array>>(url, payload, {
      adapter: 'fetch',
      responseType: 'stream',
      headers: { Accept: 'text/event-stream' },
    })
  } catch (error) {
    if (error instanceof AxiosError && error.response?.data instanceof ReadableStream) {
      const text = await new Response(error.response.data).text()
      let data: { message?: string; error?: { message?: string } }
      try {
        data = JSON.parse(text)
      } catch {
        data = { message: text }
      }
      error.response.data = data.error?.message ? { message: data.error.message } : data
    }
    throw error
  }

  const reader = res.data.getReader()
  const decoder = new TextDecoder()
  let buffer = ''
  for (;;) {
    const { value, done } = await reader.read()
    if (done) break
    buffer += decoder.decode(value, { stream: true })
    const events = buffer.split('\n\n')
    buffer = events.pop() ?? ''
    for (const event of events) {
      for (const line of event.split('\n')) {
        if (line.startsWith('data:')) onData(line.slice(5).trim())
      }
    }
  }
  return res.headers
}
