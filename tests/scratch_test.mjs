// Polyfill first
globalThis.self = globalThis;
globalThis.OffscreenCanvas = class {
  constructor(w, h) { this.width = w; this.height = h; }
  getContext() { return null; }
};

globalThis.document = {
  createElement(tag) {
    if (tag === 'script') {
      return {
        _src: '',
        crossOrigin: '',
        onload: null,
        onerror: null,
        addEventListener(event, fn) {
          if (event === 'load') this.onload = fn;
          if (event === 'error') this.onerror = fn;
        },
        set src(url) {
          this._src = url;
        }
      };
    }
    return {};
  },
  body: {
    appendChild(el) {
      if (el && el._src) {
        fetch(el._src)
          .then(r => r.text())
          .then(code => {
            // Attach ModuleFactory to self
            (0, eval)(code + '\n; self.ModuleFactory = ModuleFactory;');
            if (el.onload) el.onload();
          })
          .catch(err => {
            if (el.onerror) el.onerror(err);
          });
      }
    }
  }
};

async function test() {
  try {
    console.log('Dynamic import of tasks-vision...');
    const { FilesetResolver, PoseLandmarker } = await import('@mediapipe/tasks-vision');

    console.log('Fetching vision tasks wasm...');
    const vision = await FilesetResolver.forVisionTasks(
      'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@1.0.1/wasm'
    );
    console.log('Vision resolved:', vision);

    console.log('Creating PoseLandmarker with CPU delegate...');
    const landmarker = await PoseLandmarker.createFromOptions(vision, {
      baseOptions: {
        modelAssetPath: 'https://storage.googleapis.com/mediapipe-models/pose_landmarker/pose_landmarker_lite/float16/1/pose_landmarker_lite.task',
        delegate: 'CPU'
      },
      runningMode: 'VIDEO',
      numPoses: 1
    });
    console.log('SUCCESS! PoseLandmarker created:', !!landmarker);
  } catch (err) {
    console.error('Error during test:', err);
  }
}

test();
