import type { NextConfig } from 'next';

const config: NextConfig = {
  reactStrictMode: true,
  // Workspace packages ship TypeScript source rather than a build step, so Next
  // compiles them itself. Keeps `pnpm dev` free of a watch-and-rebuild dance.
  transpilePackages: ['@vivy/core', '@vivy/db'],
  typedRoutes: true,
  eslint: { ignoreDuringBuilds: true },
};

export default config;
