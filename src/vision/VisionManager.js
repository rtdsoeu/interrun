/**
 * VisionManager — high-performance computer vision module:
 * - Tracking executed in dedicated background thread (Web Worker).
 * - Main Three.js thread is NEVER BLOCKED, maintaining 60+ FPS.
 * - Frame transfer via zero-copy ImageBitmap Transferable (hardware downscaled).
 * - Visual overlay in webcam PIP: keypoints, action status, zone grid.
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
    this._tabHidden = false;      // set by Page Visibility API to pause inference

    // CV FPS & Latency metrics
    this.cvFps = 0;
    this.cvLatency = 0;
    this._cvFrameCount = 0;
    this._cvFpsTimer = performance.now();
    this.onFpsUpdate = null; // callback(fps, latency)

    // Recognition state (thread-safe O(1) read by game engine)
    this.currentState = {
      // Legacy fields for HeadControl / HandControl / PoseControl / MixControl
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
      // Dimensions will be set after we know the real camera AR (see _applyVideoSize)
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

      // Constrain width to ~320px so Windows Camera Frame Server captures
      // small frames (avoids the 20% CPU overhead of full-resolution capture).
      // Height is intentionally unconstrained — the camera driver picks the
      // height that matches its native AR, so portrait phone cameras stay 9:16
      // instead of being squashed into a forced 4:3 box.
      try {
        this.stream = await navigator.mediaDevices.getUserMedia({
          video: {
            facingMode: 'user',
            width: { ideal: 320 }
          },
          audio: false
        });
      } catch (userCamErr) {
        console.warn('[VisionManager] facingMode user failed, trying default camera:', userCamErr);
        this.stream = await navigator.mediaDevices.getUserMedia({
          video: { width: { ideal: 320 } },
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
          // Adapt PIP canvas and notify worker of real camera dimensions
          this._applyVideoSize();
          resolve();
        };
      });

      this.hasPermission = true;
      this.isReady = true;

      // Start Web Worker background thread
      this._initWorker();

      // Start frame capture loop
      this._startCaptureLoop();

      // Pause CV inference when tab is hidden — saves full 30fps GPU/CPU budget
      // on the worker when user alt-tabs or minimizes the window.
      if (typeof document !== 'undefined') {
        this._onVisibilityChange = () => {
          this._tabHidden = document.hidden;
        };
        document.addEventListener('visibilitychange', this._onVisibilityChange);
      }

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
          // Deliver pending video size if camera was already initialised
          if (this._pendingVideoSize) {
            this.worker.postMessage({ type: 'setVideoSize', ...this._pendingVideoSize });
            this._pendingVideoSize = null;
          }
          if (this.activeMode) {
            this.worker.postMessage({ type: 'setMode', mode: this.activeMode });
          } else if (this._pendingPreload) {
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
   * Reads the real camera resolution after the stream starts, proportionally
   * sizes the PIP canvas to preserve aspect ratio (no squashing on portrait
   * phone cameras), and notifies the worker of the actual frame dimensions
   * so it can compute proportional downscale for the ImageBitmap fallback path.
   *
   * The PIP canvas long-side is capped at 320px; the short side is computed
   * from the real AR.  Examples:
   *   Desktop 640×480  (4:3 land) → PIP 320×240
   *   Phone   480×640  (3:4 port) → PIP 240×320
   *   Phone   720×1280 (9:16 port)→ PIP 180×320
   */
  _applyVideoSize() {
    if (!this.video) return;
    const vw = this.video.videoWidth  || 320;
    const vh = this.video.videoHeight || 240;
    console.log(`[VisionManager] Camera native resolution: ${vw}×${vh}`);

    // Proportionally fit within a 320px bounding box
    const MAX = 320;
    const scale = Math.min(MAX / vw, MAX / vh);
    const pipW  = Math.round(vw * scale);
    const pipH  = Math.round(vh * scale);

    if (this.canvas) {
      this.canvas.width  = pipW;
      this.canvas.height = pipH;
    }

    // Notify worker so resizeBitmap (fallback path) uses correct proportions
    if (this.worker && this._workerReady) {
      this.worker.postMessage({ type: 'setVideoSize', width: vw, height: vh });
    } else {
      // Worker not ready yet — stash for delivery in the ready handler
      this._pendingVideoSize = { width: vw, height: vh };
    }
  }

  /**
   * CV capture loop — uses setTimeout instead of requestAnimationFrame so the
   * interval is decoupled from the display vsync (60Hz).  This reduces idle
   * CPU wake-ups from 60/s down to the actual target CV FPS (20–45/s) and
   * keeps the Three.js rAF loop uncontested on the main thread.
   *
   * PIP preview is driven by a separate, slower rAF-based paint loop that only
   * runs when the PIP element is visible.
   */
  _startCaptureLoop() {
    if (this._loopRunning) return;
    this._loopRunning = true;

    // ── CV capture tick (setTimeout-based, runs at targetFps) ──────────────
    const supportsVideoFrame = typeof VideoFrame !== 'undefined';

    const captureTick = supportsVideoFrame
      // ── Fast path: VideoFrame is zero-copy and fully synchronous.
      // No await, no GPU blit stall, no microtask delay — the frame reference
      // is transferred to the worker immediately, tightening the capture→inference
      // loop and making the setTimeout interval far more precise.
      ? () => {
          if (!this._loopRunning) return;

          const now = performance.now();

          if (this._workerBusy && now - this._lastSendTime > 1000) {
            this._workerBusy = false;
          }

          if (
            !this._tabHidden &&
            !this._workerBusy &&
            this._workerReady &&
            this.worker &&
            this.activeMode &&
            this.video &&
            this.video.readyState >= 2
          ) {
            this._workerBusy = true;
            this._lastSendTime = now;

            try {
              const frame = new VideoFrame(this.video);
              this.worker.postMessage(
                { type: 'process', frame, timestamp: now, mode: this.activeMode, resolution: this.settings.resolution },
                [frame]
              );
            } catch (e) {
              this._workerBusy = false;
            }
          }

          if (!this._loopRunning) return;
          // Poll at 16ms (≈60Hz) regardless of targetFps — _workerBusy prevents
          // double-sending. This eliminates the "missed tick" FPS halving when
          // inference occasionally runs just over the targetFps interval.
          this._captureTimer = setTimeout(captureTick, 16);
        }
      // ── Fallback path: createImageBitmap (older browsers without VideoFrame)
      : async () => {
          if (!this._loopRunning) return;

          const now = performance.now();

          if (this._workerBusy && now - this._lastSendTime > 1000) {
            this._workerBusy = false;
          }

          if (
            !this._tabHidden &&
            !this._workerBusy &&
            this._workerReady &&
            this.worker &&
            this.activeMode &&
            this.video &&
            this.video.readyState >= 2
          ) {
            this._workerBusy = true;
            this._lastSendTime = now;

            try {
              const frame = await createImageBitmap(this.video);
              this.worker.postMessage(
                { type: 'process', frame, timestamp: now, mode: this.activeMode, resolution: this.settings.resolution },
                [frame]
              );
            } catch (e) {
              this._workerBusy = false;
            }
          }

          if (!this._loopRunning) return;
          this._captureTimer = setTimeout(captureTick, 16);
        };

    // ── PIP paint tick (rAF-based, ~22 FPS cap, skips when PIP hidden) ─────
    const paintTick = () => {
      if (!this._loopRunning) return;
      const now = performance.now();
      this._renderPreview(now);
      requestAnimationFrame(paintTick);
    };

    // Kick off both loops
    this._captureTimer = setTimeout(captureTick, 16);
    requestAnimationFrame(paintTick);
  }

  _renderPreview(now) {
    if (!this.ctx || !this.canvas) return;

    // Skip rendering if PIP is hidden
    const pip = document.getElementById('webcam-pip');
    if (!pip || pip.classList.contains('hidden')) return;

    // If PIP is turned off by user, hide and bail
    if (this.settings.pipMode === 'off') {
      pip.classList.add('hidden');
      return;
    }

    // ~22 FPS cap for PIP overlay (45ms minimum between draws)
    if (now - this._lastDrawTime < 45) return;
    this._lastDrawTime = now;

    const W = this.canvas.width;
    const H = this.canvas.height;
    const ctx = this.ctx;

    if (this.settings.pipMode === 'minimal') {
      // Minimal mode: solid fill — avoids GPU video-blit overhead entirely
      ctx.fillStyle = '#080d1a';
      ctx.fillRect(0, 0, W, H);
    } else {
      // Full mode: mirrored webcam video — single save/restore wraps the transform
      ctx.save();
      ctx.clearRect(0, 0, W, H);
      ctx.setTransform(-1, 0, 0, 1, W, 0); // mirror in one step, no scale()
      ctx.drawImage(this.video, 0, 0, W, H);
      ctx.restore();
    }

    // Zone grid overlay (stage 2 & 3)
    if (this.activeMode === 'zone' || this.activeMode === 'handzone') {
      this._renderZoneGrid(W, H);
    }

    // Landmark points from worker (no save/restore — plain arc fills)
    const pts = this.currentState.points;
    if (pts && pts.length > 0) {
      for (const p of pts) {
        this._drawPoint(p.x, p.y, p.color || '#00e5ff', p.r || 4);
      }
    }

    // Status badge (gesture / action text)
    const hasText = !!this.currentState.debugText;
    if (hasText) {
      ctx.save();
      ctx.fillStyle = 'rgba(0,0,0,0.75)';
      ctx.fillRect(6, 6, 180, 22);
      ctx.fillStyle = '#00e5ff';
      ctx.font = 'bold 11px Outfit, sans-serif';
      ctx.textAlign = 'left';
      ctx.fillText(this.currentState.debugText, 12, 21);
      ctx.restore();
    }
  }

  /**
   * Draws zone grid and highlights active cell.
   * Lines are drawn based on REAL thresholds (not uniform screen thirds).
   * Hand: X 33/66%, Y 22/78%
   * Face: X 40/60%, Y 28/72%
   */
  _renderZoneGrid(W, H) {
    const isHand = this.activeMode === 'handzone' || (this.activeMode === 'zone' && this.currentState.zoneSource === 'hands');
    const isFace = !isHand;

    // Real thresholds X
    const xLeftPct  = isFace ? 0.40 : 0.33;
    const xRightPct = isFace ? 0.60 : 0.66;

    // Real thresholds Y (enlarged upper zone)
    const yTopPct = isFace ? 0.35 : 0.33;
    const yBotPct = isFace ? 0.72 : 0.76;

    // Active column / row
    const col = this.activeMode === 'handzone' ? this.currentState.hzCol : this.currentState.zoneCol;
    const row = this.activeMode === 'handzone' ? this.currentState.hzRow : this.currentState.zoneRow;

    // Pixel divider coordinates
    const xL = xLeftPct  * W;
    const xR = xRightPct * W;
    const yT = yTopPct   * H;
    const yB = yBotPct   * H;

    // --- Active cell highlight ---
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

    // --- Grid lines based on real thresholds ---
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

    // --- Icons in cells ---
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
    // Border for enhanced visibility
    this.ctx.strokeStyle = 'rgba(0,0,0,0.5)';
    this.ctx.lineWidth = 1.5;
    this.ctx.stroke();
    this.ctx.restore();
  }

  update() {
    // State is read by controllers instantaneously O(1) from worker state
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
    // Stop capture loop
    this._loopRunning = false;
    if (this._captureTimer) {
      clearTimeout(this._captureTimer);
      this._captureTimer = null;
    }

    // Remove page visibility listener
    if (this._onVisibilityChange && typeof document !== 'undefined') {
      document.removeEventListener('visibilitychange', this._onVisibilityChange);
      this._onVisibilityChange = null;
    }

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
  }
}
