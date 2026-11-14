/**
 * BenchmarkCameraPreview — Live camera feed and landmark overlay inside the benchmark modal.
 */

import { isCvStage } from './BenchmarkDefinitions.js';

export class BenchmarkCameraPreview {
  /**
   * @param {HTMLCanvasElement} [canvas]
   * @param {HTMLElement} [wrapper]
   * @param {Object} [visionManager]
   */
  constructor(canvas = null, wrapper = null, visionManager = null) {
    this.canvas = canvas;
    this.wrapper = wrapper;
    this.visionManager = visionManager;
    this.ctx = canvas?.getContext?.('2d') || null;

    this._rafId = null;
    this._isRunning = false;
    this._stageKey = 'stage4';
    this._lastDrawTime = 0;
  }

  setVisionManager(vm) {
    this.visionManager = vm;
  }

  _resolveElements() {
    if (typeof document === 'undefined') return;
    if (!this.canvas) {
      this.canvas = document.getElementById('bench-webcam-canvas');
      if (this.canvas) {
        this.ctx = this.canvas.getContext?.('2d') || null;
      }
    }
    if (!this.wrapper) {
      this.wrapper = document.getElementById('bench-cam-wrap');
    }
  }

  setStageKey(stageKey) {
    this._stageKey = stageKey;
    const isCv = isCvStage(stageKey);
    this._resolveElements();
    if (this.wrapper) {
      this.wrapper.style.display = isCv ? 'block' : 'none';
    }
  }

  start(stageKey = this._stageKey) {
    this.setStageKey(stageKey);
    if (!isCvStage(stageKey)) {
      this.stop();
      return;
    }

    if (this._isRunning) return;
    this._isRunning = true;

    const raf = typeof requestAnimationFrame !== 'undefined'
      ? requestAnimationFrame
      : (cb) => setTimeout(() => cb(performance.now()), 33);

    const renderLoop = (time) => {
      if (!this._isRunning) return;
      this._render(time);
      this._rafId = raf(renderLoop);
    };

    this._rafId = raf(renderLoop);
  }

  stop() {
    this._isRunning = false;
    if (this._rafId) {
      if (typeof cancelAnimationFrame !== 'undefined') {
        cancelAnimationFrame(this._rafId);
      } else {
        clearTimeout(this._rafId);
      }
      this._rafId = null;
    }
    this._clear();
  }

  _clear() {
    this._resolveElements();
    if (!this.ctx || !this.canvas) return;
    this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
  }

  _render(now) {
    this._resolveElements();
    if (!this.ctx || !this.canvas) return;

    // Throttle to ~30 FPS (~33ms) to minimize GPU/CPU overhead during testing
    if (now - this._lastDrawTime < 33) return;
    this._lastDrawTime = now;

    const W = this.canvas.width || 320;
    const H = this.canvas.height || 240;
    const ctx = this.ctx;

    const vm = this.visionManager;
    const video = vm?.video;

    // Check if video is streaming
    if (!video || video.readyState < 2) {
      ctx.fillStyle = '#080d1a';
      ctx.fillRect(0, 0, W, H);
      ctx.fillStyle = 'rgba(0, 229, 255, 0.85)';
      ctx.font = 'bold 12px sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText('⏳ Підключення вебкамери...', W / 2, H / 2);
      return;
    }

    // Draw mirrored video stream
    ctx.save();
    ctx.clearRect(0, 0, W, H);
    ctx.setTransform(-1, 0, 0, 1, W, 0);
    ctx.drawImage(video, 0, 0, W, H);
    ctx.restore();

    // Render 3x3 grid overlay if testing Zone or HandZone
    if (this._stageKey === 'stage2' || this._stageKey === 'stage3') {
      this._drawZoneGrid(W, H, this._stageKey);
    }

    // Render landmark points (hand / face)
    const pts = vm?.currentState?.points;
    if (pts && pts.length > 0) {
      for (let i = 0; i < pts.length; i++) {
        const p = pts[i];
        const px = p.x * W;
        const py = p.y * H;
        const r = p.r || 3.5;

        ctx.beginPath();
        ctx.arc(px, py, r, 0, Math.PI * 2);
        ctx.fillStyle = p.color || '#00e5ff';
        ctx.fill();
        ctx.strokeStyle = 'rgba(0,0,0,0.4)';
        ctx.lineWidth = 1;
        ctx.stroke();
      }
    }
  }

  _drawZoneGrid(W, H, stageKey) {
    const ctx = this.ctx;
    const isHand = stageKey === 'stage3';

    // Grid boundary thresholds
    const xL = (isHand ? 0.33 : 0.40) * W;
    const xR = (isHand ? 0.66 : 0.60) * W;
    const yT = (isHand ? 0.33 : 0.35) * H;
    const yB = (isHand ? 0.76 : 0.72) * H;

    // Active zone highlight
    const st = this.visionManager?.currentState;
    const col = isHand ? st?.hzCol : st?.zoneCol;
    const row = isHand ? st?.hzRow : st?.zoneRow;

    let x0 = 0, x1 = xL;
    if (col === 'C') { x0 = xL; x1 = xR; }
    else if (col === 'R') { x0 = xR; x1 = W; }

    let y0 = 0, y1 = yT;
    if (row === 'mid') { y0 = yT; y1 = yB; }
    else if (row === 'bot') { y0 = yB; y1 = H; }

    ctx.save();
    ctx.fillStyle = 'rgba(0, 255, 136, 0.18)';
    ctx.fillRect(x0, y0, x1 - x0, y1 - y0);

    // Grid lines
    ctx.strokeStyle = 'rgba(0, 229, 255, 0.45)';
    ctx.lineWidth = 1.5;
    ctx.setLineDash([4, 3]);

    ctx.beginPath();
    ctx.moveTo(xL, 0); ctx.lineTo(xL, H);
    ctx.moveTo(xR, 0); ctx.lineTo(xR, H);
    ctx.moveTo(0, yT); ctx.lineTo(W, yT);
    ctx.moveTo(0, yB); ctx.lineTo(W, yB);
    ctx.stroke();

    ctx.restore();
  }
}
