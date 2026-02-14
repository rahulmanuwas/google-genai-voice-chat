import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: 'standalone',
  transpilePackages: ['@genai-voice/livekit'],
};

export default nextConfig;
