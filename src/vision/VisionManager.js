/**
 * VisionManager — высокопроизводительный модуль компьютерного зрения:
 * - ТРЕКИНГ ВЫНЕСЕН В ОТДЕЛЬНЫЙ ПОТОК (Web Worker).
 * - Главный поток Three.js НЕ БЛОКИРУЕТСЯ И ВЫДАЕТ 60+ FPS.
 * - Передача кадров через zero-copy ImageBitmap Transferable (аппаратный downscale до 256x192).
 * - Наглядная индикация в окне PIP вебкамеры: точки, статус действия, сетка зон.
 */
export const CV_RESOLUTION_PRESETS = {
  eco: { width: 160, height: 120 },
  balanced: { width: 256, height: 192 },
  high: { width: 320, height: 240 }
};

export class VisionManager {
  constructor() {
    this.video = null;
    this.canvas = null;
    this.ctx = null;
    this.stream = null;
    this.isReady = false;
    this.hasPermission = false;
    this.activeMode = null; // 'face' | 'hands' | 'pose' | 'mix' | 'zone'

    // CV Quality & Performance settings
    const savedRes = (typeof localStorage !== 'undefined') ? (localStorage.getItem('interrun_cv_res') || 'balanced') : 'balanced';
    const savedFps = (typeof localStorage !== 'undefined') ? parseInt(localStorage.getItem('interrun_cv_fps') || '30', 10) : 30;
    const savedPip = (typeof localStorage !== 'undefined') ? (localStorage.getItem('interrun_pip_mode') || 'full') : 'full';

    this.settings = {
      resolution: savedRes, // 'eco' (160x120) | 'balanced' (256x192) | 'high' (320x240)
      targetFps: savedFps,   // 20 | 30 | 45
      pipMode: savedPip      // 'full' | 'minimal' | 'off'
    };

    // Web Worker
    this.worker = null;
    this._workerReady = false;
    this._workerBusy = false;
    this._lastSendTime = 0;
    this._lastDrawTime = 0;
    this._loopRunning = false;
    this._pendingPreload = false; // set by preloadModels() before worker is ready

    // CV FPS & Latency metrics
    this.cvFps = 0;
    this.cvLatency = 0;
    this._cvFrameCount = 0;
    this._cvFpsTimer = performance.now();
    this.onFpsUpdate = null; // callback(fps, latency)

    // Recognition state (thread-safe O(1) read by game engine)
    this.currentState = {
      // Legacy поля для HeadControl / HandControl / PoseControl / MixControl
      headRoll: 0,
      headPitch: 0,
      handX: 0,
      handSwipeUp: false,
      handSwipeDown: false,
      bodyLeanX: 0,
      isSquatting: false,
      isJumping: false,
      // ZoneControl fields (Stage 2)
      zoneCol: 'C',       // 'L' | 'C' | 'R'
      zoneRow: 'mid',     // 'top' | 'mid' | 'bot'
      zoneSource: null,   // 'face' | 'hands' | null
      // HandZone fields for HandZoneControl (Stage 3) — hand only
      hzCol: 'C',         // 'L' | 'C' | 'R'
      hzRow: 'mid',       // 'top' | 'mid' | 'bot'
      hzSource: null,     // 'hands' | null
      // FingerGesture fields for FingerGestureControl (Stage 4)
      fgGesture: null,    // 'lane_left' | 'lane_center' | 'lane_right' | 'jump' | 'duck' | null
      fgSource: null,     // 'hand' | null
      // HandSwipe fields for HandSwipeControl (Stage 5) — air swipes
      hsSwipe: null,      // 'left' | 'right' | 'up' | 'down' | null
      hsSwipeId: 0,       // monotonic swipe event counter
      hsSource: null,     // 'hand' | null
      hsHandPos: null,    // { x, y }
      // Debug
      rawAction: '',
      debugText: '',
      points: []
    };
  }

