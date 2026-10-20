/**
 * SafeWeb - Sites Storage
 * Gerenciamento de persistência de sites monitorados
 */

import { StorageManager, STORAGE_KEYS } from './storage-manager.js';

export class SitesStorage {
  /**
   * Retorna a lista de todos os sites monitorados
   * @returns {Promise<Array>}
   */
  static async getAll() {
    const sites = await StorageManager.get(STORAGE_KEYS.SITES, []);
    return Array.isArray(sites) ? sites : [];
  }

  /**
   * Busca um site pelo ID
   * @param {string} id 
   * @returns {Promise<Object|null>}
   */
  static async getById(id) {
    const sites = await this.getAll();
    return sites.find(site => site.id === id) || null;
  }

  /**
   * Busca um site pela URL
   * @param {string} url 
   * @returns {Promise<Object|null>}
   */
  static async getByUrl(url) {
    const sites = await this.getAll();
    const normalized = this.normalizeUrl(url);
    return sites.find(site => this.normalizeUrl(site.url) === normalized) || null;
  }

  /**
   * Adiciona um novo site para monitoramento
   * @param {Object} siteData 
   * @returns {Promise<Object>}
   */
  static async add(siteData) {
    const sites = await this.getAll();
    const normalizedUrl = this.normalizeUrl(siteData.url);

    const exists = sites.some(s => this.normalizeUrl(s.url) === normalizedUrl);
    if (exists) {
      throw new Error('Este domínio já está cadastrado no monitoramento.');
    }

    const newSite = {
      id: 'site_' + Date.now() + '_' + Math.random().toString(36).substr(2, 6),
      url: normalizedUrl,
      alias: siteData.alias || this.extractHostname(normalizedUrl),
      hostname: this.extractHostname(normalizedUrl),
      status: siteData.status || 'unknown', // 'online' | 'offline' | 'checking' | 'unknown'
      httpStatus: siteData.httpStatus !== undefined ? siteData.httpStatus : null,
      responseTimeMs: siteData.responseTimeMs !== undefined ? siteData.responseTimeMs : null,
      lastChecked: siteData.lastChecked || null,
      lastStatusChange: siteData.lastStatusChange || null,
      riskLevel: siteData.riskLevel || 'low', // 'low' | 'attention' | 'high'
      riskLabel: siteData.riskLabel || 'Nenhum risco conhecido',
      riskDetails: siteData.riskDetails || [],
      geminiAnalysis: siteData.geminiAnalysis || null,
      addedAt: new Date().toISOString()
    };

    sites.push(newSite);
    await StorageManager.set(STORAGE_KEYS.SITES, sites);
    return newSite;
  }

  /**
   * Atualiza as informações de um site
   * @param {string} id 
   * @param {Object} updates 
   * @returns {Promise<Object>}
   */
  static async update(id, updates) {
    const sites = await this.getAll();
    const index = sites.findIndex(s => s.id === id);

    if (index === -1) {
      throw new Error(`Site com ID ${id} não encontrado.`);
    }

    const updatedSite = { ...sites[index], ...updates };
    sites[index] = updatedSite;

    await StorageManager.set(STORAGE_KEYS.SITES, sites);
    return updatedSite;
  }

  /**
   * Remove um site pelo ID
   * @param {string} id 
   * @returns {Promise<boolean>}
   */
  static async remove(id) {
    const sites = await this.getAll();
    const filtered = sites.filter(s => s.id !== id);
    await StorageManager.set(STORAGE_KEYS.SITES, filtered);
    return true;
  }

  /**
   * Normaliza a URL garantindo protocolo e formato limpo
   * @param {string} urlStr 
   * @returns {string}
   */
  static normalizeUrl(urlStr) {
    let clean = urlStr.trim();
    if (!/^https?:\/\//i.test(clean)) {
      clean = 'https://' + clean;
    }
    try {
      const parsed = new URL(clean);
      return parsed.origin + (parsed.pathname !== '/' ? parsed.pathname.replace(/\/$/, '') : '');
    } catch {
      return clean;
    }
  }

  /**
   * Extrai apenas o hostname limpo
   * @param {string} urlStr 
   * @returns {string}
   */
  static extractHostname(urlStr) {
    try {
      const parsed = new URL(urlStr.startsWith('http') ? urlStr : `https://${urlStr}`);
      return parsed.hostname;
    } catch {
      return urlStr;
    }
  }
}
