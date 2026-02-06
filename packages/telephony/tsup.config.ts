import { defineConfig } from 'tsup';

export default defineConfig({
  entry: {
    index: 'src/index.ts',
    'adapters/telnyx': 'src/adapters/telnyx.ts',
    'adapters/twilio': 'src/adapters/twilio.ts',
  },
  format: ['cjs', 'esm'],
  dts: true,
  splitting: false,
  sourcemap: true,
  clean: true,
  treeshake: true,
  external: ['@genai-voice/core'],
});
