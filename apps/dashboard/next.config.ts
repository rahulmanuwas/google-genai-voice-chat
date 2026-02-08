import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  transpilePackages: ['@genai-voice/react', '@genai-voice/livekit'],
};

export default nextConfig;
