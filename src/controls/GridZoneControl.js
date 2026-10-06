/**
 * GridZoneControl — shared 3×3 grid implementation for zone-based CV controls.
 *
 * Stage 2 (ZoneControl) and Stage 3 (HandZoneControl) are identical in logic;
 * they differ only in the CV mode name and the currentState keys they read.
 * This class is parameterized with a config object so the algorithm lives once.
 *
 * Grid layout:
 *  ┌──────┬──────┬──────┐
 *  │  J←  │  J↑  │  J→  │  ← top row:  jump
 *  ├──────┼──────┼──────┤
 *  │  ←   │ IDLE │  →   │  ← mid row:  lane change
 *  ├──────┼──────┼──────┤
 *  │  S←  │  S↓  │  S→  │  ← bot row:  duck / slide
 *  └──────┴──────┴──────┘
 *    L       C       R
 *
 * Do not instantiate directly — use the ZoneControl / HandZoneControl factories.
 */
import { BaseControl } from './BaseControl.js';

export class GridZoneControl extends BaseControl {
  /**
   * @param {import('../vision/VisionManager.js').VisionManager} visionManager
   * @param {object} cfg
   * @param {string} cfg.mode      - CV worker mode: 'zone' | 'handzone'
   * @param {string} cfg.colKey    - currentState key for column: 'zoneCol' | 'hzCol'
   * @param {string} cfg.rowKey    - currentState key for row:    'zoneRow' | 'hzRow'
   * @param {string} cfg.sourceKey - currentState key for source: 'zoneSource' | 'hzSource'
   */
  constructor(visionManager, { mode, colKey, rowKey, sourceKey }) {
    super();
    this._vision    = visionManager;
    this._mode      = mode;
    this._colKey    = colKey;
    this._rowKey    = rowKey;
    this._sourceKey = sourceKey;

    /** @type {-1|0|1} Absolute target lane */
    this._desiredLane = 0;
    /** Whether the duck posture should be held this frame */
    this._isDucking = false;
  }

  _onEnable() {
    if (this._vision) {
      this._vision.setMode(this._mode);
      this._vision.initWebcam();
    }
    this._desiredLane = 0;
    this._isDucking   = false;
  }

  _onDisable() {
    this._desiredLane = 0;
    this._isDucking   = false;
  }

  update(_dt) {
    if (!this._enabled || !this._vision?.isReady) return;

    const state  = this._vision.currentState;
    const col    = state[this._colKey];
    const row    = state[this._rowKey];
    const source = state[this._sourceKey];

    // No tracking signal — release duck, preserve current lane
    if (!source) {
      this._isDucking = false;
      return;
    }

    // Absolute lane driven by column zone
    if      (col === 'L') this._desiredLane = -1;
    else if (col === 'R') this._desiredLane =  1;
    else                  this._desiredLane =  0;

    // Duck is a held state, not an impulse — active as long as zone is bottom
    this._isDucking = (row === 'bot');

    // Jump is a repeated impulse while zone is top (bunny-hop)
    if (row === 'top') this._push({ jump: true });
  }

  consume() {
    const result = super.consume();
    result.targetLane = this._desiredLane;
    result.isDucking  = this._isDucking;
    return result;
  }
}
