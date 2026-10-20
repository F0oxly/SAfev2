/**
 * SafeWeb - API Client
 * Desenvolvido por Iury.
 * Cliente de comunicação com o backend em Node.js (com fallback gracioso)
 */

import { StorageManager } from '../storage/storage-manager.js';

function logBackendWarning(baseUrl, context, err) {
  const isLocalBackend = /^http:\/\/localhost:3000(?:\/|$)/i.test(baseUrl);
  const isConnectionFailure = err.name === 'TypeError' && /failed to fetch|networkerror/i.test(err.message);

  if (!isLocalBackend || !isConnectionFailure) {
    console.warn(`[SafeWeb ApiClient] ${context}:`, err.message);
  }
}

export class ApiClient {
  /**
   * Obtém a URL base configurada para o backend
   */
  static async getBaseUrl() {
    const config = await StorageManager.getConfig();
    return config.backendUrl || 'http://localhost:3000';
  }

  /**
   * Verifica se o backend Node.js está online e respondendo
   * @returns {Promise<boolean>}
   */
  static async isBackendAvailable() {
    try {
      const baseUrl = await this.getBaseUrl();
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 2000);

      const response = await fetch(`${baseUrl}/api/health`, {
        method: 'GET',
        signal: controller.signal
      });

      clearTimeout(timeoutId);
      return response.ok;
    } catch {
      return false;
    }
  }

  /**
   * Solicita verificação de status de um site ao backend
   * @param {string} url 
   * @returns {Promise<Object|null>}
   */
  static async checkSite(url) {
    let baseUrl;
    try {
      baseUrl = await this.getBaseUrl();
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 8000);

      const response = await fetch(`${baseUrl}/api/sites/check`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url }),
        signal: controller.signal
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        throw new Error(`Backend retornou código HTTP ${response.status}`);
      }

      return await response.json();
    } catch (err) {
      logBackendWarning(baseUrl || '', `Falha ao consultar backend para ${url}`, err);
      return null;
    }
  }

  /**
   * Sincroniza a lista de sites cadastrados com o backend
   * @param {Array} sites 
   * @returns {Promise<boolean>}
   */
  static async syncSites(sites) {
    try {
      const baseUrl = await this.getBaseUrl();
      const response = await fetch(`${baseUrl}/api/sites/sync`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sites })
      });
      return response.ok;
    } catch {
      return false;
    }
  }

  /**
   * Avalia a reputação de segurança de uma URL ou domínio (Fontes confiáveis + Base Comunitária)
   * @param {string} urlOrDomain 
   * @returns {Promise<Object|null>}
   */
  static async evaluateSecurity(urlOrDomain, { title = '', context = '' } = {}) {
    let baseUrl;
    try {
      baseUrl = await this.getBaseUrl();
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 16000);

      const response = await fetch(`${baseUrl}/api/security/evaluate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: urlOrDomain, title, context }),
        signal: controller.signal
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        throw new Error(`Status HTTP ${response.status}`);
      }

      const data = await response.json();
      return data.evaluation || null;
    } catch (err) {
      logBackendWarning(baseUrl || '', 'Avaliação remota indisponível', err);
      return null;
    }
  }

  /**
   * Envia uma denúncia de site suspeito para a Base Comunitária
   * @param {Object} reportData 
   * @returns {Promise<Object>}
   */
  static async submitReport({ domain, url, category, description }) {
    try {
      const baseUrl = await this.getBaseUrl();
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 6000);

      const response = await fetch(`${baseUrl}/api/reports`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ domain, url, category, description }),
        signal: controller.signal
      });

      clearTimeout(timeoutId);

      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || `Erro HTTP ${response.status}`);
      }

      return data;
    } catch (err) {
      return {
        success: false,
        error: err.message || 'Não foi possível conectar ao servidor para enviar a denúncia.'
      };
    }
  }

  /**
   * Consulta o resumo de denúncias comunitárias de um domínio
   * @param {string} domain 
   * @returns {Promise<Object|null>}
   */
  static async getDomainReports(domain) {
    try {
      const baseUrl = await this.getBaseUrl();
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 4000);

      const response = await fetch(`${baseUrl}/api/reports/domain/${encodeURIComponent(domain)}`, {
        method: 'GET',
        signal: controller.signal
      });

      clearTimeout(timeoutId);

      if (!response.ok) return null;
      const data = await response.json();
      return data.summary || null;
    } catch {
      return null;
    }
  }

  /**
   * Envia notícia para análise no módulo SafeWeb Informa
   * @param {Object} payload { url, text, title }
   * @returns {Promise<Object|null>}
   */
  static async analyzeNews({ url = '', text = '', title = '' }) {
    let baseUrl;
    try {
      baseUrl = await this.getBaseUrl();
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 7000);

      const response = await fetch(`${baseUrl}/api/news/analyze`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url, text, title }),
        signal: controller.signal
      });

      clearTimeout(timeoutId);

      if (!response.ok) return null;
      const data = await response.json();
      return data.analysis || null;
    } catch (err) {
      logBackendWarning(baseUrl || '', 'Backend indisponível para análise de notícias, usando modo local', err);
      return null;
    }
  }

  /**
   * Busca os exemplos demonstrativos para a aula de Psicologia
   */
  static async getNewsDemoExamples() {
    try {
      const baseUrl = await this.getBaseUrl();
      const response = await fetch(`${baseUrl}/api/news/examples`);
      if (!response.ok) return null;
      const data = await response.json();
      return data.examples || null;
    } catch {
      return null;
    }
  }

  /**
   * Busca histórico de análises de notícias
   */
  static async getNewsHistory() {
    try {
      const baseUrl = await this.getBaseUrl();
      const response = await fetch(`${baseUrl}/api/news/history`);
      if (!response.ok) return [];
      const data = await response.json();
      return data.history || [];
    } catch {
      return [];
    }
  }
}
