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
  // Every OBS source sits under /obs/<widget> now. A browser source is a URL
  // someone typed into OBS once and will never revisit, so the old ones keep
  // working rather than going blank mid-stream.
  async redirects() {
    return [
      { source: "/obs", destination: "/obs/hunt", permanent: true },
      { source: "/obs/bonushunt", destination: "/obs/hunt", permanent: true },
      { source: "/obs-widget", destination: "/obs/top-bar", permanent: true },
    ]
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
