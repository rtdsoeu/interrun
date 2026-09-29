/**
 * PointerControl — Этап 1: Управление мышью И тачскрином (touch).
 * Заменяет MouseControl. Поддерживает мобильные устройства нативно.
 *
 * Управление:
 * - Свайп влево/вправо → смена полосы
 * - Свайп вверх → прыжок
 * - Свайп вниз → присед
 * - Короткий тап (без свайпа) → прыжок
 * - ПКМ / двойной тап правой кнопкой → присед
 */
import { BaseControl } from './BaseControl.js';

export class PointerControl extends BaseControl {
  constructor() {
    super();

    this._startX = 0;
    this._startY = 0;
    this._isDown = false;
    this._swipeTriggered = false;

    // Пороги чуть меньше — для пальца комфортнее
    this.SWIPE_THRESHOLD_X = 30;
    this.SWIPE_THRESHOLD_Y = 35;

    // Привязанные обработчики (mouse)
    this._onMouseDown     = (e) => { if (this._isUIElement(e.target)) return; this._handleDown(e.clientX, e.clientY, e.button); };
    this._onMouseMove     = (e) => this._handleMove(e.clientX, e.clientY);
    this._onMouseUp       = (e) => { if (this._isUIElement(e.target)) return; this._handleUp(e.clientX, e.clientY, e.button); };
    this._onContextMenu   = (e) => { e.preventDefault(); if (this._enabled) this._push({ slide: true }); };

    // Привязанные обработчики (touch)
    this._onTouchStart = (e) => {
      if (this._isUIElement(e.target)) return;
      const t = e.touches[0];
      this._handleDown(t.clientX, t.clientY, 0);
    };
    this._onTouchMove = (e) => {
      const t = e.touches[0];
      this._handleMove(t.clientX, t.clientY);
    };
    this._onTouchEnd = (e) => {
      if (this._isUIElement(e.target)) return;
      const t = e.changedTouches[0];
      this._handleUp(t.clientX, t.clientY, 0);
    };
  }

  /** Возвращает true если элемент — интерактивный UI (кнопка, ссылка, инпут) */
  _isUIElement(el) {
    if (!el) return false;
    const tag = el.tagName?.toLowerCase();
    if (tag === 'button' || tag === 'a' || tag === 'input' || tag === 'select') return true;
    // Ищем ближайшего интерактивного предка
    return !!el.closest('button, a, input, [data-no-swipe]');
  }

  _onEnable() {
    window.addEventListener('mousedown',    this._onMouseDown);
    window.addEventListener('mousemove',    this._onMouseMove);
    window.addEventListener('mouseup',      this._onMouseUp);
    window.addEventListener('contextmenu',  this._onContextMenu);
    window.addEventListener('touchstart',   this._onTouchStart, { passive: true });
    window.addEventListener('touchmove',    this._onTouchMove,  { passive: true });
    window.addEventListener('touchend',     this._onTouchEnd,   { passive: true });
  }

  _onDisable() {
    window.removeEventListener('mousedown',   this._onMouseDown);
    window.removeEventListener('mousemove',   this._onMouseMove);
    window.removeEventListener('mouseup',     this._onMouseUp);
    window.removeEventListener('contextmenu', this._onContextMenu);
    window.removeEventListener('touchstart',  this._onTouchStart);
    window.removeEventListener('touchmove',   this._onTouchMove);
    window.removeEventListener('touchend',    this._onTouchEnd);
    this._isDown = false;
    this._swipeTriggered = false;
  }

  _handleDown(x, y, button) {
    if (button === 2) return;
    this._isDown = true;
    this._startX = x;
    this._startY = y;
    this._swipeTriggered = false;
  }

  _handleMove(x, y) {
    if (!this._isDown || this._swipeTriggered) return;

    const dx = x - this._startX;
    const dy = y - this._startY;

    if (Math.abs(dx) > this.SWIPE_THRESHOLD_X && Math.abs(dx) > Math.abs(dy)) {
      this._push({ laneDelta: dx > 0 ? 1 : -1 });
      this._swipeTriggered = true;
      return;
    }

    if (Math.abs(dy) > this.SWIPE_THRESHOLD_Y) {
      this._push(dy < 0 ? { jump: true } : { slide: true });
      this._swipeTriggered = true;
    }
  }

  _handleUp(x, y, button) {
    if (!this._isDown) return;

    const dx = Math.abs(x - this._startX);
    const dy = Math.abs(y - this._startY);

    // Короткий тап без свайпа → прыжок
    if (!this._swipeTriggered && dx < 12 && dy < 12 && button === 0) {
      this._push({ jump: true });
    }

    this._isDown = false;
    this._swipeTriggered = false;
  }
}
