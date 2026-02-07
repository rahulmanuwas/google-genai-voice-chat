import { defineConfig } from 'tsup';

export default defineConfig({
  entry: {
    index: 'src/index.ts',
    'server/index': 'src/server/index.ts',
    'agent/index': 'src/agent/index.ts',
    'react/index': 'src/react/index.ts',
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
    'livekit-client',
    'livekit-server-sdk',
    'react',
    'react-dom',
  ],
});
