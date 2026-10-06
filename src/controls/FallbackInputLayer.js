/**
 * FallbackInputLayer — composable keyboard + touch swipe fallback for CV-based controls.
 *
 * Designed to be embedded inside high-stage CV controls (Stage 5+) so that when
 * the CV signal is absent (low light, camera blocked), the player can still act
 * via keyboard or touch without code duplication.
 *
 * Usage:
 *   this._fallback = new FallbackInputLayer();
 *   // In _onEnable:  this._fallback.enable();
 *   // In _onDisable: this._fallback.disable();
 *   // In consume():  merge with super.consume() using mergeFallback()
 */
import { KeyboardControl } from './KeyboardControl.js';
import { PointerControl } from './PointerControl.js';

export class FallbackInputLayer {
  constructor() {
    this._keyboard = new KeyboardControl();
    this._pointer  = new PointerControl();
  }

  enable() {
    this._keyboard.enable();
    this._pointer.enable();
  }

  disable() {
    this._keyboard.disable();
    this._pointer.disable();
  }

  update(dt) {
    this._keyboard.update(dt);
    this._pointer.update(dt);
  }

  /**
   * Returns merged fallback input. The caller's primary input takes priority.
   * Only fills in actions not already set by the primary source.
   * @param {{ laneDelta: number, jump: boolean, slide: boolean }} primary
   * @returns {{ laneDelta: number, jump: boolean, slide: boolean }}
   */
  consume(primary) {
    const kb = this._keyboard.consume();
    const pt = this._pointer.consume();

    return {
      laneDelta: primary.laneDelta !== 0 ? primary.laneDelta : (kb.laneDelta || pt.laneDelta || 0),
      jump:      Boolean(primary.jump || kb.jump || pt.jump),
      slide:     Boolean(primary.slide || kb.slide || pt.slide),
    };
  }
}
