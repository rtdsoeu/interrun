/**
 * TransitionBanner — handles stage announcement banners and countdown overlay.
 * - Stage Announce banner (#stage-announce, #stage-transition)
 * - Stage Countdown timer (#stage-countdown-banner, SVG circular progress)
 * - Touch-aware localized stage titles, badges, and controls hints
 */
import { i18n } from '../../i18n/I18n.js';
import { STAGE_CYCLE_LENGTH } from '../../game/ScoreSystem.js';

export class TransitionBanner {
  constructor() {
    this._lastStageNumber = undefined;
    this._lastIsLocked = false;
    this._lastCycle = 0;
  }

  _t(key) {
    return i18n.t(key);
  }

  _isTouch() {
    return (typeof window !== 'undefined') && (('ontouchstart' in window) || (navigator.maxTouchPoints > 0));
  }

  _tStage(stageNumber, field) {
    if (this._isTouch()) {
      const touchKey = `stage.${stageNumber}.${field}.touch`;
      const val = this._t(touchKey);
      if (val !== touchKey) return val;
    }
    return this._t(`stage.${stageNumber}.${field}`);
  }

  _tTransition(stageNumber) {
    if (this._isTouch()) {
      const touchKey = `transition.hint.${stageNumber}.touch`;
      const val = this._t(touchKey);
      if (val !== touchKey) return val;
    }
    return this._t(`transition.hint.${stageNumber}`);
  }

  announceStage(stageNumber, isLocked = false, cycle = null, currentDist = 0, soundFx = null) {
    const stages = [
      { badge: this._tStage(0, 'badge'), hint: this._tStage(0, 'hint'), title: this._tStage(0, 'title'), desc: this._tStage(0, 'desc') },
      { badge: this._tStage(1, 'badge'), hint: this._tStage(1, 'hint'), title: this._tStage(1, 'title'), desc: this._tStage(1, 'desc') },
      { badge: this._tStage(2, 'badge'), hint: this._tStage(2, 'hint'), title: this._tStage(2, 'title'), desc: this._tStage(2, 'desc') },
      { badge: this._tStage(3, 'badge'), hint: this._tStage(3, 'hint'), title: this._tStage(3, 'title'), desc: this._tStage(3, 'desc') },
      { badge: this._tStage(4, 'badge'), hint: this._tStage(4, 'hint'), title: this._tStage(4, 'title'), desc: this._tStage(4, 'desc') },
      { badge: this._tStage(5, 'badge'), hint: this._tStage(5, 'hint'), title: this._tStage(5, 'title'), desc: this._tStage(5, 'desc') },
    ];

    const info = stages[stageNumber] ?? stages[0];
    const lockSuffix = isLocked ? ' 🔒' : '';
    const effectiveCycle = (cycle !== null && cycle !== undefined) ? cycle : Math.floor(currentDist / STAGE_CYCLE_LENGTH);
    const loopSuffix = effectiveCycle > 0 ? ` [${this._t('stage.loop')} ${effectiveCycle + 1}]` : '';

    this._lastStageNumber = stageNumber;
    this._lastIsLocked = isLocked;
    this._lastCycle = effectiveCycle;

    const elStageBadge = document.getElementById('stage-badge');
    const elControlHint = document.getElementById('control-hint');
    const elStageTitle = document.getElementById('stage-title');
    const elStageDesc = document.getElementById('stage-desc');
    const elStageTransition = document.getElementById('stage-transition');

    if (elStageBadge) elStageBadge.textContent = info.badge + loopSuffix + lockSuffix;
    if (elControlHint) elControlHint.innerHTML = info.hint;

    const shouldAnnounce = stageNumber > 0 || currentDist > 50 || effectiveCycle > 0;
    if (shouldAnnounce) {
      if (elStageTitle) elStageTitle.textContent = info.title + loopSuffix + lockSuffix;
      if (elStageDesc) elStageDesc.textContent = info.desc;

      const announce = document.getElementById('stage-announce');
      if (elStageTransition && announce) {
        elStageTransition.classList.add('flash');
        announce.classList.add('show');
        if (soundFx) soundFx.playStageUp();
        setTimeout(() => {
          announce.classList.remove('show');
          elStageTransition.classList.remove('flash');
        }, 2400);
      }
    }
  }

  showTransitionCountdown(stageNumber, totalDuration, remainingSec, cycle = 0) {
    const banner = document.getElementById('stage-countdown-banner');
    if (!banner) return;

    const stageNames = [
      this._tStage(0, 'badge'),
      this._tStage(1, 'badge'),
      this._tStage(2, 'badge'),
      this._tStage(3, 'badge'),
      this._tStage(4, 'badge'),
      this._tStage(5, 'badge')
    ];

    const stageHints = [
      this._tTransition(0),
      this._tTransition(1),
      this._tTransition(2),
      this._tTransition(3),
      this._tTransition(4),
      this._tTransition(5)
    ];

    const badge = document.getElementById('transition-next-badge');
    const hint = document.getElementById('transition-next-hint');

    this._currentStageNumber = stageNumber;
    this._currentHintHtml = stageHints[stageNumber] || '';

    const loopSuffix = cycle > 0 ? ` [${this._t('stage.loop')} ${cycle + 1}]` : '';
    if (badge) badge.textContent = (stageNames[stageNumber] || `STAGE ${stageNumber}`) + loopSuffix;
    if (hint) hint.innerHTML = this._currentHintHtml;

    banner.classList.remove('hidden');
    this.updateTransitionCountdown(remainingSec, totalDuration);
  }

  updateTransitionCountdown(remainingSec, totalDuration = 3.5, isWaiting = false, stageNumber = null) {
    if (stageNumber !== null && stageNumber !== undefined) {
      this._currentStageNumber = stageNumber;
    }
    const numEl = document.getElementById('transition-timer-num');
    const circle = document.getElementById('transition-timer-circle');
    const hint = document.getElementById('transition-next-hint');

    const rem = Math.max(0, remainingSec);
    if (numEl) {
      if (isWaiting) {
        numEl.textContent = '⏳';
        numEl.style.color = '#ffd700';
      } else {
        numEl.textContent = rem > 0.05 ? rem.toFixed(1) : 'GO!';
        numEl.style.color = rem <= 1.0 ? '#00ff88' : '#00e5ff';
      }
    }

    if (hint) {
      if (isWaiting) {
        let waitKey;
        if (this._currentStageNumber === 2) {
          waitKey = 'transition.waiting.face';
        } else if (this._currentStageNumber === 3) {
          waitKey = 'transition.waiting.hand';
        } else if (this._currentStageNumber === 4) {
          waitKey = 'transition.waiting.gestures';
        } else if (this._currentStageNumber === 5) {
          waitKey = 'transition.waiting.swipes';
        } else {
          waitKey = 'transition.waiting.ready';
        }
        hint.innerHTML = `<span style="color:#ffd700; font-weight:700;">${this._t(waitKey)}</span>`;
      } else if (this._currentHintHtml) {
        hint.innerHTML = this._currentHintHtml;
      }
    }

    if (circle && totalDuration > 0) {
      const progress = isWaiting ? 0.90 : Math.max(0, Math.min(1, rem / totalDuration));
      const offset = 100 * (1 - progress);
      circle.style.strokeDashoffset = `${offset}`;
      circle.style.stroke = isWaiting ? '#ffd700' : (rem <= 1.0 ? '#00ff88' : '#00e5ff');
    }
  }

  hideTransitionCountdown() {
    const banner = document.getElementById('stage-countdown-banner');
    if (banner) banner.classList.add('hidden');
  }
}
