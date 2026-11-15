/**
 * DebugModal — debug launcher and live tweak panel.
 * - Stage selector (0..5) with double-click quick launch
 * - Game speed selector (0.5x .. 2.0x)
 * - God mode and stage lock toggles
 * - Live update of active game parameters
 */

export class DebugModal {
  constructor({ onStartDebug = null, onApplyLiveDebug = null, soundFx = null } = {}) {
    this.onStartDebug = onStartDebug;
    this.onApplyLiveDebug = onApplyLiveDebug;
    this.soundFx = soundFx;

    this.selectedStage = 0;
    this.selectedSpeed = 1.0;
  }

  get elModal() {
    return document.getElementById('debug-modal');
  }

  get elOptLock() {
    return document.getElementById('debug-opt-lock');
  }

  get elOptGod() {
    return document.getElementById('debug-opt-god');
  }

  get elOptDda() {
    return document.getElementById('debug-opt-dda');
  }

  open() {
    this.elModal?.classList.remove('hidden');
    this.updateStageButtons();
    this.updateSpeedButtons();
  }

  close() {
    this.elModal?.classList.add('hidden');
  }

  toggle() {
    if (this.elModal?.classList.contains('hidden')) {
      this.open();
    } else {
      this.close();
    }
  }

  isOpen() {
    return !!this.elModal && !this.elModal.classList.contains('hidden');
  }

  updateStageButtons() {
    document.querySelectorAll('.debug-stage-btn').forEach(btn => {
      const stage = parseInt(btn.getAttribute('data-stage') || '0', 10);
      btn.classList.toggle('selected', stage === this.selectedStage);
    });
  }

  updateSpeedButtons() {
    document.querySelectorAll('.debug-speed-btn').forEach(btn => {
      const speed = parseFloat(btn.getAttribute('data-speed') || '1.0');
      const isSelected = Math.abs(speed - this.selectedSpeed) < 0.05;
      btn.classList.toggle('selected', isSelected);
      btn.style.borderColor = isSelected ? '#00e5ff' : 'rgba(255,255,255,0.12)';
      btn.style.background  = isSelected ? 'rgba(0,229,255,0.18)' : 'rgba(255,255,255,0.04)';
      btn.style.color       = isSelected ? '#00e5ff' : 'rgba(255,255,255,0.8)';
    });
  }

  bindUI(bindFastTap) {
    // Open/close buttons
    bindFastTap('btn-debug-hud', () => this.open());
    bindFastTap('btn-debug-menu', () => this.open());
    bindFastTap('btn-debug-restart', () => this.open());
    bindFastTap('btn-close-debug', () => this.close());

    // Debug stage buttons
    document.querySelectorAll('.debug-stage-btn').forEach(btn => {
      bindFastTap(btn, () => {
        this.selectedStage = parseInt(btn.getAttribute('data-stage') || '0', 10);
        this.updateStageButtons();
      });
      btn.addEventListener('dblclick', () => {
        this.selectedStage = parseInt(btn.getAttribute('data-stage') || '0', 10);
        this.updateStageButtons();
        const isLocked = !!this.elOptLock?.checked;
        const isGod    = !!this.elOptGod?.checked;
        const isDda    = this.elOptDda ? !!this.elOptDda.checked : true;
        this.close();
        if (this.onStartDebug) {
          this.onStartDebug(this.selectedStage, isLocked, isGod, this.selectedSpeed, isDda);
        }
      });
    });

    // Debug speed buttons
    document.querySelectorAll('.debug-speed-btn').forEach(btn => {
      bindFastTap(btn, () => {
        this.selectedSpeed = parseFloat(btn.getAttribute('data-speed') || '1.0');
        this.updateSpeedButtons();
      });
    });

    // Launch button
    bindFastTap('btn-debug-launch-exec', () => {
      this.soundFx?.init();
      const isLocked = !!this.elOptLock?.checked;
      const isGod    = !!this.elOptGod?.checked;
      const isDda    = this.elOptDda ? !!this.elOptDda.checked : true;
      this.close();
      if (this.onStartDebug) {
        this.onStartDebug(this.selectedStage, isLocked, isGod, this.selectedSpeed, isDda);
      }
    });

    // Live apply button
    bindFastTap('btn-debug-live-apply', () => {
      const isLocked = !!this.elOptLock?.checked;
      const isGod    = !!this.elOptGod?.checked;
      const isDda    = this.elOptDda ? !!this.elOptDda.checked : true;
      this.close();
      if (this.onApplyLiveDebug) {
        this.onApplyLiveDebug(this.selectedStage, isLocked, isGod, this.selectedSpeed, isDda);
      }
    });
  }
}
