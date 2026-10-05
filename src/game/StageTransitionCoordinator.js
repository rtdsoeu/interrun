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
   * @param {import('./Obstacles.js').ObstacleManager} params.obstacleManager
   * @param {import('../audio/SoundFx.js').SoundFx} params.soundFx
   * @param {import('../ui/HUD.js').HUD} params.hud
   * @param {(stage: number) => void} params.onApplyStageSwitch
   */
  constructor({ scoreSystem, obstacleManager, soundFx, hud, onApplyStageSwitch }) {
    this.scoreSystem = scoreSystem;
    this.obstacleManager = obstacleManager;
    this.soundFx = soundFx;
    this.hud = hud;
    this.onApplyStageSwitch = onApplyStageSwitch;

    this.duration = 3.5;
    this.timer = 0;
    this.targetStage = null;
    this._isTransitioning = false;
  }

  get isTransitioning() {
    return this._isTransitioning;
  }

  /**
   * Begins a smooth stage transition with safe runway and countdown banner.
   * @param {number} newStage
   */
  startTransition(newStage) {
    this._isTransitioning = true;
    this.timer = this.duration;
    this.targetStage = newStage;

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
   * @param {number} dt
   */
  update(dt) {
    if (!this._isTransitioning) return;

    this.timer -= dt;
    this.hud?.updateTransitionCountdown(this.timer, this.duration);

    if (this.timer <= 0) {
      this.completeTransition();
    }
  }

  /**
   * Completes transition, restores normal gameplay mode and resuming obstacles.
   */
  completeTransition() {
    this._isTransitioning = false;
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
    this.hud?.hideTransitionCountdown();
    this.obstacleManager.setTransitioning(false);
    this.scoreSystem.setTransitioning(false);
  }
}
