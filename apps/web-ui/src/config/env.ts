import { createEnv } from '@t3-oss/env-core'
import { z } from 'zod'

declare global {
  interface Window {
    /**
     * Runtime config tera-server injects into index.html when it serves the
     * bundle, so a deployed image can be repointed at another API origin
     * without rebuilding. Absent in dev and on static-only hosts.
     */
    __APP_ENV__?: { API_URL?: string }
  }
}

const parsed = createEnv({
  /*
   * Environment variables available on the client (and server).
   *
   * 💡 You'll get type errors if these are not prefixed with VITE_.
   */
  clientPrefix: 'VITE_',
  client: {
    // No client-side env vars needed for this app
    // VITE prefix is to use in browser
    VITE_APP_NAME: z.string(),
  },
  /*
   * Due to how Next.js bundles environment variables on Edge and Client,
   * we need to manually destructure them to make sure all are included in bundle.
   *
   * 💡 You'll get type errors if not all variables from `server` & `client` are included here.
   */
  runtimeEnv: {
    VITE_APP_NAME: import.meta.env.VITE_APP_NAME,
  },
})

// API_URL resolves at runtime: the server-injected config wins, then the
// .env value (dev and static builds), and finally the page origin — the
// shipped image serves UI and API from one origin, so empty means "same as
// the page". Set it only for a split-origin setup.
export const env = {
  ...parsed,
  API_URL: window.__APP_ENV__?.API_URL || import.meta.env.API_URL || window.location.origin,
}
