/**
 * HandSwipeControl — Stage 5: Air Swipes control with fallback composition.
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
 * Employs composition with KeyboardControl for keyboard fallback,
 * while maintaining touch swipe fallback for touch devices.
 *
 * Vision Worker mode: 'handswipe'
 */
import { BaseControl } from './BaseControl.js';
import { KeyboardControl } from './KeyboardControl.js';

export class HandSwipeControl extends BaseControl {
  constructor(visionManager) {
    super();
    this.vision = visionManager;
    this._lastProcessedSwipeId = 0;

    // Delegated keyboard fallback (WASD / Arrows / Space)
    this._keyboardFallback = new KeyboardControl();

    // Touch fallback state
    this._touchStartX = 0;
    this._touchStartY = 0;
    this._touchDown = false;
    this._touchTriggered = false;

    this._onTouchStart = (e) => {
      if (this._isUI(e?.target)) return;
      const t = e?.touches?.[0];
      if (!t) return;
      this._touchStartX = t.clientX;
      this._touchStartY = t.clientY;
      this._touchDown = true;
      this._touchTriggered = false;
    };

    this._onTouchMove = (e) => {
      if (!this._touchDown || this._touchTriggered) return;
      const t = e?.touches?.[0];
      if (!t) return;
      const dx = t.clientX - this._touchStartX;
      const dy = t.clientY - this._touchStartY;
      if (Math.abs(dx) > 30 && Math.abs(dx) > Math.abs(dy)) {
        this._push({ laneDelta: dx > 0 ? 1 : -1 });
        this._touchTriggered = true;
      } else if (Math.abs(dy) > 35) {
        this._push(dy < 0 ? { jump: true } : { slide: true });
        this._touchTriggered = true;
      }
    };

    this._onTouchEnd = () => {
      this._touchDown = false;
      this._touchTriggered = false;
    };
  }

  _isUI(el) {
    if (!el || typeof el.closest !== 'function') return false;
    return !!el.closest('button, a, input, select, [data-no-swipe]');
  }

  _keyDown(e) {
    this._keyboardFallback._keyDown(e);
  }

  _keyUp(e) {
    this._keyboardFallback._keyUp(e);
  }

  _onEnable() {
    if (this.vision) {
      this.vision.setMode('handswipe');
      this.vision.initWebcam();
    }
    this._lastProcessedSwipeId = 0;
    this._keyboardFallback.enable();

    window.addEventListener('touchstart', this._onTouchStart, { passive: true });
    window.addEventListener('touchmove',  this._onTouchMove,  { passive: true });
    window.addEventListener('touchend',   this._onTouchEnd,   { passive: true });
  }

  _onDisable() {
    this._lastProcessedSwipeId = 0;
    this._keyboardFallback.disable();

    window.removeEventListener('touchstart', this._onTouchStart);
    window.removeEventListener('touchmove',  this._onTouchMove);
    window.removeEventListener('touchend',   this._onTouchEnd);
    this._touchDown = false;
    this._touchTriggered = false;
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
    const primary = super.consume();
    const kb = this._keyboardFallback.consume();

    return {
      laneDelta: primary.laneDelta !== 0 ? primary.laneDelta : (kb.laneDelta || 0),
      jump: Boolean(primary.jump || kb.jump),
      slide: Boolean(primary.slide || kb.slide)
    };
  }
}
