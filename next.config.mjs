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
  // /api/admin/extension/download zips the extension/ folder by reading it off
  // disk at request time. Next only bundles files it can see being imported, and
  // a readdir(path.join(process.cwd(), "extension")) is invisible to the tracer —
  // without this the route deploys and then fails with ENOENT.
  outputFileTracingIncludes: {
    "/api/admin/extension/download": ["./extension/**/*"],
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
