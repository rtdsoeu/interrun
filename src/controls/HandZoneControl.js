/**
 * HandZoneControl — Stage 3: Hand-only Zone CV 3×3 Grid Control.
 *
 * Concept: same 3×3 grid as ZoneControl (Stage 2),
 * but source is STRICTLY the center of the palm. No face fallback.
 * If hand is not visible — state is preserved.
 *
 *  ┌──────┬──────┬──────┐
 *  │  J←  │  J↑  │  J→  │  ← top: jump
 *  ├──────┼──────┼──────┤
 *  │  ←   │ IDLE │  →   │  ← mid: lane change
 *  ├──────┼──────┼──────┤
 *  │  S←  │  S↓  │  S→  │  ← bot: duck / slide
 *  └──────┴──────┴──────┘
 *    L       C       R
 *
 * Vision Worker mode: 'handzone'
 */
import { BaseControl } from './BaseControl.js';

export class HandZoneControl extends BaseControl {
  constructor(visionManager) {
    super();
    this.vision = visionManager;

    /** Absolute target lane: -1 (L), 0 (C), 1 (R) */
    this._desiredLane = 0;

    /** Ducking flag (active while zone is bot) */
    this._isDucking = false;
  }

  _onEnable() {
    if (this.vision) {
      this.vision.setMode('handzone');
      this.vision.initWebcam();
    }
    this._desiredLane = 0;
    this._isDucking = false;
  }

  _onDisable() {
    this._desiredLane = 0;
    this._isDucking = false;
  }

  update(_dt) {
    if (!this._enabled || !this.vision || !this.vision.isReady) return;

    const { hzCol, hzRow, hzSource } = this.vision.currentState;

    // No hand tracking — reset ducking and preserve current lane
    if (!hzSource) {
      this._isDucking = false;
      return;
    }

    // 1. Absolute lane positioning by hand X
    if (hzCol === 'L') {
      this._desiredLane = -1;
    } else if (hzCol === 'R') {
      this._desiredLane = 1;
    } else {
      this._desiredLane = 0;
    }

    // 2. Absolute ducking: while zone is bot — runner ducks
    this._isDucking = (hzRow === 'bot');

    // 3. Continuous jump: while zone is top — runner jumps
    if (hzRow === 'top') {
      this._push({ jump: true });
    }
  }

  /**
   * Return accumulated input commands including target lane and ducking hold.
   */
  consume() {
    const res = super.consume();
    res.targetLane = this._desiredLane;
    res.isDucking = this._isDucking;
    return res;
  }
}
