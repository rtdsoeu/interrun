/**
 * HandSwipeControl — Stage 5: Contactless air swipes.
 *
 * Reads swipe events from the vision worker (monotonic hsSwipeId ensures
 * each gesture is consumed exactly once by the 60 FPS game loop).
 *
 * Swipe mapping:
 *   LEFT  → step 1 lane left  (laneDelta: -1)
 *   RIGHT → step 1 lane right (laneDelta: +1)
 *   UP    → jump              (jump: true)
 *   DOWN  → slide / duck      (slide: true)
 *
 * Keyboard and touch swipe fallbacks are handled via FallbackInputLayer
 * so there is no code duplication with KeyboardControl / PointerControl.
 *
 * Vision Worker mode: 'handswipe'
 */
import { BaseControl } from './BaseControl.js';
import { FallbackInputLayer } from './FallbackInputLayer.js';

export class HandSwipeControl extends BaseControl {
  constructor(visionManager) {
    super();
    this._vision  = visionManager;
    this._fallback = new FallbackInputLayer();
    this._lastProcessedSwipeId = 0;
  }

  // ── Delegation proxies ──────────────────────────────────────────────────
  // Expose FallbackInputLayer internals so tests (and potential future debug
  // tooling) can drive keyboard/touch events directly on HandSwipeControl.
  /** @param {KeyboardEvent} e */
  _keyDown(e)       { this._fallback._keyboard._keyDown(e); }
  /** @param {KeyboardEvent} e */
  _keyUp(e)         { this._fallback._keyboard._keyUp(e); }
  /** @param {TouchEvent} e */
  _onTouchStart(e)  { this._fallback._pointer._onTouchStart(e); }
  /** @param {TouchEvent} e */
  _onTouchMove(e)   { this._fallback._pointer._onTouchMove(e); }
  /** @param {TouchEvent} e */
  _onTouchEnd(e)    { this._fallback._pointer._onTouchEnd(e); }
  // ────────────────────────────────────────────────────────────────────────

  _onEnable() {
    if (this._vision) {
      this._vision.setMode('handswipe');
      this._vision.initWebcam();
    }
    this._lastProcessedSwipeId = 0;
    this._fallback.enable();
  }

  _onDisable() {
    this._lastProcessedSwipeId = 0;
    this._fallback.disable();
  }

  update(dt) {
    this._fallback.update(dt);

    if (!this._enabled || !this._vision?.isReady) return;

    const { hsSwipe, hsSwipeId, hsSource } = this._vision.currentState;
    if (!hsSource || !hsSwipe) return;

    // Guard: consume each swipe ID exactly once (worker increments monotonically)
    if (hsSwipeId && hsSwipeId === this._lastProcessedSwipeId) return;
    this._lastProcessedSwipeId = hsSwipeId;

    switch (hsSwipe) {
      case 'left':  this._push({ laneDelta: -1 }); break;
      case 'right': this._push({ laneDelta:  1 }); break;
      case 'up':    this._push({ jump: true });     break;
      case 'down':  this._push({ slide: true });    break;
    }
  }

  consume() {
    // CV swipe takes priority; fallback fills in any unset actions
    return this._fallback.consume(super.consume());
  }
}
