/**
 * FingerGestureControl — Stage 4: Finger gestures control with kinematic curl prediction.
 *
 * Gesture mapping:
 *   1 finger (index)                        -> left lane (-1)
 *   2 fingers (index + middle)              -> center lane (0)
 *   3 fingers (index + middle + ring)       -> right lane (+1)
 *   Open palm (4-5 fingers extended)        -> JUMP (instant)
 *   Closed fist (all fingers curled)        -> SLIDE / DUCK (instant)
 *
 * Vision Worker mode: 'fingergesture'
 */
import { BaseControl } from './BaseControl.js';

export class FingerGestureControl extends BaseControl {
  constructor(visionManager) {
    super();
    this.vision = visionManager;

    /** Absolute target lane: -1 (L), 0 (C), 1 (R) */
    this._desiredLane = 0;

    /** Fist gesture re-arm latch to prevent continuous slide spam without releasing fist */
    this._fistArmed = true;

    /** Lane stability confirmation buffer */
    this._pendingLaneGesture = null;
    this._pendingLaneTimer = 0;
  }

  _onEnable() {
    if (this.vision) {
      this.vision.setMode('fingergesture');
      this.vision.initWebcam();
    }
    this._desiredLane = 0;
    this._fistArmed = true;
    this._pendingLaneGesture = null;
    this._pendingLaneTimer = 0;
  }

  _onDisable() {
    this._desiredLane = 0;
    this._fistArmed = true;
    this._pendingLaneGesture = null;
    this._pendingLaneTimer = 0;
  }

  update(dt) {
    if (!this._enabled || !this.vision || !this.vision.isReady) return;

    const { fgGesture, fgSource } = this.vision.currentState;

    // No tracking — re-arm fist and reset lane change buffer immediately
    if (!fgSource) {
      this._fistArmed = true;
      this._pendingLaneGesture = null;
      this._pendingLaneTimer = 0;
      return;
    }

    // 1. DUCK / SLIDE (Trigger once per fist clench; requires releasing fist to re-arm)
    if (fgGesture === 'duck') {
      if (this._fistArmed) {
        this._push({ slide: true });
        this._fistArmed = false;
      }
      this._pendingLaneGesture = null;
      this._pendingLaneTimer = 0;
      return;
    }

    // Hand is visible and not in closed fist: re-arm fist action
    this._fistArmed = true;

    // 2. JUMP (INSTANT PRIORITY)
    if (fgGesture === 'jump') {
      this._push({ jump: true });
      this._pendingLaneGesture = null;
      this._pendingLaneTimer = 0;
      return;
    }

    // 3. LANE SWITCHES (requires ~80ms stability confirmation
    // so transitioning curled fingers do not cause false lane shifts)
    if (fgGesture === 'lane_left' || fgGesture === 'lane_center' || fgGesture === 'lane_right') {
      if (this._pendingLaneGesture === fgGesture) {
        this._pendingLaneTimer += dt;
        if (this._pendingLaneTimer >= 0.08) {
          if (fgGesture === 'lane_left')   this._desiredLane = -1;
          if (fgGesture === 'lane_center') this._desiredLane = 0;
          if (fgGesture === 'lane_right')  this._desiredLane = 1;
        }
      } else {
        this._pendingLaneGesture = fgGesture;
        this._pendingLaneTimer = 0;
      }
    } else {
      this._pendingLaneGesture = null;
      this._pendingLaneTimer = 0;
    }
  }

  /**
   * Return accumulated input commands including target lane.
   */
  consume() {
    const res = super.consume();
    res.targetLane = this._desiredLane;
    res.isDucking = false;
    return res;
  }
}
