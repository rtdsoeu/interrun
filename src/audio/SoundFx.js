/**
 * SoundFx — Sound effects synthesizer for InterRun:
 * - Generates crisp Web Audio SFX (jump, slide, lane switch, coin, crash, stage up).
 * - Manages volume and mute routing.
 */

import { MusicPlayer } from './MusicPlayer.js';

export class SoundFx {
  constructor() {
    this._ctx = null;
    this._masterGain = null;
    this._sfxGain = null;

    // Load volume settings from localStorage
    const savedMuted = typeof localStorage !== 'undefined' ? localStorage.getItem('interrun_muted') : null;
    const savedSfx   = typeof localStorage !== 'undefined' ? localStorage.getItem('interrun_sfx_vol') : null;

    this.muted = savedMuted === 'true';
    this.sfxVolume = savedSfx !== null ? parseFloat(savedSfx) : 0.8;
    this.volume = this.sfxVolume;

    // High-performance background music player (native HTML5 Audio)
    this.music = new MusicPlayer();

    // Auto-bind one-time interaction unlock listeners
    this._bindUnlockListeners();
  }

  get bgmVolume() {
    return this.music.volume;
  }

  set bgmVolume(val) {
    this.music.setVolume(val);
  }

  _bindUnlockListeners() {
    if (typeof window === 'undefined') return;
    const onInteract = () => {
      this.unlock();
      window.removeEventListener('pointerdown', onInteract);
      window.removeEventListener('keydown',     onInteract);
      window.removeEventListener('touchstart',  onInteract);
      window.removeEventListener('click',      onInteract);
    };
    window.addEventListener('pointerdown', onInteract, { passive: true, capture: true });
    window.addEventListener('keydown',     onInteract, { passive: true, capture: true });
    window.addEventListener('touchstart',  onInteract, { passive: true, capture: true });
    window.addEventListener('click',      onInteract, { passive: true, capture: true });
  }

  /** Ensures Web Audio context is initialized and gain graph is set up */
  _ensureContext() {
    if (typeof window === 'undefined') return null;

    if (!this._ctx) {
      try {
        if (window.AudioContext) {
          this._ctx = new AudioContext();

          this._masterGain = this._ctx.createGain();
          this._masterGain.connect(this._ctx.destination);

          this._sfxGain = this._ctx.createGain();
          this._sfxGain.connect(this._masterGain);

          // Attach unified Web Audio graph to MusicPlayer (sample-accurate RAM looping, 0% CPU DSP gain)
          if (this.music) {
            this.music.attachAudioContext(this._ctx, this._masterGain);
          }

          this._updateGains();
        }
      } catch (e) {
        console.warn('[SoundFx] Web Audio not available', e);
      }
    }

    if (this._ctx && this._ctx.state === 'suspended') {
      this._ctx.resume().catch(() => {});
    }

    return this._ctx;
  }

  _updateGains() {
    if (!this._ctx) return;
    const now = this._ctx.currentTime;
    const masterTarget = this.muted ? 0 : 1;
    this._masterGain?.gain.setTargetAtTime(masterTarget, now, 0.01);
    this._sfxGain?.gain.setTargetAtTime(this.sfxVolume, now, 0.01);
  }

  /** Unlocks the AudioContext upon user gesture */
  unlock() {
    this._ensureContext();
    if (this._ctx && this._ctx.state === 'suspended') {
      this._ctx.resume().then(() => {
        this.music?.unlock();
      }).catch(() => {
        this.music?.unlock();
      });
    } else {
      this.music?.unlock();
    }
  }

  init() {
    this.unlock();
  }

  setSfxVolume(vol) {
    this.sfxVolume = Math.max(0, Math.min(1, vol));
    this.volume = this.sfxVolume;
    if (typeof localStorage !== 'undefined') {
      localStorage.setItem('interrun_sfx_vol', String(this.sfxVolume));
    }
    this._updateGains();
  }

