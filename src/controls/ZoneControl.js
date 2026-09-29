/**
 * ZoneControl — Stage 2: Face Zone CV 3×3 Grid Control (Face Only).
 *
 * Camera frame is divided into a 3×3 grid.
 * Head / nose position in cell maps to action:
 *
 *  ┌──────┬──────┬──────┐
 *  │  J←  │  J↑  │  J→  │  ← top: jump
 *  ├──────┼──────┼──────┤
 *  │  ←   │ IDLE │  →   │  ← mid: lane change
 *  ├──────┼──────┼──────┤
 *  │  S←  │  S↓  │  S→  │  ← bot: duck / slide
 *  └──────┴──────┴──────┘
 *    L       C       R
 *
 * Tracking source: FACE ONLY (nose landmark with 3×3 grid hysteresis).
 */
import { BaseControl } from './BaseControl.js';

export class ZoneControl extends BaseControl {
  constructor(visionManager) {
    super();
    this.vision = visionManager;

    // Абсолютная целевая полоса: -1 (L), 0 (C), 1 (R)
    this._desiredLane = 0;

    // Флаг приседа (активен пока зона bot)
    this._isDucking = false;
  }

  _onEnable() {
    if (this.vision) {
      this.vision.setMode('zone');
      this.vision.initWebcam();
    }
    this._desiredLane = 0;
    this._isDucking = false;
  }

  _onDisable() {
    this._desiredLane = 0;
    this._isDucking = false;
  }

  update(dt) {
    if (!this._enabled || !this.vision || !this.vision.isReady) return;

    const { zoneCol, zoneRow, zoneSource } = this.vision.currentState;

    // Нет трекинга — сбрасываем присед и сохраняем текущую полосу
    if (!zoneSource) {
      this._isDucking = false;
      return;
    }

    // 1. Абсолютное позиционирование полосы:
    // Голова слева -> бежит в левой полосе (-1)
    // Голова по центру -> бежит по центру (0)
    // Голова справа -> бежит в правой полосе (1)
    if (zoneCol === 'L') {
      this._desiredLane = -1;
    } else if (zoneCol === 'R') {
      this._desiredLane = 1;
    } else {
      this._desiredLane = 0;
    }

    // 2. Абсолютный присед: пока зона bot — бежит внизу (в приседе / подкате)
    this._isDucking = (zoneRow === 'bot');

    // 3. Непрерывный прыжок: пока зона top — персонаж непрерывно прыгает (bunny-hop)
    if (zoneRow === 'top') {
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
