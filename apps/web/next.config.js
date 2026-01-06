/** @type {import('next').NextConfig} */
const nextConfig = {
  transpilePackages: ['@aninda/shared', '@aninda/database'],
  experimental: {
    serverActions: {
      bodySizeLimit: '2mb',
    },
  },
};

module.exports = nextConfig;
