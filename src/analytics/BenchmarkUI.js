/**
 * BenchmarkUI — Real-time gesture confidence monitor and webcam preview controller.
 */

import { i18n } from '../i18n/I18n.js';
import {
  getBenchmarkClasses,
  getBenchmarkIcons,
  getBenchmarkHints,
  isCvStage,
  getModeForStage,
  getBenchmarkButtonLabels,
  calculateConfidence,
  mapCvStateToClass
} from './BenchmarkDefinitions.js';
import { BenchmarkCameraPreview } from './BenchmarkCameraPreview.js';

export class BenchmarkUI {
  /**
   * @param {Object} options
   * @param {Object} [options.benchmark] Optional benchmark instance
   * @param {Object} [options.visionManager] VisionManager instance
   * @param {Function} [options.onShowPip] Optional callback to control PIP
   */
  constructor(options = {}) {
    this.gestureBenchmark = options.benchmark || null;
    this.visionManager = options.visionManager || null;
    this.onShowPip = options.onShowPip || null;

    this.cameraPreview = null;
    this._camInitPromise = null;

    // Interactive confidence meter state
    this.selectedGesture = 'fist';
    this._confidenceRafId = null;
    this._confidenceInterval = null;
    this._confidenceActive = false;
    this._smoothedConfidence = 0;
  }

  get isRunning() {
    return false;
  }

  setVisionManager(vm) {
    this.visionManager = vm;
    if (this.cameraPreview) {
      this.cameraPreview.setVisionManager(vm);
    }
  }

  setBenchmark(bm) {
    this.gestureBenchmark = bm;
  }

  bindUI() {
    if (typeof document === 'undefined') return;

    const canvas = document.getElementById('bench-webcam-canvas');
    const wrap = document.getElementById('bench-cam-wrap');

    if (canvas && wrap) {
      if (!this.cameraPreview) {
        this.cameraPreview = new BenchmarkCameraPreview(canvas, wrap, this.visionManager);
      } else {
        this.cameraPreview.canvas = canvas;
        this.cameraPreview.wrapper = wrap;
        this.cameraPreview.ctx = canvas.getContext?.('2d') || null;
        if (this.visionManager) {
          this.cameraPreview.setVisionManager(this.visionManager);
        }
      }
    }

    const selTarget = document.getElementById('bench-select-target');
    if (selTarget && !selTarget._benchBound) {
      selTarget._benchBound = true;
      selTarget.addEventListener('change', () => this.onTargetChanged());
    }

    const curStage = selTarget?.value || 'stage4';
    this.renderGestureButtons(curStage);
    this.startConfidenceLoop();
  }

  renderGestureButtons(stageKey) {
    if (typeof document === 'undefined') return;
    const container = document.getElementById('bench-gesture-buttons');
    if (!container) return;

    const classes = getBenchmarkClasses(stageKey);
    const labels = getBenchmarkButtonLabels(stageKey);

    if (!classes.includes(this.selectedGesture)) {
      this.selectedGesture = classes.includes('fist') ? 'fist' : classes[0];
    }

    let html = '';
    for (const c of classes) {
      const isSel = (c === this.selectedGesture);
      const border = isSel ? '#00ff88' : 'rgba(255,255,255,0.15)';
      const bg = isSel ? 'rgba(0,255,136,0.18)' : 'rgba(255,255,255,0.04)';
      const color = isSel ? '#00ff88' : '#fff';
      const shadow = isSel ? '0 0 10px rgba(0,255,136,0.3)' : 'none';
      const label = labels[c] || c;

      html += `<button class="bench-gesture-btn btn-ghost ${isSel ? 'selected' : ''}" data-gesture="${c}" style="padding:8px 14px; font-size:12px; border-radius:8px; cursor:pointer; font-weight:700; transition:all 0.15s ease; border:1px solid ${border}; background:${bg}; color:${color}; box-shadow:${shadow};">${label}</button>`;
    }

    container.innerHTML = html;

    if (typeof container.querySelectorAll === 'function') {
      const buttons = container.querySelectorAll('.bench-gesture-btn');
      for (const btn of buttons) {
        btn.addEventListener?.('click', (e) => {
          e.preventDefault?.();
          const g = btn.getAttribute?.('data-gesture') || btn.dataset?.gesture;
          if (g) this.selectGesture(g, stageKey);
        });
      }
    }

    this._updateTargetName(stageKey);
  }

