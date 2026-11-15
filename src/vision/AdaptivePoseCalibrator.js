/**
 * AdaptivePoseCalibrator — One-shot level-start spatial calibration and camera tilt adaptation
 * for computer vision zone controls in InterRun.
 *
 * Designed for rock-solid 3x3 Discrete Zone Control:
 * 1. Horizontal X (Left, Center, Right) is FIXED & ROCK-SOLID (center = 0.50).
 *    Never floats or drifts when running in side lanes, eliminating false cross-lane hops.
 * 2. Vertical Y (Jump, Neutral, Slide) calibrated ONCE at the start of the level/stage:
 *    - Initial Warmup (~15 frames / ~0.5s) measures the player's neutral head height under the current camera tilt angle.
 *    - Once calibrated, the neutral baseline and thresholds are LOCKED for the entire level!
 *    - JUMP: Requires only a comfortable natural head lift (ΔY ~ 0.09 from neutral).
 *      Eliminates impossible reaching for the top bezel.
 *    - SLIDE: When face sits low in frame (laptop tilt), the duck margin dynamically compresses
 *      (ΔY ~ 0.06..0.08) so a gentle nod triggers slide without the face leaving the camera field of view.
 * 3. Deterministic & Predictable:
 *    Zero mid-game drift or floating during active play. Recalibration happens cleanly when entering
 *    a new stage/level, upon run restart, or on explicit user request (e.g. 'C' key).
 */

export const CalibrationState = {
  WARMUP: 'warmup',             // Collecting initial baseline samples at stage start
  CALIBRATING: 'calibrating',   // Calibration in progress
  TRACKING: 'tracking',         // Active zone tracking with locked baseline
  RECENTERING: 'recentering'    // Manual/optional recalibration
};

export class AdaptivePoseCalibrator {
  /**
   * @param {Object} options
   * @param {number} [options.defaultCenterX=0.50] Fixed canonical center X [0..1]
   * @param {number} [options.defaultCenterY=0.52] Canonical neutral Y [0..1]
   * @param {number} [options.leftBoundary=0.40] Left lane boundary threshold
   * @param {number} [options.rightBoundary=0.60] Right lane boundary threshold
   * @param {number} [options.jumpDelta=0.09] Upward displacement to trigger jump (comfortable head nod)
   * @param {number} [options.slideDelta=0.14] Downward displacement to trigger slide in nominal posture
   * @param {number} [options.hysteresisBand=0.035] Dead-band to prevent boundary flicker
   * @param {number} [options.calibrationFrames=15] Frame count for initial level warmup calibration
   * @param {boolean} [options.autoRecenterMidGame=true] Whether to auto-recenter mid-game on sustained posture shift (default true)
   * @param {number} [options.recenterHoldMs=3000] Milliseconds of sustained motionless hold to trigger auto-recenter (default 3000ms = 3.0s)
   * @param {number} [options.driftMaxSpeed=0.08] Maximum motion speed considered stationary
   */
  constructor({
    defaultCenterX = 0.50,
    defaultCenterY = 0.52,
    leftBoundary = 0.40,
    rightBoundary = 0.60,
    jumpDelta = 0.09,
    slideDelta = 0.14,
    hysteresisBand = 0.035,
    calibrationFrames = 15,
    autoRecenterMidGame = true,
    recenterHoldMs = 3000,
    driftMaxSpeed = 0.08
  } = {}) {
    this.defaultCenterX = defaultCenterX;
    this.defaultCenterY = defaultCenterY;
    this.leftBoundary = leftBoundary;
    this.rightBoundary = rightBoundary;
    this.jumpDelta = jumpDelta;
    this.slideDelta = slideDelta;
    this.hysteresisBand = hysteresisBand;
    this.calibrationFrames = calibrationFrames;
    this.autoRecenterMidGame = autoRecenterMidGame;
    this.recenterHoldMs = recenterHoldMs;
    this.driftMaxSpeed = driftMaxSpeed;

    this.reset();
  }

