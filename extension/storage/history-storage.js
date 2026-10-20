/**
 * SafeWeb - History Storage
 * Gerenciamento de persistência de logs de eventos e ocorrências
 */

import { StorageManager, STORAGE_KEYS } from './storage-manager.js';

const MAX_HISTORY_ITEMS = 100;

export class HistoryStorage {
  /**
   * Obtém todo o histórico de ocorrências ordenado por data descendente
   * @param {number} limit 
   * @returns {Promise<Array>}
   */
  static async getAll(limit = MAX_HISTORY_ITEMS) {
    const history = await StorageManager.get(STORAGE_KEYS.HISTORY, []);
    const sorted = Array.isArray(history) 
      ? history.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp))
      : [];
    return sorted.slice(0, limit);
  }

  /**
   * Adiciona um novo registro de ocorrência
   * @param {Object} entry 
   * @returns {Promise<Object>}
   */
  static async addEntry({
    siteId = null,
    url,
    type, // 'status_change' | 'security_alert' | 'error' | 'recovery' | 'initial_check'
    message,
    httpStatus = null,
    responseTimeMs = null,
    previousStatus = null,
    newStatus = null,
    riskLevel = null,
    riskDetails = []
  }) {
    const history = await StorageManager.get(STORAGE_KEYS.HISTORY, []);
    
    const newEntry = {
      id: 'evt_' + Date.now() + '_' + Math.random().toString(36).substr(2, 6),
      siteId,
      url,
      timestamp: new Date().toISOString(),
      type,
      message,
      httpStatus,
      responseTimeMs,
      previousStatus,
      newStatus,
      riskLevel,
      riskDetails
    };

    // Insere no início
    const updated = [newEntry, ...(Array.isArray(history) ? history : [])].slice(0, MAX_HISTORY_ITEMS);
    await StorageManager.set(STORAGE_KEYS.HISTORY, updated);
    return newEntry;
  }

  /**
   * Adiciona um registro de análise de notícia do SafeWeb Informa
   */
  static async addNewsEntry(analysis) {
    const history = await StorageManager.get(STORAGE_KEYS.HISTORY, []);
    const newEntry = {
      id: analysis.id || ('news_evt_' + Date.now()),
      url: analysis.url || analysis.domain,
      timestamp: analysis.analyzedAt || new Date().toISOString(),
      type: 'news_analysis',
      title: analysis.title,
      domain: analysis.domain,
      classification: analysis.classification,
      riskLevel: analysis.riskLevel,
      badgeColor: analysis.badgeColor,
      message: `Análise SafeWeb Informa: ${analysis.classification} — "${analysis.title.slice(0, 70)}..."`,
      reasons: analysis.reasons,
      evidence: analysis.evidence,
      sources: analysis.factCheckLinks,
      rawAnalysis: analysis
    };

    const updated = [newEntry, ...(Array.isArray(history) ? history : [])].slice(0, MAX_HISTORY_ITEMS);
    await StorageManager.set(STORAGE_KEYS.HISTORY, updated);
    return newEntry;
  }

  /**
   * Limpa o histórico de ocorrências
   * @returns {Promise<void>}
   */
  static async clear() {
    await StorageManager.set(STORAGE_KEYS.HISTORY, []);
  }

  /**
   * Obtém ocorrências de um site específico
   * @param {string} siteId 
   * @returns {Promise<Array>}
   */
  static async getBySiteId(siteId) {
    const history = await this.getAll(MAX_HISTORY_ITEMS);
    return history.filter(item => item.siteId === siteId);
  }
}
