import { BaseControl } from './BaseControl.js';

/**
 * Этап 4 (400-500м): Управление позой тела (Body Pose Tracking через Computer Vision).
 * Клавиатура ПОЛНОСТЬЮ ОТКЛЮЧЕНА!
 * Управление движениями тела перед вебкамерой:
 * - Реальный физический наклон корпуса влево/вправо = смена полосы
 * - Присед всем телом = присед в игре
 * - Физический прыжок или подъем рук над головой = прыжок в игре
 */
export class PoseControl extends BaseControl {
  constructor(visionManager) {
    super();
    this.vision = visionManager;

    this.leanThreshold = 0.25;
    this._laneArmed = true;
    this._jumpArmed = true;
    this._slideArmed = true;
  }

  _onEnable() {
    if (this.vision) {
      this.vision.setMode('pose');
      this.vision.initWebcam();
    }
  }

  _onDisable() {
    this._laneArmed = this._jumpArmed = this._slideArmed = true;
  }

  update(dt) {
    if (!this._enabled || !this.vision || !this.vision.isReady) return;

    const { bodyLeanX, isSquatting, isJumping } = this.vision.currentState;

    // 1. Физический наклон корпуса влево/вправо
    if (Math.abs(bodyLeanX) > this.leanThreshold) {
      if (this._laneArmed) {
        const delta = bodyLeanX > 0 ? 1 : -1;
        this._push({ laneDelta: delta });
        this._laneArmed = false;
      }
    } else if (Math.abs(bodyLeanX) < 0.12) {
      this._laneArmed = true;
    }

    // 2. Прыжок (тело вверх или руки над головой)
    if (isJumping) {
      if (this._jumpArmed) {
        this._push({ jump: true });
        this._jumpArmed = false;
      }
    } else {
      this._jumpArmed = true;
    }

    // 3. Реальный присед всем телом
    if (isSquatting) {
      if (this._slideArmed) {
        this._push({ slide: true });
        this._slideArmed = false;
      }
    } else {
      this._slideArmed = true;
    }
  }
}
