/** @type {import('next').NextConfig} */
const nextConfig = {
  eslint: { ignoreDuringBuilds: true },
  experimental: {
    serverComponentsExternalPackages: ["@anthropic-ai/sdk", "bullmq", "ioredis", "playwright-core", "jsdom"],
  },
};

export default nextConfig;
