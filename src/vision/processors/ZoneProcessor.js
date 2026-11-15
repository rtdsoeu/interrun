import { OneEuroFilter2D } from '../OneEuroFilter.js';
import { AdaptivePoseCalibrator } from '../AdaptivePoseCalibrator.js';

export const noseFilter = new OneEuroFilter2D(0.8, 6.0, 1.0);       // Tuned for normalized head motion [0..1]
export const handZoneFilter = new OneEuroFilter2D(1.0, 7.0, 1.0);   // Tuned for normalized 3x3 hand positioning

export const faceCalibrator = new AdaptivePoseCalibrator({
  defaultCenterX: 0.50,
  defaultCenterY: 0.52,
  leftBoundary: 0.40,
  rightBoundary: 0.60,
  jumpDelta: 0.09,
  slideDelta: 0.14,
  autoRecenterMidGame: true,
  recenterHoldMs: 3000
});

export const handCalibrator = new AdaptivePoseCalibrator({
  defaultCenterX: 0.50,
  defaultCenterY: 0.55,
  leftBoundary: 0.42,
  rightBoundary: 0.58,
  jumpDelta: 0.10,
  slideDelta: 0.11,
  hysteresisBand: 0.030,
  calibrationFrames: 15,
  autoRecenterMidGame: true,
  recenterHoldMs: 3000
});

export const HYSTERESIS_BAND = 0.04; // 4% dead-band around each zone boundary
export let zoneHyst = { col: 'C', row: 'mid' }; // committed state for ZoneControl (Stage 2)
export let hzHyst   = { col: 'C', row: 'mid' }; // committed state for HandZoneControl (Stage 3)

export function resetZoneCalibration() {
  noseFilter.reset();
  handZoneFilter.reset();
  faceCalibrator.reset();
  handCalibrator.reset();
  zoneHyst = { col: 'C', row: 'mid' };
  hzHyst   = { col: 'C', row: 'mid' };
}

/** 5-point palm centroid (wrist + 4 MCP knuckles) */
export function palmCenter(hand) {
  const pts = [hand[0], hand[5], hand[9], hand[13], hand[17]];
  return {
    x: pts.reduce((s, p) => s + p.x, 0) / pts.length,
    y: pts.reduce((s, p) => s + p.y, 0) / pts.length,
  };
}

/**
 * Returns committed column zone with hysteresis dead-band.
 */
export function applyColHysteresis(mx, rawCol, lastCol, tL, tR) {
  if (rawCol === lastCol) return rawCol;
  if (lastCol === 'C') {
    if (rawCol === 'L' && mx < tL - HYSTERESIS_BAND) return 'L';
    if (rawCol === 'R' && mx > tR + HYSTERESIS_BAND) return 'R';
    return lastCol;
  }
  if (lastCol === 'L' && mx > tL + HYSTERESIS_BAND) return rawCol;
  if (lastCol === 'R' && mx < tR - HYSTERESIS_BAND) return rawCol;
  return lastCol;
}

/**
 * Returns committed row zone with hysteresis dead-band.
 */
export function applyRowHysteresis(y, rawRow, lastRow, tTop, tBot) {
  if (rawRow === lastRow) return rawRow;
  if (lastRow === 'mid') {
    if (rawRow === 'top' && y < tTop - HYSTERESIS_BAND) return 'top';
    if (rawRow === 'bot' && y > tBot + HYSTERESIS_BAND) return 'bot';
    return lastRow;
  }
  if (lastRow === 'top' && y > tTop + HYSTERESIS_BAND) return rawRow;
  if (lastRow === 'bot' && y < tBot - HYSTERESIS_BAND) return rawRow;
  return lastRow;
}

export function zoneDebugText(col, row, prefix = '') {
  const colText = col === 'L' ? '◀ LEFT' : col === 'R' ? 'RIGHT ▶' : '· CENTER';
  const rowText = row === 'top' ? '▲ JUMP' : row === 'bot' ? '▼ SLIDE' : '';
  const parts = [colText, rowText].filter(Boolean).join(' + ');
  return prefix ? `${prefix} ${parts}` : parts;
}

export function toColZone(normX) {
  const x = 1 - normX;
  if (x < 0.33) return 'L';
  if (x > 0.66) return 'R';
  return 'C';
}

export function toColZoneFace(normX) {
  const x = 1 - normX;
  if (x < 0.40) return 'L';
  if (x > 0.60) return 'R';
  return 'C';
}

