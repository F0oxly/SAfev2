/**
 * SafeWeb - Backend Monitor Service
 * Desenvolvido integralmente por Iury.
 * Serviço de checagem contínua de disponibilidade e testes HTTP (3-Strikes e SQLite)
 */
import { getDb } from '../database.js';

export class MonitorService {
  constructor() {
    this.history = [];
    this.timer = null;
    this.intervalSeconds = 60;
  }

  /**
   * Inicia o loop de monitoramento contínuo em segundo plano
   * @param {number} intervalSeconds 
   */
  start(intervalSeconds = 60) {
    this.intervalSeconds = intervalSeconds;
    if (this.timer) clearInterval(this.timer);

    console.log(`[SafeWeb Backend] Monitor iniciado. Intervalo de checagem: ${intervalSeconds}s.`);
    
    // Execução periódica
    this.timer = setInterval(async () => {
      await this.checkAll();
    }, this.intervalSeconds * 1000);
    
    // Inicia a primeira checagem imediatamente
    setTimeout(() => this.checkAll(), 1000);
  }

  /**
   * Para o loop do monitor
   */
  stop() {
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
      console.log('[SafeWeb Backend] Monitor pausado.');
    }
  }

  /**
   * Realiza teste de conexão e tempo de resposta em uma URL
   * @param {string} url 
   * @param {number} timeoutMs 
   * @returns {Promise<Object>}
   */
  async checkUrl(url, timeoutMs = 6000) {
    const startTime = Date.now();
    let isOnline = false;
    let httpStatus = null;
    let errorMessage = null;

    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

      let response;
      try {
        response = await fetch(url, {
          method: 'HEAD',
          signal: controller.signal,
          headers: { 'User-Agent': 'SafeWeb-Uptime-Bot/1.0 (+https://github.com/safeweb)' }
        });
      } catch (e) {
        response = await fetch(url, {
          method: 'GET',
          signal: controller.signal,
          headers: { 'User-Agent': 'SafeWeb-Uptime-Bot/1.0 (+https://github.com/safeweb)' }
        });
      }

      clearTimeout(timeoutId);
      httpStatus = response.status;
      isOnline = response.status >= 200 && response.status < 400;

      if (!isOnline) {
        errorMessage = `Servidor respondeu com código de erro HTTP ${response.status}`;
      }
    } catch (err) {
      isOnline = false;
      httpStatus = null;
      if (err.name === 'AbortError') {
        errorMessage = `Tempo limite esgotado (${timeoutMs}ms)`;
      } else {
        errorMessage = err.message || 'Falha de conexão / DNS';
      }
    }

    const responseTimeMs = Date.now() - startTime;

    return {
      checked: true,
      url,
      status: isOnline ? 'online' : 'offline',
      httpStatus,
      responseTimeMs,
      error: errorMessage,
      checkedAt: new Date().toISOString()
    };
  }

  /**
   * Executa a checagem em todos os sites cadastrados no banco de dados
   */
  async checkAll() {
    const db = await getDb();
    const siteList = await db.all('SELECT * FROM monitored_sites');
    
    if (siteList.length === 0) return [];

    console.log(`[SafeWeb Backend] Verificando ${siteList.length} site(s)...`);

    for (const site of siteList) {
      const previousStatus = site.status;
      const result = await this.checkUrl(site.url);

      let newStatus = previousStatus;
      let newFailuresCount = site.failures_count || 0;
      const now = result.checkedAt;
      
      // Regra de 3 Strikes
      if (result.status === 'offline') {
        newFailuresCount += 1;
        if (newFailuresCount >= 3) {
          newStatus = 'offline';
        } else if (newStatus === 'online') {
          newStatus = 'checking'; // Fica em verificação antes de declarar offline
        }
      } else {
        newFailuresCount = 0;
        newStatus = 'online';
      }

      let lastStatusChange = site.last_status_change;

      // Detectar mudança REAL de estado
      if (previousStatus && previousStatus !== 'unknown' && previousStatus !== newStatus && (newStatus === 'online' || newStatus === 'offline')) {
        lastStatusChange = now;

        const eventEntry = {
          id: 'be_evt_' + Date.now() + '_' + Math.random().toString(36).substr(2, 5),
          siteId: site.id,
          url: site.url,
          timestamp: now,
          type: newStatus === 'online' ? 'recovery' : 'status_change',
          message: newStatus === 'online'
            ? `Site recuperado (${result.responseTimeMs}ms, HTTP ${result.httpStatus || 200})`
            : `Site indisponível após 3 tentativas (${result.error || 'HTTP ' + result.httpStatus})`,
          httpStatus: result.httpStatus,
          responseTimeMs: result.responseTimeMs,
          previousStatus,
          newStatus
        };

        this.addHistory(eventEntry);
        console.warn(`[SafeWeb Alerta] Status de ${site.url} alterado: ${previousStatus} -> ${newStatus}`);
      }

      // Atualiza no banco
      await db.run(
        `UPDATE monitored_sites 
         SET status = ?, http_status = ?, response_time_ms = ?, last_checked = ?, last_status_change = ?, failures_count = ?
         WHERE id = ?`,
        [newStatus, result.httpStatus, result.responseTimeMs, now, lastStatusChange, newFailuresCount, site.id]
      );
    }

    return await db.all('SELECT * FROM monitored_sites');
  }

  /**
   * Adiciona registro ao histórico
   */
  addHistory(entry) {
    this.history.unshift(entry);
    if (this.history.length > 200) {
      this.history.pop();
    }
  }

  // Métodos auxiliares para interagir com o DB
  async getSites() {
    const db = await getDb();
    return await db.all('SELECT * FROM monitored_sites');
  }

  async addOrUpdateSite(site) {
    const db = await getDb();
    const existing = await db.get('SELECT id FROM monitored_sites WHERE id = ?', [site.id]);
    
    if (existing) {
      await db.run(
        `UPDATE monitored_sites SET url = ?, alias = ?, status = ?, http_status = ?, response_time_ms = ?, last_checked = ?, failures_count = ? WHERE id = ?`,
        [site.url, site.alias, site.status, site.httpStatus, site.responseTimeMs, site.lastChecked, site.failures_count || 0, site.id]
      );
    } else {
      await db.run(
        `INSERT INTO monitored_sites (id, url, alias, status, http_status, response_time_ms, last_checked, failures_count, added_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [site.id, site.url, site.alias, site.status || 'unknown', site.httpStatus || null, site.responseTimeMs || null, site.lastChecked || null, 0, site.addedAt || new Date().toISOString()]
      );
    }
  }

  async removeSite(id) {
    const db = await getDb();
    const res = await db.run('DELETE FROM monitored_sites WHERE id = ?', [id]);
    return res.changes > 0;
  }

  /**
   * Sincroniza a lista de sites recebida da extensão
   * @param {Array} extensionSites 
   */
  async syncSites(extensionSites) {
    if (!Array.isArray(extensionSites)) return;
    
    const db = await getDb();
    
    // Atualiza ou insere sites da extensão
    for (const s of extensionSites) {
      if (!s.id || !s.url) continue;
      await this.addOrUpdateSite({
        id: s.id,
        url: s.url,
        alias: s.alias,
        status: s.status,
        httpStatus: s.httpStatus,
        responseTimeMs: s.responseTimeMs,
        lastChecked: s.lastChecked
      });
    }

    // Remove sites que estão no BD mas não vieram da extensão (sincronização bidirecional/master-slave)
    const incomingIds = extensionSites.map(s => s.id);
    const existingSites = await db.all('SELECT id FROM monitored_sites');
    for (const row of existingSites) {
      if (!incomingIds.includes(row.id)) {
        await db.run('DELETE FROM monitored_sites WHERE id = ?', [row.id]);
      }
    }
  }
}

export const monitorService = new MonitorService();
