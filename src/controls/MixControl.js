import { BaseControl } from './BaseControl.js';

/**
 * Этап 5+ (500м+): Комбинированный микс-режим (Multimodal Mix через Computer Vision).
 * Клавиатура ПОЛНОСТЬЮ ОТКЛЮЧЕНА!
 * Любое движение игрока распознается: наклон головы, жесты рук или наклон корпуса.
 */
export class MixControl extends BaseControl {
  constructor(visionManager) {
    super();
    this.vision = visionManager;

    this._laneArmed = true;
    this._jumpArmed = true;
    this._slideArmed = true;
  }

  _onEnable() {
    if (this.vision) {
      this.vision.setMode('mix');
      this.vision.initWebcam();
    }
  }

  _onDisable() {
    this._laneArmed = this._jumpArmed = this._slideArmed = true;
  }

  update(dt) {
    if (!this._enabled || !this.vision || !this.vision.isReady) return;

    const {
      headRoll, headPitch,
      handX, handSwipeUp, handSwipeDown,
      bodyLeanX, isSquatting, isJumping
    } = this.vision.currentState;

    // Суммарный вектор смещения полосы: берём сигнал с наибольшим abs
    const candidates = [bodyLeanX, headRoll, handX];
    const steerSignal = candidates.reduce((best, cur) =>
      Math.abs(cur) > Math.abs(best) ? cur : best, 0
    );

    if (Math.abs(steerSignal) > 0.28) {
      if (this._laneArmed) {
        const delta = steerSignal > 0 ? 1 : -1;
        this._push({ laneDelta: delta });
        this._laneArmed = false;
      }
    } else if (Math.abs(steerSignal) < 0.12) {
      this._laneArmed = true;
    }

    // Прыжок (запрокидывание головы, взмах рукой вверх или прыжок телом)
    const jumpSignal = (headPitch < -0.28) || handSwipeUp || isJumping;
    if (jumpSignal) {
      if (this._jumpArmed) {
        this._push({ jump: true });
        this._jumpArmed = false;
      }
    } else {
      this._jumpArmed = true;
    }

    // Присед (наклон головы вниз, взмах рукой вниз или присед телом)
    const slideSignal = (headPitch > 0.28) || handSwipeDown || isSquatting;
    if (slideSignal) {
      if (this._slideArmed) {
        this._push({ slide: true });
        this._slideArmed = false;
      }
    } else {
      this._slideArmed = true;
    }
  }
}
