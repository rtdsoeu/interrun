/**
 * FingerGestureControl — Stage 4: Finger gestures control with kinematic curl prediction.
 *
 * Gesture mapping:
 *   1 finger (index)                        -> left lane (-1)
 *   2 fingers (index + middle)              -> center lane (0)
 *   3 fingers (index + middle + ring)       -> right lane (+1)
 *   Open palm (4-5 fingers extended)        -> JUMP (instant)
 *   Closed fist (all fingers curled)        -> SLIDE / DUCK (instant)
 *
 * Vision Worker mode: 'fingergesture'
 */
import { BaseControl } from './BaseControl.js';

export class FingerGestureControl extends BaseControl {
  constructor(visionManager) {
    super();
    this.vision = visionManager;

    /** Абсолютная целевая полоса: -1 (L), 0 (C), 1 (R) */
    this._desiredLane = 0;

    /** Флаг приседа */
    this._isDucking = false;

    /** Буфер подтверждения стабильности полосы */
    this._pendingLaneGesture = null;
    this._pendingLaneTimer = 0;
  }

  _onEnable() {
    if (this.vision) {
      this.vision.setMode('fingergesture');
      this.vision.initWebcam();
    }
    this._desiredLane = 0;
    this._isDucking = false;
    this._pendingLaneGesture = null;
    this._pendingLaneTimer = 0;
  }

  _onDisable() {
    this._desiredLane = 0;
    this._isDucking = false;
    this._pendingLaneGesture = null;
    this._pendingLaneTimer = 0;
  }

  update(dt) {
    if (!this._enabled || !this.vision || !this.vision.isReady) return;

    const { fgGesture, fgSource } = this.vision.currentState;

    // Нет трекинга — гарантированно сбрасываем присед и буфер смены полос
    if (!fgSource) {
      this._isDucking = false;
      this._pendingLaneGesture = null;
      this._pendingLaneTimer = 0;
      return;
    }

    // Сброс удержания приседа по умолчанию (активно только при явном жесте 'duck')
    this._isDucking = (fgGesture === 'duck');

    // 1. МГНОВЕННЫЕ ДЕЙСТВИЯ (срабатывают сразу, прерывают транзиты)
    if (fgGesture === 'duck') {
      this._push({ slide: true });
      this._pendingLaneGesture = null;
      this._pendingLaneTimer = 0;
      return;
    }

    if (fgGesture === 'jump') {
      this._isDucking = false;
      this._push({ jump: true });
      this._pendingLaneGesture = null;
      this._pendingLaneTimer = 0;
      return;
    }

    // 2. СМЕНА ПОЛОС (требует подтверждения стабильности ~80мс,
    // чтобы промежуточно согнутые пальцы не вызывали ложных смен полос)
    if (fgGesture === 'lane_left' || fgGesture === 'lane_center' || fgGesture === 'lane_right') {
      if (this._pendingLaneGesture === fgGesture) {
        this._pendingLaneTimer += dt;
        if (this._pendingLaneTimer >= 0.08) {
          if (fgGesture === 'lane_left')   this._desiredLane = -1;
          if (fgGesture === 'lane_center') this._desiredLane = 0;
          if (fgGesture === 'lane_right')  this._desiredLane = 1;
        }
      } else {
        this._pendingLaneGesture = fgGesture;
        this._pendingLaneTimer = 0;
      }
    } else {
      this._pendingLaneGesture = null;
      this._pendingLaneTimer = 0;
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
