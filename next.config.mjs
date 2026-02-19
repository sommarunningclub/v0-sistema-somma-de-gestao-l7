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
  // Força limpeza do cache em cada build
  distDir: '.next',
  cleanDistDir: true,
  // Garante que webpack use o diretório correto
  webpack: (config, { isServer }) => {
    config.cache = false
    return config
  },
}

export default nextConfig
