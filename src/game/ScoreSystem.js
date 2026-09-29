/**
 * ScoreSystem — distance, speed, and stage progression tracking:
 * - Supports debug mode stage locking (lockedStage).
 * - When lockedStage !== null, the stage stays constant regardless of distance.
 *
 * Stages:
 *   0 (   0–100m): Keyboard / Touch D-pad
 *   1 ( 100–250m): Touch swipes / Mouse
 *   2 ( 250–500m): Zone CV (hand priority, face fallback) — 3×3 grid
 *   3 ( 500–750m): HandZone (3×3 grid, hand only)
 *   4 ( 750–1050m): FingerGesture (1/2/3 fingers for lane, palm=jump, fist=duck)
 *   5 (1050m+   ): HandSwipe (contactless air swipes left/right/up/down)
 */
export const STAGE_BASE_SPEEDS = [
  11.0, // Stage 0: Keyboard
  12.0, // Stage 1: Pointer / Touch
  10.0, // Stage 2: Zone CV (relaxed speed for 3x3 positioning)
  11.5, // Stage 3: HandZone
  10.5, // Stage 4: FingerGesture (relaxed for finger recognition)
  12.0  // Stage 5: HandSwipe (air swipes)
];

export class ScoreSystem {
  constructor() {
    this.distance    = 0;   // meters
    this.stage       = 0;
    const savedBest = typeof localStorage !== 'undefined' ? localStorage.getItem('interrun_best') : null;
    this.bestScore   = parseInt(savedBest || '0', 10);
    this._alive      = false;

    // Speed configuration: balanced per-stage velocities with smooth transition slowdown
    this.BASE_SPEED       = 9.0;
    this.MAX_SPEED        = 22.0;
    this.STAGE_BASE_SPEEDS = STAGE_BASE_SPEEDS;
    this.TRANSITION_SPEED = 9.0;
    this.speedMultiplier  = 1.0;
    this.isTransitioning  = false;
    this.speed            = this.STAGE_BASE_SPEEDS[0];

    // Stage thresholds (cumulative distance)
    this.STAGE_THRESHOLDS = [0, 100, 250, 500, 750, 1050];
    this.MAX_STAGE     = 5;

    this.onStageChange = null; // callback(newStage)
  }

  setTransitioning(isTrans) {
    this.isTransitioning = isTrans;
  }

  setSpeedMultiplier(multiplier = 1.0) {
    this.speedMultiplier = Math.max(0.2, Math.min(3.0, multiplier));
    if (this._alive && this.speed) {
      const base = this.STAGE_BASE_SPEEDS[this.stage] ?? 11.0;
      this.speed = base * this.speedMultiplier;
    }
  }

  start(initialStage = 0, isLocked = false, speedMultiplier = 1.0) {
    const validStage     = Math.max(0, Math.min(this.MAX_STAGE, initialStage));
    this.distance        = this.STAGE_THRESHOLDS[validStage] || 0;
    this.stage           = validStage;
    this.speedMultiplier = speedMultiplier || 1.0;
    this.speed           = (this.STAGE_BASE_SPEEDS[validStage] || 11.0) * this.speedMultiplier;
    this.isTransitioning = false;
    this.lockedStage     = isLocked ? validStage : null;
    this._alive          = true;
  }

  stop() {
    this._alive = false;
    if (this.distance > this.bestScore) {
      this.bestScore = Math.floor(this.distance);
      if (typeof localStorage !== 'undefined') {
        localStorage.setItem('interrun_best', String(this.bestScore));
      }
    }
  }

  setLockedStage(stageNum) {
    if (stageNum === null || stageNum === undefined) {
      this.lockedStage = null;
    } else {
      const target = Math.max(0, Math.min(this.MAX_STAGE, stageNum));
      this.lockedStage = target;
      this.stage = target;
      if (this.distance < this.STAGE_THRESHOLDS[target]) {
        this.distance = this.STAGE_THRESHOLDS[target];
      }
      if (this.onStageChange) this.onStageChange(target);
    }
  }

  toggleLock() {
    if (this.lockedStage !== null) {
      this.lockedStage = null;
    } else {
      this.lockedStage = this.stage;
    }
    return this.lockedStage !== null;
  }

  update(dt) {
    if (!this._alive) return;

    // Target speed logic: tailored per-stage base speed, slowdown during transition, acceleration only in endless mode
    let targetSpeed = (this.STAGE_BASE_SPEEDS[this.stage] ?? 11.0) * this.speedMultiplier;

    if (this.isTransitioning) {
      targetSpeed = this.TRANSITION_SPEED * this.speedMultiplier;
    } else if (this.stage === this.MAX_STAGE && this.distance > this.STAGE_THRESHOLDS[this.MAX_STAGE]) {
      // Endless mode after passing all 6 stages (1050m+): gradual acceleration for high score challenge
      const endlessMeters = this.distance - this.STAGE_THRESHOLDS[this.MAX_STAGE];
      const accel = Math.min(10.0, endlessMeters * 0.005); // up to +10 m/s over 2000m
      targetSpeed = ((this.STAGE_BASE_SPEEDS[this.MAX_STAGE] || 12.0) + accel) * this.speedMultiplier;
    }

    // Smooth speed interpolation (dt * 2.5 ease)
    this.speed += (targetSpeed - this.speed) * Math.min(1, dt * 2.5);
    this.distance += this.speed * dt;

    // Смена этапа (если не зафиксирован)
    if (this.lockedStage !== null) {
      if (this.stage !== this.lockedStage) {
        this.stage = this.lockedStage;
        if (this.onStageChange) this.onStageChange(this.stage);
      }
    } else {
      // Находим новый этап по пороговым значениям
      let newStage = 0;
      for (let i = this.STAGE_THRESHOLDS.length - 1; i >= 0; i--) {
        if (this.distance >= this.STAGE_THRESHOLDS[i]) {
          newStage = i;
          break;
        }
      }
      newStage = Math.min(newStage, this.MAX_STAGE);

      if (newStage !== this.stage) {
        this.stage = newStage;
        if (this.onStageChange) this.onStageChange(newStage);
      }
    }
  }

  /** Процент прогресса внутри текущего этапа [0..1] */
  get stageProgress() {
    const start = this.STAGE_THRESHOLDS[this.stage] || 0;
    const end   = this.STAGE_THRESHOLDS[this.stage + 1] || (start + 200);
    return Math.min(1, (this.distance - start) / (end - start));
  }

  /** Нормализованная скорость [0..1] */
  get speedNorm() {
    return Math.max(0, Math.min(1, (this.speed - this.BASE_SPEED) / (this.MAX_SPEED - this.BASE_SPEED)));
  }

  get scoreInt() { return Math.floor(this.distance); }

  /** Сложность 0..1 на основе distance */
  get difficulty() {
    return Math.min(1, this.distance / 500);
  }
}