  setBgmVolume(vol) {
    this.music.setVolume(vol);
  }

  setVolume(vol) {
    this.setSfxVolume(vol);
    this.setBgmVolume(vol);
  }

  setMuted(muted) {
    this.muted = !!muted;
    if (typeof localStorage !== 'undefined') {
      localStorage.setItem('interrun_muted', String(this.muted));
    }
    this._updateGains();
    this.music.setMuted(this.muted);
  }

  toggleMute() {
    this.setMuted(!this.muted);
    return this.muted;
  }

  // ─────────────────────────────────────────────────────────────────────────
  // BGM / Music Delegation
  // ─────────────────────────────────────────────────────────────────────────

  startBGM(mode = 'game') {
    this.music.play(mode);
  }

  stopBGM() {
    this.music.stop();
  }

  pauseBGM() {
    this.music.pause();
  }

  resumeBGM() {
    this.music.play();
  }

  setBgmMode(mode) {
    this.music.setMode(mode);
  }

  nextTrack() {
    this.music.nextTrack();
  }

  prevTrack() {
    this.music.prevTrack();
  }

  get currentTrackTitle() {
    return this.music.currentTrackTitle;
  }

  get playlist() {
    return this.music.playlist;
  }

  // ─────────────────────────────────────────────────────────────────────────
  // SOUND EFFECTS
  // ─────────────────────────────────────────────────────────────────────────

  /** Jump: Sine sweep up from 140Hz to 480Hz */
  playJump() {
    const ctx = this._ensureContext();
    if (!ctx || this.muted) return;

    try {
      const now = ctx.currentTime;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();

      osc.type = 'sine';
      osc.frequency.setValueAtTime(140, now);
      osc.frequency.exponentialRampToValueAtTime(480, now + 0.16);

      gain.gain.setValueAtTime(0.001, now);
      gain.gain.linearRampToValueAtTime(0.35, now + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.18);

      osc.connect(gain);
      gain.connect(this._sfxGain);

      osc.start(now);
      osc.stop(now + 0.18);
    } catch (e) {
      console.warn('[SoundFx] playJump failed', e);
    }
  }

