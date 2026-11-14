/**
 * SurveyManager — In-game subjective usability and physical fatigue evaluation.
 *
 * Implements Likert-scale questionnaire (1 to 5) for HCI usability assessment
 * aligned with System Usability Scale (SUS) and NASA-TLX physical demand dimensions:
 * 1. Physical Fatigue (М'язова втома рук/плечей)
 * 2. Gesture Responsiveness (Чутливість та передбачуваність реакції)
 * 3. Stage Transition Usability (Плавність та інтуїтивність зміни модальностей)
 * 4. Overall User Satisfaction (Загальна задоволеність мультимодальним геймплеєм)
 */

export class SurveyManager {
  constructor(storageKey = 'interrun_surveys') {
    this.storageKey = storageKey;
    this._responses = this._loadResponses();
  }

  _getStorage() {
    return typeof localStorage !== 'undefined' ? localStorage : null;
  }

  _loadResponses() {
    const storage = this._getStorage();
    if (!storage) return [];
    try {
      const raw = storage.getItem(this.storageKey);
      return raw ? JSON.parse(raw) : [];
    } catch {
      return [];
    }
  }

  _saveResponses() {
    const storage = this._getStorage();
    if (!storage) return;
    try {
      storage.setItem(this.storageKey, JSON.stringify(this._responses));
    } catch {}
  }

  /**
   * Records a user survey response.
   * @param {{ fatigue: number, responsiveness: number, transition: number, satisfaction: number, comment?: string }} data
   * @param {number} sessionCount
   * @param {number} bestDistance
   */
  submitSurvey(data, sessionCount = 0, bestDistance = 0) {
    const response = {
      id: 'survey_' + Date.now(),
      timestamp: new Date().toISOString(),
      sessionCount,
      bestDistance: Math.floor(bestDistance),
      fatigue: Math.max(1, Math.min(5, Number(data.fatigue) || 3)),
      responsiveness: Math.max(1, Math.min(5, Number(data.responsiveness) || 3)),
      transition: Math.max(1, Math.min(5, Number(data.transition) || 3)),
      satisfaction: Math.max(1, Math.min(5, Number(data.satisfaction) || 3)),
      comment: (data.comment || '').trim()
    };

    this._responses.push(response);
    this._saveResponses();
    return response;
  }

  getResponses() {
    return [...this._responses];
  }

  getStatistics() {
    const n = this._responses.length;
    if (n === 0) {
      return {
        totalResponses: 0,
        meanFatigue: 0,
        meanResponsiveness: 0,
        meanTransition: 0,
        meanSatisfaction: 0,
        susProxyScore: 0 // Scaled to 0-100
      };
    }

    const sum = this._responses.reduce(
      (acc, r) => ({
        fatigue: acc.fatigue + r.fatigue,
        responsiveness: acc.responsiveness + r.responsiveness,
        transition: acc.transition + r.transition,
        satisfaction: acc.satisfaction + r.satisfaction
      }),
      { fatigue: 0, responsiveness: 0, transition: 0, satisfaction: 0 }
    );

    const meanFatigue = Number((sum.fatigue / n).toFixed(2));
    const meanResponsiveness = Number((sum.responsiveness / n).toFixed(2));
    const meanTransition = Number((sum.transition / n).toFixed(2));
    const meanSatisfaction = Number((sum.satisfaction / n).toFixed(2));

    // SUS proxy: responsiveness, transition, satisfaction positive (1..5 -> 0..4), fatigue negative (5 - fatigue)
    // Formula: ((Resp-1) + (Trans-1) + (Sat-1) + (5-Fatigue)) / 16 * 100
    const rawSusPoints = (meanResponsiveness - 1) + (meanTransition - 1) + (meanSatisfaction - 1) + (5 - meanFatigue);
    const susProxyScore = Number(((rawSusPoints / 16) * 100).toFixed(1));

    return {
      totalResponses: n,
      meanFatigue,
      meanResponsiveness,
      meanTransition,
      meanSatisfaction,
      susProxyScore
    };
  }

  exportToJson() {
    return JSON.stringify({
      survey: 'InterRun Usability and Ergonomics Questionnaire',
      exportedAt: new Date().toISOString(),
      statistics: this.getStatistics(),
      responses: this._responses
    }, null, 2);
  }

  exportToCsv() {
    const headers = [
      'ResponseId',
      'Timestamp',
      'SessionCount',
      'BestDistance_m',
      'Fatigue_1to5',
      'Responsiveness_1to5',
      'Transition_1to5',
      'Satisfaction_1to5',
      'Comment'
    ];

    const rows = this._responses.map((r) => [
      r.id,
      `"${r.timestamp}"`,
      r.sessionCount,
      r.bestDistance,
      r.fatigue,
      r.responsiveness,
      r.transition,
      r.satisfaction,
      `"${(r.comment || '').replace(/"/g, '""')}"`
    ].join(','));

    return [headers.join(','), ...rows].join('\n');
  }

  clearResponses() {
    this._responses = [];
    const storage = this._getStorage();
    if (storage) {
      try {
        storage.removeItem(this.storageKey);
      } catch {}
    }
  }
}
