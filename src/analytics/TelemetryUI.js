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
    const kpiFatigue = document.getElementById('telem-kpi-fatigue');

    if (metrics) {
      if (kpiRuns) kpiRuns.textContent = String(metrics.totalRuns);
      if (kpiDist) kpiDist.textContent = `${metrics.totalDistanceKm} km`;
      if (kpiTime) kpiTime.textContent = `${metrics.avgSessionDurationSec} s`;
      const lastRun = history[history.length - 1];
      if (kpiFatigue) kpiFatigue.textContent = String(lastRun?.fatigueIndex ?? '1.00');
    } else {
      if (kpiRuns) kpiRuns.textContent = '0';
      if (kpiDist) kpiDist.textContent = '0 m';
      if (kpiTime) kpiTime.textContent = '0 s';
      if (kpiFatigue) kpiFatigue.textContent = '1.00';
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
      susVal.textContent = stats.totalResponses > 0 ? `${stats.susProxyScore} / 100 (N=${stats.totalResponses})` : '—';
    }
  }

  saveSurveyResponse(surveyManager, telemetryManager) {
    if (!surveyManager || typeof document === 'undefined') return;

    const getVal = (name) => {
      const checked = document.querySelector(`input[name="${name}"]:checked`);
      return checked ? parseInt(checked.value, 10) : 3;
    };

    const fatigue = getVal('survey-fatigue');
    const responsiveness = getVal('survey-resp');
    const transition = getVal('survey-trans');
    const satisfaction = getVal('survey-sat');
    const comment = document.getElementById('survey-user-comment')?.value || '';

    const sessionCount = telemetryManager?.getHistory().length || 1;
    const bestDist = parseInt(typeof localStorage !== 'undefined' ? (localStorage.getItem('interrun_best') || '0') : '0', 10);

    surveyManager.submitSurvey({
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
      saveBtn.textContent = '✓ Збережено!';
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
