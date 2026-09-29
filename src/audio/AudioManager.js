/**
 * AudioManager — Architectural audio foundation for InterRun.
 *
 * Implements a stub interface for custom sound packs:
 * 1. Place .ogg/.mp3 files in public/sounds/
 * 2. In SkinPack.getAudioConfig() return { bgm: '/sounds/bg.ogg', sfx: { jump: '/sounds/jump.ogg', ... } }
 * 3. Call audioManager.applySkinPack(skinPack) to load sounds automatically
 *
 * Different skins can provide unique audio configs.
 */
export class AudioManager {
  constructor() {
    this._ctx    = null;  // AudioContext (lazy init)
    this._bgm    = null;  // HTMLAudioElement for BGM
    this._sfx    = {};    // { name: AudioBuffer }
    this._muted  = false;
    this._volume = 0.7;
    this._sfxVol = 0.8;
    this._loaded = false;
  }

  /** Initialize AudioContext (requires user gesture) */
  async init() {
    if (this._ctx) return;
    try {
      const AudioCtx = window.AudioContext || window.webkitAudioContext;
      this._ctx = new AudioCtx();
    } catch (e) {
      console.warn('[AudioManager] Web Audio API unavailable:', e);
    }
  }

  /**
   * Apply audio config from SkinPack.
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

    // Load SFX via Web Audio API
    if (config.sfx && this._ctx) {
      for (const [name, url] of Object.entries(config.sfx)) {
        try {
          const res = await fetch(url);
          const buf = await res.arrayBuffer();
          this._sfx[name] = await this._ctx.decodeAudioData(buf);
        } catch (_) { /* audio unavailable, continue silently */ }
      }
    }
    this._loaded = true;
  }

  /**
   * Play a sound effect.
   * @param {string} name — key from sfx config
   * @param {number} [pitchVariance=0] — random pitch ±%
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

  /** Resume AudioContext on interaction */
  resume() {
    if (this._ctx?.state === 'suspended') this._ctx.resume();
    if (this._bgm && !this._muted) this._bgm.play().catch(() => {});
  }
}
