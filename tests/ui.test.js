import { describe, it, expect, vi } from 'vitest';
import { getHUDHtml } from '../src/ui/HudTemplates.js';
import { translations } from '../src/i18n/Translations.js';

describe('UI Templates (getHUDHtml)', () => {
  const dummyT = (key) => translations[key]?.en || key;
  const dummyI18n = { lang: 'en', t: dummyT };

  it('renders getHUDHtml without errors with default empty state', () => {
    const html = getHUDHtml(dummyT, dummyI18n, {});
    expect(html).toContain('id="hud"');
    expect(html).toContain('id="hud-toast"');
    expect(html).toContain('id="hud-bottom-left"');
    expect(html).toContain('id="hud-fps"');
    expect(html).toContain('id="hud-cv-panel"');
    expect(html).toContain('id="hud-cam-lowlight-badge"');
    expect(html).toContain('id="slider-bgm-vol"');
    expect(html).toContain('id="slider-sfx-vol"');
    expect(html).toContain('id="settings-modal"');
    expect(html).toContain('id="menu-slider-speed"');
    expect(html).toContain('id="slider-speed-mult"');
    expect(html).not.toContain('id="hud-dda-panel"');
  });

  it('renders getHUDHtml correctly with populated settings state', () => {
    const html = getHUDHtml(dummyT, dummyI18n, {
      soundMuted: false,
      settings: {
        bgmVolume: 0.65,
        sfxVolume: 0.85,
        targetFps: 60,
        pipMode: 'full'
      },
      currentTrackTitle: 'Synthwave Groove'
    });

    expect(html).toContain('value="0.65"');
    expect(html).toContain('value="0.85"');
    expect(html).toContain('65%');
    expect(html).toContain('85%');
    expect(html).toContain('Synthwave Groove');
    expect(html).toContain('id="camera-error-modal"');
    expect(html).toContain('id="btn-cam-error-retry"');
    expect(html).toContain('id="btn-cam-error-continue"');
  });
});

