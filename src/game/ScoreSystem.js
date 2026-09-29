/**
 * ScoreSystem — distance, speed, and stage progression tracking:
 * - Supports debug mode stage locking (lockedStage).
 * - When lockedStage !== null, the stage stays constant regardless of distance.
 * - Cyclic 6-stage progression (Stages 0..5, then loops back to Stage 0 with higher speed).
 *
 * Stages:
 *   0 (   0–100m): Keyboard / Touch D-pad
 *   1 ( 100–250m): Touch swipes / Mouse
 *   2 ( 250–500m): Zone CV (hand priority, face fallback) — 3×3 grid
 *   3 ( 500–750m): HandZone (3×3 grid, hand only)
 *   4 ( 750–1050m): FingerGesture (1/2/3 fingers for lane, palm=jump, fist=duck)
 *   5 (1050–1350m): HandSwipe (contactless air swipes left/right/up/down)
 *   -> loops back to Stage 0 (1350m+) with increased speed per cycle!
 */
export const STAGE_BASE_SPEEDS = [
  11.0, // Stage 0: Keyboard
  12.0, // Stage 1: Pointer / Touch
  10.0, // Stage 2: Zone CV (relaxed speed for 3x3 positioning)
  11.5, // Stage 3: HandZone
  10.5, // Stage 4: FingerGesture (relaxed for finger recognition)
  12.0  // Stage 5: HandSwipe (air swipes)
];

export const STAGE_THRESHOLDS = [0, 100, 250, 500, 750, 1050];
export const STAGE_CYCLE_LENGTH = 1350; // Total meters per full 6-stage loop (Stage 5 runs 1050–1350m)
export const CYCLE_SPEED_INCREMENT = 1.5; // +1.5 m/s added to all stage speeds each time we loop back to Stage 0

export class ScoreSystem {
  constructor() {
    this.distance    = 0;   // meters
    this.stage       = 0;
    const savedBest = typeof localStorage !== 'undefined' ? localStorage.getItem('interrun_best') : null;
    this.bestScore   = parseInt(savedBest || '0', 10);
    this._alive      = false;

    // Speed configuration: balanced per-stage velocities with smooth transition slowdown
    this.BASE_SPEED           = 9.0;
    this.MAX_SPEED            = 28.0;
    this.STAGE_BASE_SPEEDS    = STAGE_BASE_SPEEDS;
    this.STAGE_CYCLE_LENGTH   = STAGE_CYCLE_LENGTH;
    this.CYCLE_SPEED_INCREMENT = CYCLE_SPEED_INCREMENT;
    this.TRANSITION_SPEED     = 9.0;
    this.speedMultiplier      = 1.0;
    this.isTransitioning      = false;
    this.speed                = this.STAGE_BASE_SPEEDS[0];

    // Stage thresholds (cumulative distance within one cycle)
    this.STAGE_THRESHOLDS = STAGE_THRESHOLDS;
    this.MAX_STAGE     = 5;

    this.onStageChange = null; // callback(newStage)
  }

  /** Current loop / cycle of the game (0 = first loop 0..1350m, 1 = second loop 1350..2700m, ...) */
  get cycle() {
    return (this.lockedStage !== null) ? 0 : Math.floor(this.distance / this.STAGE_CYCLE_LENGTH);
  }

  setTransitioning(isTrans) {
    this.isTransitioning = isTrans;
  }

  setSpeedMultiplier(multiplier = 1.0) {
    this.speedMultiplier = Math.max(0.2, Math.min(3.0, multiplier));
    if (this._alive && this.speed) {
      const base = (this.STAGE_BASE_SPEEDS[this.stage] ?? 11.0) + this.cycle * this.CYCLE_SPEED_INCREMENT;
      this.speed = base * this.speedMultiplier;
    }
  }

  start(initialStage = 0, isLocked = false, speedMultiplier = 1.0) {
    const validStage     = Math.max(0, Math.min(this.MAX_STAGE, initialStage));
    this.distance        = this.STAGE_THRESHOLDS[validStage] || 0;
    this.stage           = validStage;
    this.speedMultiplier = speedMultiplier || 1.0;
    const cycleBonus     = this.cycle * this.CYCLE_SPEED_INCREMENT;
    this.speed           = ((this.STAGE_BASE_SPEEDS[validStage] || 11.0) + cycleBonus) * this.speedMultiplier;
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
      const cycleBase = Math.floor(this.distance / this.STAGE_CYCLE_LENGTH) * this.STAGE_CYCLE_LENGTH;
      const targetDist = cycleBase + this.STAGE_THRESHOLDS[target];
      if (this.distance < targetDist) {
        this.distance = targetDist;
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

    // Target speed logic: tailored per-stage base speed + loop speed increment, slowdown during transition
    const cycle = this.cycle;
    const cycleSpeedBonus = cycle * this.CYCLE_SPEED_INCREMENT;
    const baseSpeed = this.STAGE_BASE_SPEEDS[this.stage] ?? 11.0;
    let targetSpeed = (baseSpeed + cycleSpeedBonus) * this.speedMultiplier;

    if (this.isTransitioning) {
      targetSpeed = (this.TRANSITION_SPEED + cycle * 0.8) * this.speedMultiplier;
    }

    // Smooth speed interpolation (dt * 2.5 ease)
    this.speed += (targetSpeed - this.speed) * Math.min(1, dt * 2.5);
    this.distance += this.speed * dt;

    // Stage progression (if not locked)
    if (this.lockedStage !== null) {
      if (this.stage !== this.lockedStage) {
        this.stage = this.lockedStage;
        if (this.onStageChange) this.onStageChange(this.stage);
      }
    } else {
      // Find new stage within current 6-stage cycle (0..5, then 0)
      const distInCycle = this.distance % this.STAGE_CYCLE_LENGTH;
      let newStage = 0;
      for (let i = this.STAGE_THRESHOLDS.length - 1; i >= 0; i--) {
        if (distInCycle >= this.STAGE_THRESHOLDS[i]) {
          newStage = i;
          break;
        }
      }

      if (newStage !== this.stage) {
        this.stage = newStage;
        if (this.onStageChange) this.onStageChange(newStage);
      }
    }
  }

  /** Progress percentage within current stage [0..1] */
  get stageProgress() {
    const distInCycle = this.distance % this.STAGE_CYCLE_LENGTH;
    const start = this.STAGE_THRESHOLDS[this.stage] || 0;
    const end   = (this.stage < this.MAX_STAGE)
      ? (this.STAGE_THRESHOLDS[this.stage + 1] || (start + 200))
      : this.STAGE_CYCLE_LENGTH;
    return Math.min(1, Math.max(0, (distInCycle - start) / (end - start)));
  }

  /** Normalized speed [0..1] */
  get speedNorm() {
    return Math.max(0, Math.min(1, (this.speed - this.BASE_SPEED) / (this.MAX_SPEED - this.BASE_SPEED)));
  }

  get scoreInt() { return Math.floor(this.distance); }

  /** Difficulty 0..1 based on distance */
  get difficulty() {
    return Math.min(1, this.distance / 500);
  }
}

