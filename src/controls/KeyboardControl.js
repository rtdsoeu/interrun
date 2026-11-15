import { BaseControl } from './BaseControl.js';

/**
 * Stage 0 — Keyboard control.
 * WASD / arrow keys / Space.
 */
export class KeyboardControl extends BaseControl {
  constructor() {
    super();
    this._held = new Set();
    this.onKeyPress = null; // callback(code)

    this._onKD = (e) => this._keyDown(e);
    this._onKU = (e) => this._keyUp(e);
    this._onBlur = () => { this._held.clear(); };
    this._onVis = () => { if (typeof document !== 'undefined' && document.hidden) this._held.clear(); };
  }

  _onEnable() {
    window.addEventListener('keydown', this._onKD);
    window.addEventListener('keyup',   this._onKU);
    window.addEventListener('blur',    this._onBlur);
    window.addEventListener('focus',   this._onBlur);
    if (typeof document !== 'undefined') {
      document.addEventListener('visibilitychange', this._onVis);
    }
  }

  _onDisable() {
    window.removeEventListener('keydown', this._onKD);
    window.removeEventListener('keyup',   this._onKU);
    window.removeEventListener('blur',    this._onBlur);
    window.removeEventListener('focus',   this._onBlur);
    if (typeof document !== 'undefined') {
      document.removeEventListener('visibilitychange', this._onVis);
    }
    this._held.clear();
  }

  _keyDown(e) {
    if (this._held.has(e.code)) return; // ignore OS autorepeat for this key
    this._held.add(e.code);

    let matched = false;
    switch (e.code) {
      case 'ArrowLeft':
      case 'KeyA':
        this._push({ laneDelta: -1 });
        matched = true;
        break;
      case 'ArrowRight':
      case 'KeyD':
        this._push({ laneDelta: 1 });
        matched = true;
        break;
      case 'ArrowUp':
      case 'KeyW':
      case 'Space':
        this._push({ jump: true });
        e.preventDefault();
        matched = true;
        break;
      case 'ArrowDown':
      case 'KeyS':
        this._push({ slide: true });
        e.preventDefault();
        matched = true;
        break;
    }

    if (matched && this._enabled && this.onKeyPress) {
      this.onKeyPress(e.code);
    }
  }

  _keyUp(e) {
    this._held.delete(e.code);
  }
}