describe('HUD Class Logic', () => {
  function createMockElement(id = '', isHidden = true) {
    const classes = new Set(isHidden ? ['hidden'] : []);
    return {
      id,
      textContent: '',
      innerHTML: '',
      style: {},
      classList: {
        add: (c) => classes.add(c),
        remove: (c) => classes.delete(c),
        contains: (c) => classes.has(c),
        toggle: (c, force) => {
          if (force === undefined) {
            if (classes.has(c)) classes.delete(c);
            else classes.add(c);
          } else if (force) {
            classes.add(c);
          } else {
            classes.delete(c);
          }
        }
      },
      addEventListener: () => {},
      getAttribute: () => null,
      setAttribute: () => {}
    };
  }

  function setupMockDocument() {
    const registry = new Map();
    const getEl = (id) => {
      if (!registry.has(id)) {
        // Modal elements start hidden, other elements start visible
        const isModal = id.includes('modal');
        registry.set(id, createMockElement(id, isModal));
      }
      return registry.get(id);
    };

    const mockDoc = {
      getElementById: (id) => getEl(id),
      querySelectorAll: () => [],
      documentElement: { lang: 'en' }
    };

    return { mockDoc, getEl };
  }

  it('updates distance, coins, speed bar, and lives in updateHUD', async () => {
    const { Hud } = await import('../src/ui/Hud.js');
    const { mockDoc, getEl } = setupMockDocument();
    const origDoc = globalThis.document;
    globalThis.document = mockDoc;

    try {
      const hud = new Hud({ innerHTML: '' }, null, null, null);

      hud.updateHUD(125.7, 0.5, 10, 2, false, false);

      expect(getEl('hud-dist').textContent).toBe(125);
      expect(getEl('hud-coins').textContent).toBe(10);
      expect(getEl('speed-bar-fill').style.width).toBe('50%');
      expect(getEl('life-3').classList.contains('lost')).toBe(true);
      expect(getEl('life-2').classList.contains('lost')).toBe(false);
    } finally {
      globalThis.document = origDoc;
    }
  });

  it('toggles god mode visibility in updateHUD', async () => {
    const { Hud } = await import('../src/ui/Hud.js');
    const { mockDoc, getEl } = setupMockDocument();
    const origDoc = globalThis.document;
    globalThis.document = mockDoc;

    try {
      const hud = new Hud({ innerHTML: '' }, null, null, null);

      hud.updateHUD(50, 0.2, 5, 3, true, false);
      expect(getEl('god-badge').classList.contains('hidden')).toBe(false);
      expect(getEl('lives-row').classList.contains('hidden')).toBe(true);

      hud.updateHUD(50, 0.2, 5, 3, false, false);
      expect(getEl('god-badge').classList.contains('hidden')).toBe(true);
      expect(getEl('lives-row').classList.contains('hidden')).toBe(false);
    } finally {
      globalThis.document = origDoc;
    }
  });

  it('color codes FPS correctly in updateFPS', async () => {
    const { Hud } = await import('../src/ui/Hud.js');
    const { mockDoc, getEl } = setupMockDocument();
    const origDoc = globalThis.document;
    globalThis.document = mockDoc;

    try {
      const hud = new Hud({ innerHTML: '' }, null, null, null);

      hud.updateFPS(60);
      expect(getEl('hud-fps').textContent).toBe(60);
      expect(getEl('hud-fps').style.color).toBe('#00e676'); // Green

      hud.updateFPS(42);
      expect(getEl('hud-fps').textContent).toBe(42);
      expect(getEl('hud-fps').style.color).toBe('#ffd700'); // Gold

      hud.updateFPS(18);
      expect(getEl('hud-fps').textContent).toBe(18);
      expect(getEl('hud-fps').style.color).toBe('#ff3d5e'); // Red
    } finally {
      globalThis.document = origDoc;
    }
  });

  it('manages modal open/close states and closeAllModals correctly', async () => {
    const { Hud } = await import('../src/ui/Hud.js');
    const { mockDoc, getEl } = setupMockDocument();
    const origDoc = globalThis.document;
    globalThis.document = mockDoc;

    try {
      const hud = new Hud({ innerHTML: '' }, null, null, null);

      expect(hud.isAnyModalOpen()).toBe(false);

      hud.openDebugModal();
      expect(getEl('debug-modal').classList.contains('hidden')).toBe(false);
      expect(hud.isAnyModalOpen()).toBe(true);

      hud.closeDebugModal();
      expect(getEl('debug-modal').classList.contains('hidden')).toBe(true);
      expect(hud.isAnyModalOpen()).toBe(false);

      hud.toggleDebugModal();
      expect(getEl('debug-modal').classList.contains('hidden')).toBe(false);

      hud.closeAllModals();
      expect(getEl('debug-modal').classList.contains('hidden')).toBe(true);
      expect(hud.isAnyModalOpen()).toBe(false);
    } finally {
      globalThis.document = origDoc;
    }
  });

  it('updates sound mute icon in updateSoundState', async () => {
    const { Hud } = await import('../src/ui/Hud.js');
    const { mockDoc, getEl } = setupMockDocument();
    const origDoc = globalThis.document;
    globalThis.document = mockDoc;

    try {
      const hud = new Hud({ innerHTML: '' }, null, null, null);

      hud.updateSoundState(true);
      expect(getEl('hud-sound-icon').textContent).toBe('🔇');

      hud.updateSoundState(false);
      expect(getEl('hud-sound-icon').textContent).toBe('🔊');
    } finally {
      globalThis.document = origDoc;
    }
  });

  it('restricts webcam PIP preview and toggle button on non-CV stages (0 and 1)', async () => {
    const { Hud } = await import('../src/ui/Hud.js');
    const { mockDoc, getEl } = setupMockDocument();
    const origDoc = globalThis.document;
    globalThis.document = mockDoc;

    try {
      const hud = new Hud({ innerHTML: '' }, null, null, null);

      // Stage 0: Keyboard (non-CV)
      hud.announceStage(0);
      expect(getEl('btn-toggle-cam').classList.contains('hidden')).toBe(true);
      hud.showWebcamPip(true);
      expect(getEl('webcam-pip').classList.contains('hidden')).toBe(true);

      // Stage 1: Pointer (non-CV)
      hud.announceStage(1);
      expect(getEl('btn-toggle-cam').classList.contains('hidden')).toBe(true);
      hud.showWebcamPip(true);
      expect(getEl('webcam-pip').classList.contains('hidden')).toBe(true);

      // Stage 2: FaceZone (CV stage)
      hud.announceStage(2);
      expect(getEl('btn-toggle-cam').classList.contains('hidden')).toBe(false);
      hud.showWebcamPip(true);
      expect(getEl('webcam-pip').classList.contains('hidden')).toBe(false);

      // Loop back to Stage 0: Keyboard
      hud.announceStage(0);
      expect(getEl('btn-toggle-cam').classList.contains('hidden')).toBe(true);
      expect(getEl('webcam-pip').classList.contains('hidden')).toBe(true);
    } finally {
      globalThis.document = origDoc;
    }
  });

  it('opens webcam PIP immediately when launched directly into a CV stage without prior announceStage', async () => {
    const { Hud } = await import('../src/ui/Hud.js');
    const { mockDoc, getEl } = setupMockDocument();
    const origDoc = globalThis.document;
    globalThis.document = mockDoc;

    try {
      const hud = new Hud({ innerHTML: '' }, null, null, null);

      // Direct launch with stage 2 passed as forcedStage
      hud.showWebcamPip(true, 2);
      expect(getEl('webcam-pip').classList.contains('hidden')).toBe(false);

      // Announce stage 2 directly
      hud.announceStage(2);
      expect(getEl('btn-toggle-cam').classList.contains('hidden')).toBe(false);
      expect(getEl('webcam-pip').classList.contains('hidden')).toBe(false);
    } finally {
      globalThis.document = origDoc;
    }
  });

  it('exposes speedMultiplier in hud.settings and respects defaults', async () => {
    const { Hud } = await import('../src/ui/Hud.js');
    const { mockDoc } = setupMockDocument();
    const origDoc = globalThis.document;
    globalThis.document = mockDoc;

    try {
      const hud = new Hud({ innerHTML: '' }, null, null, null);
      expect(hud.settings).toBeDefined();
      expect(typeof hud.settings.speedMultiplier).toBe('number');
      expect(hud.settings.speedMultiplier).toBe(1.0);
    } finally {
      globalThis.document = origDoc;
    }
  });

  it('renders Adaptive AI Summary card in showGameOver with flow rate, TTC, assists, and kinematics', async () => {
    const { Hud } = await import('../src/ui/Hud.js');
    const { mockDoc, getEl } = setupMockDocument();
    const origDoc = globalThis.document;
    globalThis.document = mockDoc;

    try {
      const hud = new Hud({ innerHTML: '' }, null, null, null);

      const aiSummary = {
        dda: {
          timeInAssistSec: 5.0,
          timeInOptimalSec: 35.0,
          timeInChallengeSec: 10.0,
          totalCollisions: 2,
          recentSamples: 5,
          averageScore: 0.8,
          playStyle: {
            archetype: 'risk_taker',
            maneuverArchetype: 'weaver',
            personaTitle: '🔥 Risk Weaver',
            avgTtcMs: 310,
            sampleCount: 5,
            nearMissCount: 3,
            regularityPct: 82
          }
        },
        kinematics: {
          headMeters: 1.8,
          handMeters: 3.4,
          style: 'minimalist',
          styleLabel: 'Minimalist',
          icon: '🎯'
        }
      };

      hud.showGameOver(350.5, 500, 42, aiSummary);

      expect(getEl('death-dist').textContent).toBe(350);
      expect(getEl('death-best').textContent).toBe(500);
      expect(getEl('death-coins').textContent).toBe(42);

      // AI Card visibility
      expect(getEl('death-ai-card').classList.contains('hidden')).toBe(false);

      // Flow rate: 35 / (5 + 35 + 10) = 70%
      expect(getEl('death-ai-flow-val').textContent).toBe('70%');

      // TTC
      expect(getEl('death-ai-ttc-val').textContent).toBe('310 ms');

      // Assists
      expect(getEl('death-ai-assists-val').textContent).toBe('2');

      // Kinematics
      expect(getEl('death-ai-kin-val').textContent).toContain('1.8');
      expect(getEl('death-ai-kin-val').textContent).toContain('3.4');

      // Persona
      expect(getEl('death-ai-persona').textContent).toContain('Risk Weaver');
    } finally {
      globalThis.document = origDoc;
    }
  });

  it('renders physical interaction counters in showGameOver (buttons, head tilts, hand gestures, distance, near-misses)', async () => {
    const { Hud } = await import('../src/ui/Hud.js');
    const { mockDoc, getEl } = setupMockDocument();
    const origDoc = globalThis.document;
    globalThis.document = mockDoc;

    try {
      const hud = new Hud({ innerHTML: '' }, null, null, null);

      const summary = {
        actions: {
          buttonPresses: 42,
          headTiltsLeftRight: 14,
          headTiltsUpDown: 8,
          totalHeadTilts: 22,
          handGestures: 19,
          nearMisses: 6,
          totalActions: 83
        }
      };

      hud.showGameOver(1450.8, 2000, 75, summary);

      // Card must be visible
      expect(getEl('death-ai-card').classList.contains('hidden')).toBe(false);

      // 1. Distance
      expect(getEl('death-act-dist').textContent).toBe('1450 м');

      // 2. Near-misses
      expect(getEl('death-act-nearmiss').textContent).toBe('6');

      // 3. Button presses
      expect(getEl('death-act-buttons').textContent).toBe('42');

      // 4. Hand gestures
      expect(getEl('death-act-hands').textContent).toBe('19');

      // 5. Head tilts
      expect(getEl('death-act-head-total').textContent).toBe('22');
      expect(getEl('death-act-head-lr').textContent).toBe('14');
      expect(getEl('death-act-head-ud').textContent).toBe('8');

      // Header total actions badge
      expect(getEl('death-ai-persona').textContent).toContain('83');
    } finally {
      globalThis.document = origDoc;
    }
  });

  it('hides Adaptive AI Summary card in showGameOver when no AI summary is passed', async () => {
    const { Hud } = await import('../src/ui/Hud.js');
    const { mockDoc, getEl } = setupMockDocument();
    const origDoc = globalThis.document;
    globalThis.document = mockDoc;

    try {
      const hud = new Hud({ innerHTML: '' }, null, null, null);
      hud.showGameOver(120, 200, 10, null);

      expect(getEl('death-ai-card').classList.contains('hidden')).toBe(true);
      expect(getEl('death-dist').textContent).toBe(120);
    } finally {
      globalThis.document = origDoc;
    }
  });

  it('displays and auto-hides near-miss toast notifications via showToast', async () => {
    vi.useFakeTimers();
    const { Hud } = await import('../src/ui/Hud.js');
    const { mockDoc, getEl } = setupMockDocument();
    const origDoc = globalThis.document;
    globalThis.document = mockDoc;

    try {
      const hud = new Hud({ innerHTML: '' }, null, null, null);
      hud.showToast('🔥 NEAR-MISS! +150 (3.2m)', '#00e5ff', 1200);

      const toastEl = getEl('hud-toast');
      expect(toastEl.textContent).toBe('🔥 NEAR-MISS! +150 (3.2m)');
      expect(toastEl.style.color).toBe('#00e5ff');
      expect(toastEl.classList.contains('visible')).toBe(true);

      vi.advanceTimersByTime(1200);
      expect(toastEl.classList.contains('visible')).toBe(false);

      // Showing again and clearing via hideToast
      hud.showToast('🔥 NEAR-MISS! +150 (2.1m)', '#ff3d5e', 1500);
      expect(toastEl.classList.contains('visible')).toBe(true);
      hud.hideToast();
      expect(toastEl.classList.contains('visible')).toBe(false);
    } finally {
      globalThis.document = origDoc;
      vi.useRealTimers();
    }
  });
});