  /**
   * Starts the Web Worker early (without requesting camera access) and queues
   * a background preload of the MediaPipe face + hand models.
   * Call this while the main menu is showing so that Stage 2+ begins
   * instantly when the player first reaches it.
   */
  preloadModels() {
    if (!this.worker) {
      this._initWorker();
    }
    if (this._workerReady) {
      this.worker.postMessage({ type: 'preload' });
    } else {
      // Worker not ready yet — flag it; the 'ready' handler will dispatch the request
      this._pendingPreload = true;
    }
  }

  async initWebcam(previewCanvas = null) {
    if (previewCanvas) {
      this.canvas = previewCanvas;
      this.ctx = this.canvas.getContext('2d');
      this.canvas.width = 320;
      this.canvas.height = 240;
    }

    if (this.isReady) {
      return true;
    }

    // Check for getUserMedia support
    if (!navigator?.mediaDevices?.getUserMedia) {
      console.warn('[VisionManager] WebRTC / getUserMedia is not supported or blocked in this context.');
      this.hasPermission = false;
      return false;
    }

    try {
      if (!this.video) {
        this.video = document.createElement('video');
        this.video.setAttribute('playsinline', '');
        this.video.setAttribute('webkit-playsinline', '');
        this.video.setAttribute('autoplay', '');
        this.video.setAttribute('muted', '');
        this.video.muted = true;
        this.video.style.display = 'none';
        document.body.appendChild(this.video);
      }

      // Request front-facing selfie camera with fallback
      try {
        this.stream = await navigator.mediaDevices.getUserMedia({
          video: {
            width: { ideal: 320 },
            height: { ideal: 240 },
            facingMode: 'user'
          },
          audio: false
        });
      } catch (userCamErr) {
        console.warn('[VisionManager] facingMode user failed, trying default camera:', userCamErr);
        this.stream = await navigator.mediaDevices.getUserMedia({
          video: true,
          audio: false
        });
      }

      this.video.srcObject = this.stream;
      await new Promise((resolve) => {
        this.video.onloadedmetadata = async () => {
          try {
            await this.video.play();
          } catch (playErr) {
            console.warn('[VisionManager] video.play() warning:', playErr);
          }
          resolve();
        };
      });

      this.hasPermission = true;
      this.isReady = true;

      // Start Web Worker background thread
      this._initWorker();

      // Start frame capture loop
      this._startCaptureLoop();

      return true;
    } catch (err) {
      console.warn('[VisionManager] Camera access error:', err);
      this.hasPermission = false;
      return false;
    }
  }

  _initWorker() {
    if (this.worker) return;

    try {
      this.worker = new Worker(new URL('./vision.worker.js', import.meta.url), {
        type: 'module'
      });

      this.worker.onmessage = (e) => {
        const msg = e.data;
        if (msg.type === 'ready') {
          this._workerReady = true;
          console.log('[VisionManager] Web Worker ready!');
          if (this.activeMode) {
            this.worker.postMessage({ type: 'setMode', mode: this.activeMode });
          } else if (this._pendingPreload) {
            // Send the deferred preload now that the worker is initialised
            this.worker.postMessage({ type: 'preload' });
            this._pendingPreload = false;
          }
        } else if (msg.type === 'model_ready') {
          console.log(`[VisionManager] Model ${msg.mode} ready in worker (delegate: ${msg.delegate || 'unknown'}, src: ${msg.src || 'unknown'})`);
        } else if (msg.type === 'preload_done') {
          console.log('[VisionManager] Background model preload complete — CV stages will start instantly');
        } else if (msg.type === 'processed') {
          this._workerBusy = false;
          if (msg.state) {
            this.currentState = msg.state;
          }
          const now = performance.now();
          this.cvLatency = Math.round(now - this._lastSendTime);
          this._cvFrameCount++;
          const elapsed = now - this._cvFpsTimer;
          if (elapsed >= 400) {
            this.cvFps = Math.round((this._cvFrameCount * 1000) / elapsed);
            this._cvFrameCount = 0;
            this._cvFpsTimer = now;
            if (this.onFpsUpdate) {
              this.onFpsUpdate(this.cvFps, this.cvLatency);
            }
          }
        } else if (msg.type === 'error') {
          this._workerBusy = false;
          console.warn('[VisionManager] Worker error:', msg.error);
        }
      };

      this.worker.onerror = (err) => {
        this._workerBusy = false;
        console.warn('[VisionManager] Worker onerror:', err);
      };

      this.worker.postMessage({ type: 'init' });
    } catch (err) {
      console.warn('[VisionManager] Error creating Web Worker:', err);
    }
  }

