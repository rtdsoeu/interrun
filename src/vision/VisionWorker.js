/**
 * Vision Worker — Background thread inference for InterRun.
 * Dispatches raw frames to dedicated processors:
 * - ZoneProcessor: Stage 2 (Face Zone) & Stage 3 (Hand Zone)
 * - FingerGestureProcessor: Stage 4 (Finger Gestures)
 * - HandSwipeProcessor: Stage 5 (Hand Air Swipes)
 * - LegacyProcessors: Head/Hand/Pose controls
 */

import {
  faceLandmarker,
  handLandmarker,
  preloadAllModels,
  ensureModel,
  setCustomRootUrl,
  isGpuFailed,
  setGpuFailed,
  resetLandmarkerInstances
} from './processors/ModelLoader.js';

import {
  processZone,
  processHandZone,
  resetZoneCalibration
} from './processors/ZoneProcessor.js';

import {
  processFingerGesture,
  resetFingerCalibration
} from './processors/FingerGestureProcessor.js';

import {
  processHandSwipe,
  resetSwipeCalibration,
  hsSwipeCounter
} from './processors/HandSwipeProcessor.js';

// Resolution presets — must match VisionManager.CV_RESOLUTION_PRESETS
const CV_RESOLUTION_PRESETS = {
  eco:      { width: 160, height: 120 },
  balanced: { width: 256, height: 192 },
  high:     { width: 320, height: 240 },
};

let _nativeW = 320;
let _nativeH = 240;

let _resizeCanvas = null;
let _resizeCtx    = null;
let _resizeKey    = null;

function resizeBitmap(bitmap, resolution) {
  const preset = CV_RESOLUTION_PRESETS[resolution] || CV_RESOLUTION_PRESETS.high;

  const srcW = bitmap.width  || _nativeW;
  const srcH = bitmap.height || _nativeH;
  const scale = Math.min(preset.width / srcW, preset.height / srcH);

  if (scale >= 1) return bitmap;

  const targetW = Math.round(srcW * scale);
  const targetH = Math.round(srcH * scale);
  const key = `${targetW}x${targetH}`;

  try {
    if (_resizeKey !== key) {
      _resizeCanvas = new OffscreenCanvas(targetW, targetH);
      _resizeCtx    = _resizeCanvas.getContext('2d', { alpha: false, desynchronized: true })
                   || _resizeCanvas.getContext('2d');
      _resizeKey    = key;
    }
    _resizeCtx.drawImage(bitmap, 0, 0, targetW, targetH);
    const resized = _resizeCanvas.transferToImageBitmap();
    bitmap.close();
    return resized;
  } catch (canvasErr) {
    console.warn('[VisionWorker] OffscreenCanvas resize fallback:', canvasErr);
    return bitmap;
  }
}

function resetCalibration() {
  resetZoneCalibration();
  resetFingerCalibration();
  resetSwipeCalibration();
}

/** Builds the base state object with active CV stage fields */
function baseState() {
  return {
    // ZoneControl fields (Stage 2)
    zoneCol: 'C',
    zoneRow: 'mid',
    zoneSource: null,
    // HandZoneControl fields (Stage 3)
    hzCol: 'C',
    hzRow: 'mid',
    hzSource: null,
    // FingerGestureControl fields (Stage 4)
    fgGesture: null,
    fgSource: null,
    // HandSwipeControl fields (Stage 5)
    hsSwipe: null,
    hsSwipeId: hsSwipeCounter,
    hsSource: null,
    hsHandPos: null,
    // Debug & confidence
    rawAction: '',
    debugText: '',
    points: [],
    gestureConfidences: {}
  };
}

// ---------------------------------------------------------------------------
// Worker Message Handler
// ---------------------------------------------------------------------------
self.onmessage = async (e) => {
  try {
    const data = e.data;

    if (data.rootUrl) {
      setCustomRootUrl(data.rootUrl);
    }

    if (data.type === 'init' || data.type === 'preload') {
      await preloadAllModels();
      return;
    }

    if (data.type === 'setVideoSize') {
      _nativeW = data.width  || 320;
      _nativeH = data.height || 240;
      _resizeKey = null;
      console.log(`[VisionWorker] Native camera size: ${_nativeW}×${_nativeH}`);
      return;
    }

    if (data.type === 'setMode') {
      await ensureModel(data.mode, resetCalibration);
      return;
    }

    if (data.type === 'process') {
      const { frame: rawFrame, timestamp, mode, resolution } = data;
      if (!rawFrame) {
        self.postMessage({ type: 'processed', state: null });
        return;
      }

      const isVideoFrame = typeof VideoFrame !== 'undefined' && rawFrame instanceof VideoFrame;
      const frame = isVideoFrame ? rawFrame : resizeBitmap(rawFrame, resolution);

      try {
        let state = null;
        const inferStart = performance.now();

        if (mode === 'zone') {
          state = processZone(frame, timestamp, faceLandmarker, baseState);
        } else if (mode === 'handzone') {
          state = processHandZone(frame, timestamp, handLandmarker, baseState);
        } else if (mode === 'fingergesture') {
          state = processFingerGesture(frame, timestamp, handLandmarker, baseState);
        } else if (mode === 'handswipe') {
          state = processHandSwipe(frame, timestamp, handLandmarker, baseState);
        }

        const inferDuration = Math.round(performance.now() - inferStart);
        self.postMessage({ type: 'processed', state, inferDuration });
      } catch (err) {
        console.warn(`[VisionWorker] Error processing ${mode}:`, err);
        const errMsg = err?.message || String(err);
        if (!isGpuFailed() && (errMsg.includes('WebGL') || errMsg.includes('gl') || errMsg.includes('context'))) {
          console.warn('[VisionWorker] WebGL context failure during inference, falling back to CPU delegate');
          setGpuFailed(true);
          resetLandmarkerInstances();
          ensureModel(mode, resetCalibration).catch(() => {});
        }
        self.postMessage({ type: 'processed', state: null, error: errMsg });
      } finally {
        if (frame && typeof frame.close === 'function') {
          frame.close();
        }
      }
    }
  } catch (fatalErr) {
    console.error('[VisionWorker] Fatal error in onmessage:', fatalErr);
    self.postMessage({ type: 'error', error: fatalErr?.message || String(fatalErr) });
  }
};
