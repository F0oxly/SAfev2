/**
 * SafeWeb - Backend Security Gateway & Reputation Service
 * Desenvolvido por Iury.
 * Unifica:
 * 1. Base Comunitária de Denúncias do SafeWeb (SQLite)
 * 2. Cache Local Inteligente de Reputação (6h de validade)
 * 3. Consultas a APIs Externas Oficiais (Google Safe Browsing v4)
 * 4. Justificativa transparente dos fatores de risco encontrados
 */

import { getDb } from '../database.js';
import { ReportsService } from './reports.js';
import { GeminiService } from './gemini.js';
import { createHash } from 'node:crypto';

export class SecurityService {
  /**
   * Consulta a API oficial do Google Safe Browsing v4
   * @param {string} targetUrl 
   * @returns {Promise<Object>}
   */
  static async checkGoogleSafeBrowsing(targetUrl) {
    const apiKey = process.env.GOOGLE_SAFE_BROWSING_KEY;

    if (!apiKey) {
      return {
        configured: false,
        status: 'limited',
        message: 'Google Safe Browsing API Key não configurada no backend (.env).'
      };
    }

    try {
      const endpoint = `https://safebrowsing.googleapis.com/v4/threatMatches:find?key=${apiKey}`;
      const payload = {
        client: {
          clientId: 'safeweb-academic',
          clientVersion: '2.0.0'
        },
        threatInfo: {
          threatTypes: ['MALWARE', 'SOCIAL_ENGINEERING', 'UNWANTED_SOFTWARE', 'POTENTIALLY_HARMFUL_APPLICATION'],
          platformTypes: ['ANY_PLATFORM'],
          threatEntryTypes: ['URL'],
          threatEntries: [{ url: targetUrl }]
        }
      };

      const response = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      if (!response.ok) {
        throw new Error(`Google API retornou status HTTP ${response.status}`);
      }

      const data = await response.json();
      const hasThreat = Boolean(data.matches && data.matches.length > 0);

      return {
        configured: true,
        checked: true,
        hasThreat,
        threatTypes: hasThreat ? data.matches.map(m => m.threatType) : [],
        matches: data.matches || []
      };
    } catch (err) {
      console.error('[SafeWeb Security] Erro ao consultar Safe Browsing:', err.message);
      return {
        configured: true,
        checked: false,
        status: 'error',
        error: err.message
      };
    }
  }

  /**
   * Verifica se há cache de reputação válido no banco local (válido por 6 horas)
   * @param {string} domain 
   * @returns {Promise<Object|null>}
   */
  static async getCachedReputation(domain) {
    try {
      const db = await getDb();
      const row = await db.get(
        `SELECT * FROM reputation_cache WHERE domain = ?`,
        [domain]
      );

      if (!row) return null;

      const cacheAgeMs = Date.now() - new Date(row.last_verified).getTime();
      const maxAgeMs = 6 * 60 * 60 * 1000; // 6 horas

      if (cacheAgeMs < maxAgeMs) {
        let details = {};
        try {
          details = JSON.parse(row.details || '{}');
        } catch {
          details = {};
        }

        return {
          ...details,
          fromCache: true,
          cachedAt: row.last_verified
        };
      }

      return null;
    } catch (err) {
      console.warn('[SafeWeb Security] Erro ao consultar cache de reputação:', err.message);
      return null;
    }
  }

  /**
   * Salva o resultado consolidado no cache de reputação
   * @param {string} domain 
   * @param {Object} evaluation 
   */
  static async setCachedReputation(domain, evaluation) {
    try {
      const db = await getDb();
      const id = 'cache_' + domain.replace(/[^a-z0-9]/gi, '_');
      const nowIso = new Date().toISOString();

      await db.run(
        `INSERT INTO reputation_cache (id, domain, risk_level, classification, source, details, last_verified)
         VALUES (?, ?, ?, ?, ?, ?, ?)
         ON CONFLICT(domain) DO UPDATE SET
           risk_level = excluded.risk_level,
           classification = excluded.classification,
           source = excluded.source,
           details = excluded.details,
           last_verified = excluded.last_verified`,
        [
          id,
          domain,
          evaluation.riskLevel,
          evaluation.classification,
          evaluation.sources.map(s => s.name).join(', '),
          JSON.stringify(evaluation),
          nowIso
        ]
      );
    } catch (err) {
      console.warn('[SafeWeb Security] Falha ao persistir cache de reputação:', err.message);
    }
  }

