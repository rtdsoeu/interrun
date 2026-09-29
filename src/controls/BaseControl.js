/**
 * BaseControl — интерфейс для всех схем управления.
 *
 * Для добавления нового управления:
 *   1. Создайте класс, расширяющий BaseControl
 *   2. Переопределите _onEnable, _onDisable, update
 *   3. Вызывайте this._push({ laneDelta, jump, slide }) при событии
 *   4. Зарегистрируйте: controlManager.register(stageNumber, new YourControl())
 */
export class BaseControl {
  constructor() {
    this._enabled = false;
    // Очередь событий — одно нажатие = одно действие
    this._pending = { laneDelta: 0, jump: false, slide: false };
  }

  /** Активировать схему управления */
  enable() {
    this._enabled = true;
    this._reset();
    this._onEnable();
  }

  /** Деактивировать схему управления */
  disable() {
    this._onDisable();
    this._reset();
    this._enabled = false;
  }

  /** @protected Переопределите для логики активации */
  _onEnable() {}

  /** @protected Переопределите для логики деактивации */
  _onDisable() {}

  /**
   * @protected Вызывается событием, накапливает input.
   * @param {{ laneDelta?: number, jump?: boolean, slide?: boolean }} action
   */
  _push(action) {
    if (!this._enabled) return;
    if (action.laneDelta !== undefined && action.laneDelta !== 0) {
      this._pending.laneDelta = action.laneDelta;
    }
    if (action.jump)  this._pending.jump  = true;
    if (action.slide) this._pending.slide = true;
  }

  _reset() {
    this._pending = { laneDelta: 0, jump: false, slide: false };
  }

  /**
   * Вызывается каждый кадр Runner'ом.
   * Возвращает накопленные события и сбрасывает их.
   * @returns {{ laneDelta: number, jump: boolean, slide: boolean }}
   */
  consume() {
    const result = { ...this._pending };
    this._reset();
    return result;
  }

  /** Вызывается каждый кадр движком. Переопределите для аналогового ввода. */
  update(_dt) {}

  get isEnabled() { return this._enabled; }
}
