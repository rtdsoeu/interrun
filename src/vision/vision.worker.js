import { FilesetResolver, FaceLandmarker, HandLandmarker, PoseLandmarker } from '@mediapipe/tasks-vision';

// Support MediaPipe Tasks in Web Worker (ES Module Worker):
// In Chromium-based browsers, importScripts is undefined by default in ES Module Workers.
// MediaPipe's internal loader checks:
//   if ("function" != typeof importScripts) -> tries document.createElement('script')
// In a Web Worker, document does not exist (ReferenceError).
// However, if importScripts is defined as a function throwing TypeError,
// MediaPipe catches it and falls back to native dynamic import(...).
// This enables loading the Wasm ES module build cleanly.
if (typeof importScripts === 'undefined') {
  self.importScripts = () => {
    throw new TypeError('Module worker does not support importScripts');
  };
}

// Guard against ModuleFactory reset when loading multiple models in ES Module Worker:
// MediaPipe Tasks imports the wasm loader via import(wasmLoaderPath), defining ModuleFactory.
// After initializing the first model, MediaPipe resets self.ModuleFactory = void 0.
// When loading the next model, the browser returns the cached module without re-running its body,
// leaving ModuleFactory undefined and causing "ModuleFactory not set".
// We cache the factory in a closure and ignore undefined resets:
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

let visionTasks = null;
let faceLandmarker = null;
let handLandmarker = null;
let poseLandmarker = null;
let currentMode = null;

// ---------------------------------------------------------------------------
// Smoothing / calibration state (all modes)
// ---------------------------------------------------------------------------
let baselinePitch = null;
let baselineTorsoY = null;
let prevHandY = null;
let handVelocityY = 0;

// FingerGesture (Stage 4)
let fgFistFrames = 0;

// HandSwipe (Stage 5)
// Kinematic displacement + velocity detection with recoil-lockout algorithm:
// - Maintains a sliding trajectory trail (hsTrail) spanning ~220ms of 5-point palm centroid positions.
// - Rejects tracking outliers (sudden jumps > 35% of frame in < 40ms).
// - Validates displacement (|Δx| >= 0.12 or |Δy| >= 0.10) and speed (|v| >= 0.70).
// - Enforces axis dominance: |dominant_delta| > 1.35 * |secondary_delta|.
// - Anti-recoil protection: blocks reverse swipes on the same axis for 400ms after a swipe commits,
//   completely preventing the player's return hand motion from registering as a false counter-swipe.
// - Provides monotonic hsSwipeCounter ID so the main thread consumes each swipe event exactly once.
let hsTrail = [];                // [{ x, y, time }] recent palm centroid positions
let hsLastSwipe = null;          // last committed swipe direction ('left'|'right'|'up'|'down')
let hsLastSwipeTime = -Infinity; // timestamp of last committed swipe
let hsSwipeCounter = 0;          // monotonic ID for swipe events
let hsDebugTimer = 0;            // countdown timer for PIP visual confirmation

// Zone hysteresis — prevents jitter when hand/face hovers near a zone boundary.
// A zone transition is committed only when the point crosses (threshold ± HYSTERESIS_BAND).
const HYSTERESIS_BAND = 0.04; // 4% dead-band around each zone boundary
let zoneHyst = { col: 'C', row: 'mid' }; // committed state for ZoneControl (Stage 2)
let hzHyst   = { col: 'C', row: 'mid' }; // committed state for HandZoneControl (Stage 3)

/** Resets all adaptive calibration state */
function resetCalibration() {
  baselinePitch = null;
  baselineTorsoY = null;
  prevHandY = null;
  handVelocityY = 0;
  // HandSwipe
  hsTrail = [];
  hsLastSwipe = null;
  hsLastSwipeTime = -Infinity;
  hsDebugTimer = 0;
  // FingerGesture
  fgFistFrames = 0;
  // Zone hysteresis
  zoneHyst = { col: 'C', row: 'mid' };
  hzHyst   = { col: 'C', row: 'mid' };
}

function getRootUrl() {
  if (typeof location === 'undefined') return '';
  const origin = location.origin || '';
  const pathname = location.pathname.replace(/\/assets\/.*$/, '').replace(/\/src\/.*$/, '').replace(/\/$/, '');
  return `${origin}${pathname}`;
}

// ---------------------------------------------------------------------------
// Model creation helper: GPU→CPU delegate + local→CDN path fallbacks
// ---------------------------------------------------------------------------

/**
 * Creates any MediaPipe model with automatic delegate and path fallbacks.
 * Attempt order: local+GPU → local+CPU → CDN+GPU → CDN+CPU.
 *
 * GPU delegate offloads inference to WebGL — typically 3-5× faster than CPU.
 * Falls back gracefully when GPU is unavailable.
 */