  /**
   * Resets calibrator to clean initial baseline and prepares for one-shot calibration.
   */
  reset() {
    this.state = CalibrationState.WARMUP;
    this.isCalibrated = false;
    // Horizontal center is permanent and fixed at 0.50 for absolute lane steering
    this.centerX = this.defaultCenterX;
    this.centerY = this.defaultCenterY;

    // Locked vertical thresholds (calculated once calibration finishes)
    this.fixedYTop = null;
    this.fixedYBot = null;
    this.fixedDeltaDown = null;

    // Committed hysteresis state
    this.lastCol = 'C';
    this.lastRow = 'mid';

    // Kinematic motion tracking
    this.prevX = null;
    this.prevY = null;
    this.prevTime = 0;

    // Neutral resting pose timer (must be in C + mid to adapt if autoRecenter enabled)
    this.neutralStillnessTimer = 0;

    // Camera angle tilt repositioning detector (for optional mid-game recentering)
    this.shiftCandidateY = null;
    this.shiftStabilityTimer = 0;

    // Diagnostics
    this.warmupFrames = 0;
    this.repositionEvents = 0;
    this.lastWarning = null;
    this.isAsymmetric = false;
  }

  /**
   * Triggers a clean recalibration (e.g. on stage start or manual hotkey).
   */
  recalibrate() {
    this.reset();
  }

