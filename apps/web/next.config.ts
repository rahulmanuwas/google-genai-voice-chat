import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: 'standalone',
  transpilePackages: ['@genai-voice/sdk'],
};

export default nextConfig;
