/**
 * ZoneControl — Stage 2: Face Zone CV 3×3 Grid Control (Face Only).
 *
 * Camera frame is divided into a 3×3 grid.
 * Head / nose position in cell maps to action:
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
 * Tracking source: FACE ONLY (nose landmark with 3×3 grid hysteresis).
 */
import { BaseControl } from './BaseControl.js';

export class ZoneControl extends BaseControl {
  constructor(visionManager) {
    super();
    this.vision = visionManager;

    // Absolute target lane: -1 (L), 0 (C), 1 (R)
    this._desiredLane = 0;

    // Ducking flag (active while zone is bot)
    this._isDucking = false;
  }

  _onEnable() {
    if (this.vision) {
      this.vision.setMode('zone');
      this.vision.initWebcam();
    }
    this._desiredLane = 0;
    this._isDucking = false;
  }

  _onDisable() {
    this._desiredLane = 0;
    this._isDucking = false;
  }

  update(dt) {
    if (!this._enabled || !this.vision || !this.vision.isReady) return;

    const { zoneCol, zoneRow, zoneSource } = this.vision.currentState;

    // No tracking — reset ducking and preserve current lane
    if (!zoneSource) {
      this._isDucking = false;
      return;
    }

    // 1. Absolute lane positioning:
    // Head on left -> runner in left lane (-1)
    // Head in center -> runner in center lane (0)
    // Head on right -> runner in right lane (1)
    if (zoneCol === 'L') {
      this._desiredLane = -1;
    } else if (zoneCol === 'R') {
      this._desiredLane = 1;
    } else {
      this._desiredLane = 0;
    }

    // 2. Absolute ducking: while zone is bot — runner stays down (ducking / sliding)
    this._isDucking = (zoneRow === 'bot');

    // 3. Continuous jump: while zone is top — character jumps repeatedly (bunny-hop)
    if (zoneRow === 'top') {
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
