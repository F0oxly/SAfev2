/**
 * SafeWeb - Storage Manager
 * Desenvolvido por Iury.
 * Camada base de encapsulamento para o chrome.storage.local
 */

const STORAGE_KEYS = {
  SITES: 'safeweb_sites',
  HISTORY: 'safeweb_history',
  CONFIG: 'safeweb_config'
};

const DEFAULT_CONFIG = {
  checkIntervalMinutes: 2,
  backendUrl: 'http://localhost:3000',
  notificationsEnabled: true,
  useBackend: true,
  threatSensitivity: 'standard' // 'standard' | 'strict'
};

export class StorageManager {
  /**
   * Obtém item do chrome.storage.local
   * @param {string} key 
   * @param {*} defaultValue 
   * @returns {Promise<*>}
   */
  static async get(key, defaultValue = null) {
    return new Promise((resolve) => {
      chrome.storage.local.get([key], (result) => {
        if (chrome.runtime.lastError) {
          console.error(`[SafeWeb Storage] Erro ao obter chave ${key}:`, chrome.runtime.lastError);
          resolve(defaultValue);
          return;
        }
        resolve(result[key] !== undefined ? result[key] : defaultValue);
      });
    });
  }

  /**
   * Salva item no chrome.storage.local
   * @param {string} key 
   * @param {*} value 
   * @returns {Promise<void>}
   */
  static async set(key, value) {
    return new Promise((resolve, reject) => {
      chrome.storage.local.set({ [key]: value }, () => {
        if (chrome.runtime.lastError) {
          console.error(`[SafeWeb Storage] Erro ao salvar chave ${key}:`, chrome.runtime.lastError);
          reject(chrome.runtime.lastError);
          return;
        }
        resolve();
      });
    });
  }

  /**
   * Remove chave específica
   * @param {string} key 
   * @returns {Promise<void>}
   */
  static async remove(key) {
    return new Promise((resolve) => {
      chrome.storage.local.remove([key], () => {
        resolve();
      });
    });
  }

  /**
   * Obtém as configurações gerais do sistema
   */
  static async getConfig() {
    const config = await this.get(STORAGE_KEYS.CONFIG, DEFAULT_CONFIG);
    return { ...DEFAULT_CONFIG, ...config };
  }

  /**
   * Atualiza as configurações
   */
  static async setConfig(newConfig) {
    const current = await this.getConfig();
    const merged = { ...current, ...newConfig };
    await this.set(STORAGE_KEYS.CONFIG, merged);
    return merged;
  }
}

export { STORAGE_KEYS, DEFAULT_CONFIG };
