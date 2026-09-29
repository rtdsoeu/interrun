/**
 * MusicPlayer — Background music manager for InterRun:
 * - Online 24/7 Synthwave / Cyberpunk Radio Streams (Nightride FM, Chillsynth, Darksynth, EBSM).
 * - Built-in Procedural 80s Synthwave synthesizer as instant offline / failover engine.
 * - Dynamic mode filtering (menu chill, game drive, transition riser, crash filter sweep).
 * - Persistent station, volume, and mute settings in localStorage.
 */

export const RADIO_STATIONS = [
  {
    id: 'nightride',
    name: 'Nightride FM',
    genre: 'Synthwave',
    url: 'https://stream.nightride.fm/nightride.mp3'
  },
  {
    id: 'chillsynth',
    name: 'Chillsynth FM',
    genre: 'Chillwave',
    url: 'https://stream.nightride.fm/chillsynth.mp3'
  },
  {
    id: 'darksynth',
    name: 'Darksynth FM',
    genre: 'Cyberpunk',
    url: 'https://stream.nightride.fm/darksynth.mp3'
  },
  {
    id: 'ebsm',
    name: 'EBSM Cyberpunk',
    genre: 'EBM / Industrial',
    url: 'https://stream.nightride.fm/ebsm.mp3'
  },
  {
    id: 'synth',
    name: 'Procedural Synth',
    genre: '80s Web Audio',
    url: null // Synthesized offline
  }
];

// Chord definitions for the 4-bar Synthwave progression (Am -> F -> C -> G)
const BGM_CHORDS = [
  {
    rootFreq: 55.0, // A1
    octaveFreq: 110.0, // A2
    padFreqs: [220.0, 261.63, 329.63], // A3, C4, E4
    arpFreqs: [440.0, 523.25, 659.25, 880.0, 659.25, 523.25, 587.33, 659.25, 440.0, 523.25, 659.25, 783.99, 659.25, 523.25, 493.88, 523.25]
  },
  {
    rootFreq: 43.65, // F1
    octaveFreq: 87.31, // F2
    padFreqs: [174.61, 220.0, 261.63], // F3, A3, C4
    arpFreqs: [349.23, 440.0, 523.25, 698.46, 523.25, 440.0, 392.0, 440.0, 349.23, 440.0, 523.25, 659.25, 523.25, 440.0, 392.0, 440.0]
  },
  {
    rootFreq: 65.41, // C2
    octaveFreq: 130.81, // C3
    padFreqs: [130.81, 196.0, 261.63, 329.63], // C3, G3, C4, E4
    arpFreqs: [392.0, 523.25, 659.25, 783.99, 659.25, 523.25, 587.33, 659.25, 392.0, 523.25, 659.25, 783.99, 659.25, 587.33, 523.25, 587.33]
  },
  {
    rootFreq: 48.99, // G1
    octaveFreq: 98.0, // G2
    padFreqs: [196.0, 246.94, 293.66], // G3, B3, D4
    arpFreqs: [392.0, 493.88, 587.33, 783.99, 587.33, 493.88, 440.0, 493.88, 329.63, 392.0, 493.88, 659.25, 493.88, 392.0, 369.99, 392.0]
  }
];

export class MusicPlayer {
  constructor(audioContext = null) {
    this._externalCtx = audioContext;
    this._ctx = null;
    this._masterGain = null;
    this._bgmGain = null;
    this._bgmFilter = null;

    // Load persisted settings
    const savedMuted   = typeof localStorage !== 'undefined' ? localStorage.getItem('interrun_muted') : null;
    const savedBgmVol  = typeof localStorage !== 'undefined' ? localStorage.getItem('interrun_bgm_vol') : null;
    const savedStation = typeof localStorage !== 'undefined' ? localStorage.getItem('interrun_radio_station') : null;

    this.muted = savedMuted === 'true';
    this.volume = savedBgmVol !== null ? parseFloat(savedBgmVol) : 0.55;
    this.stationId = savedStation || 'nightride';
    this.mode = 'menu'; // 'menu' | 'game' | 'transition' | 'dead'

    this.isPlaying = false;
    this._unlocked = false;

    // Stream audio element
    this._audio = null;
    this._initAudioElement();

    // Procedural synthesizer state
    this._synthRunning = false;
    this._step = 0;
    this._nextStepTime = 0;
    this._schedulerTimer = null;

    this._bindUnlockListeners();
  }

