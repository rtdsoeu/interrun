import { BaseControl } from './BaseControl.js';

/**
 * Multimodal Mix mode (legacy).
 * Recognizes head tilt, hand gestures, or body lean.
 */
export class MixControl extends BaseControl {
  constructor(visionManager) {
    super();
    this.vision = visionManager;

    this._laneArmed = true;
    this._jumpArmed = true;
    this._slideArmed = true;
  }

  _onEnable() {
    if (this.vision) {
      this.vision.setMode('mix');
      this.vision.initWebcam();
    }
  }

  _onDisable() {
    this._laneArmed = this._jumpArmed = this._slideArmed = true;
  }

  update(dt) {
    if (!this._enabled || !this.vision || !this.vision.isReady) return;

    const {
      headRoll, headPitch,
      handX, handSwipeUp, handSwipeDown,
      bodyLeanX, isSquatting, isJumping
    } = this.vision.currentState;

    // Combined steering signal: pick signal with largest absolute value
    const candidates = [bodyLeanX, headRoll, handX];
    const steerSignal = candidates.reduce((best, cur) =>
      Math.abs(cur) > Math.abs(best) ? cur : best, 0
    );

    if (Math.abs(steerSignal) > 0.28) {
      if (this._laneArmed) {
        const delta = steerSignal > 0 ? 1 : -1;
        this._push({ laneDelta: delta });
        this._laneArmed = false;
      }
    } else if (Math.abs(steerSignal) < 0.12) {
      this._laneArmed = true;
    }

    // Jump (head pitch up, hand swipe up, or body jump)
    const jumpSignal = (headPitch < -0.28) || handSwipeUp || isJumping;
    if (jumpSignal) {
      if (this._jumpArmed) {
        this._push({ jump: true });
        this._jumpArmed = false;
      }
    } else {
      this._jumpArmed = true;
    }

    // Slide / duck (head pitch down, hand swipe down, or body squat)
    const slideSignal = (headPitch > 0.28) || handSwipeDown || isSquatting;
    if (slideSignal) {
      if (this._slideArmed) {
        this._push({ slide: true });
        this._slideArmed = false;
      }
    } else {
      this._slideArmed = true;
    }
  }
}
