/** @type {import('next').NextConfig} */
function normalizeBasePath(value = '') {
  const trimmed = value.trim()
  if (!trimmed) return ''

  const withLeadingSlash = trimmed.startsWith('/') ? trimmed : `/${trimmed}`
  return withLeadingSlash.replace(/\/+$/, '')
}

const isGitHubPages = process.env.GITHUB_PAGES === 'true'
const basePath = isGitHubPages ? normalizeBasePath(process.env.PAGES_BASE_PATH ?? '') : ''

const nextConfig = {
  output: 'export',
  typescript: {
    ignoreBuildErrors: true,
  },
  images: {
    unoptimized: true,
  },
  trailingSlash: true,
  ...(basePath
    ? { basePath, assetPrefix: `${basePath}/` }
    : {}),
}

export default nextConfig
