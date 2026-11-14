/**
 * BenchmarkRunner — Trial sequencing, input listeners, and execution-based state machine.
 *
 * Transitions on gesture EXECUTION rather than an arbitrary countdown timer:
 * - Continuous poses (Face Zone, Hand Zone, Finger Gestures): completes when user executes and holds the target gesture (~180ms stability).
 * - Discrete actions (Keyboard, Pointer Swipes, Air Swipes): completes immediately upon execution (match or mistake attempt).
 * - Generous timeout protection (8-10s) and manual skip to prevent getting stuck.
 */

import {
  getBenchmarkClasses,
  getBenchmarkIcons,
  getBenchmarkHints,
  isCvStage,
  mapCvStateToClass
} from './BenchmarkDefinitions.js';

export class BenchmarkRunner {
  /**
   * @param {Object} options
   * @param {Object} [options.benchmark] GestureBenchmark instance
   * @param {Object} [options.visionManager]
   * @param {HTMLElement} [options.interactionTarget] Element for pointer swipe tracking
   */
  constructor(options = {}) {
    this.gestureBenchmark = options.benchmark || null;
    this.visionManager = options.visionManager || null;
    this.interactionTarget = options.interactionTarget || null;

    this.isRunning = false;
    this.stageKey = 'stage4';
    this.sequence = [];
    this.trialIndex = 0;

    this.target = null;
    this.trialStartTime = 0;
    this._trialTimeoutMs = 10000;

    // Stability tracking for continuous CV gestures
    this._matchHoldStart = null;
    this._requiredHoldMs = 180;

    // Last air swipe ID tracked for stage 5 to avoid repeat triggers
    this._lastAirSwipeId = null;

    // Active timers and listeners
    this._tickTimer = null;
    this._advanceTimeout = null;
    this._removeListeners = null;
    this._isTransitioning = false;

    // Callbacks
    this.onTrialStart = null;    // ({ trialIndex, totalTrials, target, icon, hint })
    this.onLiveDetect = null;    // ({ detected, isMatch, icon })
    this.onTrialSuccess = null;  // ({ target, detected, latencyMs })
    this.onTrialMistake = null;  // ({ target, detected, latencyMs })
    this.onTrialTimeout = null;  // ({ target })
    this.onProgress = null;      // ({ trialIndex, totalTrials, pct })
    this.onComplete = null;      // ({ report, classList })
  }

  setVisionManager(vm) {
    this.visionManager = vm;
  }

  setBenchmark(benchmark) {
    this.gestureBenchmark = benchmark;
  }

  setInteractionTarget(el) {
    this.interactionTarget = el;
  }

  /**
   * Starts a new benchmark session.
   * @param {string} stageKey
   * @param {number} repetitions Number of trials per class (default 3)
   */
  start(stageKey = 'stage4', repetitions = 3) {
    this.stop();

    this.stageKey = stageKey;
    const testClasses = getBenchmarkClasses(stageKey);

    // Build shuffled trial sequence
    this.sequence = [];
    for (let rep = 0; rep < repetitions; rep++) {
      for (const c of testClasses) {
        this.sequence.push(c);
      }
    }
    for (let i = this.sequence.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [this.sequence[i], this.sequence[j]] = [this.sequence[j], this.sequence[i]];
    }

    if (this.gestureBenchmark) {
      this.gestureBenchmark.reset();
    }

    this.isRunning = true;
    this.trialIndex = 0;
    this._isTransitioning = false;
    this._trialTimeoutMs = (stageKey === 'stage0' || stageKey === 'stage1') ? 8000 : 10000;

    this._setupInputListeners();
    this._startTrial();

    // Start polling tick loop (for CV detection and timeout checks)
    this._tickTimer = setInterval(() => this._tick(), 35);
  }

  stop() {
    this.isRunning = false;
    this._isTransitioning = false;

    if (this._tickTimer) {
      clearInterval(this._tickTimer);
      this._tickTimer = null;
    }
    if (this._advanceTimeout) {
      clearTimeout(this._advanceTimeout);
      this._advanceTimeout = null;
    }
    if (this._removeListeners) {
      this._removeListeners();
      this._removeListeners = null;
    }
  }

