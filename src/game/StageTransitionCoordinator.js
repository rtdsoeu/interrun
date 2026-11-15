/**
 * StageTransitionCoordinator — Orchestrates smooth transitions between gameplay stages.
 *
 * Responsibilities:
 * - Coordinates transition countdown banner and SVG timer.
 * - Activates safe runway (pausing obstacles) and transition deceleration.
 * - Switches CV models and controls early to eliminate cold start hitches.
 * - Restores regular game speeds and obstacle generation upon completion.
 */
export class StageTransitionCoordinator {
  /**
   * @param {object} params
   * @param {import('./ScoreSystem.js').ScoreSystem} params.scoreSystem
   * @param {import('./ObstacleManager.js').ObstacleManager} params.obstacleManager
   * @param {import('../audio/SoundFx.js').SoundFx} params.soundFx
   * @param {import('../ui/Hud.js').Hud} params.hud
   * @param {(stage: number) => void} params.onApplyStageSwitch
   * @param {(stage: number) => boolean} [params.checkStageReady]
   * @param {(stage: number) => void} [params.onCalibrateAtEnd]
   */
  constructor({ scoreSystem, obstacleManager, soundFx, hud, onApplyStageSwitch, checkStageReady = null, onCalibrateAtEnd = null }) {
    this.scoreSystem = scoreSystem;
    this.obstacleManager = obstacleManager;
    this.soundFx = soundFx;
    this.hud = hud;
    this.onApplyStageSwitch = onApplyStageSwitch;
    this.checkStageReady = checkStageReady;
    this.onCalibrateAtEnd = onCalibrateAtEnd;

    this.duration = 3.5;
    this.timer = 0;
    this.targetStage = null;
    this._isTransitioning = false;
    this._isWaitingForDetection = false;
    this._maxWaitTimer = 0;
    this._hasCalibratedAtEnd = false;
  }

  get isTransitioning() {
    return this._isTransitioning;
  }

  get isWaitingForDetection() {
    return this._isWaitingForDetection;
  }

  /**
   * Begins a smooth stage transition with safe runway and countdown banner.
   * @param {number} newStage
   */
  startTransition(newStage) {
    this._isTransitioning = true;
    this.timer = this.duration;
    this.targetStage = newStage;
    this._isWaitingForDetection = false;
    this._maxWaitTimer = 0;
    this._hasCalibratedAtEnd = false;

    this.scoreSystem.setTransitioning(true);
    this.obstacleManager.setTransitioning(true);
    this.soundFx?.setBgmMode('transition');

    // Switch model & controller immediately so cold start / shader compilation
    // finishes during the safe runway, before obstacles resume.
    if (this.onApplyStageSwitch) {
      this.onApplyStageSwitch(newStage);
    }

    this.hud?.showTransitionCountdown(newStage, this.duration, this.timer, this.scoreSystem.cycle);
  }

  /**
   * Updates transition countdown timer every animation frame.
   * Holds the safe runway before completing until the model confirms detection of landmarks.
   * @param {number} dt
   */
  update(dt) {
    if (!this._isTransitioning) return;

    this.timer -= dt;

    const isReady = this.checkStageReady ? this.checkStageReady(this.targetStage) : true;

    if (!isReady) {
      this._maxWaitTimer += dt;
      // Hold countdown at 0.5s until model confirms detection
      if (this.timer < 0.5) {
        this.timer = 0.5;
        this._isWaitingForDetection = true;
      }
      // Safety timeout after 10s to prevent permanent hang if camera is covered/unplugged
      if (this._maxWaitTimer >= 10.0) {
        this._isWaitingForDetection = false;
        this.completeTransition();
        return;
      }
    } else {
      this._isWaitingForDetection = false;
      // End-of-transition calibration: trigger recalibration in the final 1.0s of runway when ready
      if (this.timer <= 1.0 && !this._hasCalibratedAtEnd) {
        this._hasCalibratedAtEnd = true;
        if (this.onCalibrateAtEnd) {
          this.onCalibrateAtEnd(this.targetStage);
        }
      }
    }

    this.hud?.updateTransitionCountdown(this.timer, this.duration, this._isWaitingForDetection, this.targetStage);

    if (this.timer <= 0 && isReady) {
      this.completeTransition();
    }
  }

  /**
   * Completes transition, restores normal gameplay mode and resuming obstacles.
   */
  completeTransition() {
    this._isTransitioning = false;
    this._isWaitingForDetection = false;
    this._maxWaitTimer = 0;
    this.hud?.hideTransitionCountdown();
    this.obstacleManager.setTransitioning(false);
    this.scoreSystem.setTransitioning(false);
    this.soundFx?.setBgmMode('game');
  }

  /**
   * Cancels transition immediately (used when entering menu or jumping stages in debug).
   */
  cancelTransition() {
    this._isTransitioning = false;
    this._isWaitingForDetection = false;
    this._maxWaitTimer = 0;
    this.hud?.hideTransitionCountdown();
    this.obstacleManager.setTransitioning(false);
    this.scoreSystem.setTransitioning(false);
  }
}
