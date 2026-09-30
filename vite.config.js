import { defineConfig } from 'vite';
import basicSsl from '@vitejs/plugin-basic-ssl';
import fs from 'fs';
import path from 'path';

function getAudioFiles() {
  const dir = path.resolve(process.cwd(), 'public/audio');
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  return fs.readdirSync(dir)
    .filter(f => /\.(wav|mp3|ogg|m4a|aac|webm)$/i.test(f))
    .sort((a, b) => a.localeCompare(b));
}

function updateManifest() {
  const files = getAudioFiles();
  const manifestPath = path.resolve(process.cwd(), 'public/audio/manifest.json');
  fs.writeFileSync(manifestPath, JSON.stringify(files, null, 2));
  return files;
}

export default defineConfig({
  base: './',
  plugins: [
    basicSsl(),
    {
      name: 'audio-manifest-plugin',
      buildStart() {
        updateManifest();
      },
      configureServer(server) {
        updateManifest();
        server.middlewares.use('/api/audio-tracks', (req, res) => {
          const files = updateManifest();
          res.setHeader('Content-Type', 'application/json');
          res.end(JSON.stringify(files));
        });
        server.middlewares.use((req, res, next) => {
          if (req.url && req.url.includes('/models/')) {
            res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
            res.setHeader('Content-Type', 'application/octet-stream');
          } else if (req.url && req.url.includes('/wasm/')) {
            res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
            if (req.url.endsWith('.wasm')) {
              res.setHeader('Content-Type', 'application/wasm');
            }
          }
          next();
        });
      }
    },
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
