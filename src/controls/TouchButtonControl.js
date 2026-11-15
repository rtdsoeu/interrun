/**
 * TouchButtonControl — mobile virtual D-pad (overlay over game).
 *
 * Shown automatically on touch devices or via hud.showTouchButtons().
 * Buttons:
 *   ←  →  — lane change (bottom left)
 *   ↑      — jump (bottom right, primary button)
 *   ↓      — slide / duck (above ↑)
 *
 * Operates via pointerdown on DOM elements and uses semantic CSS classes.
 */
import { BaseControl } from './BaseControl.js';
import { KeyboardControl } from './KeyboardControl.js';

export class TouchButtonControl extends BaseControl {
  constructor() {
    super();
    this._overlay = null;
    this._keyboard = new KeyboardControl();
    this.onButtonPress = null; // callback(idOrCode)
    this._keyboard.onKeyPress = (code) => this.onButtonPress?.(code);
  }

  _onEnable() {
    this._buildOverlay();
    this._keyboard.enable();
  }

  _onDisable() {
    this._keyboard.disable();
    if (this._overlay) {
      this._overlay.remove();
      this._overlay = null;
    }
  }

  update(dt) {
    this._keyboard.update(dt);
  }

  consume() {
    const touch = super.consume();
    const kb = this._keyboard.consume();
    return {
      laneDelta: touch.laneDelta !== 0 ? touch.laneDelta : (kb.laneDelta || 0),
      jump: Boolean(touch.jump || kb.jump),
      slide: Boolean(touch.slide || kb.slide)
    };
  }

  _buildOverlay() {
    if (this._overlay) return;

    this._overlay = document.createElement('div');
    this._overlay.id = 'touch-dpad';

    this._overlay.innerHTML = `
      <div id="dpad-left-group">
        <button id="dpad-left" class="dpad-btn" aria-label="Move Left">◀</button>
        <button id="dpad-right" class="dpad-btn" aria-label="Move Right">▶</button>
      </div>
      <div id="dpad-right-group">
        <button id="dpad-slide" class="dpad-btn dpad-btn-slide" aria-label="Slide">▼</button>
        <button id="dpad-jump" class="dpad-btn dpad-btn-jump" aria-label="Jump">▲</button>
      </div>
    `;

    const target = (typeof document !== 'undefined' ? (document.getElementById('ui-root') || document.body) : null);
    target?.appendChild(this._overlay);

    // Bind action callbacks
    this._bindBtn('dpad-left',  () => this._push({ laneDelta: -1 }));
    this._bindBtn('dpad-right', () => this._push({ laneDelta:  1 }));
    this._bindBtn('dpad-jump',  () => this._push({ jump: true }));
    this._bindBtn('dpad-slide', () => this._push({ slide: true }));
  }

  /** Binds pointerdown and active visual feedback */
  _bindBtn(id, action) {
    const el = document.getElementById(id);
    if (!el) return;

    el.addEventListener('pointerdown', (e) => {
      e.preventDefault();
      if (!this._enabled) return;
      action();
      this.onButtonPress?.(id);
      el.classList.add('active');
    });

    el.addEventListener('pointerup', () => {
      el.classList.remove('active');
    });

    el.addEventListener('pointercancel', () => {
      el.classList.remove('active');
    });
  }
}
