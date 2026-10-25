// Tera Router relay — local Node.js process (Node 18+, no dependencies).
// Run: `node relay.mjs` (PORT defaults to 8790), then register the pool URL
// shown in Tera Router with this machine's reachable host and port.
import http from 'node:http'
import { Readable } from 'node:stream'

const SECRET = '__TERA_RELAY_SECRET__'
const PORT = Number(process.env.PORT || 8790)
const TARGET_HEADER = 'x-tera-relay-target'
const SECRET_HEADER = 'x-tera-relay-secret'
const HOP_HEADERS = new Set(['host', 'connection', 'content-length', 'transfer-encoding', 'keep-alive'])

http
  .createServer(async (req, res) => {
    if (req.headers[SECRET_HEADER] !== SECRET) {
      res.writeHead(403).end('forbidden')
      return
    }
    const target = req.headers[TARGET_HEADER]
    if (typeof target !== 'string' || !/^https?:\/\//.test(target)) {
      res.writeHead(400).end('missing or invalid relay target')
      return
    }

    const headers = {}
    for (const [name, value] of Object.entries(req.headers)) {
      if (!HOP_HEADERS.has(name) && name !== TARGET_HEADER && name !== SECRET_HEADER) {
        headers[name] = value
      }
    }

    try {
      const hasBody = req.method !== 'GET' && req.method !== 'HEAD'
      const upstream = await fetch(target, {
        method: req.method,
        headers,
        body: hasBody ? req : undefined,
        duplex: 'half',
        redirect: 'manual',
      })
      const out = {}
      upstream.headers.forEach((value, name) => {
        if (!HOP_HEADERS.has(name) && name !== 'content-encoding') out[name] = value
      })
      res.writeHead(upstream.status, out)
      if (upstream.body) Readable.fromWeb(upstream.body).pipe(res)
      else res.end()
    } catch (err) {
      res.writeHead(502).end(`relay error: ${err.message}`)
    }
  })
  .listen(PORT, () => console.log(`Tera Router relay listening on :${PORT}`))
