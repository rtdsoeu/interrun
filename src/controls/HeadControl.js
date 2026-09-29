import { BaseControl } from './BaseControl.js';

/**
 * Этап 2 (200-300м): Управление головой (Head Tracking через Computer Vision).
 * Клавиатура ПОЛНОСТЬЮ ОТКЛЮЧЕНА!
 * Управление только движениями головы перед вебкамерой:
 * - Наклон головы влево / вправо (roll) = смена полосы
 * - Наклон головы вверх (pitch up) = прыжок
 * - Наклон головы вниз (pitch down) = присед
 */
export class HeadControl extends BaseControl {
  constructor(visionManager) {
    super();
    this.vision = visionManager;

    // Пороги срабатывания (комфортные значения без напряжения шеи)
    this.tiltThreshold = 0.26;
    this.pitchUpThreshold = -0.28;
    this.pitchDownThreshold = 0.28;

    this._laneArmed = true;
    this._jumpArmed = true;
    this._slideArmed = true;
  }

  _onEnable() {
    if (this.vision) {
      this.vision.setMode('face');
      this.vision.initWebcam();
    }
  }

  _onDisable() {
    this._laneArmed = this._jumpArmed = this._slideArmed = true;
  }

  update(dt) {
    if (!this._enabled || !this.vision || !this.vision.isReady) return;

    const { headRoll, headPitch } = this.vision.currentState;

    // 1. Смена полосы по наклону головы (roll)
    if (Math.abs(headRoll) > this.tiltThreshold) {
      if (this._laneArmed) {
        // headRoll > 0 = наклон вправо -> смена вправо (+1)
        // headRoll < 0 = наклон влево -> смена влево (-1)
        const delta = headRoll > 0 ? 1 : -1;
        this._push({ laneDelta: delta });
        this._laneArmed = false;
      }
    } else if (Math.abs(headRoll) < 0.12) {
      // Возврат головы в центральную зону взводит триггер для следующего маневра
      this._laneArmed = true;
    }

    // 2. Прыжок по запрокидыванию головы вверх (pitch up)
    if (headPitch < this.pitchUpThreshold) {
      if (this._jumpArmed) {
        this._push({ jump: true });
        this._jumpArmed = false;
      }
    } else if (headPitch > -0.12) {
      this._jumpArmed = true;
    }

    // 3. Присед по наклону головы вниз (pitch down)
    if (headPitch > this.pitchDownThreshold) {
      if (this._slideArmed) {
        this._push({ slide: true });
        this._slideArmed = false;
      }
    } else if (headPitch < 0.12) {
      this._slideArmed = true;
    }
  }
}