  /** Slide / Duck: Filtered friction whoosh */
  playSlide() {
    const ctx = this._ensureContext();
    if (!ctx || this.muted) return;

    try {
      const now = ctx.currentTime;
      const bufferSize = Math.floor(ctx.sampleRate * 0.22);
      const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
      const data = buffer.getChannelData(0);
      for (let i = 0; i < bufferSize; i++) {
        data[i] = Math.random() * 2 - 1;
      }

      const noise = ctx.createBufferSource();
      noise.buffer = buffer;

      const filter = ctx.createBiquadFilter();
      filter.type = 'bandpass';
      filter.frequency.setValueAtTime(1200, now);
      filter.frequency.exponentialRampToValueAtTime(320, now + 0.22);
      filter.Q.value = 2.5;

      const gain = ctx.createGain();
      gain.gain.setValueAtTime(0.001, now);
      gain.gain.linearRampToValueAtTime(0.4, now + 0.03);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.22);

      noise.connect(filter);
      filter.connect(gain);
      gain.connect(this._sfxGain);

      noise.start(now);
      noise.stop(now + 0.22);
    } catch (e) {
      console.warn('[SoundFx] playSlide failed', e);
    }
  }

  /** Lane Switch: Subtle triangle blip */
  playLaneSwitch() {
    const ctx = this._ensureContext();
    if (!ctx || this.muted) return;

    try {
      const now = ctx.currentTime;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();

      osc.type = 'triangle';
      osc.frequency.setValueAtTime(320, now);
      osc.frequency.exponentialRampToValueAtTime(440, now + 0.08);

      gain.gain.setValueAtTime(0.001, now);
      gain.gain.linearRampToValueAtTime(0.25, now + 0.015);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.09);

      osc.connect(gain);
      gain.connect(this._sfxGain);

      osc.start(now);
      osc.stop(now + 0.09);
    } catch (e) {
      console.warn('[SoundFx] playLaneSwitch failed', e);
    }
  }

  /** Coin Pickup: High cyber chime (B5 -> E6 -> B6) */
  playCoin() {
    const ctx = this._ensureContext();
    if (!ctx || this.muted) return;

    try {
      const now = ctx.currentTime;
      const notes = [
        { freq: 987.77, delay: 0 },
        { freq: 1318.51, delay: 0.05 },
        { freq: 1975.53, delay: 0.10 }
      ];

      notes.forEach(({ freq, delay }) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();

        osc.type = 'sine';
        osc.frequency.setValueAtTime(freq, now + delay);

        gain.gain.setValueAtTime(0.001, now + delay);
        gain.gain.linearRampToValueAtTime(0.22, now + delay + 0.01);
        gain.gain.exponentialRampToValueAtTime(0.001, now + delay + 0.16);

        osc.connect(gain);
        gain.connect(this._sfxGain);

        osc.start(now + delay);
        osc.stop(now + delay + 0.16);
      });
    } catch (e) {
      console.warn('[SoundFx] playCoin failed', e);
    }
  }

  /** Crash / Impact: Low distortion impact and noise crunch */
  playCrash() {
    const ctx = this._ensureContext();
    if (!ctx || this.muted) return;

    try {
      const now = ctx.currentTime;

      // 1. Low punch
      const osc = ctx.createOscillator();
      const oscGain = ctx.createGain();
      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(160, now);
      osc.frequency.exponentialRampToValueAtTime(32, now + 0.4);

      oscGain.gain.setValueAtTime(0.65, now);
      oscGain.gain.exponentialRampToValueAtTime(0.001, now + 0.45);

      osc.connect(oscGain);
      oscGain.connect(this._sfxGain);
      osc.start(now);
      osc.stop(now + 0.45);

      // 2. Crunch noise
      const bufferSize = Math.floor(ctx.sampleRate * 0.35);
      const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
      const data = buffer.getChannelData(0);
      for (let i = 0; i < bufferSize; i++) {
        data[i] = Math.random() * 2 - 1;
      }

      const noise = ctx.createBufferSource();
      noise.buffer = buffer;

      const filter = ctx.createBiquadFilter();
      filter.type = 'lowpass';
      filter.frequency.setValueAtTime(1400, now);
      filter.frequency.exponentialRampToValueAtTime(180, now + 0.35);

      const noiseGain = ctx.createGain();
      noiseGain.gain.setValueAtTime(0.5, now);
      noiseGain.gain.exponentialRampToValueAtTime(0.001, now + 0.35);

      noise.connect(filter);
      filter.connect(noiseGain);
      noiseGain.connect(this._sfxGain);

      noise.start(now);
      noise.stop(now + 0.35);
    } catch (e) {
      console.warn('[SoundFx] playCrash failed', e);
    }
  }

  /** Stage Up: Ascending major arpeggio fanfare */
  playStageUp() {
    const ctx = this._ensureContext();
    if (!ctx || this.muted) return;

    try {
      const now = ctx.currentTime;
      const notes = [440.0, 554.37, 659.25, 880.0];

      notes.forEach((freq, idx) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        const t = now + idx * 0.08;

        osc.type = 'triangle';
        osc.frequency.setValueAtTime(freq, t);

        gain.gain.setValueAtTime(0.001, t);
        gain.gain.linearRampToValueAtTime(0.3, t + 0.015);
        gain.gain.exponentialRampToValueAtTime(0.001, t + 0.25);

        osc.connect(gain);
        gain.connect(this._sfxGain);

        osc.start(t);
        osc.stop(t + 0.25);
      });
    } catch (e) {
      console.warn('[SoundFx] playStageUp failed', e);
    }
  }
}
