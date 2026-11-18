/**
 * SurveyManager — In-game subjective usability and physical fatigue evaluation.
 *
 * Implements standard 10-item System Usability Scale (SUS, Brooke 1996) with Likert (1 to 5) scale,
 * supporting canonical alternating polarity score calculation (scale 0-100), as well as
 * backward-compatible legacy dimensions (Fatigue, Responsiveness, Transition, Satisfaction).
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
   * @param {Object} data - Can contain answers (array of 10), q1..q10, or legacy fields.
   * @param {number} sessionCount
   * @param {number} bestDistance
   */
  submitSurvey(data, sessionCount = 0, bestDistance = 0) {
    // Extract 10 SUS answers if available
    let answers = null;
    if (Array.isArray(data.answers) && data.answers.length >= 10) {
      answers = data.answers.slice(0, 10).map((v) => Math.max(1, Math.min(5, Number(v) || 3)));
    } else if (data.q1 !== undefined || data.q2 !== undefined) {
      answers = [];
      for (let i = 1; i <= 10; i++) {
        answers.push(Math.max(1, Math.min(5, Number(data[`q${i}`]) || 3)));
      }
    }

    // Legacy values (for backward compatibility / fallbacks)
    const fatigue = Math.max(1, Math.min(5, Number(data.fatigue ?? (answers ? answers[7] : 3))));
    const responsiveness = Math.max(1, Math.min(5, Number(data.responsiveness ?? (answers ? answers[2] : 3))));
    const transition = Math.max(1, Math.min(5, Number(data.transition ?? (answers ? answers[4] : 3))));
    const satisfaction = Math.max(1, Math.min(5, Number(data.satisfaction ?? (answers ? answers[0] : 3))));

    let susScore = 0;
    if (answers) {
      // Standard SUS calculation (Brooke 1996):
      // Odd questions (1, 3, 5, 7, 9): score = q - 1
      // Even questions (2, 4, 6, 8, 10): score = 5 - q
      // SUS = sum(contributions) * 2.5
      const oddContrib = (answers[0] - 1) + (answers[2] - 1) + (answers[4] - 1) + (answers[6] - 1) + (answers[8] - 1);
      const evenContrib = (5 - answers[1]) + (5 - answers[3]) + (5 - answers[5]) + (5 - answers[7]) + (5 - answers[9]);
      susScore = Number(((oddContrib + evenContrib) * 2.5).toFixed(1));
    } else {
      // Legacy 4-item proxy calculation
      const rawPoints = (responsiveness - 1) + (transition - 1) + (satisfaction - 1) + (5 - fatigue);
      susScore = Number(((rawPoints / 16) * 100).toFixed(1));
    }

    const response = {
      id: 'survey_' + Date.now(),
      timestamp: new Date().toISOString(),
      sessionCount,
      bestDistance: Math.floor(bestDistance),
      answers: answers || [satisfaction, 5 - responsiveness, responsiveness, 5 - transition, transition, 5 - responsiveness, satisfaction, fatigue, satisfaction, fatigue],
      q1: answers ? answers[0] : satisfaction,
      q2: answers ? answers[1] : 5 - responsiveness,
      q3: answers ? answers[2] : responsiveness,
      q4: answers ? answers[3] : 5 - transition,
      q5: answers ? answers[4] : transition,
      q6: answers ? answers[5] : 5 - responsiveness,
      q7: answers ? answers[6] : satisfaction,
      q8: answers ? answers[7] : fatigue,
      q9: answers ? answers[8] : satisfaction,
      q10: answers ? answers[9] : fatigue,
      fatigue,
      responsiveness,
      transition,
      satisfaction,
      susScore,
      susProxyScore: susScore,
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
        meanQuestions: Array(10).fill(0),
        susScore: 0,
        susProxyScore: 0
      };
    }

    const meanQuestions = [];
    for (let i = 0; i < 10; i++) {
      const qSum = this._responses.reduce((sum, r) => sum + (r.answers ? r.answers[i] : (r[`q${i + 1}`] || 3)), 0);
      meanQuestions.push(Number((qSum / n).toFixed(2)));
    }

    const sum = this._responses.reduce(
      (acc, r) => ({
        fatigue: acc.fatigue + (r.fatigue || 3),
        responsiveness: acc.responsiveness + (r.responsiveness || 3),
        transition: acc.transition + (r.transition || 3),
        satisfaction: acc.satisfaction + (r.satisfaction || 3),
        susScore: acc.susScore + (r.susScore || r.susProxyScore || 0)
      }),
      { fatigue: 0, responsiveness: 0, transition: 0, satisfaction: 0, susScore: 0 }
    );

    const meanFatigue = Number((sum.fatigue / n).toFixed(2));
    const meanResponsiveness = Number((sum.responsiveness / n).toFixed(2));
    const meanTransition = Number((sum.transition / n).toFixed(2));
    const meanSatisfaction = Number((sum.satisfaction / n).toFixed(2));

    // Calculate SUS from mean question answers if available
    const oddContrib = (meanQuestions[0] - 1) + (meanQuestions[2] - 1) + (meanQuestions[4] - 1) + (meanQuestions[6] - 1) + (meanQuestions[8] - 1);
    const evenContrib = (5 - meanQuestions[1]) + (5 - meanQuestions[3]) + (5 - meanQuestions[5]) + (5 - meanQuestions[7]) + (5 - meanQuestions[9]);
    const susScore = Number(((oddContrib + evenContrib) * 2.5).toFixed(1));

    return {
      totalResponses: n,
      meanFatigue,
      meanResponsiveness,
      meanTransition,
      meanSatisfaction,
      meanQuestions,
      susScore,
      susProxyScore: susScore
    };
  }

  exportToJson() {
    return JSON.stringify({
      survey: 'InterRun Usability and Ergonomics Questionnaire (SUS)',
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
      'Q1',
      'Q2',
      'Q3',
      'Q4',
      'Q5',
      'Q6',
      'Q7',
      'Q8',
      'Q9',
      'Q10',
      'SUS_Score',
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
      r.answers?.[0] ?? r.q1 ?? 3,
      r.answers?.[1] ?? r.q2 ?? 3,
      r.answers?.[2] ?? r.q3 ?? 3,
      r.answers?.[3] ?? r.q4 ?? 3,
      r.answers?.[4] ?? r.q5 ?? 3,
      r.answers?.[5] ?? r.q6 ?? 3,
      r.answers?.[6] ?? r.q7 ?? 3,
      r.answers?.[7] ?? r.q8 ?? 3,
      r.answers?.[8] ?? r.q9 ?? 3,
      r.answers?.[9] ?? r.q10 ?? 3,
      r.susScore ?? r.susProxyScore ?? 0,
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
