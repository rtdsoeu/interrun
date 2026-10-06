import { describe, it, expect } from 'vitest';
import { getHUDHtml } from '../src/ui/templates.js';
import { translations } from '../src/i18n/translations.js';

describe('UI Templates (getHUDHtml)', () => {
  const dummyT = (key) => translations[key]?.en || key;
  const dummyI18n = { lang: 'en', t: dummyT };

  it('renders getHUDHtml without errors with default empty state', () => {
    const html = getHUDHtml(dummyT, dummyI18n, {});
    expect(html).toContain('id="hud"');
    expect(html).toContain('id="hud-bottom-left"');
    expect(html).toContain('id="hud-fps"');
    expect(html).toContain('id="hud-cv-panel"');
    expect(html).toContain('id="hud-cam-lowlight-badge"');
    expect(html).toContain('id="slider-bgm-vol"');
    expect(html).toContain('id="slider-sfx-vol"');
    expect(html).toContain('id="settings-modal"');
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
    const { HUD } = await import('../src/ui/HUD.js');
    const { mockDoc, getEl } = setupMockDocument();
    const origDoc = globalThis.document;
    globalThis.document = mockDoc;

    try {
      const hud = new HUD({ innerHTML: '' }, null, null, null);

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
    const { HUD } = await import('../src/ui/HUD.js');
    const { mockDoc, getEl } = setupMockDocument();
    const origDoc = globalThis.document;
    globalThis.document = mockDoc;

    try {
      const hud = new HUD({ innerHTML: '' }, null, null, null);

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
    const { HUD } = await import('../src/ui/HUD.js');
    const { mockDoc, getEl } = setupMockDocument();
    const origDoc = globalThis.document;
    globalThis.document = mockDoc;

    try {
      const hud = new HUD({ innerHTML: '' }, null, null, null);

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
    const { HUD } = await import('../src/ui/HUD.js');
    const { mockDoc, getEl } = setupMockDocument();
    const origDoc = globalThis.document;
    globalThis.document = mockDoc;

    try {
      const hud = new HUD({ innerHTML: '' }, null, null, null);

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
    const { HUD } = await import('../src/ui/HUD.js');
    const { mockDoc, getEl } = setupMockDocument();
    const origDoc = globalThis.document;
    globalThis.document = mockDoc;

    try {
      const hud = new HUD({ innerHTML: '' }, null, null, null);

      hud.updateSoundState(true);
      expect(getEl('hud-sound-icon').textContent).toBe('🔇');

      hud.updateSoundState(false);
      expect(getEl('hud-sound-icon').textContent).toBe('🔊');
    } finally {
      globalThis.document = origDoc;
    }
  });
});
