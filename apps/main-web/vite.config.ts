import { cloudflare } from '@cloudflare/vite-plugin'
import { workersCacheCdnAdapter } from '@vinext/cloudflare/cache/workers-cache-cdn-adapter'
import { imagesOptimizer } from '@vinext/cloudflare/images/images-optimizer'
import vinext from 'vinext'
import { defineConfig } from 'vite'

export default defineConfig({
  plugins: [
    vinext({
      cache: { cdn: workersCacheCdnAdapter() },
      images: { optimizer: imagesOptimizer() },
    }),
    cloudflare({
      viteEnvironment: {
        name: 'rsc',
        childEnvironments: ['ssr'],
      },
    }),
  ],
})
