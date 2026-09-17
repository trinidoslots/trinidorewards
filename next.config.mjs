/** @type {import('next').NextConfig} */
const nextConfig = {
  eslint: {
    ignoreDuringBuilds: true,
  },
  typescript: {
    ignoreBuildErrors: true,
  },
  images: {
    unoptimized: true,
  },
  // The bonus hunt widget moved to /obs/bonushunt so every OBS source sits under
  // /obs/<widget>. Browser sources already pointing at /obs keep working.
  async redirects() {
    return [{ source: "/obs", destination: "/obs/bonushunt", permanent: true }]
  },
  experimental: {
    staleTimes: {
      dynamic: 30,
      static: 180,
    },
  },
  onDemandEntries: {
    maxInactiveAge: 15 * 1000,
    pagesBufferLength: 2,
  },
  turbopack: {
    root: '../',
  },
}

export default nextConfig
