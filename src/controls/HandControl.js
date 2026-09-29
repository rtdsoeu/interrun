import { BaseControl } from './BaseControl.js';

/**
 * Hand Gestures control (legacy).
 * Hand movements in front of webcam:
 * - Palm shift left / right relative to center = lane change
 * - Fast hand swipe up = jump
 * - Fast hand swipe down = slide / duck
 */
export class HandControl extends BaseControl {
  constructor(visionManager) {
    super();
    this.vision = visionManager;

    this.handThresholdX = 0.28;
    this._laneArmed = true;
    this._jumpArmed = true;
    this._slideArmed = true;
  }

  _onEnable() {
    if (this.vision) {
      this.vision.setMode('hands');
      this.vision.initWebcam();
    }
  }

  _onDisable() {
    this._laneArmed = this._jumpArmed = this._slideArmed = true;
  }

  update(dt) {
    if (!this._enabled || !this.vision || !this.vision.isReady) return;

    const { handX, handSwipeUp, handSwipeDown } = this.vision.currentState;

    // 1. Lane change by hand position
    if (Math.abs(handX) > this.handThresholdX) {
      if (this._laneArmed) {
        const delta = handX > 0 ? 1 : -1;
        this._push({ laneDelta: delta });
        this._laneArmed = false;
      }
    } else if (Math.abs(handX) < 0.12) {
      this._laneArmed = true;
    }

    // 2. Jump by fast swipe up
    if (handSwipeUp) {
      if (this._jumpArmed) {
        this._push({ jump: true });
        this._jumpArmed = false;
      }
    } else {
      this._jumpArmed = true;
    }

    // 3. Duck / slide by fast swipe down
    if (handSwipeDown) {
      if (this._slideArmed) {
        this._push({ slide: true });
        this._slideArmed = false;
      }
    } else {
      this._slideArmed = true;
    }
  }
}