  selectGesture(gestureKey, stageKey) {
    this.selectedGesture = gestureKey;
    const sel = document.getElementById('bench-select-target');
    const curStage = stageKey || sel?.value || 'stage4';

    const container = document.getElementById('bench-gesture-buttons');
    if (container && typeof container.querySelectorAll === 'function') {
      const buttons = container.querySelectorAll('.bench-gesture-btn');
      for (const btn of buttons) {
        const g = btn.getAttribute?.('data-gesture') || btn.dataset?.gesture;
        const isSel = g === gestureKey;
        btn.classList?.toggle('selected', isSel);
        if (btn.style) {
          btn.style.border = isSel ? '1px solid #00ff88' : '1px solid rgba(255,255,255,0.15)';
          btn.style.background = isSel ? 'rgba(0,255,136,0.18)' : 'rgba(255,255,255,0.04)';
          btn.style.color = isSel ? '#00ff88' : '#fff';
          btn.style.boxShadow = isSel ? '0 0 10px rgba(0,255,136,0.3)' : 'none';
        }
      }
    }

    this._updateTargetName(curStage);
    this._smoothedConfidence = 0;
  }

  _updateTargetName(stageKey) {
    if (typeof document === 'undefined') return;
    const targetNameEl = document.getElementById('bench-target-name');
    const labels = getBenchmarkButtonLabels(stageKey);
    const icons = getBenchmarkIcons(stageKey);

    const displayName = labels[this.selectedGesture] || icons[this.selectedGesture] || this.selectedGesture;
    if (targetNameEl) {
      targetNameEl.textContent = displayName;
    }
  }

  async onTargetChanged() {
    this.bindUI();

    const sel = document.getElementById('bench-select-target');
    const stageKey = sel?.value || 'stage4';

    this.renderGestureButtons(stageKey);

    const detectedEl = document.getElementById('bench-detected-gesture');
    if (detectedEl) {
      detectedEl.textContent = '--';
      detectedEl.style.color = 'var(--accent)';
    }

    const isCv = isCvStage(stageKey);
    const wrap = document.getElementById('bench-cam-wrap');
    if (wrap) {
      wrap.style.display = isCv ? 'block' : 'none';
    }

    if (this.cameraPreview) {
      this.cameraPreview.setStageKey(stageKey);
    }

    if (isCv) {
      if (this.cameraPreview) {
        this.cameraPreview.start(stageKey);
      }
      if (this.visionManager && !this.visionManager.isReady && !this.visionManager.hasCameraError) {
        this.ensureCameraReady(stageKey);
      } else if (this.visionManager?.isReady) {
        this.visionManager.setMode(getModeForStage(stageKey));
      }
    } else {
      if (this.cameraPreview) {
        this.cameraPreview.stop();
      }
    }

    this.startConfidenceLoop();
  }

  startConfidenceLoop() {
    this.stopConfidenceLoop();
    this._confidenceActive = true;

    const tick = () => {
      if (!this._confidenceActive) return;
      this._updateConfidenceMeter();
      if (typeof window !== 'undefined' && typeof window.requestAnimationFrame === 'function') {
        this._confidenceRafId = window.requestAnimationFrame(tick);
      } else {
        this._confidenceInterval = setTimeout(tick, 50);
      }
    };

    tick();
  }

  stopConfidenceLoop() {
    this._confidenceActive = false;
    if (typeof window !== 'undefined' && this._confidenceRafId) {
      window.cancelAnimationFrame(this._confidenceRafId);
      this._confidenceRafId = null;
    }
    if (this._confidenceInterval) {
      clearTimeout(this._confidenceInterval);
      this._confidenceInterval = null;
    }
  }