  setMode(mode) {
    this.activeMode = mode;
    if (this.worker) {
      this.worker.postMessage({ type: 'setMode', mode });
    }
  }

  /**
   * Фоновый цикл захвата:
   * Аппаратный быстрый снимок кадра createImageBitmap (< 0.2мс)
   * и передача владения без копирования памяти в системный поток Worker.
   * Рендер Three.js ни на миллисекунду не останавливается!
   */
  _startCaptureLoop() {
    if (this._loopRunning) return;
    this._loopRunning = true;

    const tick = async () => {
      if (!this._loopRunning) return;

      if (!this.isReady || !this.video) {
        requestAnimationFrame(tick);
        return;
      }

      const now = performance.now();

      // Watchdog timer: reset busy flag if worker doesn't respond within 1000ms
      if (this._workerBusy && now - this._lastSendTime > 1000) {
        this._workerBusy = false;
      }

      // Dynamic target FPS dispatch (e.g., 20fps = 50ms, 30fps = 33ms, 45fps = 22ms, 60fps = 16.6ms)
      const targetInterval = Math.round(1000 / (this.settings.targetFps || 30));
      // 8ms tolerance prevents skipping 60Hz display refresh frames due to sub-millisecond timer jitter
      const shouldSend = (now - this._lastSendTime >= targetInterval - 8);

      if (
        shouldSend &&
        !this._workerBusy &&
        this._workerReady &&
        this.worker &&
        this.activeMode &&
        this.video.readyState >= 2
      ) {
        this._workerBusy = true;
        this._lastSendTime = now;

        try {
          // Dynamic hardware downscaling based on performance settings (native GPU texture path)
          const preset = CV_RESOLUTION_PRESETS[this.settings.resolution] || CV_RESOLUTION_PRESETS.balanced;
          const bitmap = await createImageBitmap(this.video, {
            resizeWidth: preset.width,
            resizeHeight: preset.height
          });

          // Transferable Objects: zero-copy ownership transfer to Web Worker
          this.worker.postMessage(
            {
              type: 'process',
              bitmap,
              timestamp: now,
              mode: this.activeMode
            },
            [bitmap]
          );
        } catch (e) {
          this._workerBusy = false;
        }
      }

      // Render PIP preview and overlay markers
      this._renderPreview(now);

      requestAnimationFrame(tick);
    };

    requestAnimationFrame(tick);
  }

