/**
 * PipOverlay — 2D canvas overlay renderer for webcam PIP window.
 * - Hardware mirrored camera video feed
 * - Zone grid overlay with real bounding box thresholds
 * - Facial & hand landmark points
 * - Active gesture / action debug badge
 * - Loading status indicator
 */

export const ZONE_ACTION_COLORS = {
  'top-L': '#6c63ff55', 'top-C': '#00e5ff55', 'top-R': '#6c63ff55',
  'mid-L': '#00ff8844', 'mid-C': 'rgba(255,255,255,0.03)', 'mid-R': '#00ff8844',
  'bot-L': '#ff6b3555', 'bot-C': '#ff6b3555', 'bot-R': '#ff6b3555'
};

export const ZONE_LABELS = [
  ['↑◀', '↑', '↑▶'],
  ['◀',  '·', '▶' ],
  ['↓◀', '↓', '↓▶']
];

export class PipOverlay {
  constructor() {
    this._lastDrawTime = 0;
  }

  /**
   * Main rendering method for PIP canvas overlay.
   */
  render({
    canvas,
    ctx,
    video,
    state,
    settings,
    activeMode,
    isModelReady = true,
    preloadProgress = 0,
    now = performance.now()
  }) {
    if (!ctx || !canvas) return;

    // Skip rendering if PIP is hidden
    const pip = (typeof document !== 'undefined') ? document.getElementById('webcam-pip') : null;
    if (!pip || pip.classList.contains('hidden')) return;

    // If PIP is turned off by user, hide and bail
    if (settings?.pipMode === 'off') {
      pip.classList.add('hidden');
      return;
    }

    // ~22 FPS cap for PIP overlay (45ms minimum between draws)
    if (now - this._lastDrawTime < 45) return;
    this._lastDrawTime = now;

    const W = canvas.width;
    const H = canvas.height;

    if (settings?.pipMode === 'minimal') {
      // Minimal mode: solid fill — avoids GPU video-blit overhead entirely
      ctx.fillStyle = '#080d1a';
      ctx.fillRect(0, 0, W, H);
    } else if (video) {
      // Full mode: mirrored webcam video — single save/restore wraps the transform
      ctx.save();
      ctx.clearRect(0, 0, W, H);
      ctx.setTransform(-1, 0, 0, 1, W, 0); // mirror in one step
      ctx.drawImage(video, 0, 0, W, H);
      ctx.restore();
    }

    // Zone grid overlay (stage 2 & 3: zone and handzone only)
    if (activeMode === 'zone' || activeMode === 'handzone') {
      this.renderZoneGrid(ctx, W, H, activeMode, state);
    }

    // Landmark points from worker
    const pts = state?.points;
    if (pts && pts.length > 0) {
      for (const p of pts) {
        this.drawPoint(ctx, canvas, p.x, p.y, p.color || '#00e5ff', p.r || 4);
      }
    }

    // If active model is not loaded yet, render gentle loading banner in PIP without occluding the preview
    if (!isModelReady) {
      ctx.save();
      const bannerH = 20;
      ctx.fillStyle = 'rgba(8, 13, 26, 0.85)';
      ctx.fillRect(4, H - bannerH - 4, W - 8, bannerH);
      ctx.strokeStyle = 'rgba(255, 215, 0, 0.6)';
      ctx.lineWidth = 1;
      ctx.strokeRect(4, H - bannerH - 4, W - 8, bannerH);
      ctx.fillStyle = '#ffd700';
      ctx.font = 'bold 9px Outfit, sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      const pct = Math.round((preloadProgress || 0) * 100);
      const text = pct > 0 && pct < 100 ? `⚡ LOADING AI (${pct}%)...` : '⚡ PREPARING AI...';
      ctx.fillText(text, W / 2, H - 4 - bannerH / 2);
      ctx.restore();
    }

    // Status badge (gesture / action text)
    const hasText = !!state?.debugText;
    if (hasText) {
      ctx.save();
      ctx.fillStyle = 'rgba(0,0,0,0.75)';
      ctx.fillRect(6, 6, 180, 22);
      ctx.fillStyle = '#00e5ff';
      ctx.font = 'bold 11px Outfit, sans-serif';
      ctx.textAlign = 'left';
      ctx.fillText(state.debugText, 12, 21);
      ctx.restore();
    }
  }

