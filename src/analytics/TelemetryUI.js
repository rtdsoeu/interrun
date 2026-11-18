/**
 * TelemetryUI — DOM renderer and export coordinator for Telemetry Stats and Usability Survey tabs.
 */

import { i18n } from '../i18n/I18n.js';

export class TelemetryUI {
  constructor() {
    this._isBound = false;
  }

  renderTelemetryStats(telemetryManager) {
    if (!telemetryManager || typeof document === 'undefined') return;

    const metrics = telemetryManager.getAggregatedMetrics();
    const history = telemetryManager.getHistory();

    const kpiRuns = document.getElementById('telem-kpi-runs');
    const kpiDist = document.getElementById('telem-kpi-dist');
    const kpiTime = document.getElementById('telem-kpi-time');
    const styleLabel = document.getElementById('telem-style-label');
    const styleReg = document.getElementById('telem-style-reg');
    const styleManeuver = document.getElementById('telem-style-maneuver');
    const styleKinematics = document.getElementById('telem-style-kinematics');

    const lastRun = history[history.length - 1] || telemetryManager.currentSession;
    const playStyle = lastRun?.dda?.playStyle;
    const kinSummary = telemetryManager.getKinematicSummary();

    if (styleLabel && styleReg) {
      if (playStyle && playStyle.sampleCount >= 3) {
        let icon = '⚖️';
        let color = '#00ff88';
        if (playStyle.archetype === 'risk_taker') {
          icon = '🔥';
          color = '#ff3d5e';
        } else if (playStyle.archetype === 'cautious') {
          icon = '🛡️';
          color = '#4cc9f0';
        } else if (playStyle.archetype === 'variable') {
          icon = '⚡';
          color = '#ffd700';
        }

        let personaKey = 'telemetry.style.persona.flow_master';
        if (playStyle.archetype === 'risk_taker') {
          personaKey = playStyle.maneuverArchetype === 'weaver' ? 'telemetry.style.persona.risk_weaver'
                     : playStyle.maneuverArchetype === 'acrobat' ? 'telemetry.style.persona.risk_acrobat'
                     : 'telemetry.style.persona.risk_taker';
        } else if (playStyle.archetype === 'cautious') {
          personaKey = playStyle.maneuverArchetype === 'weaver' ? 'telemetry.style.persona.tactical_weaver'
                     : playStyle.maneuverArchetype === 'acrobat' ? 'telemetry.style.persona.tactical_acrobat'
                     : 'telemetry.style.persona.tactician';
        } else if (playStyle.archetype === 'variable') {
          personaKey = 'telemetry.style.persona.dynamic';
        } else if (playStyle.archetype === 'calibrating') {
          personaKey = 'telemetry.style.persona.calibrating';
        } else {
          personaKey = playStyle.maneuverArchetype === 'weaver' ? 'telemetry.style.persona.flow_weaver'
                     : playStyle.maneuverArchetype === 'acrobat' ? 'telemetry.style.persona.flow_acrobat'
                     : 'telemetry.style.persona.flow_master';
        }

        const title = i18n?.t?.(personaKey) || playStyle.personaTitle || `${icon} ${playStyle.label}`;
        styleLabel.innerHTML = `<span style="color:${color};">${title}</span>`;
        styleReg.textContent = `${playStyle.regularityPct}% ${i18n.t('telemetry.style.reg_title').toLowerCase()} (${i18n.lang === 'uk' ? 'сер.' : 'avg.'} ${playStyle.avgMarginMeters}m)`;
      } else {
        styleLabel.textContent = i18n?.t?.('telemetry.style.persona.flow_master') || '⚡ Flow Master';
        styleReg.textContent = i18n.t('telemetry.style.calibrating');
      }
    }

    if (styleManeuver) {
      if (playStyle && playStyle.weavesPct !== undefined) {
        const icon = playStyle.maneuverIcon || '🏃';
        const maneuverKey = playStyle.maneuverArchetype === 'weaver' ? 'telemetry.style.maneuver.weaver'
                          : playStyle.maneuverArchetype === 'acrobat' ? 'telemetry.style.maneuver.acrobat'
                          : 'telemetry.style.maneuver.universal';
        const label = i18n?.t?.(maneuverKey) || playStyle.maneuverLabel || i18n.t('telemetry.style.maneuvers');
        styleManeuver.textContent = `${icon} ${label} (${playStyle.weavesPct}% ${i18n.t('telemetry.style.lanes')} / ${playStyle.verticalsPct}% ${i18n.t('telemetry.style.jumps')})`;
      } else {
        styleManeuver.textContent = i18n.t('telemetry.style.maneuver_calib');
      }
    }

    if (styleKinematics) {
      if (kinSummary && (kinSummary.headMeters > 0 || kinSummary.handMeters > 0)) {
        const kinLabel = (kinSummary.style && i18n?.t?.(`telemetry.style.kin.${kinSummary.style}`)) || kinSummary.styleLabel;
        styleKinematics.textContent = `${kinSummary.icon} ${kinLabel} (${kinSummary.headMeters} ${i18n.t('telemetry.style.head')}, ${kinSummary.handMeters} ${i18n.t('telemetry.style.hand')})`;
      } else if (playStyle?.nearMissCount > 0) {
        styleKinematics.textContent = `🔥 ${playStyle.nearMissCount} ${i18n.t('telemetry.style.near_misses')}`;
      } else {
        styleKinematics.textContent = i18n.t('telemetry.style.bio_gathering');
      }
    }

    if (metrics) {
      if (kpiRuns) kpiRuns.textContent = String(metrics.totalRuns);
      if (kpiDist) kpiDist.textContent = `${metrics.totalDistanceKm} km`;
      if (kpiTime) kpiTime.textContent = `${metrics.avgSessionDurationSec} s`;
    } else {
      if (kpiRuns) kpiRuns.textContent = '0';
      if (kpiDist) kpiDist.textContent = '0 m';
      if (kpiTime) kpiTime.textContent = '0 s';
    }

    const tbody = document.getElementById('telem-table-stages-body');
    if (tbody) {
      const stageNames = [
        '0: ⌨️ ' + i18n.t('stage.0.name'),
        '1: 👆 ' + i18n.t('stage.1.name'),
        '2: 🎯 ' + i18n.t('stage.2.name'),
        '3: ✋ ' + i18n.t('stage.3.name'),
        '4: ✌️ ' + i18n.t('stage.4.name'),
        '5: 👋 ' + i18n.t('stage.5.name')
      ];

      let html = '';
      for (let s = 0; s <= 5; s++) {
        const stageData = metrics?.stages?.[s];
        const dist = stageData?.totalDistance ? `${stageData.totalDistance}m` : '0m';
        const errors = stageData ? `${stageData.errorRatePer100m} /100m` : '0.00';
        let reaction = '—';
        if (stageData?.avgReactionTimeMs) {
          const ttc = stageData.avgReactionTimeMs;
          if (ttc < 350) {
            reaction = `<span style="color:#ff3d5e; font-weight:700;" title="${i18n.t('telemetry.ttc.nearmiss')}">${ttc}ms 🔥</span>`;
          } else if (ttc <= 700) {
            reaction = `<span style="color:#00ff88; font-weight:700;" title="${i18n.t('telemetry.ttc.balanced')}">${ttc}ms ⚖️</span>`;
          } else {
            reaction = `<span style="color:#4cc9f0; font-weight:700;" title="${i18n.t('telemetry.ttc.safe')}">${ttc}ms 🛡️</span>`;
          }
        }
        const fps = s >= 2
          ? `${stageData?.meanCvFps || '--'} CV / ${stageData?.meanGameFps || 60}`
          : `— / ${stageData?.meanGameFps || 60}`;

        html += `
          <tr style="border-bottom:1px solid rgba(255,255,255,0.06);">
            <td style="padding:6px; font-weight:700;">${stageNames[s]}</td>
            <td style="padding:6px;">${dist}</td>
            <td style="padding:6px; color:${stageData?.errorRatePer100m > 1 ? '#ff6b35' : '#00ff88'};">${errors}</td>
            <td style="padding:6px;">${reaction}</td>
            <td style="padding:6px; color:rgba(255,255,255,0.65);">${fps}</td>
          </tr>
        `;
      }
      tbody.innerHTML = html;
    }
  }

