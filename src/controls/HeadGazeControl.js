/**
 * HeadGazeControl — Head gaze direction gesture control (legacy).
 *
 * Discrete impulse gestures:
 *   - Turn / gaze LEFT  → step 1 lane left (laneDelta: -1)
 *   - Turn / gaze RIGHT → step 1 lane right (laneDelta: +1)
 *   - Nod DOWN          → slide / duck (slide: true)
 *   - Look UP           → jump (jump: true)
 *
 * Vision Worker mode: 'headgaze'
 */
import { BaseControl } from './BaseControl.js';

export class HeadGazeControl extends BaseControl {
  constructor(visionManager) {
    super();
    this.vision = visionManager;

    this._armed = true;
    this._cooldown = 0;
    this._holdTimer = 0;
    this._lastDir = 'center';
  }

  _onEnable() {
    if (this.vision) {
      this.vision.setMode('headgaze');
      this.vision.initWebcam();
    }
    this._armed = true;
    this._cooldown = 0;
    this._holdTimer = 0;
    this._lastDir = 'center';
  }

  _onDisable() {
    this._armed = true;
    this._cooldown = 0;
    this._holdTimer = 0;
    this._lastDir = 'center';
  }

  update(dt) {
    if (!this._enabled || !this.vision || !this.vision.isReady) return;

    const { gazeDir, gazeSource } = this.vision.currentState;

    // No face tracking — idle
    if (!gazeSource) return;

    if (this._cooldown > 0) {
      this._cooldown -= dt;
    }

    // Returning gaze to center re-arms gesture
    if (gazeDir === 'center') {
      this._armed = true;
      this._holdTimer = 0;
      this._lastDir = 'center';
      return;
    }

    // Initial gesture trigger on deflection from center
    if (this._armed && this._cooldown <= 0) {
      this._triggerGesture(gazeDir);
      this._armed = false;
      this._lastDir = gazeDir;
      this._holdTimer = 0;
      this._cooldown = 0.20; // 200ms debounce
      return;
    }

    // Auto-repeat when maintaining gaze (only for left/right lane switching)
    if (gazeDir === this._lastDir && (gazeDir === 'left' || gazeDir === 'right')) {
      this._holdTimer += dt;
      if (this._holdTimer >= 0.40) {
        this._triggerGesture(gazeDir);
        this._holdTimer = 0;
        this._cooldown = 0.25;
      }
    }
  }

  _triggerGesture(dir) {
    switch (dir) {
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

  /**
   * Return accumulated input commands (laneDelta, jump, slide).
   */
  consume() {
    return super.consume();
  }
}