  skipCurrentTrial() {
    if (!this.isRunning || this._isTransitioning) return;
    const target = this.sequence[this.trialIndex];
    const latency = Math.round(performance.now() - this.trialStartTime);

    if (this.gestureBenchmark) {
      this.gestureBenchmark.recordSample(target, 'none', latency);
    }
    if (this.onTrialTimeout) {
      this.onTrialTimeout({ target, skipped: true });
    }

    this._advanceToNextTrial();
  }

  _setupInputListeners() {
    if (this.stageKey === 'stage0') {
      const win = typeof window !== 'undefined' ? window : (typeof globalThis !== 'undefined' && globalThis.addEventListener ? globalThis : null);
      if (!win) return;

      const onKeyDown = (e) => {
        if (!this.isRunning || this._isTransitioning) return;
        let code = null;
        if (e.code === 'KeyA' || e.code === 'ArrowLeft') code = 'key_left';
        else if (e.code === 'KeyD' || e.code === 'ArrowRight') code = 'key_right';
        else if (e.code === 'KeyW' || e.code === 'ArrowUp' || e.code === 'Space') code = 'key_jump';
        else if (e.code === 'KeyS' || e.code === 'ArrowDown') code = 'key_duck';

        if (code) {
          e.preventDefault?.();
          this._handleDiscreteInput(code);
        }
      };

      win.addEventListener('keydown', onKeyDown);
      this._removeListeners = () => win.removeEventListener('keydown', onKeyDown);
    } else if (this.stageKey === 'stage1') {
      let startX = 0;
      let startY = 0;
      let isDragging = false;
      const targetEl = this.interactionTarget || (typeof window !== 'undefined' ? window : null);
      if (!targetEl) return;

      const onPointerDown = (e) => {
        if (!this.isRunning || this._isTransitioning) return;
        startX = e.clientX ?? e.touches?.[0]?.clientX ?? 0;
        startY = e.clientY ?? e.touches?.[0]?.clientY ?? 0;
        isDragging = true;
      };

      const onPointerUp = (e) => {
        if (!isDragging || !this.isRunning || this._isTransitioning) return;
        isDragging = false;
        const endX = e.clientX ?? e.changedTouches?.[0]?.clientX ?? 0;
        const endY = e.clientY ?? e.changedTouches?.[0]?.clientY ?? 0;
        const dx = endX - startX;
        const dy = endY - startY;

        let swipeDir = null;
        if (Math.hypot(dx, dy) >= 25) {
          if (Math.abs(dx) > Math.abs(dy)) {
            swipeDir = dx > 0 ? 'swipe_right' : 'swipe_left';
          } else {
            swipeDir = dy > 0 ? 'swipe_down' : 'swipe_up';
          }
        }

        if (swipeDir) {
          this._handleDiscreteInput(swipeDir);
        }
      };

      targetEl.addEventListener('pointerdown', onPointerDown);
      targetEl.addEventListener('pointerup', onPointerUp);
      this._removeListeners = () => {
        targetEl.removeEventListener('pointerdown', onPointerDown);
        targetEl.removeEventListener('pointerup', onPointerUp);
      };
    }
  }

  _startTrial() {
    if (this.trialIndex >= this.sequence.length) {
      this._completeBenchmark();
      return;
    }

    this.target = this.sequence[this.trialIndex];
    this.trialStartTime = performance.now();
    this._matchHoldStart = null;
    this._isTransitioning = false;

    const icons = getBenchmarkIcons(this.stageKey);
    const hints = getBenchmarkHints(this.stageKey);

    if (this.onTrialStart) {
      this.onTrialStart({
        trialIndex: this.trialIndex,
        totalTrials: this.sequence.length,
        target: this.target,
        icon: icons[this.target] || this.target,
        hint: hints
      });
    }

    if (this.onProgress) {
      const pct = Math.round((this.trialIndex / this.sequence.length) * 100);
      this.onProgress({
        trialIndex: this.trialIndex,
        totalTrials: this.sequence.length,
        pct
      });
    }
  }