export function toRowZone(normY) {
  if (normY < 0.33) return 'top';
  if (normY > 0.76) return 'bot';
  return 'mid';
}

export function toRowZoneFace(normY) {
  if (normY < 0.35) return 'top';
  if (normY > 0.72) return 'bot';
  return 'mid';
}

/**
 * processZone (for ZoneControl, Stage 2) — Face ONLY (nose tracking 3x3).
 */
export function processZone(bitmap, timestamp, faceLandmarker, baseState) {
  const state = baseState();

  if (!faceLandmarker) {
    state.debugText = '⏳ Loading face model...';
    return state;
  }

  const faceResults = faceLandmarker.detectForVideo(bitmap, timestamp);
  if (faceResults?.faceLandmarks && faceResults.faceLandmarks.length > 0) {
    const face = faceResults.faceLandmarks[0];
    const rawNose = face[1];
    const filteredNose = (timestamp && timestamp > 0)
      ? noseFilter.filter(rawNose.x, rawNose.y, timestamp)
      : rawNose;
    const mx = 1 - filteredNose.x;

    // Adaptive spatial calibration with camera tilt tracking and edge margin protection
    const calib = faceCalibrator.update(mx, filteredNose.y, timestamp);
    const col = calib.col;
    const row = calib.row;
    zoneHyst.col = col;
    zoneHyst.row = row;

    state.zoneCol    = col;
    state.zoneRow    = row;
    state.zoneSource = 'face';

    // Dynamic thresholds exported for PIP visualization
    state.adaptiveZone = {
      xL: calib.xLeft,
      xR: calib.xRight,
      yT: calib.yTop,
      yB: calib.yBot,
      cx: calib.centerX,
      cy: calib.centerY,
      warning: calib.warning,
      isAsymmetric: calib.isAsymmetric,
      state: calib.state,
      isCalibrated: calib.isCalibrated,
      calibrationProgress: calib.calibrationProgress,
      repositionEvents: calib.repositionEvents
    };

    state.kinematics = {
      source: 'face',
      deltaDist: calib.deltaDist || 0,
      speed: calib.motionSpeed || 0
    };

    let prefix = '👤';
    if (!calib.isCalibrated) {
      prefix = '📐 CALIBRATING';
    } else if (calib.warning === 'tilt_down') {
      prefix = '⚠️ TILT CAM DOWN';
    } else if (calib.warning === 'tilt_up') {
      prefix = '⚠️ TILT CAM UP';
    }

    state.debugText = zoneDebugText(col, row, prefix);

    // Confidences normalized against dynamic thresholds
    const halfW = Math.max(0.08, calib.centerX - calib.xLeft);
    const halfH = Math.max(0.08, calib.centerY - calib.yTop);

    state.gestureConfidences = {
      face_left: Number(Math.max(0, Math.min(1, (calib.xLeft - mx + 0.05) / 0.15)).toFixed(3)),
      face_right: Number(Math.max(0, Math.min(1, (mx - calib.xRight + 0.05) / 0.15)).toFixed(3)),
      face_center: Number((Math.max(0, Math.min(1, 1 - Math.abs(mx - calib.centerX) / halfW)) * Math.max(0, Math.min(1, 1 - Math.abs(filteredNose.y - calib.centerY) / halfH))).toFixed(3)),
      face_jump: Number(Math.max(0, Math.min(1, (calib.yTop - filteredNose.y + 0.05) / 0.15)).toFixed(3)),
      face_slide: Number(Math.max(0, Math.min(1, (filteredNose.y - calib.yBot + 0.05) / 0.15)).toFixed(3))
    };
    state.points = [
      { x: mx, y: filteredNose.y, color: '#00e5ff', r: 7 },
      // Subtle reference point for calibrated center
      { x: calib.centerX, y: calib.centerY, color: 'rgba(0, 229, 255, 0.35)', r: 3 }
    ];
    return state;
  }

  noseFilter.reset();
  zoneHyst = { col: 'C', row: 'mid' };
  state.zoneSource = null;
  state.debugText  = '👤 Show face in camera';
  return state;
}

/**
 * processHandZone (for HandZoneControl, Stage 3) — Hand ONLY (palm center 3x3).
 */
