import { BaseControl } from './BaseControl.js';

/**
 * Этап 3 (300-400м): Управление жестами рук (Hand Gestures через Computer Vision).
 * Клавиатура ПОЛНОСТЬЮ ОТКЛЮЧЕНА!
 * Управление только движениями рук перед вебкамерой:
 * - Смещение кисти влево / вправо относительно центра = смена полосы
 * - Резкий взмах рукой вверх = прыжок
 * - Резкий взмах рукой вниз = присед
 */
export class HandControl extends BaseControl {
  constructor(visionManager) {
    super();
    this.vision = visionManager;

    this.handThresholdX = 0.28;
    this._laneArmed = true;
    this._jumpArmed = true;
    this._slideArmed = true;
  }

  _onEnable() {
    if (this.vision) {
      this.vision.setMode('hands');
      this.vision.initWebcam();
    }
  }

  _onDisable() {
    this._laneArmed = this._jumpArmed = this._slideArmed = true;
  }

  update(dt) {
    if (!this._enabled || !this.vision || !this.vision.isReady) return;

    const { handX, handSwipeUp, handSwipeDown } = this.vision.currentState;

    // 1. Смена полосы по положению кисти
    if (Math.abs(handX) > this.handThresholdX) {
      if (this._laneArmed) {
        const delta = handX > 0 ? 1 : -1;
        this._push({ laneDelta: delta });
        this._laneArmed = false;
      }
    } else if (Math.abs(handX) < 0.12) {
      this._laneArmed = true;
    }

    // 2. Прыжок по резкому взмаху вверх
    if (handSwipeUp) {
      if (this._jumpArmed) {
        this._push({ jump: true });
        this._jumpArmed = false;
      }
    } else {
      this._jumpArmed = true;
    }

    // 3. Присед по резкому взмаху вниз
    if (handSwipeDown) {
      if (this._slideArmed) {
        this._push({ slide: true });
        this._slideArmed = false;
      }
    } else {
      this._slideArmed = true;
    }
  }
}