  _tick() {
    if (!this.isRunning || this._isTransitioning) return;

    const now = performance.now();
    const elapsed = now - this.trialStartTime;
    const target = this.target;
    const isCv = isCvStage(this.stageKey);

    if (isCv && this.visionManager) {
      const st = this.visionManager.currentState;
      const detected = mapCvStateToClass(this.stageKey, st);
      const icons = getBenchmarkIcons(this.stageKey);

      if (this.onLiveDetect) {
        this.onLiveDetect({
          detected,
          isMatch: detected === target,
          icon: icons[detected] || detected
        });
      }

      // Discrete Air Swipe (Stage 5)
      if (this.stageKey === 'stage5') {
        const swipe = st?.hsSwipe;
        if (swipe && swipe !== this._lastAirSwipe) {
          this._lastAirSwipe = swipe;
          const detectedSwipe = `swipe_${swipe}`;
          this._handleDiscreteInput(detectedSwipe);
          return;
        } else if (!swipe) {
          this._lastAirSwipe = null;
        }
      } else {
        // Continuous Poses (Stage 2: Face, Stage 3: HandZone, Stage 4: Finger Gestures)
        if (detected === target) {
          if (!this._matchHoldStart) {
            this._matchHoldStart = now;
          } else if (now - this._matchHoldStart >= this._requiredHoldMs) {
            // Execution verified with stable hold!
            const latency = Math.round(now - this.trialStartTime);
            this._handleExecutionSuccess(target, latency);
            return;
          }
        } else {
          this._matchHoldStart = null;
        }
      }
    }

    // Fallback timeout protection (8-10s)
    if (elapsed >= this._trialTimeoutMs) {
      const detected = isCv ? mapCvStateToClass(this.stageKey, this.visionManager?.currentState) : 'none';
      if (this.gestureBenchmark) {
        this.gestureBenchmark.recordSample(target, detected, this._trialTimeoutMs);
      }
      if (this.onTrialTimeout) {
        this.onTrialTimeout({ target, detected });
      }
      this._advanceToNextTrial();
    }
  }

  _handleDiscreteInput(input) {
    if (this._isTransitioning || !this.isRunning) return;

    const target = this.target;
    const latency = Math.round(performance.now() - this.trialStartTime);

    if (input === target) {
      this._handleExecutionSuccess(target, latency);
    } else {
      this._handleExecutionMistake(target, input, latency);
    }
  }

  _handleExecutionSuccess(target, latency) {
    this._isTransitioning = true;

    if (this.gestureBenchmark) {
      this.gestureBenchmark.recordSample(target, target, latency);
    }
    if (this.onTrialSuccess) {
      this.onTrialSuccess({ target, detected: target, latencyMs: latency });
    }

    this._advanceTimeout = setTimeout(() => {
      this._advanceToNextTrial();
    }, 280);
  }

  _handleExecutionMistake(target, mistakeInput, latency) {
    this._isTransitioning = true;

    if (this.gestureBenchmark) {
      this.gestureBenchmark.recordSample(target, mistakeInput, latency);
    }
    if (this.onTrialMistake) {
      this.onTrialMistake({ target, detected: mistakeInput, latencyMs: latency });
    }

    this._advanceTimeout = setTimeout(() => {
      this._advanceToNextTrial();
    }, 380);
  }

  _advanceToNextTrial() {
    this._isTransitioning = false;
    this.trialIndex++;

    if (this.trialIndex >= this.sequence.length) {
      this._completeBenchmark();
    } else {
      this._startTrial();
    }
  }

  _completeBenchmark() {
    this.stop();

    const testClasses = getBenchmarkClasses(this.stageKey);
    const report = this.gestureBenchmark
      ? this.gestureBenchmark.calculateReport(testClasses)
      : null;

    if (this.onProgress) {
      this.onProgress({
        trialIndex: this.sequence.length,
        totalTrials: this.sequence.length,
        pct: 100
      });
    }

    if (this.onComplete) {
      this.onComplete({ report, classList: testClasses });
    }
  }
}
