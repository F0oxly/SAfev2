/**
 * SafeWeb - Backend Reports Service (Base Comunitária)
 * Desenvolvido por Iury.
 * Gerencia denúncias de sites, contagem por categoria, medidas anti-spam e agregação de reputação.
 */

import { getDb } from '../database.js';

export const VALID_CATEGORIES = {
  phishing: 'Phishing ou roubo de contas',
  scam_financial: 'Tentativa de golpe financeiro',
  malware: 'Distribuição de malware',
  impersonation: 'Site falso que imita uma marca',
  suspicious_redirect: 'Redirecionamentos suspeitos',
  spam_fraud: 'Spam ou fraude',
  other: 'Outro comportamento suspeito'
};

export class ReportsService {
  /**
   * Normaliza um domínio ou URL para o formato canônico limpo (ex: sub.dominio.com)
   * @param {string} input 
   * @returns {string}
   */
  static normalizeDomain(input) {
    if (!input || typeof input !== 'string') return '';

    let cleaned = input.trim().toLowerCase();

    // Se não tiver protocolo, adiciona http temporário para o parser URL funcionar
    if (!/^https?:\/\//i.test(cleaned)) {
      cleaned = 'http://' + cleaned;
    }

    try {
      const parsed = new URL(cleaned);
      let hostname = parsed.hostname;
      if (hostname.startsWith('www.')) {
        hostname = hostname.slice(4);
      }
      return hostname;
    } catch {
      // Fallback caso não seja URL válida
      return input.trim().toLowerCase().replace(/^https?:\/\//, '').replace(/^www\./, '').split('/')[0].split(':')[0];
    }
  }

  /**
   * Registra uma denúncia com validação, medidas anti-spam e agregação
   * @param {Object} reportData 
   * @returns {Promise<Object>}
   */
  static async createReport({ domain, url, category, description }) {
    const normalizedDomain = this.normalizeDomain(domain || url);
    if (!normalizedDomain) {
      throw new Error('Domínio ou URL inválido.');
    }

    const cleanCategory = category && VALID_CATEGORIES[category] ? category : 'other';
    const cleanDescription = (description || '').trim().slice(0, 500); // Limita tamanho para evitar abusos

    const db = await getDb();
    const now = new Date();
    const nowIso = now.toISOString();

    // Medida Anti-Spam: Verificar se já existe denúncia idêntica (mesmo domínio e categoria) nos últimos 10 minutos
    const tenMinutesAgo = new Date(now.getTime() - 10 * 60 * 1000).toISOString();
    const existingRecent = await db.get(
      `SELECT id, created_at FROM reports 
       WHERE domain = ? AND category = ? AND created_at > ?
       LIMIT 1`,
      [normalizedDomain, cleanCategory, tenMinutesAgo]
    );

    if (existingRecent) {
      return {
        success: true,
        duplicated: true,
        reportId: existingRecent.id,
        domain: normalizedDomain,
        message: 'Denúncia recente já registrada para este domínio nesta categoria. O relato foi considerado na reputação comunitária sem duplicar o registro.'
      };
    }

    const reportId = 'rep_' + Date.now() + '_' + Math.random().toString(36).substr(2, 6);

    await db.run(
      `INSERT INTO reports (id, domain, url, category, description, status, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, 'pending', ?, ?)`,
      [reportId, normalizedDomain, url ? url.trim() : null, cleanCategory, cleanDescription, nowIso, nowIso]
    );

    // Invalida cache de reputação para forçar reanálise imediata
    await db.run('DELETE FROM reputation_cache WHERE domain = ?', [normalizedDomain]);

    return {
      success: true,
      duplicated: false,
      reportId,
      domain: normalizedDomain,
      category: cleanCategory,
      categoryLabel: VALID_CATEGORIES[cleanCategory],
      createdAt: nowIso,
      status: 'pending',
      message: 'Denúncia recebida com sucesso e incluída na base comunitária do SafeWeb.'
    };
  }

  /**
   * Obtém o resumo consolidado de denúncias de um determinado domínio
   * @param {string} rawDomain 
   * @returns {Promise<Object>}
   */
  static async getDomainSummary(rawDomain) {
    const domain = this.normalizeDomain(rawDomain);
    if (!domain) {
      return {
        domain: '',
        totalReports: 0,
        categories: {},
        statusCounts: { pending: 0, confirmed: 0, dismissed: 0, inconclusive: 0 },
        latestReportDate: null
      };
    }

    const db = await getDb();

    const reports = await db.all(
      `SELECT category, status, created_at FROM reports WHERE domain = ?`,
      [domain]
    );

    const categories = {};
    const statusCounts = { pending: 0, confirmed: 0, dismissed: 0, inconclusive: 0 };
    let latestReportDate = null;

    for (const rep of reports) {
      // Contagem por categoria
      categories[rep.category] = (categories[rep.category] || 0) + 1;
      // Contagem por status
      if (statusCounts[rep.status] !== undefined) {
        statusCounts[rep.status]++;
      } else {
        statusCounts[rep.status] = 1;
      }
      // Mais recente
      if (!latestReportDate || rep.created_at > latestReportDate) {
        latestReportDate = rep.created_at;
      }
    }

    return {
      domain,
      totalReports: reports.length,
      categories,
      statusCounts,
      latestReportDate
    };
  }

  /**
   * Lista denúncias recentes para exibição e consulta
   * @param {number} limit 
   * @returns {Promise<Array>}
   */
  static async listRecentReports(limit = 50) {
    const db = await getDb();
    const rows = await db.all(
      `SELECT id, domain, url, category, description, status, created_at, updated_at 
       FROM reports 
       ORDER BY created_at DESC 
       LIMIT ?`,
      [limit]
    );

    return rows.map(r => ({
      ...r,
      categoryLabel: VALID_CATEGORIES[r.category] || r.category
    }));
  }

  /**
   * Atualiza o estado de moderação de uma denúncia
   * @param {string} id 
   * @param {string} status ('confirmed', 'dismissed', 'inconclusive', 'pending')
   * @param {string} reviewNotes 
   * @returns {Promise<boolean>}
   */
  static async updateStatus(id, status, reviewNotes = '') {
    const validStatuses = ['pending', 'confirmed', 'dismissed', 'inconclusive'];
    if (!validStatuses.includes(status)) {
      throw new Error(`Status inválido. Permitidos: ${validStatuses.join(', ')}`);
    }

    const db = await getDb();
    const nowIso = new Date().toISOString();

    const res = await db.run(
      `UPDATE reports SET status = ?, review_notes = ?, updated_at = ? WHERE id = ?`,
      [status, reviewNotes, nowIso, id]
    );

    if (res.changes > 0) {
      // Invalida cache de reputação dos domínios afetados
      const rep = await db.get('SELECT domain FROM reports WHERE id = ?', [id]);
      if (rep && rep.domain) {
        await db.run('DELETE FROM reputation_cache WHERE domain = ?', [rep.domain]);
      }
      return true;
    }

    return false;
  }
}