  exportTelemetryCsv(telemetryManager) {
    if (!telemetryManager) return;
    const csv = telemetryManager.exportToCsv();
    this._downloadFile('interrun_telemetry.csv', csv, 'text/csv');
  }

  exportTelemetryJson(telemetryManager) {
    if (!telemetryManager) return;
    const json = telemetryManager.exportToJson();
    this._downloadFile('interrun_telemetry.json', json, 'application/json');
  }

  clearTelemetryHistory(telemetryManager) {
    if (!telemetryManager) return;
    telemetryManager.clearHistory();
    this.renderTelemetryStats(telemetryManager);
  }

  renderSurveySummary(surveyManager) {
    if (!surveyManager || typeof document === 'undefined') return;
    const stats = surveyManager.getStatistics();
    const susVal = document.getElementById('survey-sus-val');
    if (susVal) {
      const score = stats.susScore !== undefined ? stats.susScore : stats.susProxyScore;
      susVal.textContent = stats.totalResponses > 0 ? `${score} / 100 (N=${stats.totalResponses})` : '—';
    }
  }

  saveSurveyResponse(surveyManager, telemetryManager) {
    if (!surveyManager || typeof document === 'undefined') return;

    const getVal = (name, fallback = 3) => {
      const checked = document.querySelector(`input[name="${name}"]:checked`);
      return checked ? parseInt(checked.value, 10) : fallback;
    };

    const answers = [];
    for (let i = 1; i <= 10; i++) {
      answers.push(getVal(`survey-q${i}`, 3));
    }

    // Support legacy field elements if present
    const fatigue = getVal('survey-fatigue', answers[7]);
    const responsiveness = getVal('survey-resp', answers[2]);
    const transition = getVal('survey-trans', answers[4]);
    const satisfaction = getVal('survey-sat', answers[0]);
    const comment = document.getElementById('survey-user-comment')?.value || '';

    const sessionCount = telemetryManager?.getHistory().length || 1;
    const bestDist = parseInt(typeof localStorage !== 'undefined' ? (localStorage.getItem('interrun_best') || '0') : '0', 10);

    surveyManager.submitSurvey({
      q1: answers[0],
      q2: answers[1],
      q3: answers[2],
      q4: answers[3],
      q5: answers[4],
      q6: answers[5],
      q7: answers[6],
      q8: answers[7],
      q9: answers[8],
      q10: answers[9],
      answers,
      fatigue,
      responsiveness,
      transition,
      satisfaction,
      comment
    }, sessionCount, bestDist);

    this.renderSurveySummary(surveyManager);

    const saveBtn = document.getElementById('btn-survey-save');
    if (saveBtn) {
      const orig = saveBtn.textContent;
      saveBtn.textContent = i18n.t('telemetry.survey.saved');
      saveBtn.style.background = '#00ff88';
      saveBtn.style.color = '#000';
      setTimeout(() => {
        saveBtn.textContent = orig;
        saveBtn.style.background = '';
        saveBtn.style.color = '';
      }, 1800);
    }
  }

  exportSurveyCsv(surveyManager) {
    if (!surveyManager) return;
    const csv = surveyManager.exportToCsv();
    this._downloadFile('interrun_usability_surveys.csv', csv, 'text/csv');
  }

  _downloadFile(filename, content, mimeType) {
    if (typeof document === 'undefined') return;
    try {
      const blob = new Blob([content], { type: mimeType });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      setTimeout(() => URL.revokeObjectURL(url), 1000);
    } catch (e) {
      console.warn('[TelemetryUI] File download failed:', e);
    }
  }
}
