import { defineConfig, defineWorker } from 'cf/config'

export default defineConfig({
  worker: defineWorker({
    name: 'terarouter-docs',
    entrypoint: '@tanstack/react-start/server-entry',
    compatibilityDate: '2026-09-29',
    compatibilityFlags: ['nodejs_compat'],
    // SSR worker; prerendered pages ship as static assets and anything
    // else falls through to the Worker. drop-trailing-slash keeps URLs
    // identical to the previous site (/docs/gateway serves directly).
    // Attach docs.terarouter.xyz via `domains` when cutting over DNS.
    assets: { htmlHandling: 'drop-trailing-slash', notFoundHandling: 'none' },
    observability: {
      enabled: true,
    },
    domains: ['docs.terarouter.xyz'],
  }),
})