  _initAudioElement() {
    if (typeof window === 'undefined' || typeof Audio === 'undefined') return;
    try {
      this._audio = new Audio();
      this._audio.preload = 'none';
      this._audio.crossOrigin = 'anonymous';

      this._audio.addEventListener('error', (e) => {
        console.warn('[MusicPlayer] Radio stream error, falling back to procedural synthesizer', e);
        if (this.isPlaying && this.stationId !== 'synth') {
          this._startProceduralSynth();
        }
      });
    } catch (e) {
      console.warn('[MusicPlayer] Could not create Audio element', e);
    }
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

  _ensureContext() {
    if (this._externalCtx) {
      this._ctx = this._externalCtx;
    } else if (!this._ctx && typeof window !== 'undefined') {
      try {
        const AudioCtx = window.AudioContext || window.webkitAudioContext;
        if (AudioCtx) {
          this._ctx = new AudioCtx();
        }
      } catch (e) {
        console.warn('[MusicPlayer] AudioContext creation failed', e);
      }
    }

    if (this._ctx && !this._bgmGain) {
      try {
        this._masterGain = this._ctx.createGain();
        this._masterGain.connect(this._ctx.destination);

        this._bgmFilter = this._ctx.createBiquadFilter();
        this._bgmFilter.type = 'lowpass';
        this._bgmFilter.frequency.value = 16000;
        this._bgmFilter.connect(this._masterGain);

        this._bgmGain = this._ctx.createGain();
        this._bgmGain.connect(this._bgmFilter);

        this._updateGains();
      } catch (e) {
        console.warn('[MusicPlayer] Gain graph creation failed', e);
      }
    }

    if (this._ctx && this._ctx.state === 'suspended') {
      this._ctx.resume().catch(() => {});
    }

    return this._ctx;
  }

  _updateGains() {
    const effectiveVol = this.muted ? 0 : this.volume;

    // 1. Update HTML5 audio element volume
    if (this._audio) {
      const modeScale = (this.mode === 'dead') ? 0.3 : (this.mode === 'menu') ? 0.8 : 1.0;
      this._audio.volume = Math.max(0, Math.min(1, effectiveVol * modeScale));
      this._audio.muted = this.muted;
    }

    // 2. Update Web Audio procedural synthesizer gain
    if (this._ctx && this._bgmGain) {
      const now = this._ctx.currentTime;
      this._masterGain?.gain.setTargetAtTime(this.muted ? 0 : 1, now, 0.02);
      this._bgmGain?.gain.setTargetAtTime(effectiveVol, now, 0.02);
    }
  }

  unlock() {
    this._unlocked = true;
    this._ensureContext();
    if (this.isPlaying) {
      this.play();
    }
  }

  play(mode = this.mode) {
    this.mode = mode;
    this.isPlaying = true;
    this._ensureContext();

    const station = RADIO_STATIONS.find(s => s.id === this.stationId) || RADIO_STATIONS[0];

    if (station.url) {
      // 1. Play online radio stream
      this._stopProceduralSynth();
      if (this._audio) {
        if (this._audio.src !== station.url) {
          this._audio.src = station.url;
        }
        this._updateGains();
        this._audio.play().catch(err => {
          console.warn('[MusicPlayer] Stream play blocked or failed, fallback to synth', err);
          this._startProceduralSynth();
        });
      }
    } else {
      // 2. Procedural Synthwave mode
      if (this._audio) {
        this._audio.pause();
      }
      this._startProceduralSynth();
    }
  }

  pause() {
    this.isPlaying = false;
    if (this._audio) this._audio.pause();
    this._stopProceduralSynth();
  }

  stop() {
    this.pause();
  }

  setMode(mode) {
    this.mode = mode;
    this._updateGains();

    if (this._ctx && this._bgmFilter) {
      const now = this._ctx.currentTime;
      if (mode === 'dead') {
        this._bgmFilter.frequency.setTargetAtTime(300, now, 0.35);
      } else if (mode === 'transition') {
        this._bgmFilter.frequency.setTargetAtTime(14000, now, 0.2);
      } else if (mode === 'menu') {
        this._bgmFilter.frequency.setTargetAtTime(4500, now, 0.3);
      } else {
        this._bgmFilter.frequency.setTargetAtTime(16000, now, 0.1);
      }
    }

    if (!this.isPlaying) {
      this.play(mode);
    }
  }

  setStation(stationId) {
    this.stationId = stationId;
    if (typeof localStorage !== 'undefined') {
      localStorage.setItem('interrun_radio_station', stationId);
    }
    if (this.isPlaying) {
      this.play();
    }
  }

  setVolume(vol) {
    this.volume = Math.max(0, Math.min(1, vol));
    if (typeof localStorage !== 'undefined') {
      localStorage.setItem('interrun_bgm_vol', String(this.volume));
    }
    this._updateGains();
  }

  setMuted(muted) {
    this.muted = !!muted;
    if (typeof localStorage !== 'undefined') {
      localStorage.setItem('interrun_muted', String(this.muted));
    }
    this._updateGains();
  }

  toggleMute() {
    this.setMuted(!this.muted);
    return this.muted;
  }

  // ─────────────────────────────────────────────────────────────────────────
  // Procedural Synthwave Scheduler
  // ─────────────────────────────────────────────────────────────────────────

  _startProceduralSynth() {
    if (this._synthRunning) return;
    this._ensureContext();
    this._synthRunning = true;
    this._step = 0;
    if (this._ctx) {
      this._nextStepTime = this._ctx.currentTime + 0.05;
    }
    if (this._schedulerTimer) clearInterval(this._schedulerTimer);
    this._schedulerTimer = setInterval(() => this._schedulerLoop(), 25);
  }

  _stopProceduralSynth() {
    this._synthRunning = false;
    if (this._schedulerTimer) {
      clearInterval(this._schedulerTimer);
      this._schedulerTimer = null;
    }
  }

  _schedulerLoop() {
    if (!this._synthRunning || !this._ctx) return;
    if (this._ctx.state === 'suspended') return;

    const bpm = this.mode === 'menu' ? 108 : 124;
    const stepTime = 60 / bpm / 4; // 16th note
    const lookahead = 0.12;

    // Resynchronize timeline if browser lagged or context was just resumed
    if (this._nextStepTime < this._ctx.currentTime) {
      this._nextStepTime = this._ctx.currentTime + 0.05;
    }

    while (this._nextStepTime < this._ctx.currentTime + lookahead) {
      this._scheduleStep(this._step, this._nextStepTime);
      this._step = (this._step + 1) % 64; // 4-bar loop (16 * 4)
      this._nextStepTime += stepTime;
    }
  }

  _scheduleStep(step, time) {
    const ctx = this._ctx;
    if (!ctx) return;

    const bar = Math.floor(step / 16);
    const stepInBar = step % 16;
    const chord = BGM_CHORDS[bar];
    const isMenu = this.mode === 'menu';
    const isTransition = this.mode === 'transition';
    const isDead = this.mode === 'dead';

    if (isDead) return;

    // 1. Kick Drum
    if (!isMenu) {
      if (stepInBar === 0 || stepInBar === 4 || stepInBar === 8 || stepInBar === 12) {
        this._synthKick(time, 0.85);
      }
    } else {
      if (stepInBar === 0 || stepInBar === 8) {
        this._synthKick(time, 0.6);
      }
    }

    // 2. Snare Drum
    if (!isMenu) {
      if (stepInBar === 4 || stepInBar === 12) {
        this._synthSnare(time, 0.7);
      }
      if (isTransition && (stepInBar === 2 || stepInBar === 6 || stepInBar === 10 || stepInBar === 14)) {
        this._synthSnare(time, 0.45);
      }
    }

    // 3. Hi-Hats
    if (!isMenu) {
      const isOffbeat = (stepInBar % 4 === 2);
      this._synthHiHat(time, isOffbeat, isOffbeat ? 0.35 : 0.18);
    } else {
      if (stepInBar % 4 === 0) {
        this._synthHiHat(time, false, 0.15);
      }
    }

    // 4. Rolling Bass
    if (!isMenu) {
      const isOctave = (stepInBar % 4 === 2 || stepInBar % 4 === 3);
      const freq = isOctave ? chord.octaveFreq : chord.rootFreq;
      this._synthBass(time, freq, 0.10, 0.55);
    } else {
      if (stepInBar === 0 || stepInBar === 8) {
        this._synthBass(time, chord.rootFreq, 0.35, 0.35);
      }
    }

    // 5. Arpeggio
    const arpFreq = chord.arpFreqs[stepInBar];
    if (arpFreq) {
      this._synthArp(time, arpFreq, 0.11, isMenu ? 0.25 : 0.32);
    }

    // 6. Pad
    if (stepInBar === 0) {
      this._synthPad(time, chord.padFreqs, stepTime * 15, isMenu ? 0.3 : 0.22);
    }
  }

  _synthKick(time, vol = 0.8) {
    const ctx = this._ctx;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    osc.frequency.setValueAtTime(145, time);
    osc.frequency.exponentialRampToValueAtTime(38, time + 0.08);

    gain.gain.setValueAtTime(vol, time);
    gain.gain.exponentialRampToValueAtTime(0.001, time + 0.12);

    osc.connect(gain);
    gain.connect(this._bgmGain);

    osc.start(time);
    osc.stop(time + 0.12);
  }

  _synthSnare(time, vol = 0.6) {
    const ctx = this._ctx;

    const osc = ctx.createOscillator();
    const oscGain = ctx.createGain();
    osc.type = 'triangle';
    osc.frequency.setValueAtTime(180, time);
    osc.frequency.exponentialRampToValueAtTime(80, time + 0.07);
    oscGain.gain.setValueAtTime(vol * 0.7, time);
    oscGain.gain.exponentialRampToValueAtTime(0.001, time + 0.08);
    osc.connect(oscGain);
    oscGain.connect(this._bgmGain);
    osc.start(time);
    osc.stop(time + 0.08);

    const bufferSize = Math.floor(ctx.sampleRate * 0.14);
    const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) {
      data[i] = Math.random() * 2 - 1;
    }
    const noise = ctx.createBufferSource();
    noise.buffer = buffer;
    const filter = ctx.createBiquadFilter();
    filter.type = 'highpass';
    filter.frequency.value = 1000;

    const noiseGain = ctx.createGain();
    noiseGain.gain.setValueAtTime(vol * 0.6, time);
    noiseGain.gain.exponentialRampToValueAtTime(0.001, time + 0.14);

    noise.connect(filter);
    filter.connect(noiseGain);
    noiseGain.connect(this._bgmGain);
    noise.start(time);
    noise.stop(time + 0.14);
  }