  /**
   * Draws zone grid and highlights active cell.
   * Lines are drawn based on REAL thresholds (not uniform screen thirds).
   * Hand: X 33/66%, Y 22/78%
   * Face: X 40/60%, Y 28/72%
   */
  renderZoneGrid(ctx, W, H, activeMode, state) {
    const isHand = activeMode === 'handzone' || (activeMode === 'zone' && state?.zoneSource === 'hands');
    const isFace = !isHand;

    // Use dynamic adaptive thresholds if calibrated by AdaptivePoseCalibrator, else fallback to nominal
    const az = state?.adaptiveZone;
    const xLeftPct  = az ? az.xL : (isFace ? 0.40 : 0.42);
    const xRightPct = az ? az.xR : (isFace ? 0.60 : 0.58);
    const yTopPct   = az ? az.yT : (isFace ? 0.43 : 0.45);
    const yBotPct   = az ? az.yB : (isFace ? 0.66 : 0.66);

    // Active column / row
    const col = activeMode === 'handzone' ? state?.hzCol : state?.zoneCol;
    const row = activeMode === 'handzone' ? state?.hzRow : state?.zoneRow;

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
    ctx.save();
    ctx.fillStyle = ZONE_ACTION_COLORS[actionKey] || 'rgba(255,255,255,0.06)';
    ctx.fillRect(x0, y0, x1 - x0, y1 - y0);

    // --- Grid lines based on dynamic adaptive thresholds ---
    ctx.strokeStyle = isHand ? 'rgba(255, 215, 0, 0.60)' : (az?.isAsymmetric ? 'rgba(255, 215, 0, 0.65)' : 'rgba(0, 229, 255, 0.50)');
    ctx.lineWidth = 1.5;
    ctx.setLineDash([4, 3]);

    ctx.beginPath();
    ctx.moveTo(xL, 0); ctx.lineTo(xL, H);
    ctx.moveTo(xR, 0); ctx.lineTo(xR, H);
    ctx.moveTo(0, yT); ctx.lineTo(W, yT);
    ctx.moveTo(0, yB); ctx.lineTo(W, yB);
    ctx.stroke();

    // --- Icons in cells (zero allocation) ---
    ctx.setLineDash([]);
    ctx.font = 'bold 9px sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';

    const colIdx = col === 'L' ? 0 : col === 'R' ? 2 : 1;
    const rowIdx = row === 'top' ? 0 : row === 'bot' ? 2 : 1;

    for (let r = 0; r < 3; r++) {
      const cy = r === 0 ? yT / 2 : r === 1 ? (yT + yB) / 2 : (yB + H) / 2;
      for (let c = 0; c < 3; c++) {
        const cx = c === 0 ? xL / 2 : c === 1 ? (xL + xR) / 2 : (xR + W) / 2;
        ctx.fillStyle = (r === rowIdx && c === colIdx) ? '#ffffff' : 'rgba(255,255,255,0.35)';
        ctx.fillText(ZONE_LABELS[r][c], cx, cy);
      }
    }

    // --- Dynamic Camera Tilt & Adaptive Centering Status Badge ---
    if (az?.isCalibrated === false || az?.state === 'warmup') {
      const pct = Math.round((az?.calibrationProgress || 0) * 100);
      ctx.fillStyle = isHand ? 'rgba(255, 215, 0, 0.90)' : 'rgba(0, 229, 255, 0.90)';
      ctx.fillRect(4, 4, W - 8, 14);
      ctx.fillStyle = '#080d1a';
      ctx.font = 'bold 8px sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      const label = isHand ? `📐 CALIBRATING HAND (${pct}%)` : `📐 CALIBRATING ANGLE (${pct}%)`;
      ctx.fillText(label, W / 2, 11);
    } else if (az?.warning === 'tilt_down') {
      ctx.fillStyle = 'rgba(255, 107, 53, 0.90)';
      ctx.fillRect(4, 4, W - 8, 14);
      ctx.fillStyle = '#ffffff';
      ctx.font = 'bold 8px sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(isHand ? '⚠️ RAISE HAND HIGHER' : '⚠️ TILT CAM DOWN', W / 2, 11);
    } else if (az?.warning === 'tilt_up') {
      ctx.fillStyle = 'rgba(255, 107, 53, 0.90)';
      ctx.fillRect(4, 4, W - 8, 14);
      ctx.fillStyle = '#ffffff';
      ctx.font = 'bold 8px sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(isHand ? '⚠️ LOWER HAND' : '⚠️ TILT CAM UP', W / 2, 11);
    } else if (az?.state === 'recentering') {
      ctx.fillStyle = isHand ? 'rgba(255, 215, 0, 0.90)' : 'rgba(0, 229, 255, 0.90)';
      ctx.fillRect(4, 4, W - 8, 14);
      ctx.fillStyle = '#080d1a';
      ctx.font = 'bold 8px sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText('📐 POSITION RE-CENTERED', W / 2, 11);
    }

    ctx.restore();
  }

  drawPoint(ctx, canvas, normX, normY, color, radius = 4) {
    if (!ctx || !canvas) return;
    ctx.save();
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.arc(normX * canvas.width, normY * canvas.height, radius, 0, Math.PI * 2);
    ctx.fill();
    // Border for enhanced visibility
    ctx.strokeStyle = 'rgba(0,0,0,0.5)';
    ctx.lineWidth = 1.5;
    ctx.stroke();
    ctx.restore();
  }
}
