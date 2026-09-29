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

    // Fallback keyboard controls for low-light emergency backup
    this._heldKeys = new Set();
    this._laneArmed = true;
    this._jumpArmed = true;
    this._slideArmed = true;
    this._onKD = (e) => this._keyDown(e);
    this._onKU = (e) => this._keyUp(e);

    // Fallback touch controls
    this._touchStartX = 0;
    this._touchStartY = 0;
    this._touchDown = false;
    this._touchTriggered = false;
    this._onTouchStart = (e) => {
      if (this._isUI(e.target)) return;
      const t = e.touches[0];
      this._touchStartX = t.clientX;
      this._touchStartY = t.clientY;
      this._touchDown = true;
      this._touchTriggered = false;
    };
    this._onTouchMove = (e) => {
      if (!this._touchDown || this._touchTriggered) return;
      const t = e.touches[0];
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

  _onEnable() {
    if (this.vision) {
      this.vision.setMode('handswipe');
      this.vision.initWebcam();
    }
    this._lastProcessedSwipeId = 0;
    window.addEventListener('keydown', this._onKD);
    window.addEventListener('keyup',   this._onKU);
    window.addEventListener('touchstart', this._onTouchStart, { passive: true });
    window.addEventListener('touchmove',  this._onTouchMove,  { passive: true });
    window.addEventListener('touchend',   this._onTouchEnd,   { passive: true });
  }

  _onDisable() {
    this._lastProcessedSwipeId = 0;
    window.removeEventListener('keydown', this._onKD);
    window.removeEventListener('keyup',   this._onKU);
    window.removeEventListener('touchstart', this._onTouchStart);
    window.removeEventListener('touchmove',  this._onTouchMove);
    window.removeEventListener('touchend',   this._onTouchEnd);
    this._heldKeys.clear();
    this._laneArmed = this._jumpArmed = this._slideArmed = true;
    this._touchDown = false;
  }

  _keyDown(e) {
    if (this._heldKeys.has(e.code)) return;
    this._heldKeys.add(e.code);

    switch (e.code) {
      case 'ArrowLeft':
      case 'KeyA':
        if (this._laneArmed) { this._push({ laneDelta: -1 }); this._laneArmed = false; }
        break;
      case 'ArrowRight':
      case 'KeyD':
        if (this._laneArmed) { this._push({ laneDelta: 1 }); this._laneArmed = false; }
        break;
      case 'ArrowUp':
      case 'KeyW':
      case 'Space':
        if (this._jumpArmed) { this._push({ jump: true }); this._jumpArmed = false; }
        e.preventDefault();
        break;
      case 'ArrowDown':
      case 'KeyS':
        if (this._slideArmed) { this._push({ slide: true }); this._slideArmed = false; }
        e.preventDefault();
        break;
    }
  }

  _keyUp(e) {
    this._heldKeys.delete(e.code);
    const noLane = !this._heldKeys.has('ArrowLeft') && !this._heldKeys.has('KeyA') &&
                   !this._heldKeys.has('ArrowRight') && !this._heldKeys.has('KeyD');
    if (noLane) this._laneArmed = true;
    if (e.code === 'ArrowUp' || e.code === 'KeyW' || e.code === 'Space') this._jumpArmed  = true;
    if (e.code === 'ArrowDown' || e.code === 'KeyS')                      this._slideArmed = true;
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