  _synthHiHat(time, open = false, vol = 0.2) {
    const ctx = this._ctx;
    const duration = open ? 0.12 : 0.035;

    const bufferSize = Math.floor(ctx.sampleRate * duration);
    const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) {
      data[i] = Math.random() * 2 - 1;
    }

    const noise = ctx.createBufferSource();
    noise.buffer = buffer;

    const filter = ctx.createBiquadFilter();
    filter.type = 'highpass';
    filter.frequency.value = 7500;

    const gain = ctx.createGain();
    gain.gain.setValueAtTime(vol, time);
    gain.gain.exponentialRampToValueAtTime(0.001, time + duration);

    noise.connect(filter);
    filter.connect(gain);
    gain.connect(this._bgmGain);

    noise.start(time);
    noise.stop(time + duration);
  }

  _synthBass(time, freq, duration = 0.10, vol = 0.5) {
    const ctx = this._ctx;
    const osc = ctx.createOscillator();
    const filter = ctx.createBiquadFilter();
    const gain = ctx.createGain();

    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(freq, time);

    filter.type = 'lowpass';
    filter.Q.value = 3.5;
    filter.frequency.setValueAtTime(750, time);
    filter.frequency.exponentialRampToValueAtTime(160, time + duration);

    gain.gain.setValueAtTime(vol, time);
    gain.gain.exponentialRampToValueAtTime(0.001, time + duration);

    osc.connect(filter);
    filter.connect(gain);
    gain.connect(this._bgmGain);

    osc.start(time);
    osc.stop(time + duration);
  }

  _synthArp(time, freq, duration = 0.11, vol = 0.3) {
    const ctx = this._ctx;
    const osc = ctx.createOscillator();
    const filter = ctx.createBiquadFilter();
    const gain = ctx.createGain();

    osc.type = 'triangle';
    osc.frequency.setValueAtTime(freq, time);

    filter.type = 'bandpass';
    filter.frequency.setValueAtTime(freq * 1.5, time);
    filter.Q.value = 1.8;

    gain.gain.setValueAtTime(vol, time);
    gain.gain.exponentialRampToValueAtTime(0.001, time + duration);

    osc.connect(filter);
    filter.connect(gain);
    gain.connect(this._bgmGain);

    osc.start(time);
    osc.stop(time + duration);
  }

  _synthPad(time, freqs, duration = 1.8, vol = 0.25) {
    const ctx = this._ctx;

    freqs.forEach((freq) => {
      const osc1 = ctx.createOscillator();
      const osc2 = ctx.createOscillator();
      const filter = ctx.createBiquadFilter();
      const gain = ctx.createGain();

      osc1.type = 'sawtooth';
      osc2.type = 'sawtooth';
      osc1.frequency.setValueAtTime(freq, time);
      osc2.frequency.setValueAtTime(freq, time);
      osc1.detune.setValueAtTime(-6, time);
      osc2.detune.setValueAtTime(6, time);

      filter.type = 'lowpass';
      filter.frequency.setValueAtTime(1400, time);

      gain.gain.setValueAtTime(0.001, time);
      gain.gain.linearRampToValueAtTime(vol / freqs.length, time + 0.3);
      gain.gain.exponentialRampToValueAtTime(0.001, time + duration);

      osc1.connect(filter);
      osc2.connect(filter);
      filter.connect(gain);
      gain.connect(this._bgmGain);

      osc1.start(time);
      osc2.start(time);
      osc1.stop(time + duration);
      osc2.stop(time + duration);
    });
  }
}
