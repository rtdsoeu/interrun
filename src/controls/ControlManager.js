/**
 * ControlManager — плагинная система управления.
 *
 * Добавить новое управление в одну строку:
 *   controlManager.register(2, new HeadControl());
 *
 * Переключить этап:
 *   controlManager.setStage(2);
 *
 * Получить события кадра:
 *   const { laneDelta, jump, slide } = controlManager.consume();
 */
export class ControlManager {
  constructor() {
    /** @type {Map<number, import('./BaseControl.js').BaseControl>} */
    this._controls = new Map();
    this._stage    = -1;
    this._active   = null;
    this.onStageChange = null; // callback(newStage, oldStage)
  }

  /**
   * Регистрация схемы управления для этапа.
   * @param {number} stage
   * @param {import('./BaseControl.js').BaseControl} control
   */
  register(stage, control) {
    this._controls.set(stage, control);
  }

  /**
   * Переключить активный этап.
   * @param {number} stage
   */
  setStage(stage) {
    if (stage === this._stage) return;

    const prev = this._stage;
    if (this._active) this._active.disable();

    this._stage  = stage;
    this._active = this._controls.get(stage) ?? null;

    if (this._active) this._active.enable();
    if (this.onStageChange) this.onStageChange(stage, prev);
  }

  /** Текущий этап */
  get stage() { return this._stage; }

  /** @returns {{ laneDelta: number, jump: boolean, slide: boolean }} */
  consume() {
    if (!this._active) return { laneDelta: 0, jump: false, slide: false };
    return this._active.consume();
  }

  update(dt) {
    if (this._active) this._active.update(dt);
  }
}
