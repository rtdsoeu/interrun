import { OneEuroFilter2D } from '../OneEuroFilter.js';

export const noseFilter = new OneEuroFilter2D(0.8, 6.0, 1.0);       // Tuned for normalized head motion [0..1]
export const handZoneFilter = new OneEuroFilter2D(1.0, 7.0, 1.0);   // Tuned for normalized 3x3 hand positioning

export const HYSTERESIS_BAND = 0.04; // 4% dead-band around each zone boundary
export let zoneHyst = { col: 'C', row: 'mid' }; // committed state for ZoneControl (Stage 2)
export let hzHyst   = { col: 'C', row: 'mid' }; // committed state for HandZoneControl (Stage 3)

export function resetZoneCalibration() {
  noseFilter.reset();
  handZoneFilter.reset();
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

    const rawCol = toColZoneFace(filteredNose.x);
    const rawRow = toRowZoneFace(filteredNose.y);

    const col = applyColHysteresis(mx, rawCol, zoneHyst.col, 0.40, 0.60);
    const row = applyRowHysteresis(filteredNose.y, rawRow, zoneHyst.row, 0.35, 0.72);
    zoneHyst.col = col;
    zoneHyst.row = row;

    state.zoneCol    = col;
    state.zoneRow    = row;
    state.zoneSource = 'face';

    state.debugText = zoneDebugText(col, row, '👤');
    state.gestureConfidences = {
      face_left: Number(Math.max(0, Math.min(1, (0.45 - mx) / 0.18)).toFixed(3)),
      face_right: Number(Math.max(0, Math.min(1, (mx - 0.55) / 0.18)).toFixed(3)),
      face_center: Number((Math.max(0, Math.min(1, 1 - Math.abs(mx - 0.50) / 0.16)) * Math.max(0, Math.min(1, 1 - Math.abs(filteredNose.y - 0.53) / 0.22))).toFixed(3)),
      face_jump: Number(Math.max(0, Math.min(1, (0.42 - filteredNose.y) / 0.15)).toFixed(3)),
      face_slide: Number(Math.max(0, Math.min(1, (filteredNose.y - 0.65) / 0.15)).toFixed(3))
    };
    state.points = [
      { x: mx, y: filteredNose.y, color: '#00e5ff', r: 7 }
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
    state.gestureConfidences = {
      hand_left: Number(Math.max(0, Math.min(1, (0.40 - mx) / 0.18)).toFixed(3)),
      hand_right: Number(Math.max(0, Math.min(1, (mx - 0.60) / 0.18)).toFixed(3)),
      hand_center: Number((Math.max(0, Math.min(1, 1 - Math.abs(mx - 0.50) / 0.18)) * Math.max(0, Math.min(1, 1 - Math.abs(pc.y - 0.55) / 0.24))).toFixed(3)),
      hand_jump: Number(Math.max(0, Math.min(1, (0.40 - pc.y) / 0.15)).toFixed(3)),
      hand_slide: Number(Math.max(0, Math.min(1, (pc.y - 0.70) / 0.15)).toFixed(3))
    };
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
