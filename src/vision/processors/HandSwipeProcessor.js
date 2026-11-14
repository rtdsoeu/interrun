import { OneEuroFilter2D } from '../OneEuroFilter.js';
import { palmCenter } from './ZoneProcessor.js';

export const handSwipeFilter = new OneEuroFilter2D(1.2, 8.0, 1.0);  // Tuned for normalized air swipes

export let hsTrail = [];                // [{ x, y, time }] recent palm centroid positions
export let hsLastSwipe = null;          // last committed swipe direction ('left'|'right'|'up'|'down')
export let hsLastSwipeTime = -Infinity; // timestamp of last committed swipe
export let hsSwipeCounter = 0;          // monotonic ID for swipe events
export let hsDebugTimer = 0;            // countdown timer for PIP visual confirmation
export let hsPrevFrameTime = 0;         // previous frame timestamp for delta measurement
export let hsAvgFrameInterval = 33;     // smoothed frame arrival interval in ms (auto-detects low-light FPS)
export let hsLastKnownPos = null;       // { x, y, time, vx, vy } for Exit Flick detection

export function resetSwipeCalibration() {
  handSwipeFilter.reset();
  hsTrail = [];
  hsLastSwipe = null;
  hsLastSwipeTime = -Infinity;
  hsDebugTimer = 0;
  hsPrevFrameTime = 0;
  hsAvgFrameInterval = 33;
  hsLastKnownPos = null;
}

/**
 * Temporal Refractory Gating with deliberate counter-swipe bypass.
 */
export function isSwipePermitted(detectedSwipe, handPos, timestamp, displacement = 0.15, velocity = 0.50) {
  if (!detectedSwipe) return false;

  const isLowFps = hsAvgFrameInterval >= 48;
  const isUltraLowFps = hsAvgFrameInterval >= 80;

  const timeSinceLast = timestamp - hsLastSwipeTime;

  // Global mechanical bounce guard (rapid sensor glitches under 100ms)
  if (timeSinceLast < 100) {
    return false;
  }

  const isOpposite =
    (hsLastSwipe === 'left'  && detectedSwipe === 'right') ||
    (hsLastSwipe === 'right' && detectedSwipe === 'left')  ||
    (hsLastSwipe === 'up'    && detectedSwipe === 'down')  ||
    (hsLastSwipe === 'down'  && detectedSwipe === 'up');

  const isSame = (hsLastSwipe === detectedSwipe);

  // 1. OPPOSITE SWIPE VALIDATION (Temporal Anti-Recoil)
  if (isOpposite) {
    const minTurnaround = isUltraLowFps ? Math.max(220, hsAvgFrameInterval * 2.0)
                        : isLowFps      ? Math.max(200, hsAvgFrameInterval * 2.0)
                        : 240;

    if (timeSinceLast < minTurnaround) {
      const isStrongCounter = (displacement >= 0.16) && (velocity >= 0.65);
      if (!(timeSinceLast >= 140 && isStrongCounter)) {
        return false;
      }
    }
  }
  // 2. SAME DIRECTION SWIPE (Double-Swipe in same direction)
  else if (isSame) {
    const sameCooldown = isUltraLowFps ? Math.max(160, hsAvgFrameInterval * 1.5)
                       : isLowFps      ? Math.max(150, hsAvgFrameInterval * 1.5)
                       : 160;
    if (timeSinceLast < sameCooldown) return false;
  }
  // 3. ORTHOGONAL COMBO (e.g. Left -> Jump, Right -> Slide)
  else {
    const orthoCooldown = isUltraLowFps ? Math.max(110, hsAvgFrameInterval * 1.2)
                        : isLowFps      ? Math.max(100, hsAvgFrameInterval * 1.2)
                        : 110;
    if (timeSinceLast < orthoCooldown) return false;
  }

  return true;
}

/**
 * HandSwipe (Stage 5) — Process Hand Swipe
 */
