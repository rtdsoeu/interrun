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
