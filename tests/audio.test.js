import { describe, it, expect, beforeEach } from 'vitest';

// Node test environment stub
if (typeof globalThis.window === 'undefined') {
  globalThis.window = {
    addEventListener: () => {},
    removeEventListener: () => {}
  };
}

// Mock localStorage
const mockStorage = {};
globalThis.localStorage = {
  getItem: (key) => (key in mockStorage ? mockStorage[key] : null),
  setItem: (key, val) => { mockStorage[key] = String(val); },
  removeItem: (key) => { delete mockStorage[key]; },
  clear: () => { Object.keys(mockStorage).forEach(k => delete mockStorage[k]); }
};

// Mock Audio element
class MockAudio {
  constructor(src) {
    this.src = src;
    this.loop = false;
    this.preload = 'none';
    this.muted = false;
    this.volume = 1.0;
    this.currentTime = 0;
    this.paused = true;
    this.listeners = {};
  }
  addEventListener(event, cb) {
    this.listeners[event] = cb;
  }
  removeEventListener(event, cb) {
    delete this.listeners[event];
  }
  play() {
    this.paused = false;
    return Promise.resolve();
  }
  pause() {
    this.paused = true;
  }
}
globalThis.Audio = MockAudio;

import { MusicPlayer } from '../src/audio/MusicPlayer.js';
import { SoundFx } from '../src/audio/SoundFx.js';

describe('MusicPlayer', () => {
  let player;

  beforeEach(() => {
    localStorage.clear();
    player = new MusicPlayer('/audio/bgm.wav');
  });

  it('initializes with default volume and menu mode', () => {
    expect(player.volume).toBe(0.7);
    expect(player.mode).toBe('menu');
    expect(player.muted).toBe(false);
    expect(player.currentTrackUrl).toBe('/audio/bgm.wav');
    expect(player.currentTrackTitle).toBe('Bgm');
  });

  it('maintains equal volume parity between menu, game, and transition', () => {
    player.volume = 0.8;

    player.mode = 'game';
    expect(player._computeTargetVolume()).toBeCloseTo(0.8, 2);

    player.mode = 'menu';
    // Menu volume is strictly equal to game volume
    expect(player._computeTargetVolume()).toBeCloseTo(0.8, 2);

    player.mode = 'transition';
    expect(player._computeTargetVolume()).toBeCloseTo(0.8, 2);

    player.mode = 'dead';
    expect(player._computeTargetVolume()).toBeCloseTo(0.8 * 0.35, 2);

    player.setMuted(true);
    expect(player._computeTargetVolume()).toBe(0);
  });

  it('persists volume and mute settings in localStorage', () => {
    player.setVolume(0.5);
    expect(localStorage.getItem('interrun_bgm_vol')).toBe('0.5');

    player.setMuted(true);
    expect(localStorage.getItem('interrun_muted')).toBe('true');

    player.toggleMute();
    expect(player.muted).toBe(false);
    expect(localStorage.getItem('interrun_muted')).toBe('false');
  });

  it('switches tracks with fade and wraps circularly in playlist', async () => {
    player.playlist = ['/audio/cyber_drive.mp3', '/audio/synth_wave.ogg', '/audio/neon_city.wav'];
    player.trackIndex = 0;

    expect(player.currentTrackTitle).toBe('Cyber drive');

    await player.nextTrack();
    expect(player.trackIndex).toBe(1);
    expect(player.currentTrackTitle).toBe('Synth wave');

    await player.nextTrack();
    expect(player.trackIndex).toBe(2);
    expect(player.currentTrackTitle).toBe('Neon city');

    // Circular wrap to 0
    await player.nextTrack();
    expect(player.trackIndex).toBe(0);

    // Prev wraps to end
    await player.prevTrack();
    expect(player.trackIndex).toBe(2);
  });
});

describe('SoundFx integration with MusicPlayer', () => {
  let soundFx;

  beforeEach(() => {
    localStorage.clear();
    soundFx = new SoundFx();
  });

  it('routes bgm volume, mode changes, and track switching', () => {
    soundFx.setBgmVolume(0.4);
    expect(soundFx.bgmVolume).toBe(0.4);
    expect(soundFx.music.volume).toBe(0.4);

    soundFx.startBGM('game');
    expect(soundFx.music.isPlaying).toBe(true);
    expect(soundFx.music.mode).toBe('game');

    soundFx.setBgmMode('dead');
    expect(soundFx.music.mode).toBe('dead');

    soundFx.music.playlist = ['/audio/song_a.mp3', '/audio/song_b.mp3'];
    soundFx.nextTrack();
    expect(soundFx.currentTrackTitle).toBe('Song b');

    soundFx.stopBGM();
    expect(soundFx.music.isPlaying).toBe(false);
  });

  it('mutes both sfx and bgm on setMuted', () => {
    soundFx.setMuted(true);
    expect(soundFx.muted).toBe(true);
    expect(soundFx.music.muted).toBe(true);

    soundFx.toggleMute();
    expect(soundFx.muted).toBe(false);
    expect(soundFx.music.muted).toBe(false);
  });
});
