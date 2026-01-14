import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  /* config options here */
  experimental: {
    turbo: {
      resolveExtensions: ['.tsx', '.ts', '.jsx', '.js', '.mjs', '.json'],
    },
  },
  // Exclude Python virtual environment from file watching
  webpack: (config, { isServer }) => {
    config.watchOptions = {
      ...config.watchOptions,
      ignored: ['**/1051-env/**', '**/__pycache__/**', '**/*.pyc'],
    };
    return config;
  },
};

export default nextConfig;
