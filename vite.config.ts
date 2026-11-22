import { defineConfig } from 'vitest/config';
import { buildInputs } from './src/ui/developer-pages.ts';
import { devAudioGainOffsets } from './scripts/vite-dev-audio-gain-offsets.ts';

export default defineConfig(({ mode }) => ({
  // Temporary test output and the relocated host cache contain tens of thousands
  // of files. None is a client dependency, so do not traverse them for HMR.
  server: { port: 5173, strictPort: true, watch: { ignored: ['**/tmp/**', '**/test-results/**', '**/dist/**'] } },
  // The game and its developer pages (src/ui/developer-pages.ts decides which are published).
  build: { target: 'es2023', rolldownOptions: { input: buildInputs(mode) } },
  // Dev server only: « Enregistrer » of the sounds page writes the gain offsets file.
  plugins: [devAudioGainOffsets()],
  resolve: { alias: [{ find: /^three$/, replacement: 'three/webgpu' }] },
  test: {
    include: ['tests/**/*.test.ts'],
    // The deep colony scenarios are CPU-bound; avoid oversubscribing local cores.
    maxWorkers: 2,
    testTimeout: 30_000,
  },
}));