  _renderPreview(now) {
    if (!this.ctx || !this.canvas) return;

    const pip = document.getElementById('webcam-pip');
    if (pip && pip.classList.contains('hidden')) return;

    // If PIP is turned off by user, keep it hidden and skip rendering
    if (this.settings.pipMode === 'off') {
      if (pip && !pip.classList.contains('hidden')) {
        pip.classList.add('hidden');
      }
      return;
    }

    if (now - this._lastDrawTime < 45) return;
    this._lastDrawTime = now;

    const W = this.canvas.width;
    const H = this.canvas.height;

    if (this.settings.pipMode === 'minimal') {
      // Minimal mode: skip drawing video to completely avoid 2D canvas blit GPU overhead
      this.ctx.fillStyle = '#080d1a';
      this.ctx.fillRect(0, 0, W, H);
    } else {
      // Full mode: draw mirrored webcam video stream
      this.ctx.save();
      this.ctx.clearRect(0, 0, W, H);
      this.ctx.translate(W, 0);
      this.ctx.scale(-1, 1);
      this.ctx.drawImage(this.video, 0, 0, W, H);
      this.ctx.restore();
    }

    // В zone/handzone-режиме рисуем сетку 3×3 и подсвечиваем активную зону
    if (this.activeMode === 'zone' || this.activeMode === 'handzone') {
      this._renderZoneGrid(W, H);
    }

    // Отрисовка маркеров, вычисленных в фоновом потоке
    if (this.currentState.points && this.currentState.points.length > 0) {
      for (const p of this.currentState.points) {
        this._drawPoint(p.x, p.y, p.color || '#00e5ff', p.r || 4);
      }
    }

    // Recognition status text overlay
    if (this.currentState.debugText) {
      this.ctx.save();
      this.ctx.fillStyle = 'rgba(0, 0, 0, 0.75)';
      this.ctx.fillRect(6, 6, 180, 22);
      this.ctx.fillStyle = '#00e5ff';
      this.ctx.font = 'bold 11px Outfit, sans-serif';
      this.ctx.fillText(this.currentState.debugText, 12, 21);
      this.ctx.restore();
    }

    // Live CV FPS & latency badge in top-right corner
    if (this.cvFps > 0) {
      this.ctx.save();
      this.ctx.fillStyle = 'rgba(0, 0, 0, 0.70)';
      this.ctx.fillRect(W - 74, 6, 68, 22);
      this.ctx.fillStyle = this.cvFps >= 25 ? '#00e5ff' : this.cvFps >= 15 ? '#ffd700' : '#ff3d5e';
      this.ctx.font = 'bold 10px monospace';
      this.ctx.textAlign = 'right';
      this.ctx.fillText(`${this.cvFps} FPS`, W - 10, 21);
      this.ctx.restore();
    }
  }

  /**
   * Рисует сетку зон и подсвечивает активную ячейку.
   * Линии рисуются по РЕАЛЬНЫМ порогам (не равномерная треть экрана).
   * Рука:  X 33/66%, Y 22/78%
   * Лицо:  X 40/60%, Y 28/72%
   */
  _renderZoneGrid(W, H) {
    const isHand = this.activeMode === 'handzone' || (this.activeMode === 'zone' && this.currentState.zoneSource === 'hands');
    const isFace = !isHand;

    // Реальные пороги X
    const xLeftPct  = isFace ? 0.40 : 0.33;
    const xRightPct = isFace ? 0.60 : 0.66;

    // Реальные пороги Y (увеличенная верхняя зона)
    const yTopPct = isFace ? 0.35 : 0.33;
    const yBotPct = isFace ? 0.72 : 0.76;

    // Активная колонка/строка
    const col = this.activeMode === 'handzone' ? this.currentState.hzCol : this.currentState.zoneCol;
    const row = this.activeMode === 'handzone' ? this.currentState.hzRow : this.currentState.zoneRow;

    // Пиксельные координаты разделителей
    const xL = xLeftPct  * W;
    const xR = xRightPct * W;
    const yT = yTopPct   * H;
    const yB = yBotPct   * H;

    // --- Подсветка активной ячейки ---
    const x0 = col === 'L' ? 0  : col === 'R' ? xR : xL;
    const x1 = col === 'L' ? xL : col === 'R' ? W  : xR;
    const y0 = row === 'top' ? 0  : row === 'bot' ? yB : yT;
    const y1 = row === 'top' ? yT : row === 'bot' ? H  : yB;

    const actionColors = {
      'top-L': '#6c63ff55', 'top-C': '#00e5ff55', 'top-R': '#6c63ff55',
      'mid-L': '#00ff8844', 'mid-C': 'rgba(255,255,255,0.03)', 'mid-R': '#00ff8844',
      'bot-L': '#ff6b3555', 'bot-C': '#ff6b3555', 'bot-R': '#ff6b3555'
    };

    this.ctx.save();
    this.ctx.fillStyle = actionColors[`${row}-${col}`] || 'rgba(255,255,255,0.06)';
    this.ctx.fillRect(x0, y0, x1 - x0, y1 - y0);

    // --- Линии сетки по реальным порогам ---
    this.ctx.strokeStyle = 'rgba(255,255,255,0.30)';
    this.ctx.lineWidth = 1;
    this.ctx.setLineDash([3, 3]);

    for (const px of [xL, xR]) {
      this.ctx.beginPath();
      this.ctx.moveTo(px, 0);
      this.ctx.lineTo(px, H);
      this.ctx.stroke();
    }
    for (const py of [yT, yB]) {
      this.ctx.beginPath();
      this.ctx.moveTo(0, py);
      this.ctx.lineTo(W, py);
      this.ctx.stroke();
    }

    // --- Иконки в ячейках ---
    this.ctx.setLineDash([]);
    this.ctx.font = 'bold 9px sans-serif';
    this.ctx.textAlign = 'center';
    this.ctx.textBaseline = 'middle';

    const cellsX = [xL / 2, (xL + xR) / 2, (xR + W) / 2];
    const cellsY = [yT / 2, (yT + yB) / 2, (yB + H) / 2];
    const labels = [
      ['↑◀', '↑', '↑▶'],
      ['◀',  '·', '▶' ],
      ['↓◀', '↓', '↓▶']
    ];
    const colIdx = col === 'L' ? 0 : col === 'R' ? 2 : 1;
    const rowIdx = row === 'top' ? 0 : row === 'bot' ? 2 : 1;

    for (let r = 0; r < 3; r++) {
      for (let c = 0; c < 3; c++) {
        this.ctx.fillStyle = (r === rowIdx && c === colIdx) ? '#ffffff' : 'rgba(255,255,255,0.35)';
        this.ctx.fillText(labels[r][c], cellsX[c], cellsY[r]);
      }
    }

    this.ctx.restore();
  }


