/**
 * BaseControl — interface for all control schemes.
 *
 * To add a new control scheme:
 *   1. Create a class extending BaseControl
 *   2. Override _onEnable, _onDisable, update
 *   3. Call this._push({ laneDelta, jump, slide }) on event
 *   4. Register: controlManager.register(stageNumber, new YourControl())
 */
export class BaseControl {
  constructor() {
    this._enabled = false;
    // Event queue — one trigger = one action
    this._pending = { laneDelta: 0, jump: false, slide: false };
  }

  /** Activate control scheme */
  enable() {
    this._enabled = true;
    this._reset();
    this._onEnable();
  }

  /** Deactivate control scheme */
  disable() {
    this._onDisable();
    this._reset();
    this._enabled = false;
  }

  /** @protected Override for activation logic */
  _onEnable() {}

  /** @protected Override for deactivation logic */
  _onDisable() {}

  /**
   * @protected Called by events, accumulates input.
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
   * Called every frame by Runner.
   * Returns accumulated events and resets them.
   * @returns {{ laneDelta: number, jump: boolean, slide: boolean }}
   */
  consume() {
    const result = { ...this._pending };
    this._reset();
    return result;
  }

  /** Called every frame by the engine. Override for continuous/analog input. */
  update(_dt) {}

  get isEnabled() { return this._enabled; }
}
