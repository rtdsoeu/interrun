import { BaseControl } from './BaseControl.js';

/**
 * Stage 0 — Keyboard control.
 * WASD / arrow keys / Space.
 */
export class KeyboardControl extends BaseControl {
  constructor() {
    super();
    this._held = new Set();
    this._laneArmed  = true; // flag: lane action can trigger again
    this._jumpArmed  = true;
    this._slideArmed = true;

    this._onKD = (e) => this._keyDown(e);
    this._onKU = (e) => this._keyUp(e);
  }

  _onEnable() {
    window.addEventListener('keydown', this._onKD);
    window.addEventListener('keyup',   this._onKU);
  }

  _onDisable() {
    window.removeEventListener('keydown', this._onKD);
    window.removeEventListener('keyup',   this._onKU);
    this._held.clear();
    this._laneArmed = this._jumpArmed = this._slideArmed = true;
  }

  _keyDown(e) {
    if (this._held.has(e.code)) return; // ignore autorepeat
    this._held.add(e.code);

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
    this._held.delete(e.code);

    // Re-arm after releasing all lane movement keys
    const noLane = !this._held.has('ArrowLeft') && !this._held.has('KeyA') &&
                   !this._held.has('ArrowRight') && !this._held.has('KeyD');
    if (noLane) this._laneArmed = true;

    if (e.code === 'ArrowUp' || e.code === 'KeyW' || e.code === 'Space') this._jumpArmed  = true;
    if (e.code === 'ArrowDown' || e.code === 'KeyS')                      this._slideArmed = true;
  }
}
