import { createEnv } from '@t3-oss/env-core'
import { z } from 'zod'

export const env = createEnv({
  /*
   * Serverside Environment variables, not available on the client.
   * Will throw if you access these variables on the client.
   */
  server: {
    BETTER_AUTH_URL: z.url(),
    BETTER_AUTH_SECRET: z.string(),
  },
  /*
   * Environment variables available on the client (and server).
   *
   * 💡 You'll get type errors if these are not prefixed with VITE_.
   */
  clientPrefix: 'VITE_',
  client: {
    // No client-side env vars needed for this app
    // VITE prefix is to use in browser
    VITE_API_URL: z.url(),
  },
  /*
   * Due to how Next.js bundles environment variables on Edge and Client,
   * we need to manually destructure them to make sure all are included in bundle.
   *
   * 💡 You'll get type errors if not all variables from `server` & `client` are included here.
   */
  runtimeEnv: {
    VITE_API_URL: import.meta.env.VITE_API_URL,

    BETTER_AUTH_URL: import.meta.env.BETTER_AUTH_URL,
    BETTER_AUTH_SECRET: import.meta.env.BETTER_AUTH_SECRET,
  },
})
