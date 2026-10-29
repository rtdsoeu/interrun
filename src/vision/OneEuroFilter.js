/**
 * 1-Euro Filter (Casiez, Roussel, Vogel, CHI 2012)
 *
 * Adaptive first-order low-pass filter designed specifically for noisy human-computer
 * interaction (HCI) tracking signals. It dynamically balances jitter reduction at low speeds
 * (narrow cutoff frequency) with near-zero lag during rapid deliberate movements (wide cutoff frequency).
 *
 * Mathematical formulation:
 *   cutoff = minCutoff + beta * |dxHat|
 *   alpha = 1 / (1 + (1 / (2 * pi * cutoff)) / dt)
 *   xHat_i = alpha * x_i + (1 - alpha) * xHat_{i-1}
 *
 * Note on coordinate spaces:
 *   When operating on normalized coordinates in range [0, 1], beta is scaled proportionally
 *   (default beta = 5.0 .. 8.0) to achieve responsiveness equivalent to beta = 0.005 .. 0.008
 *   in raw pixel coordinate spaces.
 */
export class OneEuroFilter {
  /**
   * @param {number} minCutoff - Minimum cutoff frequency in Hz (> 0). Lower values reduce stationary jitter.
   * @param {number} beta      - Speed coefficient (> 0). Higher values reduce lag during high-speed motion.
   * @param {number} dCutoff   - Cutoff frequency for the derivative in Hz (> 0).
   */
  constructor(minCutoff = 1.0, beta = 5.0, dCutoff = 1.0) {
    this.minCutoff = minCutoff;
    this.beta = beta;
    this.dCutoff = dCutoff;

    this.xPrev = null;
    this.dxPrev = 0;
    this.tPrev = null;
  }

  /** Resets internal historical state (e.g. on mode switch or target loss) */
  reset() {
    this.xPrev = null;
    this.dxPrev = 0;
    this.tPrev = null;
  }

  /**
   * Filters an incoming noisy coordinate sample.
   * @param {number} x         - Raw noisy value
   * @param {number} timestamp - Monotonic timestamp in milliseconds (e.g. performance.now())
   * @returns {number} Filtered value
   */
  filter(x, timestamp) {
    if (this.tPrev === null || this.xPrev === null) {
      this.xPrev = x;
      this.dxPrev = 0;
      this.tPrev = timestamp;
      return x;
    }

    // Delta time in seconds, clamped to minimum to prevent division by zero
    const dt = Math.max((timestamp - this.tPrev) / 1000.0, 1e-4);
    this.tPrev = timestamp;

    // 1. Estimate and filter the rate of change (derivative / velocity)
    const dx = (x - this.xPrev) / dt;
    const alphaD = this._computeAlpha(this.dCutoff, dt);
    const dxHat = alphaD * dx + (1.0 - alphaD) * this.dxPrev;
    this.dxPrev = dxHat;

    // 2. Compute adaptive cutoff frequency based on filtered speed
    const cutoff = this.minCutoff + this.beta * Math.abs(dxHat);

    // 3. Filter the main signal with the adaptive cutoff
    const alpha = this._computeAlpha(cutoff, dt);
    const xHat = alpha * x + (1.0 - alpha) * this.xPrev;
    this.xPrev = xHat;

    return xHat;
  }

  /**
   * Calculates smoothing factor alpha from cutoff frequency (Hz) and dt (seconds).
   */
  _computeAlpha(cutoff, dt) {
    const tau = 1.0 / (2.0 * Math.PI * Math.max(cutoff, 1e-5));
    return 1.0 / (1.0 + tau / dt);
  }
}

/**
 * 2D vector wrapper around two independent 1-Euro filters for (X, Y) plane tracking.
 */
export class OneEuroFilter2D {
  /**
   * @param {number} minCutoff - Minimum cutoff frequency in Hz
   * @param {number} beta      - Speed coefficient
   * @param {number} dCutoff   - Cutoff frequency for derivative
   */
  constructor(minCutoff = 1.0, beta = 5.0, dCutoff = 1.0) {
    this.fx = new OneEuroFilter(minCutoff, beta, dCutoff);
    this.fy = new OneEuroFilter(minCutoff, beta, dCutoff);
  }

  reset() {
    this.fx.reset();
    this.fy.reset();
  }

  /**
   * Filters an (x, y) point pair.
   * @param {number} x - Raw X
   * @param {number} y - Raw Y
   * @param {number} timestamp - Millisecond timestamp
   * @returns {{x: number, y: number}} Filtered coordinates
   */
  filter(x, y, timestamp) {
    return {
      x: this.fx.filter(x, timestamp),
      y: this.fy.filter(y, timestamp)
    };
  }
}
