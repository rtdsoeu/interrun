/**
 * HandZoneControl — Этап 3: Зональное CV управление только рукой.
 *
 * Концепция: та же сетка 3×3, что и в ZoneControl (Этап 2),
 * но источник — ТОЛЬКО центр ладони. Без фоллбека на лицо.
 * Если рука не видна — состояние не меняется.
 *
 *  ┌──────┬──────┬──────┐
 *  │  J←  │  J↑  │  J→  │  ← top: прыжок
 *  ├──────┼──────┼──────┤
 *  │  ←   │ IDLE │  →   │  ← mid: смена полосы
 *  ├──────┼──────┼──────┤
 *  │  S←  │  S↓  │  S→  │  ← bot: присед
 *  └──────┴──────┴──────┘
 *    L       C       R
 *
 * Режим Vision Worker: 'handzone'
 */
import { BaseControl } from './BaseControl.js';

export class HandZoneControl extends BaseControl {
  constructor(visionManager) {
    super();
    this.vision = visionManager;

    /** Абсолютная целевая полоса: -1 (L), 0 (C), 1 (R) */
    this._desiredLane = 0;

    /** Флаг приседа (активен пока зона bot) */
    this._isDucking = false;
  }

  _onEnable() {
    if (this.vision) {
      this.vision.setMode('handzone');
      this.vision.initWebcam();
    }
    this._desiredLane = 0;
    this._isDucking = false;
  }

  _onDisable() {
    this._desiredLane = 0;
    this._isDucking = false;
  }

  update(_dt) {
    if (!this._enabled || !this.vision || !this.vision.isReady) return;

    const { hzCol, hzRow, hzSource } = this.vision.currentState;

    // Нет трекинга руки — сбрасываем присед и сохраняем текущую полосу
    if (!hzSource) {
      this._isDucking = false;
      return;
    }

    // 1. Абсолютное позиционирование полосы по X руки
    if (hzCol === 'L') {
      this._desiredLane = -1;
    } else if (hzCol === 'R') {
      this._desiredLane = 1;
    } else {
      this._desiredLane = 0;
    }

    // 2. Абсолютный присед: пока зона bot — бежит в приседе
    this._isDucking = (hzRow === 'bot');

    // 3. Непрерывный прыжок: пока зона top — прыгает
    if (hzRow === 'top') {
      this._push({ jump: true });
    }
  }

  /**
   * Возвращает накопленные команды ввода, включая абсолютную полосу и удержание приседа.
   */
  consume() {
    const res = super.consume();
    res.targetLane = this._desiredLane;
    res.isDucking = this._isDucking;
    return res;
  }
}
