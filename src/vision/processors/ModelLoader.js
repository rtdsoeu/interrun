import { FilesetResolver, FaceLandmarker, HandLandmarker } from '@mediapipe/tasks-vision';

// Polyfill minimal document / window for MediaPipe / Emscripten inside Web Worker on iOS / WebKit
if (typeof self.document === 'undefined') {
  self.document = {
    createElement(tag) {
      if (tag === 'canvas') {
        return (typeof OffscreenCanvas !== 'undefined') ? new OffscreenCanvas(1, 1) : {
          getContext: () => null,
          width: 1,
          height: 1,
          style: {}
        };
      }
      return {
        style: {},
        setAttribute() {},
        appendChild() {},
        removeChild() {},
        addEventListener() {},
        removeEventListener() {}
      };
    },
    addEventListener() {},
    removeEventListener() {},
    documentElement: {},
    body: {
      appendChild() {},
      removeChild() {}
    }
  };
}

if (typeof self.window === 'undefined') {
  self.window = self;
}

// Support MediaPipe Tasks in Web Worker (ES Module Worker):
if (typeof importScripts === 'undefined') {
  try {
    self.importScripts = () => {
      throw new TypeError('Module worker does not support importScripts');
    };
  } catch {
    // Read-only in some WebKit versions
  }
}

// Guard against ModuleFactory reset when loading multiple models in ES Module Worker:
let _cachedModuleFactory = null;
Object.defineProperty(self, 'ModuleFactory', {
  get() {
    return _cachedModuleFactory;
  },
  set(fn) {
    if (fn) {
      _cachedModuleFactory = fn;
    }
  },
  configurable: true,
  enumerable: true
});

if (typeof self.import === 'undefined') {
  self.import = async (url) => {
    const mod = await import(/* @vite-ignore */ url);
    if (mod && mod.default) {
      _cachedModuleFactory = mod.default;
    }
    return mod;
  };
}

export let visionTasks = null;
export let faceLandmarker = null;
export let handLandmarker = null;
export let currentMode = null;

let _customRootUrl = null;
let _gpuFailed = false;

let faceLandmarkerPromise = null;
let handLandmarkerPromise = null;
let preloadAllPromise = null;

export function setCustomRootUrl(url) {
  _customRootUrl = url;
}

export function getRootUrl() {
  if (_customRootUrl) return _customRootUrl;
  if (typeof location === 'undefined') return '';
  const origin = location.origin || '';
  const pathname = location.pathname.replace(/\/assets\/.*$/, '').replace(/\/src\/.*$/, '').replace(/\/$/, '');
  return `${origin}${pathname}`;
}

export function setGpuFailed(failed) {
  _gpuFailed = failed;
}

export function isGpuFailed() {
  return _gpuFailed;
}

export function resetLandmarkerInstances() {
  faceLandmarker = null;
  handLandmarker = null;
  faceLandmarkerPromise = null;
  handLandmarkerPromise = null;
}

/**
 * Creates any MediaPipe model with automatic delegate and path fallbacks.
 * Attempt order: local+GPU → local+CPU → CDN+GPU → CDN+CPU.
 */
export async function createModel(Creator, wasm, localPath, cdnPath, opts) {
  const baseCanvas = (typeof OffscreenCanvas !== 'undefined') ? new OffscreenCanvas(1, 1) : undefined;
  const mergedOpts = baseCanvas ? { canvas: baseCanvas, ...opts } : { ...opts };

  const tryCreate = (path, delegate) =>
    Creator.createFromOptions(wasm, { ...mergedOpts, baseOptions: { modelAssetPath: path, delegate } });

  const attempts = _gpuFailed
    ? [
        [localPath, 'CPU'],
        [cdnPath,   'CPU'],
      ]
    : [
        [localPath, 'GPU'], [localPath, 'CPU'],
        [cdnPath,   'GPU'], [cdnPath,   'CPU'],
      ];
  let lastErr;
  for (const [path, delegate] of attempts) {
    try {
      const inst = await tryCreate(path, delegate);
      const src = path.includes('googleapis') ? 'CDN' : 'local';
      console.log(`[VisionWorker] Model ready — delegate:${delegate} src:${src}`);
      inst._delegate = delegate;
      inst._src = src;
      return inst;
    } catch (e) {
      console.warn(`[VisionWorker] Delegate attempt failed (${delegate}, ${path}):`, e?.message || e);
      lastErr = e;
    }
  }
  throw lastErr;
}

/**
 * Initializes FilesetResolver with local wasm or CDN fallback.
 */