  _drawPoint(normX, normY, color, radius = 4) {
    if (!this.ctx || !this.canvas) return;
    this.ctx.save();
    this.ctx.fillStyle = color;
    this.ctx.beginPath();
    this.ctx.arc(normX * this.canvas.width, normY * this.canvas.height, radius, 0, Math.PI * 2);
    this.ctx.fill();
    // Обводка для лучшей видимости
    this.ctx.strokeStyle = 'rgba(0,0,0,0.5)';
    this.ctx.lineWidth = 1.5;
    this.ctx.stroke();
    this.ctx.restore();
  }

  update() {
    // Состояние считывается контроллерами мгновенно O(1) из фонового потока
  }

  applySettings(newSettings) {
    if (!newSettings) return;
    if (newSettings.resolution) {
      this.settings.resolution = newSettings.resolution;
      if (typeof localStorage !== 'undefined') {
        localStorage.setItem('interrun_cv_res', newSettings.resolution);
      }
    }
    if (newSettings.targetFps) {
      this.settings.targetFps = parseInt(newSettings.targetFps, 10);
      if (typeof localStorage !== 'undefined') {
        localStorage.setItem('interrun_cv_fps', String(this.settings.targetFps));
      }
    }
    if (newSettings.pipMode) {
      this.settings.pipMode = newSettings.pipMode;
      if (typeof localStorage !== 'undefined') {
        localStorage.setItem('interrun_pip_mode', newSettings.pipMode);
      }
      const pip = (typeof document !== 'undefined') ? document.getElementById('webcam-pip') : null;
      if (pip) {
        if (newSettings.pipMode === 'off') {
          pip.classList.add('hidden');
        } else if (this.activeMode) {
          pip.classList.remove('hidden');
        }
      }
    }
  }

  stop() {
    if (this.stream) {
      this.stream.getTracks().forEach((t) => t.stop());
      this.stream = null;
    }
    if (this.worker) {
      this.worker.terminate();
      this.worker = null;
    }
    this.isReady = false;
    this._workerReady = false;
    this._loopRunning = false;
  }
}
