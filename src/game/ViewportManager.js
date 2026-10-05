/**
 * ViewportManager — Handles viewport framing, render scaling, aspect ratio,
 * and responsive resize observation for InterRun.
 */
export class ViewportManager {
  /**
   * @param {object} params
   * @param {THREE.PerspectiveCamera} params.camera
   * @param {THREE.WebGLRenderer} params.renderer
   * @param {HTMLElement} [params.container]
   */
  constructor({ camera, renderer, container }) {
    this.camera = camera;
    this.renderer = renderer;
    this.container = container || (typeof document !== 'undefined' ? document.getElementById('game-container') : null);

    const savedFrame = typeof localStorage !== 'undefined' ? localStorage.getItem('interrun_viewport_frame') : null;
    const savedScale = typeof localStorage !== 'undefined' ? localStorage.getItem('interrun_render_scale') : null;

    this.viewportFrame = savedFrame || 'full';
    this.renderScale = savedScale ? parseFloat(savedScale) : 1.0;

    this._onResize = () => this.handleResize();
    this._resizeObserver = null;

    this._initListeners();
    this.applyViewportFrame(this.viewportFrame);
    this.applyRenderScale(this.renderScale);
  }

  _initListeners() {
    if (typeof window !== 'undefined') {
      window.addEventListener('resize', this._onResize);
      if (window.visualViewport) {
        window.visualViewport.addEventListener('resize', this._onResize);
        window.visualViewport.addEventListener('scroll', this._onResize);
      }
    }

    if (this.container && typeof ResizeObserver !== 'undefined') {
      this._resizeObserver = new ResizeObserver(() => this.handleResize());
      this._resizeObserver.observe(this.container);
    }
  }

  /**
   * Adjusts camera aspect ratio and renderer viewport dimensions.
   */
  handleResize() {
    const container = this.container || (typeof document !== 'undefined' ? (document.getElementById('game-container') || document.body) : null);
    const maxH = typeof window !== 'undefined'
      ? (window.visualViewport ? Math.round(window.visualViewport.height) : window.innerHeight)
      : 720;
    const maxW = typeof window !== 'undefined'
      ? (window.visualViewport ? Math.round(window.visualViewport.width) : window.innerWidth)
      : 1280;

    let w = container?.clientWidth || maxW;
    let h = container?.clientHeight || maxH;

    // Safety guard: in fullscreen mobile browsers, ensure canvas never exceeds
    // the true visible visual viewport (eliminates bottom 15-20px overflow beneath navigation bar)
    if (this.viewportFrame === 'full') {
      if (h > maxH) h = maxH;
      if (w > maxW) w = maxW;
    }

    if (w <= 0 || h <= 0) return;

    if (this.camera) {
      this.camera.aspect = w / h;
      this.camera.updateProjectionMatrix();
    }

    if (this.renderer) {
      this.renderer.setSize(w, h, false);
    }
  }

  /**
   * Sets the viewport framing aspect ratio ('full', '16-9', 'mobile', '4-3').
   * @param {string} frame
   */
  applyViewportFrame(frame) {
    this.viewportFrame = frame;
    const container = this.container || (typeof document !== 'undefined' ? document.getElementById('game-container') : null);
    if (container) {
      container.classList.remove('frame-full', 'frame-16-9', 'frame-mobile', 'frame-4-3');
      container.classList.add(`frame-${frame}`);
    }

    if (typeof localStorage !== 'undefined') {
      localStorage.setItem('interrun_viewport_frame', frame);
    }

    if (typeof requestAnimationFrame !== 'undefined') {
      requestAnimationFrame(() => this.handleResize());
      setTimeout(() => this.handleResize(), 320);
    }
  }

  /**
   * Sets 3D render scale factor (0.5, 0.75, 1.0).
   * @param {number} scale
   */
  applyRenderScale(scale) {
    this.renderScale = scale;
    if (typeof localStorage !== 'undefined') {
      localStorage.setItem('interrun_render_scale', String(scale));
    }

    if (this.renderer) {
      const dpr = Math.min(typeof window !== 'undefined' ? window.devicePixelRatio || 1 : 1, 2) * scale;
      this.renderer.setPixelRatio(dpr);
    }

    this.handleResize();
  }

  /**
   * Cleans up event listeners and observers.
   */
  dispose() {
    if (typeof window !== 'undefined') {
      window.removeEventListener('resize', this._onResize);
      if (window.visualViewport) {
        window.visualViewport.removeEventListener('resize', this._onResize);
        window.visualViewport.removeEventListener('scroll', this._onResize);
      }
    }

    if (this._resizeObserver) {
      this._resizeObserver.disconnect();
      this._resizeObserver = null;
    }
  }
}
