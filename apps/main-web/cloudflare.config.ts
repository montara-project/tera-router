import { bindings, defineConfig, defineWorker } from 'cf/config'

export default defineConfig({
  worker: defineWorker({
    name: 'main-web',
    entrypoint: 'vinext/server/fetch-handler',
    compatibilityDate: '2026-09-29',
    compatibilityFlags: ['nodejs_compat'],
    assets: { notFoundHandling: 'none' },
    env: {
      ASSETS: bindings.assets(),
      IMAGES: bindings.images(),
    },
    cache: {
      enabled: true,
    },
    observability: {
      enabled: true,
    },
    workersDev: false,
    previewUrls: false,
    domains: ['terarouter.xyz'],
  }),
})
