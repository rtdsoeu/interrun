import { BaseControl } from './BaseControl.js';

/**
 * Stage 1 — Mouse / swipe control (legacy).
 * - Swipe or quick movement left/right = lane change
 * - Click LMB or swipe up = jump
 * - Click RMB or swipe down = slide / duck
 */
export class MouseControl extends BaseControl {
  constructor() {
    super();

    this._startX = 0;
    this._startY = 0;
    this._isDown = false;
    this._swipeTriggered = false;

    this.SWIPE_THRESHOLD_X = 35; // pixels for lane change
    this.SWIPE_THRESHOLD_Y = 40; // pixels for jump/slide

    this._onMouseDown = (e) => this._handleDown(e);
    this._onMouseMove = (e) => this._handleMove(e);
    this._onMouseUp   = (e) => this._handleUp(e);
    this._onContextMenu = (e) => this._handleContextMenu(e);
  }

  _onEnable() {
    window.addEventListener('mousedown', this._onMouseDown);
    window.addEventListener('mousemove', this._onMouseMove);
    window.addEventListener('mouseup',   this._onMouseUp);
    window.addEventListener('contextmenu', this._onContextMenu);
  }

  _onDisable() {
    window.removeEventListener('mousedown', this._onMouseDown);
    window.removeEventListener('mousemove', this._onMouseMove);
    window.removeEventListener('mouseup',   this._onMouseUp);
    window.removeEventListener('contextmenu', this._onContextMenu);
    this._isDown = false;
    this._swipeTriggered = false;
  }

  _handleContextMenu(e) {
    if (!this._enabled) return;
    e.preventDefault();
    // RMB immediately triggers slide
    this._push({ slide: true });
  }

  _handleDown(e) {
    if (e.button === 2) return; // RMB handled in contextmenu
    this._isDown = true;
    this._startX = e.clientX;
    this._startY = e.clientY;
    this._swipeTriggered = false;
  }

  _handleMove(e) {
    if (!this._isDown || this._swipeTriggered) return;

    const dx = e.clientX - this._startX;
    const dy = e.clientY - this._startY;

    // Horizontal swipe
    if (Math.abs(dx) > this.SWIPE_THRESHOLD_X && Math.abs(dx) > Math.abs(dy)) {
      this._push({ laneDelta: dx > 0 ? 1 : -1 });
      this._swipeTriggered = true;
      return;
    }

    // Vertical swipe
    if (Math.abs(dy) > this.SWIPE_THRESHOLD_Y) {
      if (dy < 0) {
        // Up = jump
        this._push({ jump: true });
      } else {
        // Down = slide
        this._push({ slide: true });
      }
      this._swipeTriggered = true;
    }
  }

  _handleUp(e) {
    if (!this._isDown) return;

    // Short click without swipe counts as jump
    const dx = Math.abs(e.clientX - this._startX);
    const dy = Math.abs(e.clientY - this._startY);
    if (!this._swipeTriggered && dx < 10 && dy < 10 && e.button === 0) {
      this._push({ jump: true });
    }

    this._isDown = false;
    this._swipeTriggered = false;
  }
}
