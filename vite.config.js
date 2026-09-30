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

function createMediaPipePatchPlugin() {
  return {
    name: 'patch-mediapipe-worker-ios',
    enforce: 'pre',
    transform(code, id) {
      if (id.includes('@mediapipe') || id.includes('vision_bundle')) {
        let patched = code.replace(/\/\/# sourceMappingURL=.*/g, '');
        // 1. Bypass MediaPipe's broken Safari version check that causes fallback to document.createElement("canvas") in workers
        const safariCheck = '!function(t=navigator){return(t=t.userAgent).includes("Safari")&&!t.includes("Chrome")}(t)||!!((t=t.userAgent.match(/Version\\/([\\d]+).*Safari/))&&t.length>=1&&Number(t[1])>=17)';
        patched = patched.replace(safariCheck, 'true');

        // 2. Prevent $h loader from attempting document.createElement("script") inside Web Worker scope
        const scriptLoader = 'if("function"!=typeof importScripts){let e=document.createElement("script");';
        const safeScriptLoader = 'if("function"!=typeof importScripts && typeof document!=="undefined"){let e=document.createElement("script");';
        patched = patched.replace(scriptLoader, safeScriptLoader);

        return {
          code: patched,
          map: null
        };
      }
    }
  };
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
    createMediaPipePatchPlugin()
  ],
  server: {
    host: true,
    https: true
  },
  worker: {
    format: 'es',
    plugins: () => [createMediaPipePatchPlugin()]
  },
  optimizeDeps: {
    exclude: ['@mediapipe/tasks-vision']
  }
});