  /**
   * Executa avaliação combinada e transparente de segurança e reputação
   * @param {string} targetUrl 
   * @returns {Promise<Object>}
   */
  static async evaluateReputation(targetUrl, { title = '', context = '' } = {}) {
    const domain = ReportsService.normalizeDomain(targetUrl);
    if (!domain) {
      return {
        url: targetUrl,
        domain: '',
        riskLevel: 'none',
        classification: 'Nenhum risco conhecido',
        reasons: ['URL ou domínio inválido para análise.'],
        sources: [],
        community: null,
        checkedAt: new Date().toISOString()
      };
    }

    // 1. Verificar Cache de Reputação (evita chamadas repetidas às APIs externas)
    const geminiContextHash = createHash('sha256')
      .update(JSON.stringify({ targetUrl, title, context }))
      .digest('hex');
    const cached = await this.getCachedReputation(domain);
    if (cached && (
      cached.geminiAnalysis && cached.geminiContextHash === geminiContextHash ||
      !cached.geminiAnalysis && cached.riskLevel !== 'none'
    )) {
      return cached;
    }

    // PASSO 3: Consulta à Base Comunitária de Denúncias (SafeWeb SQLite)
    const communitySummary = await ReportsService.getDomainSummary(domain);

    // PASSO 4: Consulta à Fonte Externa (Google Safe Browsing)
    const safeBrowsingResult = await this.checkGoogleSafeBrowsing(targetUrl);

    // 4. Avaliação e Ponderação de Fatores (Sem saltar para conclusões precipitadas)
    let riskLevel = 'none'; // 'none' | 'attention' | 'high' | 'critical'
    let classification = 'Nenhum risco conhecido';
    const reasons = [];
    const sources = [];

    // Avaliação da Fonte Confiável Externa
    if (safeBrowsingResult.configured && safeBrowsingResult.hasThreat) {
      riskLevel = 'critical';
      classification = 'Ameaça confirmada por fonte confiável';
      const threatTypes = safeBrowsingResult.threatTypes.join(', ');
      reasons.push(`Listado no banco global de ameaças do Google Safe Browsing (${threatTypes}).`);
      sources.push({
        name: 'Google Safe Browsing',
        status: 'threat',
        details: `Ameaça confirmada: ${threatTypes}`
      });
    } else if (safeBrowsingResult.configured && safeBrowsingResult.checked) {
      sources.push({
        name: 'Google Safe Browsing',
        status: 'clean',
        details: 'Nenhuma ameaça identificada na base oficial do Google.'
      });
    } else {
      sources.push({
        name: 'Google Safe Browsing',
        status: 'limited',
        details: safeBrowsingResult.message || 'Verificação externa limitada ou indisponível.'
      });
    }

    // Avaliação da Base Comunitária
    const totalReports = communitySummary.totalReports;
    const confirmedReports = communitySummary.statusCounts.confirmed || 0;
    const pendingReports = communitySummary.statusCounts.pending || 0;

    if (confirmedReports > 0) {
      // Se houver denúncias revisadas e confirmadas pela moderação
      if (riskLevel !== 'critical') {
        riskLevel = 'high';
        classification = 'Risco elevado';
      }
      reasons.push(`${confirmedReports} denúncia(s) confirmada(s) por revisão na base comunitária.`);
      sources.push({
        name: 'Base Comunitária SafeWeb',
        status: 'confirmed_reports',
        details: `${confirmedReports} denúncia(s) verificada(s) de usuários.`
      });
    } else if (pendingReports >= 3) {
      // Múltiplas denúncias de usuários geram alerta de "Atenção", nunca acusação categórica
      if (riskLevel === 'none') {
        riskLevel = 'attention';
        classification = 'Atenção';
      }
      reasons.push(`Este domínio possui ${pendingReports} relatos recentes de usuários sob análise.`);
      sources.push({
        name: 'Base Comunitária SafeWeb',
        status: 'pending_reports',
        details: `${pendingReports} relatos em averiguação pela comunidade.`
      });
    } else if (pendingReports > 0) {
      // 1 ou 2 denúncias isoladas não alteram o nível para perigoso, apenas informam
      reasons.push(`Existe relato prévio de usuário registrado sobre este domínio (${pendingReports} relato sob análise).`);
      sources.push({
        name: 'Base Comunitária SafeWeb',
        status: 'isolated_report',
        details: `${pendingReports} relato registrado. Recomenda-se cautela.`
      });
    } else {
      sources.push({
        name: 'Base Comunitária SafeWeb',
        status: 'clean',
        details: 'Nenhuma denúncia comunitária registrada para este domínio.'
      });
    }

    let geminiAnalysis = null;
    if (riskLevel !== 'critical' && riskLevel !== 'high' && confirmedReports === 0) {
      try {
        geminiAnalysis = await GeminiService.analyzeSite({ url: targetUrl, title, context });
        sources.push({
          name: 'Gemini AI',
          status: geminiAnalysis.veredicto === 'SUSPEITO' ? 'threat' : 'clean',
          details: geminiAnalysis.explicacao
        });

        if (geminiAnalysis.veredicto === 'SUSPEITO') {
          riskLevel = 'high';
          classification = 'Site suspeito identificado pela análise Gemini AI';
          reasons.push(`Análise Gemini AI: ${geminiAnalysis.explicacao}`);
        }
      } catch (err) {
        console.warn('[SafeWeb Security] Análise Gemini de site indisponível:', err.message);
      }
    }

    // Se nenhuma ameaça foi identificada e não há relatos preocupantes
    if (reasons.length === 0) {
      reasons.push('Nenhuma ameaça conhecida ou relato suspeito foi identificado nos bancos consultados.');
    }

    const evaluation = {
      url: targetUrl,
      domain,
      riskLevel,
      classification,
      reasons,
      sources,
      geminiAnalysis,
      geminiContextHash,
      community: {
        totalReports: communitySummary.totalReports,
        categories: communitySummary.categories,
        statusCounts: communitySummary.statusCounts,
        latestReportDate: communitySummary.latestReportDate
      },
      externalReputation: {
        configured: safeBrowsingResult.configured,
        checked: safeBrowsingResult.checked || false,
        status: safeBrowsingResult.status || (safeBrowsingResult.hasThreat ? 'threat' : 'clean')
      },
      checkedAt: new Date().toISOString(),
      fromCache: false
    };

    // 5. Salva no cache inteligente
    await this.setCachedReputation(domain, evaluation);

    return evaluation;
  }
}
