import { BaseControl } from './BaseControl.js';

/**
 * Head Tracking control (legacy).
 * Head movements in front of webcam:
 * - Head roll left / right = lane change
 * - Head pitch up = jump
 * - Head pitch down = slide / duck
 */
export class HeadControl extends BaseControl {
  constructor(visionManager) {
    super();
    this.vision = visionManager;

    // Trigger thresholds
    this.tiltThreshold = 0.26;
    this.pitchUpThreshold = -0.28;
    this.pitchDownThreshold = 0.28;

    this._laneArmed = true;
    this._jumpArmed = true;
    this._slideArmed = true;
  }

  _onEnable() {
    if (this.vision) {
      this.vision.setMode('face');
      this.vision.initWebcam();
    }
  }

  _onDisable() {
    this._laneArmed = this._jumpArmed = this._slideArmed = true;
  }

  update(dt) {
    if (!this._enabled || !this.vision || !this.vision.isReady) return;

    const { headRoll, headPitch } = this.vision.currentState;

    // 1. Lane change by head roll
    if (Math.abs(headRoll) > this.tiltThreshold) {
      if (this._laneArmed) {
        // headRoll > 0 = tilt right -> lane right (+1)
        // headRoll < 0 = tilt left -> lane left (-1)
        const delta = headRoll > 0 ? 1 : -1;
        this._push({ laneDelta: delta });
        this._laneArmed = false;
      }
    } else if (Math.abs(headRoll) < 0.12) {
      // Returning head to center zone re-arms trigger for next maneuver
      this._laneArmed = true;
    }

    // 2. Jump by tilting head up (pitch up)
    if (headPitch < this.pitchUpThreshold) {
      if (this._jumpArmed) {
        this._push({ jump: true });
        this._jumpArmed = false;
      }
    } else if (headPitch > -0.12) {
      this._jumpArmed = true;
    }

    // 3. Duck / slide by tilting head down (pitch down)
    if (headPitch > this.pitchDownThreshold) {
      if (this._slideArmed) {
        this._push({ slide: true });
        this._slideArmed = false;
      }
    } else if (headPitch < 0.12) {
      this._slideArmed = true;
    }
  }
}
