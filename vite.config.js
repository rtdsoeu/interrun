import { defineConfig } from 'vite';
import basicSsl from '@vitejs/plugin-basic-ssl';

export default defineConfig({
  base: './',
  plugins: [
    basicSsl(),
    {
      name: 'strip-missing-sourcemaps',
      enforce: 'pre',
      transform(code, id) {
        if (id.includes('@mediapipe')) {
          return {
            code: code.replace(/\/\/# sourceMappingURL=.*/g, ''),
            map: null
          };
        }
      }
    }
  ],
  server: {
    host: true,
    https: true
  },
  worker: {
    format: 'es'
  },
  optimizeDeps: {
    exclude: ['@mediapipe/tasks-vision']
  }
});

