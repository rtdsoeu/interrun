/**
 * SettingsModal — manages the configuration modal for audio, CV, and graphics.
 * - Volume sliders (BGM & SFX)
 * - Music track selection
 * - Computer vision resolution and target FPS presets
 * - PIP camera display mode (full / minimal / off)
 * - Viewport framing and render scaling
 */

export class SettingsModal {
  constructor({
    onApplySettings = null,
    onUpdateAudioSettings = null,
    onApplyDisplaySettings = null
  } = {}) {
    this.onApplySettings = onApplySettings;
    this.onUpdateAudioSettings = onUpdateAudioSettings;
    this.onApplyDisplaySettings = onApplyDisplaySettings;
  }

  get elModal() {
    return document.getElementById('settings-modal');
  }

  isOpen() {
    return !!this.elModal && !this.elModal.classList.contains('hidden');
  }

  open(settings, soundFx = null, visionManager = null) {
    if (visionManager) {
      Object.assign(settings, visionManager.settings);
    }
    if (soundFx) {
      settings.sfxVolume = soundFx.sfxVolume;
      settings.bgmVolume = soundFx.bgmVolume;
    }
    this.elModal?.classList.remove('hidden');

    const sliderBgm = document.getElementById('slider-bgm-vol');
    const valBgm = document.getElementById('settings-bgm-val');
    if (sliderBgm) sliderBgm.value = settings.bgmVolume;
    if (valBgm) valBgm.textContent = `${Math.round(settings.bgmVolume * 100)}%`;

    const sliderSfx = document.getElementById('slider-sfx-vol');
    const valSfx = document.getElementById('settings-sfx-val');
    if (sliderSfx) sliderSfx.value = settings.sfxVolume;
    if (valSfx) valSfx.textContent = `${Math.round(settings.sfxVolume * 100)}%`;

    const elTrack = document.getElementById('settings-current-track-name');
    if (elTrack && soundFx) {
      elTrack.textContent = soundFx.currentTrackTitle;
    }

    this.updateButtons(settings);
  }

  close() {
    this.elModal?.classList.add('hidden');
  }

  toggle(settings, soundFx = null, visionManager = null) {
    if (this.isOpen()) {
      this.close();
    } else {
      this.open(settings, soundFx, visionManager);
    }
  }

  updateButtons(settings) {
    document.querySelectorAll('.setting-opt-btn').forEach(btn => {
      const group = btn.getAttribute('data-group');
      const val = btn.getAttribute('data-val');
      let isSelected = false;
      if (group === 'sfxVolume' || group === 'bgmVolume' || group === 'renderScale') {
        const numVal = parseFloat(val);
        const curVal = settings[group];
        isSelected = Math.abs(numVal - curVal) < 0.05;
      } else {
        isSelected = (val === String(settings[group]));
      }
      btn.classList.toggle('selected', isSelected);
      btn.style.borderColor = isSelected ? 'var(--accent)' : 'rgba(255,255,255,0.12)';
      btn.style.background  = isSelected ? 'rgba(0,229,255,0.18)' : 'rgba(255,255,255,0.04)';
      btn.style.color       = isSelected ? '#00e5ff' : 'rgba(255,255,255,0.8)';
    });
  }

  bindUI(settings, soundFx, visionManager, bindFastTap) {
    // Open & close triggers
    bindFastTap('btn-hud-settings', () => this.open(settings, soundFx, visionManager));
    bindFastTap('btn-open-settings', () => this.open(settings, soundFx, visionManager));
    bindFastTap('btn-close-settings', () => this.close());

    // Save & apply
    bindFastTap('btn-settings-save', () => {
      this.close();
      if (visionManager) {
        visionManager.applySettings(settings);
      }
      if (this.onApplySettings) {
        this.onApplySettings(settings);
      }
      if (this.onUpdateAudioSettings) {
        this.onUpdateAudioSettings({
          sfxVolume: settings.sfxVolume,
          bgmVolume: settings.bgmVolume
        });
      }
      if (this.onApplyDisplaySettings) {
        this.onApplyDisplaySettings({
          viewportFrame: settings.viewportFrame,
          renderScale: settings.renderScale
        });
      }
    });

    // Audio Sliders
    const sliderBgm = document.getElementById('slider-bgm-vol');
    const valBgm = document.getElementById('settings-bgm-val');
    if (sliderBgm) {
      sliderBgm.addEventListener('input', (e) => {
        const val = parseFloat(e.target.value);
        settings.bgmVolume = val;
        if (valBgm) valBgm.textContent = `${Math.round(val * 100)}%`;
        if (this.onUpdateAudioSettings) {
          this.onUpdateAudioSettings({ bgmVolume: val });
        }
      });
    }

    const sliderSfx = document.getElementById('slider-sfx-vol');
    const valSfx = document.getElementById('settings-sfx-val');
    if (sliderSfx) {
      sliderSfx.addEventListener('input', (e) => {
        const val = parseFloat(e.target.value);
        settings.sfxVolume = val;
        if (valSfx) valSfx.textContent = `${Math.round(val * 100)}%`;
        if (this.onUpdateAudioSettings) {
          this.onUpdateAudioSettings({ sfxVolume: val });
        }
      });
    }

    // Track Playlist Switcher
    bindFastTap('btn-track-prev', () => {
      soundFx?.prevTrack();
    });
    bindFastTap('btn-track-next', () => {
      soundFx?.nextTrack();
    });

    if (soundFx?.music) {
      soundFx.music.onTrackChange = (title) => {
        const elTrack = document.getElementById('settings-current-track-name');
        if (elTrack) elTrack.textContent = title;
      };
    }

    // Setting option buttons (presets)
    document.querySelectorAll('.setting-opt-btn').forEach(btn => {
      bindFastTap(btn, () => {
        const group = btn.getAttribute('data-group');
        const val = btn.getAttribute('data-val');
        if (group && val) {
          if (group === 'targetFps') {
            settings[group] = parseInt(val, 10);
          } else if (group === 'sfxVolume' || group === 'bgmVolume') {
            const num = parseFloat(val);
            settings[group] = num;
            if (this.onUpdateAudioSettings) {
              this.onUpdateAudioSettings({ [group]: num });
            }
          } else if (group === 'renderScale') {
            const num = parseFloat(val);
            settings[group] = num;
            if (this.onApplyDisplaySettings) {
              this.onApplyDisplaySettings({ renderScale: num });
            }
          } else if (group === 'viewportFrame') {
            settings[group] = val;
            if (this.onApplyDisplaySettings) {
              this.onApplyDisplaySettings({ viewportFrame: val });
            }
          } else {
            settings[group] = val;
          }
          this.updateButtons(settings);
        }
      });
    });
  }
}