async function createModel(Creator, wasm, localPath, cdnPath, opts) {
  const tryCreate = (path, delegate) =>
    Creator.createFromOptions(wasm, { ...opts, baseOptions: { modelAssetPath: path, delegate } });

  const attempts = [
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

// ---------------------------------------------------------------------------
// Palm centroid — 5-point average (wrist + 4 MCP knuckles).
// More stable than the 2-point (wrist + mid-MCP) average when fingers move.
// Landmarks: 0=wrist, 5=index MCP, 9=middle MCP, 13=ring MCP, 17=pinky MCP
// ---------------------------------------------------------------------------
function palmCenter(hand) {
  const pts = [hand[0], hand[5], hand[9], hand[13], hand[17]];
  return {
    x: pts.reduce((s, p) => s + p.x, 0) / pts.length,
    y: pts.reduce((s, p) => s + p.y, 0) / pts.length,
  };
}

// ---------------------------------------------------------------------------
// Hysteresis helpers — prevent boundary jitter for zone-based controls.
// A zone change is only committed when the point is clearly past
// (threshold ± HYSTERESIS_BAND), creating a dead-band around every boundary.
// ---------------------------------------------------------------------------

/**
 * Returns the committed column zone after applying hysteresis.
 * @param {number} mx      - mirrored X (1 - normX), range [0..1]
 * @param {string} rawCol  - raw column computed by threshold function
 * @param {string} lastCol - previously committed column
 * @param {number} tL      - left boundary (0.33 hand / 0.40 face)
 * @param {number} tR      - right boundary (0.66 hand / 0.60 face)
 */
function applyColHysteresis(mx, rawCol, lastCol, tL, tR) {
  if (rawCol === lastCol) return rawCol;
  if (lastCol === 'C') {
    if (rawCol === 'L' && mx < tL - HYSTERESIS_BAND) return 'L';
    if (rawCol === 'R' && mx > tR + HYSTERESIS_BAND) return 'R';
    return lastCol;
  }
  if (lastCol === 'L' && mx > tL + HYSTERESIS_BAND) return rawCol; // exit L zone
  if (lastCol === 'R' && mx < tR - HYSTERESIS_BAND) return rawCol; // exit R zone
  return lastCol;
}

/**
 * Returns the committed row zone after applying hysteresis.
 * @param {number} y       - normalized Y, range [0..1] (0 = top of frame)
 * @param {string} rawRow  - raw row from threshold function
 * @param {string} lastRow - previously committed row
 * @param {number} tTop    - top/mid boundary
 * @param {number} tBot    - mid/bot boundary
 */
function applyRowHysteresis(y, rawRow, lastRow, tTop, tBot) {
  if (rawRow === lastRow) return rawRow;
  if (lastRow === 'mid') {
    if (rawRow === 'top' && y < tTop - HYSTERESIS_BAND) return 'top';
    if (rawRow === 'bot' && y > tBot + HYSTERESIS_BAND) return 'bot';
    return lastRow;
  }
  if (lastRow === 'top' && y > tTop + HYSTERESIS_BAND) return rawRow; // exit top
  if (lastRow === 'bot' && y < tBot - HYSTERESIS_BAND) return rawRow; // exit bot
  return lastRow;
}

/** Formats a user-friendly debug string for 3x3 zones */
function zoneDebugText(col, row, prefix = '') {
  const colText = col === 'L' ? '◀ LEFT' : col === 'R' ? 'RIGHT ▶' : '· CENTER';
  const rowText = row === 'top' ? '▲ JUMP' : row === 'bot' ? '▼ SLIDE' : '';
  const parts = [colText, rowText].filter(Boolean).join(' + ');
  return prefix ? `${prefix} ${parts}` : parts;
}

// ---------------------------------------------------------------------------
// FilesetResolver initialization
// ---------------------------------------------------------------------------
async function initVision() {
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

// ---------------------------------------------------------------------------
// On-demand model loading
// ---------------------------------------------------------------------------
async function ensureModel(mode) {
  try {
    if (!visionTasks) await initVision();
    if (!visionTasks) return;

    currentMode = mode;
    resetCalibration();

    const rootUrl = getRootUrl();

    // Face model — needed for 'face', 'zone'
    if ((mode === 'face' || mode === 'zone') && !faceLandmarker) {
      try {
        faceLandmarker = await createModel(
          FaceLandmarker, visionTasks,
          `${rootUrl}/models/face_landmarker.task`,
          'https://storage.googleapis.com/mediapipe-models/face_landmarker/face_landmarker/float16/1/face_landmarker.task',
          { runningMode: 'VIDEO', numFaces: 1 }
        );
        self.postMessage({ type: 'model_ready', mode: 'face', delegate: faceLandmarker._delegate, src: faceLandmarker._src });
      } catch (faceErr) {
        console.warn('[VisionWorker] Failed to load faceLandmarker:', faceErr);
      }
    }

    // Hand model — needed for 'hands', 'handzone', 'fingergesture', 'handswipe'
    if ((mode === 'hands' || mode === 'handzone' || mode === 'fingergesture' || mode === 'handswipe') && !handLandmarker) {
      try {
        handLandmarker = await createModel(
          HandLandmarker, visionTasks,
          `${rootUrl}/models/hand_landmarker.task`,
          'https://storage.googleapis.com/mediapipe-models/hand_landmarker/hand_landmarker/float16/1/hand_landmarker.task',
          { runningMode: 'VIDEO', numHands: 1 }
        );
        self.postMessage({ type: 'model_ready', mode: 'hands', delegate: handLandmarker._delegate, src: handLandmarker._src });
      } catch (handErr) {
        console.warn('[VisionWorker] Failed to load handLandmarker:', handErr);
      }
    }

    // Pose model — legacy support for 'pose' and 'mix'
    if ((mode === 'pose' || mode === 'mix') && !poseLandmarker) {
      try {
        poseLandmarker = await createModel(
          PoseLandmarker, visionTasks,
          `${rootUrl}/models/pose_landmarker_lite.task`,
          'https://storage.googleapis.com/mediapipe-models/pose_landmarker/pose_landmarker_lite/float16/1/pose_landmarker_lite.task',
          { runningMode: 'VIDEO', numPoses: 1 }
        );
        self.postMessage({ type: 'model_ready', mode: 'pose' });
      } catch (poseErr) {
        console.warn('[VisionWorker] Failed to load poseLandmarker:', poseErr);
      }
    }
  } catch (e) {
    console.error('[VisionWorker] Error in ensureModel for ' + mode, e);
  }
}

// ---------------------------------------------------------------------------
// Message handler
// ---------------------------------------------------------------------------
self.onmessage = async (e) => {
  try {
    const data = e.data;

    if (data.type === 'init') {
      await initVision();
      return;
    }

    // Silent background preload — loads face + hand models without activating a mode.
    // Triggered from the main thread while the menu is on screen so Stage 2+ starts
    // without the loading delay that would otherwise interrupt gameplay.
    if (data.type === 'preload') {
      await initVision();
      await ensureModel('zone');     // loads face model
      await ensureModel('handzone'); // loads hand model
      self.postMessage({ type: 'preload_done' });
      return;
    }

    if (data.type === 'setMode') {
      await ensureModel(data.mode);
      return;
    }

    if (data.type === 'process') {
      const { bitmap, timestamp, mode } = data;
      if (!bitmap) {
        self.postMessage({ type: 'processed', state: null });
        return;
      }

      try {
        let state = null;

        if (mode === 'face' && faceLandmarker) {
          state = processFace(bitmap, timestamp);
        } else if (mode === 'hands' && handLandmarker) {
          state = processHands(bitmap, timestamp);
        } else if ((mode === 'pose' || mode === 'mix') && poseLandmarker) {
          state = processPose(bitmap, timestamp);
        } else if (mode === 'zone') {
          state = processZone(bitmap, timestamp);
        } else if (mode === 'handzone') {
          state = processHandZone(bitmap, timestamp);
        } else if (mode === 'fingergesture') {
          state = processFingerGesture(bitmap, timestamp);
        } else if (mode === 'handswipe') {
          state = processHandSwipe(bitmap, timestamp);
        }

        self.postMessage({ type: 'processed', state });
      } catch (err) {
        console.warn(`[VisionWorker] Error processing ${mode}:`, err);
        self.postMessage({ type: 'processed', state: null, error: err.message });
      } finally {
        bitmap.close();
      }
    }
  } catch (fatalErr) {
    console.error('[VisionWorker] Fatal error in onmessage:', fatalErr);
    self.postMessage({ type: 'error', error: fatalErr?.message || String(fatalErr) });
  }
};

// ---------------------------------------------------------------------------
// Zone coordinate converters
// ---------------------------------------------------------------------------

/**
 * Converts normalized coordinate [0..1] to X zone for hand (mirrored).
 * Standard thresholds: 0.33 / 0.66.
 */
function toColZone(normX) {
  const x = 1 - normX; // mirror
  if (x < 0.33) return 'L';
  if (x > 0.66) return 'R';
  return 'C';
}

/**
 * Converts normalized coordinate [0..1] to X zone for face (mirrored).
 * Tighter thresholds: 0.40 / 0.60 for natural head movement.
 */
function toColZoneFace(normX) {
  const x = 1 - normX;
  if (x < 0.40) return 'L';
  if (x > 0.60) return 'R';
  return 'C';
}

/**
 * Y row zone for HAND:
 *   top  Y < 0.33 (top 33% of frame for easy jump)
 *   mid  Y 0.33..0.76
 *   bot  Y > 0.76 (bottom 24% of frame for slide)
 */
function toRowZone(normY) {
  if (normY < 0.33) return 'top';
  if (normY > 0.76) return 'bot';
  return 'mid';
}

/**
 * Y row zone for FACE:
 *   top  Y < 0.35 (comfortable head lift for jump)
 *   mid  Y 0.35..0.72
 *   bot  Y > 0.72 (comfortable head dip for slide)
 */
function toRowZoneFace(normY) {
  if (normY < 0.35) return 'top';
  if (normY > 0.72) return 'bot';
  return 'mid';
}

/** Builds the base state object with all fields at default values */
function baseState() {
  return {
    // Legacy fields for old controllers (HeadControl / HandControl / PoseControl)
    headRoll: 0, headPitch: 0,
    handX: 0, handSwipeUp: false, handSwipeDown: false,
    bodyLeanX: 0, isSquatting: false, isJumping: false,
    // ZoneControl fields (Stage 2)
    zoneCol: 'C',
    zoneRow: 'mid',
    zoneSource: null,
    // HandZoneControl fields (Stage 3)
    hzCol: 'C',
    hzRow: 'mid',
    hzSource: null,
    // FingerGestureControl fields (Stage 4)
    fgGesture: null,  // 'lane_left' | 'lane_center' | 'lane_right' | 'jump' | 'duck' | null
    fgSource: null,   // 'hand' | null
    // HandSwipeControl fields (Stage 5)
    hsSwipe: null,    // 'left' | 'right' | 'up' | 'down' | null
    hsSwipeId: hsSwipeCounter,
    hsSource: null,   // 'hand' | null
    hsHandPos: null,  // { x, y }
    // Debug
    rawAction: '',
    debugText: '',
    points: []
  };
}

// ---------------------------------------------------------------------------
// LEGACY: processFace (for HeadControl, stage 2 legacy)
// ---------------------------------------------------------------------------
function processFace(bitmap, timestamp) {
  const results = faceLandmarker.detectForVideo(bitmap, timestamp);
  const state = baseState();

  if (results?.faceLandmarks && results.faceLandmarks.length > 0) {
    const landmarks = results.faceLandmarks[0];
    const leftEye  = landmarks[33];
    const rightEye = landmarks[263];
    const nose     = landmarks[1];

    if (leftEye && rightEye && nose) {
      const mirrLeftX  = 1 - leftEye.x;
      const mirrRightX = 1 - rightEye.x;
      const dx = mirrRightX - mirrLeftX;
      const dy = rightEye.y - leftEye.y;
      const angle = Math.atan2(dy, dx);

      state.headRoll = Math.max(-1, Math.min(1, angle / 0.22));

      const eyeCenterY = (leftEye.y + rightEye.y) / 2;
      const pitchRaw   = nose.y - eyeCenterY;

      if (baselinePitch === null) {
        baselinePitch = pitchRaw;
      } else {
        baselinePitch = baselinePitch * 0.992 + pitchRaw * 0.008;
      }

      const pitchDelta = pitchRaw - baselinePitch;
      state.headPitch = Math.max(-1, Math.min(1, pitchDelta * 7.0));

      let action = 'CENTER';
      if (state.headRoll > 0.26)        action = 'RIGHT ▶';
      else if (state.headRoll < -0.26)  action = '◀ LEFT';
      if (state.headPitch < -0.28)      action = '▲ JUMP';
      else if (state.headPitch > 0.28)  action = '▼ SLIDE';
      state.debugText = action;

      state.points = [
        { x: 1 - nose.x,     y: nose.y,     color: '#00e5ff', r: 5 },
        { x: mirrLeftX,      y: leftEye.y,  color: '#00ff88', r: 3 },
        { x: mirrRightX,     y: rightEye.y, color: '#00ff88', r: 3 }
      ];
    }
  } else {
    state.debugText = 'No face detected';
  }
  return state;
}

// ---------------------------------------------------------------------------
// LEGACY: processHands (for HandControl, stage 3 legacy)
// ---------------------------------------------------------------------------
function processHands(bitmap, timestamp) {
  const results = handLandmarker.detectForVideo(bitmap, timestamp);
  const state = baseState();

  if (results?.landmarks && results.landmarks.length > 0) {
    const hand       = results.landmarks[0];
    const wrist      = hand[0];
    const indexTip   = hand[8];
    const middleTip  = hand[12];

    const handCenterX = 1 - ((wrist.x + indexTip.x + middleTip.x) / 3);
    const handCenterY =      (wrist.y + indexTip.y + middleTip.y) / 3;

    state.handX = Math.max(-1, Math.min(1, (handCenterX - 0.5) * 3.2));

    if (prevHandY !== null) {
      const dy = handCenterY - prevHandY;
      handVelocityY = dy * 0.7 + handVelocityY * 0.3;
      state.handSwipeUp   = handVelocityY < -0.05;
      state.handSwipeDown = handVelocityY >  0.05;
    }
    prevHandY = handCenterY;

    let action = 'WRIST: CENTER';
    if (state.handX > 0.28)        action = 'RIGHT ▶';
    else if (state.handX < -0.28)  action = '◀ LEFT';
    if (state.handSwipeUp)         action = '▲ JUMP';
    else if (state.handSwipeDown)  action = '▼ SLIDE';
    state.debugText = action;

    state.points = [
      { x: handCenterX,    y: handCenterY, color: '#ffd700', r: 6 },
      { x: 1 - indexTip.x, y: indexTip.y, color: '#ff6b35', r: 4 }
    ];
  } else {
    state.debugText = 'No hand detected';
  }
  return state;
}

// ---------------------------------------------------------------------------
// LEGACY: processPose (for PoseControl + MixControl legacy)
// ---------------------------------------------------------------------------
function processPose(bitmap, timestamp) {
  const results = poseLandmarker.detectForVideo(bitmap, timestamp);
  const state = baseState();

  if (results?.landmarks && results.landmarks.length > 0) {
    const pose           = results.landmarks[0];
    const leftShoulder   = pose[11];
    const rightShoulder  = pose[12];
    const leftWrist      = pose[15];
    const rightWrist     = pose[16];

    if (leftShoulder && rightShoulder) {
      const torsoX = 1 - ((leftShoulder.x + rightShoulder.x) / 2);
      const torsoY =      (leftShoulder.y + rightShoulder.y) / 2;

      state.bodyLeanX = Math.max(-1, Math.min(1, (torsoX - 0.5) * 3.4));

      if (baselineTorsoY === null) {
        baselineTorsoY = torsoY;
      } else {
        baselineTorsoY = baselineTorsoY * 0.992 + torsoY * 0.008;
      }

      state.isSquatting = (torsoY - baselineTorsoY) > 0.06;

      const handsUp = (leftWrist  && leftWrist.y  < leftShoulder.y)  ||
                      (rightWrist && rightWrist.y  < rightShoulder.y);
      state.isJumping = (torsoY - baselineTorsoY) < -0.05 || handsUp;

      let action = 'POSE: STRAIGHT';
      if (state.bodyLeanX > 0.25)        action = 'RIGHT ▶';
      else if (state.bodyLeanX < -0.25)  action = '◀ LEFT';
      if (state.isJumping)               action = '▲ JUMP';
      else if (state.isSquatting)        action = '▼ SLIDE';
      state.debugText = action;

      state.points = [
        { x: torsoX,               y: torsoY,           color: '#00ff88', r: 6 },
        { x: 1 - leftShoulder.x,   y: leftShoulder.y,  color: '#00e5ff', r: 4 },
        { x: 1 - rightShoulder.x,  y: rightShoulder.y, color: '#00e5ff', r: 4 }
      ];
    }
  } else {
    state.debugText = 'No body detected';
  }
  return state;
}

// ---------------------------------------------------------------------------
// ---------------------------------------------------------------------------
// processZone (for ZoneControl, Stage 2)
// Logic: Face ONLY (nose tracking).
// Grid 3×3 layout with hysteresis-gated zone transitions.
// Tighter thresholds (0.40 / 0.60 for X, 0.35 / 0.72 for Y) for natural head movement.
// ---------------------------------------------------------------------------
function processZone(bitmap, timestamp) {
  const state = baseState();

  if (!faceLandmarker) {
    state.debugText = '⏳ Loading face model...';
    return state;
  }

  const faceResults = faceLandmarker.detectForVideo(bitmap, timestamp);
  if (faceResults?.faceLandmarks && faceResults.faceLandmarks.length > 0) {
    const face = faceResults.faceLandmarks[0];
    const nose = face[1];
    const mx = 1 - nose.x; // mirrored X

    const rawCol = toColZoneFace(nose.x);
    const rawRow = toRowZoneFace(nose.y);

    // Commit zone change only when clearly past threshold + dead-band
    const col = applyColHysteresis(mx, rawCol, zoneHyst.col, 0.40, 0.60);
    const row = applyRowHysteresis(nose.y, rawRow, zoneHyst.row, 0.35, 0.72);
    zoneHyst.col = col;
    zoneHyst.row = row;

    state.zoneCol    = col;
    state.zoneRow    = row;
    state.zoneSource = 'face';

    state.debugText = zoneDebugText(col, row, '👤');
    state.points = [
      { x: mx, y: nose.y, color: '#00e5ff', r: 7 }
    ];
    return state;
  }

  zoneHyst = { col: 'C', row: 'mid' };
  state.zoneSource = null;
  state.debugText  = '👤 Show face in camera';
  return state;
}

// ---------------------------------------------------------------------------
// processHandZone (for HandZoneControl, Stage 3)
// Zone 3×3 using ONLY hand center. No face fallback.
// ---------------------------------------------------------------------------
function processHandZone(bitmap, timestamp) {
  const state = baseState();

  if (!handLandmarker) {
    state.debugText = '⏳ Loading hand model...';
    return state;
  }

  const handResults = handLandmarker.detectForVideo(bitmap, timestamp);
  if (handResults?.landmarks && handResults.landmarks.length > 0) {
    const hand = handResults.landmarks[0];
    const pc = palmCenter(hand);
    const mx = 1 - pc.x; // mirrored X

    const rawCol = toColZone(pc.x);
    const rawRow = toRowZone(pc.y);

    const col = applyColHysteresis(mx, rawCol, hzHyst.col, 0.33, 0.66);
    const row = applyRowHysteresis(pc.y, rawRow, hzHyst.row, 0.33, 0.76);
    hzHyst.col = col;
    hzHyst.row = row;

    state.hzCol    = col;
    state.hzRow    = row;
    state.hzSource = 'hands';

    state.debugText = zoneDebugText(col, row, '✋');
    state.points = [
      { x: mx,             y: pc.y,      color: '#ffd700',             r: 8 },
      { x: 1 - hand[0].x,  y: hand[0].y, color: 'rgba(255,215,0,0.4)', r: 3 },
      { x: 1 - hand[9].x,  y: hand[9].y, color: 'rgba(255,215,0,0.4)', r: 3 }
    ];
  } else {
    hzHyst = { col: 'C', row: 'mid' };
    state.hzSource  = null;
    state.debugText = '✋ Show hand in camera';
  }

  return state;
}

// ---------------------------------------------------------------------------
// processFingerGesture (for FingerGestureControl, Stage 4)
// Finger count + open palm + fist -> game actions.
//
// Landmark indices (MediaPipe HandLandmarker):
//   0 = wrist
//   Thumb:  1(CMC) 2(MCP) 3(IP) 4(tip)
//   Index:  5(MCP) 6(PIP) 7(DIP) 8(tip)
//   Middle: 9(MCP) 10(PIP) 11(DIP) 12(tip)
//   Ring:   13(MCP) 14(PIP) 15(DIP) 16(tip)
//   Pinky:  17(MCP) 18(PIP) 19(DIP) 20(tip)
// ---------------------------------------------------------------------------
function processFingerGesture(bitmap, timestamp) {
  const state = baseState();

  if (!handLandmarker) {
    state.debugText = '⏳ Loading hand model...';
    return state;
  }

  const results = handLandmarker.detectForVideo(bitmap, timestamp);

  if (results?.landmarks && results.landmarks.length > 0) {
    const hand  = results.landmarks[0];
    const wrist = hand[0];

    const thumbTip  = hand[4];  const thumbIP  = hand[3];  const thumbMCP = hand[2];
    const idxTip    = hand[8];  const idxDIP   = hand[7];  const idxPIP   = hand[6];  const idxMCP  = hand[5];
    const midTip    = hand[12]; const midDIP   = hand[11]; const midPIP   = hand[10]; const midMCP  = hand[9];
    const ringTip   = hand[16]; const ringDIP  = hand[15]; const ringPIP  = hand[14]; const ringMCP = hand[13];
    const pinkyTip  = hand[20]; const pinkyDIP = hand[19]; const pinkyPIP = hand[18]; const pinkyMCP = hand[17];

    function dist2D(a, b) {
      const dx = a.x - b.x;
      const dy = a.y - b.y;
      return Math.sqrt(dx * dx + dy * dy);
    }

    const wristToMid = dist2D(wrist, hand[9]);
    const scale = wristToMid + 1e-5;


    // Strict extension check by top-point:
    // 1. Tip must be the topmost point (tip.y strictly above DIP and well above PIP)
    // 2. Finger must be outstretched: distance from tip to MCP knuckle > 0.45 * scale
    // 3. Tip must be further from wrist than PIP
    const isFingerExtended = (tip, dip, pip, mcp) => {
      const isTopPoint = (tip.y < dip.y) && (tip.y < pip.y - 0.015);
      const isOutstretched = dist2D(tip, mcp) > scale * 0.45;
      const isFurtherThanKnuckle = dist2D(tip, wrist) > dist2D(pip, wrist) * 1.05;
      return isTopPoint && isOutstretched && isFurtherThanKnuckle;
    };

    const idxUp   = isFingerExtended(idxTip, idxDIP, idxPIP, idxMCP);
    const midUp   = isFingerExtended(midTip, midDIP, midPIP, midMCP);
    const ringUp  = isFingerExtended(ringTip, ringDIP, ringPIP, ringMCP);
    const pinkyUp = isFingerExtended(pinkyTip, pinkyDIP, pinkyPIP, pinkyMCP);

    // Thumb is extended when spread outward away from the palm/index knuckle
    const thumbUp = dist2D(thumbTip, idxMCP) > scale * 0.48 &&
                    dist2D(thumbTip, wrist) > dist2D(thumbMCP, wrist) * 1.10;

    const extendedCount = (idxUp ? 1 : 0) + (midUp ? 1 : 0) + (ringUp ? 1 : 0) + (pinkyUp ? 1 : 0);

    // Curled check for genuine closed fist:
    // Fingertip is folded down towards the knuckle (tip.y > pip.y - 0.02) and tucked close to palm
    const isFingerCurled = (tip, pip, mcp) => {
      const isFoldedDown = tip.y > pip.y - 0.025;
      const isCloseToKnuckle = dist2D(tip, mcp) < scale * 0.42;
      return isFoldedDown && isCloseToKnuckle;
    };

    const idxCurled   = isFingerCurled(idxTip, idxPIP, idxMCP);
    const midCurled   = isFingerCurled(midTip, midPIP, midMCP);
    const ringCurled  = isFingerCurled(ringTip, ringPIP, ringMCP);
    const pinkyCurled = isFingerCurled(pinkyTip, pinkyPIP, pinkyMCP);

    const isTrueFist = idxCurled && midCurled && ringCurled && pinkyCurled && (extendedCount === 0);

    if (isTrueFist) {
      fgFistFrames++;
    } else {
      fgFistFrames = 0;
    }

    let gesture = null;
    let label = '';

    // 1. Open Palm: ALL 4 main fingers strictly UP -> JUMP (instant priority, eliminates phantom duck before jump)
    if (idxUp && midUp && ringUp && pinkyUp) {
      gesture = 'jump';
      label = '🖐️ PALM: JUMP';
      fgFistFrames = 0;
    }
    // 2. Closed Fist: all 4 fingers confirmed tightly curled for at least 2 consecutive frames -> DUCK / SLIDE
    else if (isTrueFist && fgFistFrames >= 2) {
      gesture = 'duck';
      label = '✊ FIST: SLIDE';
    }
    // 3. Three Fingers: strictly Index + Middle + Ring UP, and Pinky DOWN -> RIGHT LANE (+1)
    else if (idxUp && midUp && ringUp && !pinkyUp) {
      gesture = 'lane_right';
      label = '🤟 3 FINGERS: RIGHT';
    }
    // 4. Two Fingers: strictly Index + Middle UP, and Ring + Pinky DOWN -> CENTER LANE (0)
    else if (idxUp && midUp && !ringUp && !pinkyUp) {
      gesture = 'lane_center';
      label = '✌️ 2 FINGERS: CENTER';
    }
    // 5. One Finger: strictly Index UP, and Middle + Ring + Pinky DOWN -> LEFT LANE (-1)
    else if (idxUp && !midUp && !ringUp && !pinkyUp) {
      gesture = 'lane_left';
      label = '☝️ 1 FINGER: LEFT';
    } else {
      gesture = null;
      label = `✋ Fingers: ${extendedCount}`;
    }

    state.fgGesture = gesture;
    state.fgSource  = 'hand';
    state.debugText = label;

    const pc = palmCenter(hand);
    state.points = [
      { x: 1 - pc.x, y: pc.y, color: '#ff6b35', r: 7 },
      { x: 1 - thumbTip.x, y: thumbTip.y, color: thumbUp ? '#00ff88' : '#666', r: 4 },
      { x: 1 - idxTip.x, y: idxTip.y, color: idxUp ? '#00ff88' : '#666', r: 4 },
      { x: 1 - midTip.x, y: midTip.y, color: midUp ? '#00ff88' : '#666', r: 4 },
      { x: 1 - ringTip.x, y: ringTip.y, color: ringUp ? '#00ff88' : '#666', r: 4 },
      { x: 1 - pinkyTip.x, y: pinkyTip.y, color: pinkyUp ? '#00ff88' : '#666', r: 4 }
    ];
  } else {
    fgFistFrames = 0;
    state.fgSource  = null;
    state.fgGesture = null;
    state.debugText = '✋ Show hand in camera';
  }

  return state;
}

// ---------------------------------------------------------------------------
// processHandSwipe (for HandSwipeControl, Stage 5)
// Air Swipes detection via kinematic displacement & velocity with anti-recoil.
//
// Key design principles:
// - Sliding trajectory buffer (hsTrail) spanning 220ms using 5-point palm centroid.
// - Rejects tracking outliers (> 35% screen displacement within < 40ms).
// - Validates displacement (|Δx| >= 0.12 or |Δy| >= 0.10) and speed (|v| >= 0.70).
// - Enforces axis dominance (|dominant| > 1.35 * |secondary|).
// - Asymmetric cooldown & Recoil Lockout:
//     * Opposite direction on same axis is locked for 400ms (blocks recoil hand pull-back).
//     * Same direction cooldown: 220ms (allows fast double-swipe lane changes).
//     * Orthogonal direction (e.g. left then jump): 180ms (allows fluid combos).
// - Complete trail flush on swipe commit.
// - Increments monotonic hsSwipeCounter for single-event consumption on the main thread.
// ---------------------------------------------------------------------------
function processHandSwipe(bitmap, timestamp) {
  const state = baseState();

  if (!handLandmarker) {
    state.debugText = '⏳ Loading hand model...';
    return state;
  }

  const results = handLandmarker.detectForVideo(bitmap, timestamp);

  if (!(results?.landmarks?.length > 0)) {
    // Hand lost — clear trail after 200ms
    if (hsTrail.length > 0 && timestamp - hsTrail[hsTrail.length - 1].time > 200) {
      hsTrail = [];
    }
    state.hsSource  = null;
    state.hsSwipe   = null;
    state.hsSwipeId = hsSwipeCounter;
    state.debugText = '👋 Show hand in camera';
    return state;
  }

  const hand = results.landmarks[0];
  const pc = palmCenter(hand);
  const handX = 1 - pc.x; // mirrored: 0 = player-left, 1 = player-right
  const handY = pc.y;     // 0 = top, 1 = bottom

  state.hsSource  = 'hand';
  state.hsHandPos = { x: handX, y: handY };

  // Outlier rejection: if hand jumped excessively fast across the frame, ignore
  const lastPoint = hsTrail.length > 0 ? hsTrail[hsTrail.length - 1] : null;
  if (lastPoint) {
    const jumpDt = (timestamp - lastPoint.time) / 1000;
    if (jumpDt > 0 && jumpDt < 0.05) {
      const jumpDist = Math.hypot(handX - lastPoint.x, handY - lastPoint.y);
      if (jumpDist > 0.35) {
        // Glitch or tracking teleport — reset trail to current point
        hsTrail = [{ x: handX, y: handY, time: timestamp }];
      }
    }
  }

  // Push new point
  hsTrail.push({ x: handX, y: handY, time: timestamp });

  // Retain only points within the last 220ms
  while (hsTrail.length > 0 && (timestamp - hsTrail[0].time) > 220) {
    hsTrail.shift();
  }

  let detectedSwipe = null;

  // Evaluate swipe if trail has sufficient duration (>= 60ms) and sample count (>= 3)
  if (hsTrail.length >= 3) {
    const oldest = hsTrail[0];
    const dt = (timestamp - oldest.time) / 1000;

    if (dt >= 0.06 && dt <= 0.25) {
      const dx = handX - oldest.x;
      const dy = handY - oldest.y;
      const vx = dx / dt;
      const vy = dy / dt;

      const absDx = Math.abs(dx);
      const absDy = Math.abs(dy);
      const absVx = Math.abs(vx);
      const absVy = Math.abs(vy);

      // Horizontal swipe check:
      // Minimum distance: 12% of screen width; velocity >= 0.70 screens/sec; X dominates Y by 1.35x
      if (absDx >= 0.12 && absVx >= 0.70 && absDx > absDy * 1.35) {
        detectedSwipe = dx < 0 ? 'left' : 'right';
      }
      // Vertical swipe check:
      // Minimum distance: 10% of screen height; velocity >= 0.65 screens/sec; Y dominates X by 1.35x
      else if (absDy >= 0.10 && absVy >= 0.65 && absDy > absDx * 1.35) {
        detectedSwipe = dy < 0 ? 'up' : 'down'; // dy < 0 is upward motion
      }
    }
  }

  // If a candidate swipe is detected, validate against cooldown and recoil lockout rules
  if (detectedSwipe) {
    const timeSinceLast = timestamp - hsLastSwipeTime;
    let isAllowed = false;

    const isOpposite =
      (hsLastSwipe === 'left'  && detectedSwipe === 'right') ||
      (hsLastSwipe === 'right' && detectedSwipe === 'left')  ||
      (hsLastSwipe === 'up'    && detectedSwipe === 'down')  ||
      (hsLastSwipe === 'down'  && detectedSwipe === 'up');

    const isSame = (hsLastSwipe === detectedSwipe);

    if (isOpposite) {
      // Recoil protection: opposite direction lockout for 400ms
      isAllowed = timeSinceLast >= 400;
    } else if (isSame) {
      // Same direction cooldown: 220ms (allows fast double-swipes across lanes)
      isAllowed = timeSinceLast >= 220;
    } else {
      // Orthogonal direction (e.g. left then up/jump): 180ms for fluid combos
      isAllowed = timeSinceLast >= 180;
    }

    if (isAllowed) {
      hsSwipeCounter++;
      hsLastSwipe = detectedSwipe;
      hsLastSwipeTime = timestamp;
      hsTrail = []; // Flush trail immediately so recoil motion doesn't build up
      hsDebugTimer = 550; // Visual feedback timer for HUD/PIP
      state.hsSwipe = detectedSwipe;
      state.hsSwipeId = hsSwipeCounter;
    } else {
      detectedSwipe = null;
    }
  }

  // Update visual debug timer
  if (hsDebugTimer > 0) {
    hsDebugTimer -= 33;
    const swipeIcons = {
      left:  '👋 SWIPE ◀ LEFT',
      right: '👋 SWIPE RIGHT ▶',
      up:    '👋 SWIPE ▲ JUMP',
      down:  '👋 SWIPE ▼ SLIDE'
    };
    state.debugText = swipeIcons[hsLastSwipe] || '👋 Tracking hand...';
  } else {
    state.debugText = '👋 Wave hand (← → ↑ ↓)';
  }

  state.hsSwipeId = hsSwipeCounter;

  // Palm center and visual landmark points
  state.points = [
    { x: handX, y: handY, color: '#00ff88', r: 8 },
    { x: 1 - hand[0].x, y: hand[0].y, color: 'rgba(0,255,136,0.4)', r: 3 },
    { x: 1 - hand[9].x, y: hand[9].y, color: 'rgba(0,255,136,0.4)', r: 3 }
  ];

  return state;
}
