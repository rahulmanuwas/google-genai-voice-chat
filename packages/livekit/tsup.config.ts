import { defineConfig } from 'tsup';

export default defineConfig({
  entry: {
    index: 'src/index.ts',
    'chatbot/index': 'src/chatbot/index.ts',
    'chatbot/api': 'src/chatbot/api/index.ts',
    'server/index': 'src/server/index.ts',
    'agent/index': 'src/agent/index.ts',
    'react/index': 'src/react/index.ts',
    'core/index': 'src/core/index.ts',
    'telephony/index': 'src/telephony/index.ts',
    'telephony/adapters/telnyx': 'src/telephony/adapters/telnyx.ts',
    'telephony/adapters/twilio': 'src/telephony/adapters/twilio.ts',
  },
  format: ['cjs', 'esm'],
  dts: true,
  splitting: false,
  sourcemap: true,
  clean: true,
  treeshake: true,
  external: [
    '@livekit/agents',
    '@livekit/agents-plugin-google',
    '@livekit/components-react',
    '@google/genai',
    'livekit-client',
    'livekit-server-sdk',
    'react',
    'react-dom',
  ],
});
