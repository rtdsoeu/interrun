/**
 * WakeLockManager — Prevents mobile / desktop screen from sleeping or dimming
 * during gameplay, especially crucial during hands-free CV stages (Face / Hand / Gestures).
 *
 * Uses the standard Screen Wake Lock API with automatic re-acquisition
 * on visibilitychange (e.g. when returning to the tab from background).
 */
export class WakeLockManager {
  constructor() {
    this._sentinel = null;
    this._requested = false;
    this._onVisibilityChange = () => this._handleVisibilityChange();

    if (typeof document !== 'undefined') {
      document.addEventListener('visibilitychange', this._onVisibilityChange);
    }
  }

  /** Is Screen Wake Lock API supported in current browser environment */
  get isSupported() {
    return typeof navigator !== 'undefined' && 'wakeLock' in navigator && typeof navigator.wakeLock?.request === 'function';
  }

  /** Whether a wake lock is currently actively held */
  get isHoldingLock() {
    return this._sentinel !== null && !this._sentinel.released;
  }

  /**
   * Request screen wake lock to keep display awake.
   * Safe to call multiple times; will not create duplicate locks.
   */
  async request() {
    this._requested = true;
    if (!this.isSupported) return;
    if (this.isHoldingLock) return;

    try {
      this._sentinel = await navigator.wakeLock.request('screen');
      this._sentinel.addEventListener('release', () => {
        this._sentinel = null;
      });
    } catch (err) {
      // May fail if battery saver is active, tab is backgrounded, or system permission denied
      this._sentinel = null;
      if (process.env.NODE_ENV !== 'production' && typeof console !== 'undefined') {
        console.warn('[WakeLock] Request failed:', err?.message || err);
      }
    }
  }

  /**
   * Release screen wake lock (e.g. when in menu or dead screen to save battery).
   */
  async release() {
    this._requested = false;
    if (this._sentinel) {
      try {
        await this._sentinel.release();
      } catch (_) {
        // Ignored
      }
      this._sentinel = null;
    }
  }

  /**
   * Automatically re-acquire wake lock when tab returns to foreground if game was active.
   */
  _handleVisibilityChange() {
    if (typeof document === 'undefined') return;
    if (document.visibilityState === 'visible' && this._requested) {
      this.request();
    }
  }

  /**
   * Clean up event listeners.
   */
  destroy() {
    this.release();
    if (typeof document !== 'undefined') {
      document.removeEventListener('visibilitychange', this._onVisibilityChange);
    }
  }
}