  /**
   * Updates calibrator with the current filtered landmark position.
   *
   * @param {number} x Mirrored horizontal coordinate [0..1] (0 = player left, 1 = player right)
   * @param {number} y Normalized vertical coordinate [0..1] (0 = top, 1 = bottom)
   * @param {number} [timestamp=0] Timestamp in ms
   * @returns {Object} Calculated active zone classification and dynamic thresholds
   */
  update(x, y, timestamp = 0) {
    if (typeof x !== 'number' || typeof y !== 'number' || isNaN(x) || isNaN(y)) {
      return this._fallbackState();
    }

    const dt = (this.prevTime > 0 && timestamp > this.prevTime)
      ? Math.min(200, timestamp - this.prevTime)
      : 33;
    this.prevTime = timestamp;

    // 1. KINEMATIC VELOCITY ESTIMATION
    let speed = 0;
    let deltaDist = 0;
    let vx = 0;
    let vy = 0;
    if (this.prevX !== null && this.prevY !== null) {
      const dx = x - this.prevX;
      const dy = y - this.prevY;
      deltaDist = Math.sqrt(dx * dx + dy * dy);
      const dtSec = Math.max(1e-3, dt / 1000);
      speed = (deltaDist / dtSec);
      vx = dx / dtSec;
      vy = dy / dtSec;
    }
    this.prevX = x;
    this.prevY = y;

    // 1.1. LOW-FPS PREDICTIVE LOOKAHEAD (Compensates camera exposure & transmission lag at <= 15 FPS)
    let predX = x;
    let predY = y;
    const isLowFps = dt >= 65; // True for 8-15 FPS webcams

    if (isLowFps && speed > 0.08) {
      // Extrapolate coordinate ~75-90ms ahead based on linear velocity, damped to prevent overshoot
      const lookaheadSec = Math.min(0.09, (dt / 1000) * 0.80);
      predX = Math.max(0.05, Math.min(0.95, x + vx * lookaheadSec));
      predY = Math.max(0.05, Math.min(0.95, y + vy * lookaheadSec));
    }

    // 2. ONE-SHOT WARMUP INITIALIZATION AT LEVEL/STAGE START
    if (!this.isCalibrated) {
      this.warmupFrames++;
      // Exponential moving average towards observed face height under current camera tilt
      const alpha = 0.25;
      this.centerY = (1 - alpha) * this.centerY + alpha * y;

      if (this.warmupFrames >= this.calibrationFrames) {
        this._lockThresholds(this.centerY);
        this.isCalibrated = true;
        this.state = CalibrationState.TRACKING;
      }
    }
    // 3. MID-GAME POSTURE ADAPTATION (Auto-recenters after sustained hold >= recenterHoldMs)
    else if (this.autoRecenterMidGame) {
      const distY = Math.abs(y - this.centerY);
      const isShifted = distY > 0.07 || this.lastRow !== 'mid';

      if (isShifted && speed < this.driftMaxSpeed) {
        if (this.shiftCandidateY === null) {
          this.shiftCandidateY = y;
          this.shiftStabilityTimer = 0;
        } else {
          const shiftDrift = Math.abs(y - this.shiftCandidateY);
          if (shiftDrift < 0.04) {
            this.shiftStabilityTimer += dt;
            if (this.shiftStabilityTimer >= this.recenterHoldMs) {
              this.state = CalibrationState.RECENTERING;
              this.repositionEvents++;
              this.shiftCandidateY = null;
              this.shiftStabilityTimer = 0;
            }
          } else {
            this.shiftCandidateY = y;
            this.shiftStabilityTimer = 0;
          }
        }
      } else {
        this.shiftCandidateY = null;
        this.shiftStabilityTimer = 0;
      }

      if (this.state === CalibrationState.RECENTERING) {
        const fastAlpha = Math.min(1.0, (dt / 1000) * 5.0);
        this.centerY += (y - this.centerY) * fastAlpha;
        if (Math.abs(y - this.centerY) < 0.015) {
          this._lockThresholds(this.centerY);
          this.state = CalibrationState.TRACKING;
        }
      }
    }

    // 4. HORIZONTAL ZONES (WITH DYNAMIC LOW-FPS BOUNDARY TUNING)
    // On low-FPS webcams, slightly compress the center neutral dead-band by 0.02
    // so deliberate sideways motion crosses the lane boundary 1 frame earlier
    const xLeft = isLowFps ? this.leftBoundary + 0.02 : this.leftBoundary;
    const xRight = isLowFps ? this.rightBoundary - 0.02 : this.rightBoundary;
    const effHysteresis = isLowFps
      ? (speed > 0.20 ? 0.008 : Math.max(0.012, this.hysteresisBand * 0.5))
      : this.hysteresisBand;

    // 5. VERTICAL ZONES (WITH DYNAMIC LOW-FPS JUMP SENSITIVITY)
    const jumpD = isLowFps ? Math.max(0.065, this.jumpDelta - 0.015) : this.jumpDelta;
    const yTop = this.fixedYTop !== null 
      ? (isLowFps ? Math.min(this.fixedYTop + 0.012, this.centerY - 0.065) : this.fixedYTop)
      : Math.max(0.06, this.centerY - jumpD);

    const deltaDown = this.fixedDeltaDown !== null ? this.fixedDeltaDown : (this.centerY > 0.55 ? Math.max(0.05, (0.82 - this.centerY) * 0.45) : this.slideDelta);
    const effectiveDeltaDown = isLowFps ? Math.max(0.05, deltaDown - 0.012) : deltaDown;
    const yBot = this.fixedYBot !== null
      ? (isLowFps ? Math.max(this.fixedYBot - 0.012, this.centerY + 0.05) : this.fixedYBot)
      : Math.min(0.88, this.centerY + effectiveDeltaDown);

    // 6. HYSTERESIS CLASSIFICATION USING PREDICTIVE LOOKAHEAD COORDINATES
    // Horizontal (Columns: L, C, R)
    let rawCol = 'C';
    if (predX < xLeft) rawCol = 'L';
    else if (predX > xRight) rawCol = 'R';

    let committedCol = this.lastCol;
    if (rawCol === this.lastCol) {
      committedCol = rawCol;
    } else if (this.lastCol === 'C') {
      if (rawCol === 'L' && predX < xLeft - effHysteresis) committedCol = 'L';
      else if (rawCol === 'R' && predX > xRight + effHysteresis) committedCol = 'R';
    } else if (this.lastCol === 'L') {
      if (predX > xLeft + effHysteresis) committedCol = rawCol;
    } else if (this.lastCol === 'R') {
      if (predX < xRight - effHysteresis) committedCol = rawCol;
    }
    this.lastCol = committedCol;

    // Vertical (Rows: top, mid, bot)
    let rawRow = 'mid';
    if (predY < yTop) rawRow = 'top';
    else if (predY > yBot) rawRow = 'bot';

    // Hysteresis dead-bands
    const hystUp = isLowFps ? 0.012 : 0.020;
    const hystDown = Math.min(isLowFps ? 0.015 : 0.025, deltaDown * 0.25);

    let committedRow = this.lastRow;
    if (rawRow === this.lastRow) {
      committedRow = rawRow;
    } else if (this.lastRow === 'mid') {
      if (rawRow === 'top' && predY < yTop - hystUp) committedRow = 'top';
      else if (rawRow === 'bot' && predY > yBot + hystDown) committedRow = 'bot';
    } else if (this.lastRow === 'top') {
      if (predY > yTop + hystUp) committedRow = rawRow;
    } else if (this.lastRow === 'bot') {
      if (predY < yBot - hystDown) committedRow = rawRow;
    }
    this.lastRow = committedRow;

    return {
      col: committedCol,
      row: committedRow,
      centerX: Number(this.centerX.toFixed(3)),
      centerY: Number(this.centerY.toFixed(3)),
      predX: Number(predX.toFixed(3)),
      predY: Number(predY.toFixed(3)),
      isLowFps,
      xLeft: Number(xLeft.toFixed(3)),
      xRight: Number(xRight.toFixed(3)),
      yTop: Number(yTop.toFixed(3)),
      yBot: Number(yBot.toFixed(3)),
      warning: this.lastWarning,
      isAsymmetric: this.isAsymmetric,
      state: this.state,
      isCalibrated: this.isCalibrated,
      calibrationProgress: Math.min(1.0, this.warmupFrames / this.calibrationFrames),
      repositionEvents: this.repositionEvents,
      deltaDist: Number(deltaDist.toFixed(4)),
      motionSpeed: Number(speed.toFixed(3))
    };
  }