export function processHandSwipe(bitmap, timestamp, handLandmarker, baseState) {
  const state = baseState();

  if (!handLandmarker) {
    state.debugText = '⏳ Loading hand model...';
    return state;
  }

  // Measure empirical frame arrival delta
  if (hsPrevFrameTime > 0) {
    const rawInterval = timestamp - hsPrevFrameTime;
    if (rawInterval > 5 && rawInterval < 1000) {
      hsAvgFrameInterval = hsAvgFrameInterval * 0.8 + rawInterval * 0.2;
    }
  }
  hsPrevFrameTime = timestamp;

  const isLowFps = hsAvgFrameInterval >= 48;
  const isUltraLowFps = hsAvgFrameInterval >= 80;

  const results = handLandmarker.detectForVideo(bitmap, timestamp);

  // ---------------------------------------------------------------------------
  // HAND LOST BRANCH — Handle Exit Flicks, Motion Blur Dropout, and trail cleanup
  // ---------------------------------------------------------------------------
  if (!(results?.landmarks?.length > 0)) {
    let detectedSwipe = null;

    const maxLostWindow = Math.max(300, hsAvgFrameInterval * 2.8);
    if (hsLastKnownPos && (timestamp - hsLastKnownPos.time) <= maxLostWindow) {
      const p = hsLastKnownPos;
      const minExitVx = isUltraLowFps ? 0.18 : isLowFps ? 0.26 : 0.32;
      const minExitVy = isUltraLowFps ? 0.16 : isLowFps ? 0.24 : 0.32;
      const minEdgeVx = isUltraLowFps ? 0.05 : isLowFps ? 0.08 : 0.10;
      const minEdgeVy = isUltraLowFps ? 0.05 : isLowFps ? 0.08 : 0.10;
      const edgeLeft  = isUltraLowFps ? 0.38 : 0.32;
      const edgeRight = isUltraLowFps ? 0.62 : 0.68;
      const edgeTop   = isUltraLowFps ? 0.36 : 0.30;
      const edgeBot   = isUltraLowFps ? 0.64 : 0.70;

      if (p.vx < -minExitVx || (p.x < edgeLeft && p.vx < -minEdgeVx)) {
        detectedSwipe = 'left';
      } else if (p.vx > minExitVx || (p.x > edgeRight && p.vx > minEdgeVx)) {
        detectedSwipe = 'right';
      } else if (p.vy < -minExitVy || (p.y < edgeTop && p.vy < -minEdgeVy)) {
        detectedSwipe = 'up';
      } else if (p.vy > minExitVy || (p.y > edgeBot && p.vy > minEdgeVy)) {
        detectedSwipe = 'down';
      }
    }

    if (detectedSwipe) {
      if (isSwipePermitted(detectedSwipe, hsLastKnownPos, timestamp)) {
        hsSwipeCounter++;
        hsLastSwipe = detectedSwipe;
        hsLastSwipeTime = timestamp;
        hsTrail.length = 0;
        hsLastKnownPos = null;
        hsDebugTimer = 550;
        state.hsSwipe = detectedSwipe;
        state.hsSwipeId = hsSwipeCounter;
        state.hsSource = 'hand';
        const swipeIcons = {
          left:  '👋 SWIPE ◀ LEFT',
          right: '👋 SWIPE RIGHT ▶',
          up:    '👋 SWIPE ▲ JUMP',
          down:  '👋 SWIPE ▼ SLIDE'
        };
        state.debugText = swipeIcons[detectedSwipe] || '👋 Swipe exit';
        return state;
      }
    }

    const handLostTimeout = Math.min(600, Math.max(250, hsAvgFrameInterval * 3.5));
    if (hsTrail.length > 0 && timestamp - hsTrail[hsTrail.length - 1].time > handLostTimeout) {
      hsTrail.length = 0;
      hsLastKnownPos = null;
    }

    state.hsSource  = null;
    state.hsSwipe   = null;
    state.hsSwipeId = hsSwipeCounter;
    state.debugText = isUltraLowFps ? '⚡ Low light (7-10 FPS): Broad swipes'
                    : isLowFps      ? '👋 Hand lost (Hold steady in light)'
                    : '👋 Show hand in camera';
    return state;
  }

  // ---------------------------------------------------------------------------
  // HAND DETECTED BRANCH
  // ---------------------------------------------------------------------------
  const hand = results.landmarks[0];
  const rawPc = palmCenter(hand);
  const pc = (timestamp && timestamp > 0)
    ? handSwipeFilter.filter(rawPc.x, rawPc.y, timestamp)
    : rawPc;

  const handX = 1 - pc.x; // mirrored: 0 = player-left, 1 = player-right
  const handY = pc.y;     // 0 = top, 1 = bottom

  state.hsSource  = 'hand';
  state.hsHandPos = { x: handX, y: handY };

  // Neutral center reset
  if (handX >= 0.42 && handX <= 0.58 && handY >= 0.38 && handY <= 0.62) {
    if (timestamp - hsLastSwipeTime >= 150) {
      hsLastSwipe = null;
    }
  }

  // Outlier rejection
  const lastPoint = hsTrail.length > 0 ? hsTrail[hsTrail.length - 1] : null;
  if (lastPoint) {
    const jumpDt = (timestamp - lastPoint.time) / 1000;
    if (jumpDt > 0 && jumpDt < 0.05) {
      const jumpDist = Math.hypot(handX - lastPoint.x, handY - lastPoint.y);
      if (jumpDist > 0.35) {
        hsTrail.length = 0;
        hsTrail.push({ x: handX, y: handY, time: timestamp });
      }
    }
  }

  // Push new point and prune old entries
  hsTrail.push({ x: handX, y: handY, time: timestamp });
  const cutoffWindow = Math.min(520, Math.max(220, hsAvgFrameInterval * 3.8));
  const cutoff = timestamp - cutoffWindow;
  let startIdx = 0;
  while (startIdx < hsTrail.length - 1 && hsTrail[startIdx].time < cutoff) {
    startIdx++;
  }
  if (startIdx > 0) {
    hsTrail.splice(0, startIdx);
  }

  let detectedSwipe = null;
  let swipeDisplacement = 0;
  let swipeVelocity = 0;

  // 1. IMMEDIATE STEP-DELTA
  if (!detectedSwipe && hsTrail.length >= 2) {
    const prevPoint = hsTrail[hsTrail.length - 2];
    const stepDt = (timestamp - prevPoint.time) / 1000;
    const maxAllowedStepDt = Math.max(0.35, (hsAvgFrameInterval * 2.5) / 1000);
    if (stepDt > 0.02 && stepDt <= maxAllowedStepDt) {
      const stepDx = handX - prevPoint.x;
      const stepDy = handY - prevPoint.y;
      const stepVx = stepDx / stepDt;
      const stepVy = stepDy / stepDt;

      const absStepDx = Math.abs(stepDx);
      const absStepDy = Math.abs(stepDy);
      const absStepVx = Math.abs(stepVx);
      const absStepVy = Math.abs(stepVy);

      const minStepDx = isUltraLowFps ? 0.08 : isLowFps ? 0.11 : 0.13;
      const minStepDy = isUltraLowFps ? 0.07 : isLowFps ? 0.10 : 0.12;
      const minStepVx = isUltraLowFps ? 0.25 : isLowFps ? 0.38 : 0.52;
      const minStepVy = isUltraLowFps ? 0.22 : isLowFps ? 0.34 : 0.48;
      const domRatio  = isUltraLowFps ? 1.15 : isLowFps ? 1.20 : 1.25;

      if (absStepDx >= minStepDx && absStepVx >= minStepVx && absStepDx > absStepDy * domRatio) {
        detectedSwipe = stepDx < 0 ? 'left' : 'right';
        swipeDisplacement = absStepDx;
        swipeVelocity = absStepVx;
      } else if (absStepDy >= minStepDy && absStepVy >= minStepVy && absStepDy > absStepDx * domRatio) {
        detectedSwipe = stepDy < 0 ? 'up' : 'down';
        swipeDisplacement = absStepDy;
        swipeVelocity = absStepVy;
      }
    }
  }

  // 2. MULTI-SAMPLE SLIDING WINDOW
  if (!detectedSwipe && hsTrail.length >= 2) {
    const oldest = hsTrail[0];
    const dt = (timestamp - oldest.time) / 1000;
    const minDt = Math.max(0.04, (hsAvgFrameInterval * 0.7) / 1000);
    const maxDt = Math.min(0.60, Math.max(0.28, (hsAvgFrameInterval * 3.8) / 1000));

    if (dt >= minDt && dt <= maxDt) {
      const dx = handX - oldest.x;
      const dy = handY - oldest.y;
      const vx = dx / dt;
      const vy = dy / dt;

      const absDx = Math.abs(dx);
      const absDy = Math.abs(dy);
      const absVx = Math.abs(vx);
      const absVy = Math.abs(vy);

      const minDx = isUltraLowFps ? 0.10 : isLowFps ? 0.13 : 0.15;
      const minDy = isUltraLowFps ? 0.08 : isLowFps ? 0.11 : 0.13;
      const minVx = isUltraLowFps ? 0.22 : isLowFps ? 0.32 : 0.44;
      const minVy = isUltraLowFps ? 0.20 : isLowFps ? 0.28 : 0.40;
      const domRatio = isUltraLowFps ? 1.15 : isLowFps ? 1.20 : 1.25;

      if (absDx >= minDx && absVx >= minVx && absDx > absDy * domRatio) {
        detectedSwipe = dx < 0 ? 'left' : 'right';
        swipeDisplacement = absDx;
        swipeVelocity = absVx;
      } else if (absDy >= minDy && absVy >= minVy && absDy > absDx * domRatio) {
        detectedSwipe = dy < 0 ? 'up' : 'down';
        swipeDisplacement = absDy;
        swipeVelocity = absVy;
      }
    }
  }

  // 3. SWIPE VALIDATION
  if (detectedSwipe) {
    const currentPos = { x: handX, y: handY };
    if (isSwipePermitted(detectedSwipe, currentPos, timestamp, swipeDisplacement, swipeVelocity)) {
      hsSwipeCounter++;
      hsLastSwipe = detectedSwipe;
      hsLastSwipeTime = timestamp;
      hsTrail.length = 0;
      hsLastKnownPos = null;
      hsDebugTimer = 550;
      state.hsSwipe = detectedSwipe;
      state.hsSwipeId = hsSwipeCounter;
    } else {
      detectedSwipe = null;
    }
  }

  // Calculate current velocity
  let curVx = 0;
  let curVy = 0;
  if (hsTrail.length >= 2) {
    const pPrev = hsTrail[hsTrail.length - 2];
    const pDt = (timestamp - pPrev.time) / 1000;
    if (pDt > 0.01) {
      curVx = (handX - pPrev.x) / pDt;
      curVy = (handY - pPrev.y) / pDt;
    }
  }
  hsLastKnownPos = { x: handX, y: handY, time: timestamp, vx: curVx, vy: curVy };

  // Resting reset
  if (Math.hypot(curVx, curVy) < 0.22 && (timestamp - hsLastSwipeTime >= 120)) {
    hsLastSwipe = null;
  }

  // Visual debug timer
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
    state.debugText = isLowFps ? '👋 Wave hand (10-15 FPS Low-light)' : '👋 Wave hand (← → ↑ ↓)';
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
