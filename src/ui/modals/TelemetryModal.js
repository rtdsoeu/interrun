/**
 * TelemetryModal — controller for the telemetry stats, benchmark, and survey modal.
 * Coordinates TelemetryUI, BenchmarkUI, and SurveyManager.
 */

export class TelemetryModal {
  constructor({
    telemetryManager = null,
    gestureBenchmark = null,
    surveyManager = null,
    telemetryUI = null,
    benchmarkUI = null
  } = {}) {
    this.telemetryManager = telemetryManager;
    this.gestureBenchmark = gestureBenchmark;
    this.surveyManager = surveyManager;
    this.telemetryUI = telemetryUI;
    this.benchmarkUI = benchmarkUI;
    this.currentTab = 'stats';
  }

  get elModal() {
    return document.getElementById('telemetry-modal');
  }

  isOpen() {
    return !!this.elModal && !this.elModal.classList.contains('hidden');
  }

  open() {
    this.elModal?.classList.remove('hidden');
    this.switchTab(this.currentTab || 'stats');
    this.renderTelemetryStats();
    this.renderSurveySummary();
  }

  close() {
    this.elModal?.classList.add('hidden');
    this.benchmarkUI?.closeBenchmark();
  }

  toggle() {
    if (this.isOpen()) {
      this.close();
    } else {
      this.open();
    }
  }

  switchTab(tab) {
    this.currentTab = tab;
    const tabStats = document.getElementById('btn-telem-tab-stats');
    const tabBench = document.getElementById('btn-telem-tab-bench');
    const tabSurvey = document.getElementById('btn-telem-tab-survey');

    const panelStats = document.getElementById('telem-panel-stats');
    const panelBench = document.getElementById('telem-panel-bench');
    const panelSurvey = document.getElementById('telem-panel-survey');

    const setTabStyle = (btn, active) => {
      if (!btn) return;
      btn.style.borderColor = active ? '#00ff88' : 'rgba(255,255,255,0.12)';
      btn.style.color = active ? '#00ff88' : 'rgba(255,255,255,0.7)';
      btn.style.background = active ? 'rgba(0,255,136,0.12)' : 'rgba(255,255,255,0.03)';
    };

    setTabStyle(tabStats, tab === 'stats');
    setTabStyle(tabBench, tab === 'bench');
    setTabStyle(tabSurvey, tab === 'survey');

    if (panelStats) panelStats.classList.toggle('hidden', tab !== 'stats');
    if (panelBench) panelBench.classList.toggle('hidden', tab !== 'bench');
    if (panelSurvey) panelSurvey.classList.toggle('hidden', tab !== 'survey');

    if (tab === 'stats') this.renderTelemetryStats();
    if (tab === 'bench') {
      this.benchmarkUI?.onTargetChanged();
    } else {
      this.benchmarkUI?.closeBenchmark();
    }
    if (tab === 'survey') this.renderSurveySummary();
  }

  renderTelemetryStats() {
    this.telemetryUI?.renderTelemetryStats(this.telemetryManager);
  }

  exportTelemetryCsv() {
    this.telemetryUI?.exportTelemetryCsv(this.telemetryManager);
  }

  exportTelemetryJson() {
    this.telemetryUI?.exportTelemetryJson(this.telemetryManager);
  }

  clearTelemetryHistory() {
    this.telemetryUI?.clearTelemetryHistory(this.telemetryManager);
  }

  renderSurveySummary() {
    this.telemetryUI?.renderSurveySummary(this.surveyManager);
  }

  saveSurveyResponse() {
    this.telemetryUI?.saveSurveyResponse(this.surveyManager, this.telemetryManager);
  }

  exportSurveyCsv() {
    this.telemetryUI?.exportSurveyCsv(this.surveyManager);
  }

  bindUI(bindFastTap) {
    bindFastTap('btn-telemetry-menu', () => this.open());
    bindFastTap('btn-telemetry-restart', () => this.open());
    bindFastTap('btn-close-telemetry', () => this.close());

    bindFastTap('btn-telem-tab-stats', () => this.switchTab('stats'));
    bindFastTap('btn-telem-tab-bench', () => this.switchTab('bench'));
    bindFastTap('btn-telem-tab-survey', () => this.switchTab('survey'));

    bindFastTap('btn-telem-export-csv', () => this.exportTelemetryCsv());
    bindFastTap('btn-telem-export-json', () => this.exportTelemetryJson());
    bindFastTap('btn-telem-clear', () => this.clearTelemetryHistory());

    bindFastTap('btn-survey-save', () => this.saveSurveyResponse());
    bindFastTap('btn-survey-export-csv', () => this.exportSurveyCsv());
  }
}
