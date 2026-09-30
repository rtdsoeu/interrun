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

// Static constants to prevent per-draw allocations in PIP canvas
const ZONE_ACTION_COLORS = {
  'top-L': '#6c63ff55', 'top-C': '#00e5ff55', 'top-R': '#6c63ff55',
  'mid-L': '#00ff8844', 'mid-C': 'rgba(255,255,255,0.03)', 'mid-R': '#00ff8844',
  'bot-L': '#ff6b3555', 'bot-C': '#ff6b3555', 'bot-R': '#ff6b3555'
};

const ZONE_LABELS = [
  ['↑◀', '↑', '↑▶'],
  ['◀',  '·', '▶' ],
  ['↓◀', '↓', '↓▶']
];

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
    this._dispatchTimer = null;
    this._watchdogTimer = null;
    this._rvfcId = null;
    this._initPromise = null;

    // Platform detection (iOS & Safari have known WebKit quirks with VideoFrame & off-screen video)
    const ua = typeof navigator !== 'undefined' ? navigator.userAgent || '' : '';
    const isIOS = typeof navigator !== 'undefined' && (/iPad|iPhone|iPod/.test(ua) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1));
    const isSafari = typeof navigator !== 'undefined' && /^((?!chrome|android).)*safari/i.test(ua);
    this.isIOS = isIOS;
    this.isSafari = isSafari;

    // VideoFrame is NOT supported by MediaPipe Tasks Wasm in WebKit/Safari,
    // and new VideoFrame(HTMLVideoElement) has cloning/transfer issues on iOS.
    // We restrict zero-copy VideoFrame exclusively to non-WebKit browsers (Chrome/Edge/Firefox).
    this._supportsVideoFrame = typeof VideoFrame !== 'undefined' && !isIOS && !isSafari;
    this._fallbackCanvas = null;
    this._fallbackCtx = null;

    // Error tracking & callbacks for camera modal & controls fallback
    this.hasCameraError = false;
    this.lastError = null;
    this.onCameraError = null; // callback(errorInfo)

    // Camera & CV Performance metrics
    this.hardwareCamFps = 0;
    this.realCamFps = 0;
    this.cvFps = 0;
    this.cvLatency = 0;
    this.cvFrametime = 0;
    this._camFrameCount = 0;
    this._camFpsTimer = performance.now();
    this._cvFrameCount = 0;
    this._cvFpsTimer = performance.now();
    this.modelsReady = false;
    this.faceModelReady = false;
    this.handsModelReady = false;
    this.preloadProgress = 0;
    this.onPreloadProgress = null; // callback(progress, stage)
    this.onAllModelsReady = null;  // callback()
    this.onModelReady = null;      // callback(mode)
    this.onFpsUpdate = null;          // callback(cvFps, frametime, camFps)
    this.onSettingsCalibrated = null; // callback(settings)

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
   * Starts the Web Worker early and queues an immediate, eager
   * preload of all MediaPipe models (face + hands) while pre-warming the HTTP cache.
   */
  preloadModels() {
    this._prefetchAssets();
    if (!this.worker) {
      this._initWorker();
    }
    const rootUrl = typeof window !== 'undefined' ? `${window.location.origin}${window.location.pathname.replace(/\/$/, '')}` : '';
    if (this._workerReady) {
      this.worker.postMessage({ type: 'preload', rootUrl });
    } else {
      // Worker not ready yet — flag it; the 'ready' handler will dispatch the request
      this._pendingPreload = true;
    }
  }

  /**
   * Proactively warms the browser's HTTP cache with model binaries and Wasm.
   */
  _prefetchAssets() {
    if (typeof window === 'undefined' || !window.fetch) return;
    try {
      const origin = window.location.origin || '';
      const pathname = (window.location.pathname || '').replace(/\/$/, '');
      const rootUrl = `${origin}${pathname}`;
      const urls = [
        `${rootUrl}/models/face_landmarker.task`,
        `${rootUrl}/models/hand_landmarker.task`,
        `${rootUrl}/wasm/vision_wasm_internal.wasm`
      ];
      for (const url of urls) {
        fetch(url, { cache: 'force-cache' }).catch(() => {});
      }
    } catch {
      // Non-critical prefetch fallback
    }
  }

  /**
   * Checks if the required AI model for a given CV mode is loaded and ready.
   */
  isModelReadyForMode(mode) {
    if (!mode) return true;
    if (mode === 'face' || mode === 'zone') return !!this.faceModelReady;
    if (mode === 'hands' || mode === 'handzone' || mode === 'fingergesture' || mode === 'handswipe') return !!this.handsModelReady;
    return true;
  }

  setPreviewCanvas(previewCanvas) {
    if (!previewCanvas) return;
    this.canvas = previewCanvas;
    this.ctx = this.canvas.getContext('2d');
    if (this.videoWidth && this.videoHeight) {
      this._applyVideoSize();
    }
  }

  async initWebcam(previewCanvas = null) {
    if (previewCanvas) {
      this.setPreviewCanvas(previewCanvas);
    }

    if (this.isReady) {
      return true;
    }

    if (this._initPromise) {
      return this._initPromise;
    }

    this._initPromise = (async () => {
      // Check for getUserMedia support (HTTPS / localhost or browser flag required)
      if (!navigator?.mediaDevices?.getUserMedia) {
        const isSecure = typeof window === 'undefined' || window.isSecureContext !== false;
        const errorInfo = {
          type: !isSecure ? 'insecure_context' : 'unsupported',
          name: !isSecure ? 'InsecureContextError' : 'NotSupportedError',
          message: !isSecure
            ? 'WebRTC camera access requires HTTPS (or localhost).'
            : 'WebRTC / getUserMedia is not supported or blocked in this browser.'
        };
        console.warn('[VisionManager]', errorInfo.message);
        this.hasPermission = false;
        this.hasCameraError = true;
        this.lastError = errorInfo;
        if (this.onCameraError) {
          this.onCameraError(errorInfo);
        }
        return false;
      }

      try {
        if (!this.video && typeof document !== 'undefined') {
          this.video = document.createElement('video');
          this.video.setAttribute('playsinline', '');
          this.video.setAttribute('webkit-playsinline', 'true');
          this.video.playsInline = true;
          this.video.setAttribute('autoplay', '');
          this.video.setAttribute('muted', '');
          this.video.muted = true;
          // In WebKit (iOS Safari), elements off-screen or with 0 opacity have their frame decoding paused to save power.
          // Keep it rendered within viewport bounds with 0.001 opacity behind everything,
          // without constraining to tiny dimensions (which downscales hardware decode buffers on Android).
          this.video.style.position = 'fixed';
          this.video.style.top = '0';
          this.video.style.left = '0';
          this.video.style.width = '100%';
          this.video.style.height = '100%';
          this.video.style.objectFit = 'cover';
          this.video.style.opacity = '0.001';
          this.video.style.zIndex = '-9999';
          this.video.style.pointerEvents = 'none';
          document.body.appendChild(this.video);
        }

        // Explicitly request FRONT / SELFIE CAMERA ('user') with mobile-safe tiers:
        // Note: Height is unconstrained so portrait 9:16 mobile cameras never fail with OverconstrainedError.
        // FrameRate uses ideal only (no min constraint) to support all mobile camera drivers.
        try {
          this.stream = await navigator.mediaDevices.getUserMedia({
            video: {
              facingMode: { ideal: 'user' },
              width: { ideal: 320 },
              frameRate: { ideal: 60 }
            },
            audio: false
          });
        } catch (err1) {
          console.warn('[VisionManager] Tier 1 camera request failed, trying Tier 2 (basic front camera):', err1);
          try {
            this.stream = await navigator.mediaDevices.getUserMedia({
              video: {
                facingMode: 'user',
                width: { ideal: 320 }
              },
              audio: false
            });
          } catch (err2) {
            console.warn('[VisionManager] Tier 2 front camera failed, trying Tier 3 (permissive front camera):', err2);
            try {
              this.stream = await navigator.mediaDevices.getUserMedia({
                video: {
                  facingMode: { ideal: 'user' }
                },
                audio: false
              });
            } catch (err3) {
              console.warn('[VisionManager] Tier 3 failed, trying any available camera:', err3);
              this.stream = await navigator.mediaDevices.getUserMedia({
                video: true,
                audio: false
              });
            }
          }
        }

        // Progressive enhancement: hint continuous auto-exposure to avoid aggressive FPS drop in dark conditions
        try {
          const track = this.stream?.getVideoTracks()[0];
          if (track && 'getCapabilities' in track) {
            const caps = track.getCapabilities();
            if (caps?.exposureMode?.includes('continuous')) {
              track.applyConstraints({ advanced: [{ exposureMode: 'continuous' }] }).catch(() => {});
            }
          }
        } catch {
          // Non-critical capability check
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

        // Run hardware camera FPS mini-benchmark and auto-configure settings
        await this._benchmarkCameraFps();

        this.hasPermission = true;
        this.isReady = true;
        this.hasCameraError = false;
        this.lastError = null;

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
        const name = err?.name || '';
        const isPermissionDenied = name === 'NotAllowedError' || name === 'PermissionDeniedError';
        const isNotFound = name === 'NotFoundError' || name === 'DevicesNotFoundError';
        const isNotReadable = name === 'NotReadableError' || name === 'TrackStartError';
        const errorInfo = {
          type: isPermissionDenied ? 'permission_denied' : (isNotFound ? 'not_found' : (isNotReadable ? 'in_use' : 'general')),
          name,
          message: err?.message || String(err)
        };
        this.hasPermission = false;
        this.isReady = false;
        this.hasCameraError = true;
        this.lastError = errorInfo;
        if (this.onCameraError) {
          this.onCameraError(errorInfo);
        }
        return false;
      } finally {
        this._initPromise = null;
      }
    })();

    return this._initPromise;
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
          const rootUrl = typeof window !== 'undefined' ? `${window.location.origin}${window.location.pathname.replace(/\/$/, '')}` : '';

          // Deliver pending video size if camera was already initialised
          if (this._pendingVideoSize) {
            this.worker.postMessage({ type: 'setVideoSize', ...this._pendingVideoSize });
            this._pendingVideoSize = null;
          }

          // Always ensure worker preloads all models upfront!
          this.worker.postMessage({ type: 'preload', rootUrl });
          this._pendingPreload = false;

          if (this.activeMode) {
            this.worker.postMessage({ type: 'setMode', mode: this.activeMode, rootUrl });
          }
        } else if (msg.type === 'model_ready') {
          console.log(`[VisionManager] Model ${msg.mode} ready in worker (delegate: ${msg.delegate || 'unknown'}, src: ${msg.src || 'unknown'})`);
          if (msg.mode === 'face') this.faceModelReady = true;
          if (msg.mode === 'hands') this.handsModelReady = true;
          if (this.onModelReady) this.onModelReady(msg.mode);
        } else if (msg.type === 'preload_progress') {
          this.preloadProgress = msg.progress || 0;
          if (this.onPreloadProgress) {
            this.onPreloadProgress(this.preloadProgress, msg.stage);
          }
        } else if (msg.type === 'preload_done') {
          console.log('[VisionManager] Background model preload complete — all CV stages ready');
          this.modelsReady = true;
          this.faceModelReady = true;
          this.handsModelReady = true;
          this.preloadProgress = 1.0;
          if (this.onPreloadProgress) {
            this.onPreloadProgress(1.0, 'complete');
          }
          if (this.onAllModelsReady) {
            this.onAllModelsReady();
          }
        } else if (msg.type === 'processed') {
          this._workerBusy = false;
          if (msg.state) {
            this.currentState = msg.state;
          }
          const now = performance.now();
          const currentDuration = msg.inferDuration ?? Math.round(now - this._lastSendTime);
          this.cvFrametime = this.cvFrametime === 0
            ? currentDuration
            : Math.round(this.cvFrametime * 0.75 + currentDuration * 0.25);
          this.cvLatency = this.cvFrametime;

          this._cvFrameCount++;
          const elapsed = now - this._cvFpsTimer;
          if (elapsed >= 400) {
            this.cvFps = Math.round((this._cvFrameCount * 1000) / elapsed);
            this._cvFrameCount = 0;
            this._cvFpsTimer = now;
            if (this.onFpsUpdate) {
              this.onFpsUpdate(this.cvFps, this.cvFrametime, this.realCamFps || this.hardwareCamFps);
            }
          }
          // Reactive dispatch: immediately pipeline the next frame as soon as worker finishes
          this._dispatchFrame(now);
        } else if (msg.type === 'error') {
          this._workerBusy = false;
          console.warn('[VisionManager] Worker error:', msg.error);
        }
      };

      this.worker.onerror = (err) => {
        this._workerBusy = false;
        console.warn('[VisionManager] Worker onerror:', err);
      };

      const rootUrl = typeof window !== 'undefined' ? `${window.location.origin}${window.location.pathname.replace(/\/$/, '')}` : '';
      this.worker.postMessage({ type: 'init', rootUrl });
    } catch (err) {
      console.warn('[VisionManager] Error creating Web Worker:', err);
    }
  }

  setMode(mode) {
    this.activeMode = mode;
    if (this.worker) {
      const rootUrl = typeof window !== 'undefined' ? `${window.location.origin}${window.location.pathname.replace(/\/$/, '')}` : '';
      this.worker.postMessage({ type: 'setMode', mode, rootUrl });
    }
    // Kick off dispatch immediately when new mode is activated
    if (this._loopRunning && this._workerReady && !this._workerBusy) {
      this._dispatchFrame(performance.now());
    }
  }

  /**
   * Fast hardware camera FPS benchmark on initialization:
   * Samples 10-12 video frames via requestVideoFrameCallback (~160-350ms)
   * to determine real camera sensor delivery rate and auto-calibrate settings.
   */
  async _benchmarkCameraFps() {
    if (!this.video) return;

    let measuredFps = 30;
    if ('requestVideoFrameCallback' in this.video) {
      try {
        measuredFps = await new Promise((resolve) => {
          let frames = 0;
          let firstTime = 0;
          const targetFrames = 12;
          const timeout = setTimeout(() => {
            resolve(frames > 2 ? Math.round(((frames - 1) * 1000) / (performance.now() - firstTime)) : 30);
          }, 600);

          const sampleCb = (now) => {
            if (frames === 0) firstTime = now;
            frames++;
            if (frames >= targetFrames) {
              clearTimeout(timeout);
              const duration = now - firstTime;
              const fps = duration > 0 ? Math.round(((frames - 1) * 1000) / duration) : 30;
              resolve(fps);
              return;
            }
            if (this.video && 'requestVideoFrameCallback' in this.video) {
              this.video.requestVideoFrameCallback(sampleCb);
            } else {
              clearTimeout(timeout);
              resolve(30);
            }
          };
          this.video.requestVideoFrameCallback(sampleCb);
        });
      } catch {
        measuredFps = 30;
      }
    }

    let normalizedFps = measuredFps;
    if (measuredFps >= 48 && measuredFps <= 72) normalizedFps = 60;
    else if (measuredFps >= 24 && measuredFps <= 35) normalizedFps = 30;
    else if (measuredFps <= 0) normalizedFps = 30;

    this.hardwareCamFps = normalizedFps;
    this.realCamFps = normalizedFps;

    // Auto-configure targetFps & resolution if not locked by user preference in localStorage
    const hasCustomFps = typeof localStorage !== 'undefined' && localStorage.getItem('interrun_cv_fps');
    if (!hasCustomFps) {
      this.settings.targetFps = normalizedFps >= 50 ? 60 : normalizedFps <= 15 ? 15 : normalizedFps <= 25 ? 20 : 30;
    }

    const hasCustomRes = typeof localStorage !== 'undefined' && localStorage.getItem('interrun_cv_res');
    if (!hasCustomRes) {
      this.settings.resolution = normalizedFps >= 50 ? 'balanced' : normalizedFps <= 25 ? 'eco' : 'balanced';
    }

    if (this.onSettingsCalibrated) {
      this.onSettingsCalibrated(this.settings);
    }

    console.log(`[VisionManager] Camera benchmark: measured ${measuredFps} FPS (normalized ${normalizedFps} FPS). Target FPS: ${this.settings.targetFps}, Resolution: ${this.settings.resolution}`);
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
   * Dispatches the next video frame to the CV Worker.
   * - Reactive: triggered as soon as worker finishes the previous frame.
   * - Respects targetFps throttle settings (20/30/45/60 FPS).
   * - Uses zero-copy VideoFrame where supported (Chrome/Edge/Safari).
   */
  _dispatchFrame(now = performance.now()) {
    if (
      !this._loopRunning ||
      this._tabHidden ||
      this._workerBusy ||
      !this._workerReady ||
      !this.worker ||
      !this.activeMode ||
      !this.video ||
      this.video.readyState < 2
    ) {
      return;
    }

    // Target FPS throttling
    const targetFps = this.settings.targetFps || 60;
    const minInterval = 1000 / targetFps - 2; // 2ms tolerance for frame delivery
    const elapsedSinceLast = now - this._lastSendTime;
    if (elapsedSinceLast < minInterval) {
      // Schedule dispatch for the remaining delay
      if (!this._dispatchTimer) {
        this._dispatchTimer = setTimeout(() => {
          this._dispatchTimer = null;
          this._dispatchFrame(performance.now());
        }, Math.max(1, Math.round(minInterval - elapsedSinceLast)));
      }
      return;
    }

    if (this._dispatchTimer) {
      clearTimeout(this._dispatchTimer);
      this._dispatchTimer = null;
    }

    this._workerBusy = true;
    this._lastSendTime = now;

    if (this._supportsVideoFrame) {
      try {
        const frame = new VideoFrame(this.video);
        this.worker.postMessage(
          { type: 'process', frame, timestamp: now, mode: this.activeMode, resolution: this.settings.resolution },
          [frame]
        );
        return;
      } catch (vfErr) {
        // VideoFrame failed on this browser/platform (e.g. mobile Safari) — permanently switch to createImageBitmap
        this._supportsVideoFrame = false;
      }
    }

    createImageBitmap(this.video)
      .then((frame) => {
        if (!this._loopRunning || !this._workerBusy) {
          frame.close();
          return;
        }
        this.worker.postMessage(
          { type: 'process', frame, timestamp: now, mode: this.activeMode, resolution: this.settings.resolution },
          [frame]
        );
      })
      .catch((bitmapErr) => {
        // Fallback for Safari/WebKit if direct video createImageBitmap fails:
        // paint into an in-memory 2D canvas and extract bitmap from canvas.
        try {
          if (!this._fallbackCanvas) {
            this._fallbackCanvas = document.createElement('canvas');
            this._fallbackCtx = this._fallbackCanvas.getContext('2d', { willReadFrequently: true });
          }
          const vw = this.video.videoWidth || 320;
          const vh = this.video.videoHeight || 240;
          if (this._fallbackCanvas.width !== vw || this._fallbackCanvas.height !== vh) {
            this._fallbackCanvas.width = vw;
            this._fallbackCanvas.height = vh;
          }
          this._fallbackCtx.drawImage(this.video, 0, 0, vw, vh);
          createImageBitmap(this._fallbackCanvas)
            .then((frame) => {
              if (!this._loopRunning || !this._workerBusy) {
                frame.close();
                return;
              }
              this.worker.postMessage(
                { type: 'process', frame, timestamp: now, mode: this.activeMode, resolution: this.settings.resolution },
                [frame]
              );
            })
            .catch(() => {
              this._workerBusy = false;
            });
        } catch {
          this._workerBusy = false;
        }
      });
  }

  /**
   * CV capture loop:
   * - Drives frame acquisition via requestVideoFrameCallback (rVFC) for exact hardware frame-sync.
   * - Employs a 33ms watchdog timer for robust fallback on older browsers or dropped frames.
   * - Completely eliminates the 16ms setTimeout quantization bottleneck.
   * - Drives PIP preview with a separate ~22 FPS rAF paint loop.
   */
  _startCaptureLoop() {
    if (this._loopRunning) return;
    this._loopRunning = true;

    // 1. Primary frame sync via requestVideoFrameCallback (rVFC) if available
    if (this.video && 'requestVideoFrameCallback' in this.video) {
      const onVideoFrame = (now) => {
        if (!this._loopRunning) return;

        // Continuous hardware camera sensor FPS counter
        this._camFrameCount++;
        const camElapsed = now - this._camFpsTimer;
        if (camElapsed >= 1000) {
          this.realCamFps = Math.round((this._camFrameCount * 1000) / camElapsed);
          this._camFrameCount = 0;
          this._camFpsTimer = now;
        }

        this._dispatchFrame(now);
        if (this.video && 'requestVideoFrameCallback' in this.video) {
          this._rvfcId = this.video.requestVideoFrameCallback(onVideoFrame);
        }
      };
      this._rvfcId = this.video.requestVideoFrameCallback(onVideoFrame);
    }

    // 2. Watchdog heartbeat (every 33ms) — ensures continuous operation,
    // recovers from transient worker stalls, and provides fallback if rVFC is unavailable.
    const watchdogTick = () => {
      if (!this._loopRunning) return;
      const now = performance.now();
      if (this._workerBusy && now - this._lastSendTime > 1000) {
        this._workerBusy = false;
      }
      this._dispatchFrame(now);
      this._watchdogTimer = setTimeout(watchdogTick, 33);
    };
    this._watchdogTimer = setTimeout(watchdogTick, 33);

    // Initial frame dispatch kick-off
    this._dispatchFrame(performance.now());

    // 3. PIP paint tick (rAF-based, ~22 FPS cap, skips when PIP hidden)
    const paintTick = () => {
      if (!this._loopRunning) return;
      const now = performance.now();
      this._renderPreview(now);
      requestAnimationFrame(paintTick);
    };
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

    // Zone grid overlay (stage 2 & 3: zone and handzone only)
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

    // If active model is not loaded yet, render gentle loading overlay in PIP
    if (!this.isModelReadyForMode(this.activeMode)) {
      ctx.save();
      ctx.fillStyle = 'rgba(8, 13, 26, 0.78)';
      ctx.fillRect(0, 0, W, H);
      ctx.fillStyle = '#ffd700';
      ctx.font = 'bold 11px Outfit, sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      const pct = Math.round((this.preloadProgress || 0) * 100);
      const text = pct > 0 && pct < 100 ? `⚡ LOADING AI MODELS (${pct}%)...` : '⚡ PREPARING AI MODEL...';
      ctx.fillText(text, W / 2, H / 2 - 6);
      ctx.fillStyle = 'rgba(255, 255, 255, 0.7)';
      ctx.font = '9px Outfit, sans-serif';
      ctx.fillText('Ready soon', W / 2, H / 2 + 10);
      ctx.restore();
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

    const actionKey = `${row}-${col}`;
    this.ctx.save();
    this.ctx.fillStyle = ZONE_ACTION_COLORS[actionKey] || 'rgba(255,255,255,0.06)';
    this.ctx.fillRect(x0, y0, x1 - x0, y1 - y0);

    // --- Grid lines based on real thresholds (batched path) ---
    this.ctx.strokeStyle = 'rgba(255,255,255,0.30)';
    this.ctx.lineWidth = 1;
    this.ctx.setLineDash([3, 3]);

    this.ctx.beginPath();
    this.ctx.moveTo(xL, 0); this.ctx.lineTo(xL, H);
    this.ctx.moveTo(xR, 0); this.ctx.lineTo(xR, H);
    this.ctx.moveTo(0, yT); this.ctx.lineTo(W, yT);
    this.ctx.moveTo(0, yB); this.ctx.lineTo(W, yB);
    this.ctx.stroke();

    // --- Icons in cells (zero allocation) ---
    this.ctx.setLineDash([]);
    this.ctx.font = 'bold 9px sans-serif';
    this.ctx.textAlign = 'center';
    this.ctx.textBaseline = 'middle';

    const colIdx = col === 'L' ? 0 : col === 'R' ? 2 : 1;
    const rowIdx = row === 'top' ? 0 : row === 'bot' ? 2 : 1;

    for (let r = 0; r < 3; r++) {
      const cy = r === 0 ? yT / 2 : r === 1 ? (yT + yB) / 2 : (yB + H) / 2;
      for (let c = 0; c < 3; c++) {
        const cx = c === 0 ? xL / 2 : c === 1 ? (xL + xR) / 2 : (xR + W) / 2;
        this.ctx.fillStyle = (r === rowIdx && c === colIdx) ? '#ffffff' : 'rgba(255,255,255,0.35)';
        this.ctx.fillText(ZONE_LABELS[r][c], cx, cy);
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
      if (this._loopRunning && this._workerReady && !this._workerBusy) {
        this._dispatchFrame(performance.now());
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
    if (this._dispatchTimer) {
      clearTimeout(this._dispatchTimer);
      this._dispatchTimer = null;
    }
    if (this._watchdogTimer) {
      clearTimeout(this._watchdogTimer);
      this._watchdogTimer = null;
    }
    if (this._rvfcId && this.video && 'cancelVideoFrameCallback' in this.video) {
      this.video.cancelVideoFrameCallback(this._rvfcId);
      this._rvfcId = null;
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
    this.hardwareCamFps = 0;
    this.realCamFps = 0;
    this.cvFps = 0;
    this.cvLatency = 0;
    this.cvFrametime = 0;
    this._camFrameCount = 0;
    this._cvFrameCount = 0;
    this.isReady = false;
    this._workerReady = false;
  }
}
