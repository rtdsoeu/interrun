/**
 * GridZoneControl — Reusable 3×3 Grid Computer Vision Control.
 *
 * Divides the camera frame into a 3×3 grid:
 *  ┌──────┬──────┬──────┐
 *  │  J←  │  J↑  │  J→  │  ← top: jump
 *  ├──────┼──────┼──────┤
 *  │  ←   │ IDLE │  →   │  ← mid: lane change
 *  ├──────┼──────┼──────┤
 *  │  S←  │  S↓  │  S→  │  ← bot: duck / slide
 *  └──────┴──────┴──────┘
 *    L       C       R
 *
 * Parameterized by:
 *  - mode: VisionManager mode string ('zone', 'handzone', etc.)
 *  - colKey: currentState column property ('zoneCol', 'hzCol')
 *  - rowKey: currentState row property ('zoneRow', 'hzRow')
 *  - sourceKey: currentState source property ('zoneSource', 'hzSource')
 */
import { BaseControl } from './BaseControl.js';

export class GridZoneControl extends BaseControl {
  /**
   * @param {import('../vision/VisionManager.js').VisionManager} visionManager
   * @param {object} config
   * @param {string} config.mode - Vision mode to activate
   * @param {string} config.colKey - Column key in currentState ('L' | 'C' | 'R')
   * @param {string} config.rowKey - Row key in currentState ('top' | 'mid' | 'bot')
   * @param {string} config.sourceKey - Tracking source key in currentState
   */
  constructor(visionManager, { mode, colKey, rowKey, sourceKey }) {
    super();
    this.vision = visionManager;
    this.config = { mode, colKey, rowKey, sourceKey };

    // Absolute target lane: -1 (L), 0 (C), 1 (R)
    this._desiredLane = 0;

    // Ducking flag (active while zone is bot)
    this._isDucking = false;
  }

  _onEnable() {
    if (this.vision) {
      this.vision.setMode(this.config.mode);
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

    const state = this.vision.currentState;
    const source = state[this.config.sourceKey];

    // No tracking detected — reset ducking and preserve current lane
    if (!source) {
      this._isDucking = false;
      return;
    }

    const col = state[this.config.colKey];
    const row = state[this.config.rowKey];

    // 1. Absolute lane positioning:
    // Left zone (-1), Right zone (+1), Center zone (0)
    if (col === 'L') {
      this._desiredLane = -1;
    } else if (col === 'R') {
      this._desiredLane = 1;
    } else {
      this._desiredLane = 0;
    }

    // 2. Absolute ducking: while zone is bot — runner ducks
    this._isDucking = (row === 'bot');

    // 3. Continuous jump: while zone is top — runner jumps repeatedly
    if (row === 'top') {
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
