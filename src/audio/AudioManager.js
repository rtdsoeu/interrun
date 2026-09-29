/**
 * AudioManager — архитектурная основа звуковой системы.
 *
 * Сейчас реализует stub-интерфейс.
 * Для добавления звука:
 *   1. Положите .ogg/.mp3 в public/sounds/
 *   2. В SkinPack.getAudioConfig() верните { bgm: '/sounds/bg.ogg', sfx: { jump: '/sounds/jump.ogg', ... } }
 *   3. Вызовите audioManager.applySkinPack(skinPack) — звуки подгрузятся автоматически
 *
 * Разные скины могут иметь разные звуки — у каждого SkinPack свой AudioConfig.
 */
export class AudioManager {
  constructor() {
    this._ctx    = null;  // AudioContext (lazy init)
    this._bgm    = null;  // HTMLAudioElement для BGM
    this._sfx    = {};    // { name: AudioBuffer }
    this._muted  = false;
    this._volume = 0.7;
    this._sfxVol = 0.8;
    this._loaded = false;
  }

  /** Инициализация AudioContext (требует user gesture) */
  async init() {
    if (this._ctx) return;
    try {
      this._ctx = new (window.AudioContext || window.webkitAudioContext)();
    } catch (e) {
      console.warn('[AudioManager] Web Audio API unavailable:', e);
    }
  }

  /**
   * Применить аудио-конфиг из SkinPack.
   * @param {{ bgm?: string, sfx?: Record<string, string> }} config
   */
  async applySkinPack(config) {
    if (!config) return;
    this._stopBGM();

    if (config.bgm) {
      this._bgm = new Audio(config.bgm);
      this._bgm.loop    = true;
      this._bgm.volume  = this._volume;
      if (!this._muted) this._bgm.play().catch(() => {});
    }

    // Загрузка SFX через Web Audio API
    if (config.sfx && this._ctx) {
      for (const [name, url] of Object.entries(config.sfx)) {
        try {
          const res = await fetch(url);
          const buf = await res.arrayBuffer();
          this._sfx[name] = await this._ctx.decodeAudioData(buf);
        } catch (_) { /* звук недоступен — игра продолжается */ }
      }
    }
    this._loaded = true;
  }

  /**
   * Воспроизвести звуковой эффект.
   * @param {string} name — ключ из sfx конфига
   * @param {number} [pitchVariance=0] — случайный pitch ±%
   */
  playSFX(name, pitchVariance = 0) {
    if (this._muted || !this._ctx || !this._sfx[name]) return;
    const src = this._ctx.createBufferSource();
    src.buffer = this._sfx[name];
    if (pitchVariance > 0) {
      src.playbackRate.value = 1 + (Math.random() - 0.5) * pitchVariance;
    }
    const gain = this._ctx.createGain();
    gain.gain.value = this._sfxVol;
    src.connect(gain).connect(this._ctx.destination);
    src.start();
  }

  _stopBGM() {
    if (this._bgm) { this._bgm.pause(); this._bgm.src = ''; this._bgm = null; }
  }

  setMuted(v) {
    this._muted = v;
    if (this._bgm) this._bgm.muted = v;
  }

  setVolume(v) {
    this._volume = v;
    if (this._bgm) this._bgm.volume = v;
  }

  /** Возобновить AudioContext после взаимодействия */
  resume() {
    if (this._ctx?.state === 'suspended') this._ctx.resume();
    if (this._bgm && !this._muted) this._bgm.play().catch(() => {});
  }
}
