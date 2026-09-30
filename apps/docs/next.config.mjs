import { createMDX } from 'fumadocs-mdx/next'

const withMDX = createMDX()

/** @type {import('next').NextConfig} */
const config = {
  reactStrictMode: true,
  // Emits .next/standalone for the Docker image in deploy/docs.Dockerfile.
  output: 'standalone',
}

export default withMDX(config)
