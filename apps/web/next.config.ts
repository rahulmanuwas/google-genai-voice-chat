import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: 'standalone',
  transpilePackages: ['@genai-voice/react', '@genai-voice/livekit'],
};

export default nextConfig;