export function processHandZone(bitmap, timestamp, handLandmarker, baseState) {
  const state = baseState();

  if (!handLandmarker) {
    state.debugText = '⏳ Loading hand model...';
    return state;
  }

  const handResults = handLandmarker.detectForVideo(bitmap, timestamp);
  if (handResults?.landmarks && handResults.landmarks.length > 0) {
    const hand = handResults.landmarks[0];
    const rawPc = palmCenter(hand);
    const pc = (timestamp && timestamp > 0)
      ? handZoneFilter.filter(rawPc.x, rawPc.y, timestamp)
      : rawPc;
    const mx = 1 - pc.x;

    // Adaptive spatial calibration for Hand Zone (compact center, ergonomic vertical deltas)
    const calib = handCalibrator.update(mx, pc.y, timestamp);
    const col = calib.col;
    const row = calib.row;
    hzHyst.col = col;
    hzHyst.row = row;

    state.hzCol    = col;
    state.hzRow    = row;
    state.hzSource = 'hands';

    // Dynamic thresholds exported for PIP visualization
    state.adaptiveZone = {
      xL: calib.xLeft,
      xR: calib.xRight,
      yT: calib.yTop,
      yB: calib.yBot,
      cx: calib.centerX,
      cy: calib.centerY,
      warning: calib.warning,
      isAsymmetric: calib.isAsymmetric,
      state: calib.state,
      isCalibrated: calib.isCalibrated,
      calibrationProgress: calib.calibrationProgress,
      repositionEvents: calib.repositionEvents
    };

    state.kinematics = {
      source: 'hands',
      deltaDist: calib.deltaDist || 0,
      speed: calib.motionSpeed || 0
    };

    let prefix = '✋';
    if (!calib.isCalibrated) {
      prefix = '📐 CALIBRATING';
    } else if (calib.warning === 'tilt_down') {
      prefix = '⚠️ RAISE HAND';
    } else if (calib.warning === 'tilt_up') {
      prefix = '⚠️ LOWER HAND';
    }

    state.debugText = zoneDebugText(col, row, prefix);

    // Confidences normalized against calibrated thresholds
    const halfW = Math.max(0.08, calib.centerX - calib.xLeft);
    const halfH = Math.max(0.08, calib.centerY - calib.yTop);

    state.gestureConfidences = {
      hand_left: Number(Math.max(0, Math.min(1, (calib.xLeft - mx + 0.04) / 0.14)).toFixed(3)),
      hand_right: Number(Math.max(0, Math.min(1, (mx - calib.xRight + 0.04) / 0.14)).toFixed(3)),
      hand_center: Number((Math.max(0, Math.min(1, 1 - Math.abs(mx - calib.centerX) / halfW)) * Math.max(0, Math.min(1, 1 - Math.abs(pc.y - calib.centerY) / halfH))).toFixed(3)),
      hand_jump: Number(Math.max(0, Math.min(1, (calib.yTop - pc.y + 0.04) / 0.14)).toFixed(3)),
      hand_slide: Number(Math.max(0, Math.min(1, (pc.y - calib.yBot + 0.04) / 0.14)).toFixed(3))
    };
    state.points = [
      { x: mx,             y: pc.y,      color: '#ffd700',             r: 8 },
      { x: 1 - hand[0].x,  y: hand[0].y, color: 'rgba(255,215,0,0.4)', r: 3 },
      { x: 1 - hand[9].x,  y: hand[9].y, color: 'rgba(255,215,0,0.4)', r: 3 },
      // Reference anchor for calibrated resting hand position
      { x: calib.centerX,  y: calib.centerY, color: 'rgba(255, 215, 0, 0.40)', r: 3 }
    ];
  } else {
    hzHyst = { col: 'C', row: 'mid' };
    state.hzSource  = null;
    state.debugText = '✋ Show hand in camera';
    state.adaptiveZone = {
      xL: handCalibrator.leftBoundary,
      xR: handCalibrator.rightBoundary,
      yT: handCalibrator.fixedYTop || (handCalibrator.centerY - handCalibrator.jumpDelta),
      yB: handCalibrator.fixedYBot || (handCalibrator.centerY + handCalibrator.slideDelta),
      cx: handCalibrator.centerX,
      cy: handCalibrator.centerY,
      warning: handCalibrator.lastWarning,
      isAsymmetric: handCalibrator.isAsymmetric,
      state: handCalibrator.state,
      isCalibrated: handCalibrator.isCalibrated,
      calibrationProgress: Math.min(1.0, handCalibrator.warmupFrames / handCalibrator.calibrationFrames),
      repositionEvents: handCalibrator.repositionEvents
    };
  }

  return state;
}
