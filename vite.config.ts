import { defineConfig } from 'vitest/config';

export default defineConfig(({ mode }) => ({
  // Temporary test output and the relocated host cache contain tens of thousands
  // of files. None is a client dependency, so do not traverse them for HMR.
  server: { port: 5173, strictPort: true, watch: { ignored: ['**/tmp/**', '**/test-results/**', '**/dist/**'] } },
  build: { target: 'es2023', rolldownOptions: { input: mode === 'pages' ? ['index.html','assets.html'] : ['index.html','navigation.html','assets.html'] } },
  resolve: { alias: [{ find: /^three$/, replacement: 'three/webgpu' }] },
  test: {
    include: ['tests/**/*.test.ts'],
    // The deep colony scenarios are CPU-bound; avoid oversubscribing local cores.
    maxWorkers: 2,
    testTimeout: 30_000,
  },
}));
