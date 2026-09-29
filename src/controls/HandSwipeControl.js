/**
 * HandSwipeControl — Stage 5: Air Swipes control.
 *
 * Contactless dynamic hand swipes in front of the webcam:
 *   - Swipe LEFT  -> step 1 lane left (laneDelta: -1)
 *   - Swipe RIGHT -> step 1 lane right (laneDelta: 1)
 *   - Swipe UP    -> jump (jump: true)
 *   - Swipe DOWN  -> slide/duck (slide: true)
 *
 * Each swipe event contains a monotonic hsSwipeId from the vision worker,
 * ensuring each detected gesture is consumed exactly once by the game loop.
 *
 * Vision Worker mode: 'handswipe'
 */
import { BaseControl } from './BaseControl.js';

export class HandSwipeControl extends BaseControl {
  constructor(visionManager) {
    super();
    this.vision = visionManager;
    this._lastProcessedSwipeId = 0;
  }

  _onEnable() {
    if (this.vision) {
      this.vision.setMode('handswipe');
      this.vision.initWebcam();
    }
    this._lastProcessedSwipeId = 0;
  }

  _onDisable() {
    this._lastProcessedSwipeId = 0;
  }

  update(_dt) {
    if (!this._enabled || !this.vision || !this.vision.isReady) return;

    const { hsSwipe, hsSwipeId, hsSource } = this.vision.currentState;
    if (!hsSource || !hsSwipe) return;

    // Guard against multi-firing: process each swipe ID once
    if (hsSwipeId && hsSwipeId === this._lastProcessedSwipeId) {
      return;
    }
    this._lastProcessedSwipeId = hsSwipeId;

    switch (hsSwipe) {
      case 'left':
        this._push({ laneDelta: -1 });
        break;
      case 'right':
        this._push({ laneDelta: 1 });
        break;
      case 'up':
        this._push({ jump: true });
        break;
      case 'down':
        this._push({ slide: true });
        break;
    }
  }

  consume() {
    return super.consume();
  }
}
