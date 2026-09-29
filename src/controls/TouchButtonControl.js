/**
 * TouchButtonControl — mobile virtual D-pad (overlay over game).
 *
 * Shown automatically on touch devices or via hud.showTouchButtons().
 * Buttons:
 *   ←  →  — lane change (bottom left)
 *   ↑      — jump (bottom right, primary button)
 *   ↓      — slide / duck (above ↑)
 *
 * Does not register global window events — operates via onpointerdown on DOM elements.
 */
import { BaseControl } from './BaseControl.js';

export class TouchButtonControl extends BaseControl {
  constructor() {
    super();
    this._overlay = null;
  }

  _onEnable() {
    this._buildOverlay();
  }

  _onDisable() {
    if (this._overlay) {
      this._overlay.remove();
      this._overlay = null;
    }
  }

  _buildOverlay() {
    if (this._overlay) return;

    this._overlay = document.createElement('div');
    this._overlay.id = 'touch-dpad';
    Object.assign(this._overlay.style, {
      position: 'absolute',
      bottom: '0',
      left: '0',
      right: '0',
      height: '160px',
      zIndex: '50',
      pointerEvents: 'none',
      display: 'flex',
      alignItems: 'flex-end',
      justifyContent: 'space-between',
      padding: '0 16px calc(16px + env(safe-area-inset-bottom, 0px))',
      userSelect: 'none'
    });

    this._overlay.innerHTML = `
      <div id="dpad-left-group" style="display:flex; gap:10px; align-items:flex-end;">
        ${this._btn('dpad-left',  '◀', '#00e5ff')}
        ${this._btn('dpad-right', '▶', '#00e5ff')}
      </div>
      <div id="dpad-right-group" style="display:flex; flex-direction:column; gap:8px; align-items:center;">
        ${this._btn('dpad-slide', '▼', '#ff6b35', '56px')}
        ${this._btn('dpad-jump',  '▲', '#00e5ff', '72px')}
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

  /** Generates inline HTML button */
  _btn(id, icon, color, size = '64px') {
    return `
      <button id="${id}" style="
        width:${size}; height:${size};
        background: rgba(0,0,0,0.55);
        border: 2px solid ${color};
        border-radius: 50%;
        color: ${color};
        font-size: ${parseInt(size) * 0.38}px;
        font-weight: 900;
        pointer-events: all;
        cursor: pointer;
        touch-action: manipulation;
        display: flex; align-items: center; justify-content: center;
        box-shadow: 0 0 16px ${color}55;
        transition: background 0.1s, transform 0.08s;
        -webkit-tap-highlight-color: transparent;
      ">${icon}</button>
    `;
  }

  /** Binds pointerdown and visual feedback */
  _bindBtn(id, action) {
    const el = document.getElementById(id);
    if (!el) return;

    el.addEventListener('pointerdown', (e) => {
      e.preventDefault();
      if (!this._enabled) return;
      action();
      el.style.transform = 'scale(0.88)';
      el.style.background = 'rgba(255,255,255,0.12)';
    });

    el.addEventListener('pointerup', () => {
      el.style.transform = 'scale(1)';
      el.style.background = 'rgba(0,0,0,0.55)';
    });

    el.addEventListener('pointercancel', () => {
      el.style.transform = 'scale(1)';
      el.style.background = 'rgba(0,0,0,0.55)';
    });
  }
}