  _updateConfidenceMeter() {
    if (typeof document === 'undefined') return;

    const sel = document.getElementById('bench-select-target');
    const stageKey = sel?.value || 'stage4';
    const st = this.visionManager?.currentState;
    const targetClass = this.selectedGesture;

    // Raw target confidence
    const rawConf = calculateConfidence(stageKey, targetClass, st);

    // Smooth via EMA (fluid, responsive transitions)
    this._smoothedConfidence += (rawConf - this._smoothedConfidence) * 0.35;
    if (Math.abs(this._smoothedConfidence - rawConf) < 0.01) {
      this._smoothedConfidence = rawConf;
    }
    const pct = Math.max(0, Math.min(100, Math.round(this._smoothedConfidence * 100)));

    const barEl = document.getElementById('bench-confidence-bar');
    const pctEl = document.getElementById('bench-confidence-pct');
    const statusEl = document.getElementById('bench-confidence-status');
    const detectedEl = document.getElementById('bench-detected-gesture');

    // Live detected class
    const detected = mapCvStateToClass(stageKey, st);
    const labels = getBenchmarkButtonLabels(stageKey);

    if (detectedEl) {
      if (detected !== 'none') {
        detectedEl.textContent = labels[detected] || detected;
        detectedEl.style.color = (detected === targetClass) ? '#00ff88' : '#ff9f43';
      } else {
        detectedEl.textContent = '--';
        detectedEl.style.color = 'var(--accent)';
      }
    }

    if (barEl) {
      barEl.style.width = `${pct}%`;
      if (pct < 35) {
        barEl.style.background = 'linear-gradient(90deg, #ff3d5e, #ff6b35)';
        barEl.style.boxShadow = '0 0 8px rgba(255,61,94,0.3)';
      } else if (pct < 70) {
        barEl.style.background = 'linear-gradient(90deg, #00e5ff, #ffd700)';
        barEl.style.boxShadow = '0 0 10px rgba(255,215,0,0.35)';
      } else {
        barEl.style.background = 'linear-gradient(90deg, #00e5ff, #00ff88)';
        barEl.style.boxShadow = '0 0 16px rgba(0,255,136,0.6)';
      }
    }

    if (pctEl) {
      pctEl.textContent = `${pct}%`;
      if (pct < 35) {
        pctEl.style.color = '#ff3d5e';
      } else if (pct < 70) {
        pctEl.style.color = '#ffd700';
      } else {
        pctEl.style.color = '#00ff88';
      }
    }

    if (statusEl) {
      const isCv = isCvStage(stageKey);
      if (isCv && (!st || (!st.fgSource && !st.hzSource && !st.zoneSource))) {
        statusEl.textContent = stageKey === 'stage2'
          ? (i18n.t('telemetry.bench.status.no_face') || '👤 Position face in camera view')
          : (i18n.t('telemetry.bench.status.no_hand') || '✋ Place hand in front of camera');
        statusEl.style.color = 'rgba(255,255,255,0.6)';
      } else if (detected !== 'none' && detected !== targetClass) {
        statusEl.textContent = i18n.t('telemetry.bench.status.mismatch') || '⚠️ Different gesture detected! Show target gesture.';
        statusEl.style.color = '#ff9f43';
      } else if (detected === targetClass && pct >= 75) {
        statusEl.textContent = i18n.t('telemetry.bench.status.recognized') || '🎯 Excellent! Gesture clearly detected!';
        statusEl.style.color = '#00ff88';
      } else if (pct >= 35) {
        statusEl.textContent = i18n.t('telemetry.bench.status.holding') || '🤏 Forming gesture...';
        statusEl.style.color = '#ffd700';
      } else {
        statusEl.textContent = i18n.t('telemetry.bench.status.prompt') || 'Show selected gesture to camera';
        statusEl.style.color = 'rgba(255,255,255,0.7)';
      }
    }
  }

  async ensureCameraReady(stageKey) {
    if (!this.visionManager || this.visionManager.isReady || this.visionManager.hasCameraError) {
      if (this.visionManager?.isReady) {
        this.visionManager.setMode(getModeForStage(stageKey));
      }
      return;
    }

    if (this._camInitPromise) return this._camInitPromise;

    this._camInitPromise = (async () => {
      try {
        const pipCanvas = document.getElementById('webcam-canvas');
        await this.visionManager.initWebcam(pipCanvas);
        this.visionManager.setMode(getModeForStage(stageKey));
        if (this.cameraPreview) {
          this.cameraPreview.setVisionManager(this.visionManager);
          this.cameraPreview.start(stageKey);
        }
      } catch (err) {
        console.warn('[BenchmarkUI] Camera init failed:', err);
      } finally {
        this._camInitPromise = null;
      }
    })();

    return this._camInitPromise;
  }

  closeBenchmark() {
    this.stopConfidenceLoop();
    if (this.cameraPreview) {
      this.cameraPreview.stop();
    }
  }

  // Safe stubs for API compatibility
  runGestureBenchmark() {}
  stopGestureBenchmark() {}
  exportCsv() {}
  exportJson() {}
  _renderBenchmarkResults() {}

  getBenchmarkClasses(stageKey) {
    return getBenchmarkClasses(stageKey);
  }

  getBenchmarkIcons(stageKey) {
    return getBenchmarkIcons(stageKey);
  }

  getBenchmarkHints(stageKey) {
    return getBenchmarkHints(stageKey);
  }
}
