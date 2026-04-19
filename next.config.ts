import type { NextConfig } from 'next'

const nextConfig: NextConfig = {
  output: 'standalone',
  experimental: {
    serverActions: {
      allowedOrigins: ['localhost:3004', 'bizhub.pcc2k.com'],
    },
  },
}

export default nextConfig