  _lockThresholds(cy) {
    this.centerY = Math.max(0.30, Math.min(0.70, cy));

    // Calculate and lock vertical thresholds once for the entire level
    this.fixedYTop = Math.max(0.06, this.centerY - this.jumpDelta);

    // Slide/Duck with Drop-Out Protection:
    // When camera is tilted so face sits low (centerY > 0.55), available footroom to bottom (0.82) is small.
    // Compress deltaDown once at level start so a gentle nod triggers slide without leaving frame.
    if (this.centerY > 0.55) {
      this.fixedDeltaDown = Math.max(0.05, Math.min(this.slideDelta, (0.82 - this.centerY) * 0.45));
      this.isAsymmetric = true;
    } else {
      this.fixedDeltaDown = this.slideDelta;
      this.isAsymmetric = false;
    }
    this.fixedYBot = Math.min(0.88, this.centerY + this.fixedDeltaDown);

    // Check camera tilt quality at start
    if (this.centerY > 0.66) {
      this.lastWarning = 'tilt_down'; // Face too low, tilt camera downwards/screen forward
    } else if (this.centerY < 0.34) {
      this.lastWarning = 'tilt_up';   // Face too high, tilt camera upwards
    } else {
      this.lastWarning = null;
    }
  }

  _fallbackState() {
    return {
      col: this.lastCol || 'C',
      row: this.lastRow || 'mid',
      centerX: 0.50,
      centerY: Number(this.centerY.toFixed(3)),
      xLeft: this.leftBoundary,
      xRight: this.rightBoundary,
      yTop: Number((this.centerY - this.jumpDelta).toFixed(3)),
      yBot: Number((this.centerY + this.slideDelta).toFixed(3)),
      warning: this.lastWarning,
      isAsymmetric: false,
      state: this.state,
      isCalibrated: this.isCalibrated,
      calibrationProgress: Math.min(1.0, this.warmupFrames / this.calibrationFrames),
      repositionEvents: this.repositionEvents,
      deltaDist: 0,
      motionSpeed: 0
    };
  }
}