export async function initVision() {
  if (visionTasks) return visionTasks;
  try {
    const rootUrl = getRootUrl();
    visionTasks = await FilesetResolver.forVisionTasks(`${rootUrl}/wasm`, true);
    console.log('[VisionWorker] FilesetResolver initialized successfully (Wasm Module)');
    self.postMessage({ type: 'ready' });
    return visionTasks;
  } catch (err) {
    console.warn('[VisionWorker] Local wasm init failed, trying CDN:', err);
    try {
      visionTasks = await FilesetResolver.forVisionTasks(
        'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@1.0.1/wasm',
        true
      );
      console.log('[VisionWorker] FilesetResolver CDN fallback successful');
      self.postMessage({ type: 'ready' });
      return visionTasks;
    } catch (cdnErr) {
      console.error('[VisionWorker] Critical error initVision:', cdnErr);
      self.postMessage({ type: 'error', error: cdnErr.message });
    }
  }
}

export async function loadFaceModel() {
  if (faceLandmarker) return faceLandmarker;
  if (faceLandmarkerPromise) return faceLandmarkerPromise;

  faceLandmarkerPromise = (async () => {
    await initVision();
    const rootUrl = getRootUrl();
    try {
      faceLandmarker = await createModel(
        FaceLandmarker, visionTasks,
        `${rootUrl}/models/face_landmarker.task`,
        'https://storage.googleapis.com/mediapipe-models/face_landmarker/face_landmarker/float16/1/face_landmarker.task',
        {
          runningMode: 'VIDEO',
          numFaces: 1,
          outputFaceBlendshapes: false,
          outputFacialTransformationMatrixes: false,
          minFaceDetectionConfidence: 0.5,
          minFacePresenceConfidence: 0.5,
          minTrackingConfidence: 0.5
        }
      );
      self.postMessage({ type: 'model_ready', mode: 'face', delegate: faceLandmarker._delegate, src: faceLandmarker._src });
      return faceLandmarker;
    } catch (faceErr) {
      console.warn('[VisionWorker] Failed to load faceLandmarker:', faceErr);
      faceLandmarkerPromise = null;
      throw faceErr;
    }
  })();

  return faceLandmarkerPromise;
}

export async function loadHandModel() {
  if (handLandmarker) return handLandmarker;
  if (handLandmarkerPromise) return handLandmarkerPromise;

  handLandmarkerPromise = (async () => {
    await initVision();
    const rootUrl = getRootUrl();
    try {
      handLandmarker = await createModel(
        HandLandmarker, visionTasks,
        `${rootUrl}/models/hand_landmarker.task`,
        'https://storage.googleapis.com/mediapipe-models/hand_landmarker/hand_landmarker/float16/1/hand_landmarker.task',
        {
          runningMode: 'VIDEO',
          numHands: 1,
          minHandDetectionConfidence: 0.5,
          minHandPresenceConfidence: 0.5,
          minTrackingConfidence: 0.5
        }
      );
      self.postMessage({ type: 'model_ready', mode: 'hands', delegate: handLandmarker._delegate, src: handLandmarker._src });
      return handLandmarker;
    } catch (handErr) {
      console.warn('[VisionWorker] Failed to load handLandmarker:', handErr);
      handLandmarkerPromise = null;
      throw handErr;
    }
  })();

  return handLandmarkerPromise;
}

export async function preloadAllModels() {
  if (preloadAllPromise) return preloadAllPromise;

  preloadAllPromise = (async () => {
    try {
      self.postMessage({ type: 'preload_progress', stage: 'wasm', progress: 0.15 });
      await initVision();
      self.postMessage({ type: 'preload_progress', stage: 'face', progress: 0.35 });

      await loadFaceModel();
      self.postMessage({ type: 'preload_progress', stage: 'hands', progress: 0.70 });

      await loadHandModel();
      self.postMessage({ type: 'preload_progress', stage: 'complete', progress: 1.0 });
      self.postMessage({ type: 'preload_done' });
    } catch (err) {
      console.warn('[VisionWorker] Preload all models error:', err);
    }
  })();

  return preloadAllPromise;
}

export async function ensureModel(mode, onCalibrationReset) {
  try {
    currentMode = mode;
    if (onCalibrationReset) onCalibrationReset();

    if (mode === 'zone' || mode === 'face') {
      if (!faceLandmarker) {
        await loadFaceModel();
      }
    } else if (mode === 'handzone' || mode === 'fingergesture' || mode === 'handswipe' || mode === 'hands') {
      if (!handLandmarker) {
        await loadHandModel();
      }
    }
  } catch (e) {
    console.error('[VisionWorker] Error in ensureModel for ' + mode, e);
  }
}
