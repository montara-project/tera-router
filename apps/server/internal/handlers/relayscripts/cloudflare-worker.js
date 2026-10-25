// Tera Router relay — Cloudflare Worker.
// Deploy: `npx wrangler deploy worker.js --name tera-relay --compatibility-date 2024-09-23`
// (or paste into a new Worker in the Cloudflare dashboard), then register the
// pool URL shown in Tera Router with your workers.dev host.
const SECRET = '__TERA_RELAY_SECRET__'
const TARGET_HEADER = 'x-tera-relay-target'
const SECRET_HEADER = 'x-tera-relay-secret'

export default {
  async fetch(request) {
    if (request.headers.get(SECRET_HEADER) !== SECRET) {
      return new Response('forbidden', { status: 403 })
    }
    const target = request.headers.get(TARGET_HEADER)
    if (!target || !/^https?:\/\//.test(target)) {
      return new Response('missing or invalid relay target', { status: 400 })
    }

    const headers = new Headers()
    for (const [name, value] of request.headers) {
      if (name !== 'host' && name !== TARGET_HEADER && name !== SECRET_HEADER && !name.startsWith('cf-')) {
        headers.set(name, value)
      }
    }

    const hasBody = request.method !== 'GET' && request.method !== 'HEAD'
    return fetch(target, {
      method: request.method,
      headers,
      body: hasBody ? request.body : undefined,
      redirect: 'manual',
    })
  },
}
