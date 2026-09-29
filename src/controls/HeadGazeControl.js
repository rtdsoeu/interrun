/**
 * HeadGazeControl — Этап 4: Жестовое управление направлением взгляда головы.
 *
 * НЕ ЗОНАЛЬНОЕ: работает дискретными жестами (импульсами), как свайпы:
 *   - Поворот/взгляд ВЛЕВО  → шаг на 1 полосу влево (laneDelta: -1)
 *   - Поворот/взгляд ВПРАВО → шаг на 1 полосу вправо (laneDelta: +1)
 *   - Кивок ВНИЗ            → подкат (slide: true)
 *   - Взгляд ВВЕРХ          → прыжок (jump: true)
 *
 * Жизненный цикл жеста:
 *   1. Взгляд прямо (center) взводит готовность (_armed = true).
 *   2. При фиксации направления жест срабатывает ровно 1 раз.
 *   3. Повторный жест требует либо возврата в центр (быстрый жест «повернул-вернул»),
 *      либо удержания взгляда более 400мс (авто-повтор для смены нескольких полос).
 *
 * Режим Vision Worker: 'headgaze'
 */
import { BaseControl } from './BaseControl.js';

export class HeadGazeControl extends BaseControl {
  constructor(visionManager) {
    super();
    this.vision = visionManager;

    this._armed = true;
    this._cooldown = 0;
    this._holdTimer = 0;
    this._lastDir = 'center';
  }

  _onEnable() {
    if (this.vision) {
      this.vision.setMode('headgaze');
      this.vision.initWebcam();
    }
    this._armed = true;
    this._cooldown = 0;
    this._holdTimer = 0;
    this._lastDir = 'center';
  }

  _onDisable() {
    this._armed = true;
    this._cooldown = 0;
    this._holdTimer = 0;
    this._lastDir = 'center';
  }

  update(dt) {
    if (!this._enabled || !this.vision || !this.vision.isReady) return;

    const { gazeDir, gazeSource } = this.vision.currentState;

    // Нет трекинга лица — ничего не делаем
    if (!gazeSource) return;

    if (this._cooldown > 0) {
      this._cooldown -= dt;
    }

    // Возврат взгляда в центр взводит жест заново
    if (gazeDir === 'center') {
      this._armed = true;
      this._holdTimer = 0;
      this._lastDir = 'center';
      return;
    }

    // Первичное срабатывание жеста при отклонении из центра
    if (this._armed && this._cooldown <= 0) {
      this._triggerGesture(gazeDir);
      this._armed = false;
      this._lastDir = gazeDir;
      this._holdTimer = 0;
      this._cooldown = 0.20; // 200мс защита от дребезга
      return;
    }

    // Автоповтор при длительном удержании взгляда (только для смены полосы влево/вправо)
    if (gazeDir === this._lastDir && (gazeDir === 'left' || gazeDir === 'right')) {
      this._holdTimer += dt;
      if (this._holdTimer >= 0.40) {
        this._triggerGesture(gazeDir);
        this._holdTimer = 0;
        this._cooldown = 0.25;
      }
    }
  }

  _triggerGesture(dir) {
    switch (dir) {
      case 'left':
        this._push({ laneDelta: -1 });
        break;
      case 'right':
        this._push({ laneDelta: 1 });
        break;
      case 'up':
        this._push({ jump: true });
        break;
      case 'down':
        this._push({ slide: true });
        break;
    }
  }

  /**
   * Возвращает накопленные команды ввода (laneDelta, jump, slide).
   * Не использует targetLane — полностью жестовое импульсное управление.
   */
  consume() {
    return super.consume();
  }
}
