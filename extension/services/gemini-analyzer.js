/**
 * SafeWeb - Gemini AI Analyzer
 * Desenvolvido por Iury & Equipe.
 *
 * Módulo de inteligência artificial alimentado pela Gemini API oficial do Google.
 * Avalia notícias, links, detecção de fake news, sensacionalismo e segurança de sites
 * de forma contextualizada, rápida e com tratamento robusto de erros e fallbacks.
 */

import { StorageManager } from '../storage/storage-manager.js';
import { GEMINI_API_KEY as LOCAL_SECRETS_KEY } from './secrets.js';

// ─── Configurações de Acesso Seguro ──────────────────────────────────────────
// A chave nunca é exposta no código versionado:
// Pode ser configurada na aba 'Ajustes' da extensão ou no arquivo local 'secrets.js'.
export async function getActiveGeminiApiKey() {
  try {
    const config = await StorageManager.getConfig();
    if (config?.geminiApiKey && config.geminiApiKey.trim()) {
      return config.geminiApiKey.trim();
    }
  } catch {}
  return (LOCAL_SECRETS_KEY || '').trim();
}

// Lista de modelos ordenados por prioridade (3.5-flash-lite é ultra-rápido e estável)
const GEMINI_MODELS = [
  'gemini-3.5-flash-lite',
  'gemini-3.8-flash',
  'gemini-2.5-flash',
  'gemini-flash-latest'
];

const GEMINI_TIMEOUT_MS = 12000;

// ─── Whitelist de Apoio (Grandes Veículos Auditados) ──────────────────────────
export const TRUSTED_DOMAINS = [
  'uol.com.br',
  'g1.globo.com',
  'globo.com',
  'poder360.com.br',
  'cartacapital.com.br',
  'estadao.com.br',
  'folha.uol.com.br',
  'cnnbrasil.com.br',
  'bbc.com',
  'reuters.com',
  'agenciabrasil.ebc.com.br',
  'nexojornal.com.br',
  'metropoles.com',
  'elpais.com',
  'jota.info',
  'fiocruz.br',
  'butantan.gov.br',
  'gov.br',
  'who.int',
  'nature.com',
  'sciencedirect.com',
  'usp.br',
  'aosfatos.org',
  'lupa.uol.com.br'
];

/**
 * Função interna que executa a chamada à API do Gemini com fallback automático entre modelos.
 * @param {string} promptText 
 * @returns {Promise<string|null>} Resposta em texto puro ou null
 */
async function callGeminiApi(promptText) {
  const apiKey = await getActiveGeminiApiKey();
  if (!apiKey) {
    console.warn('[SafeWeb Gemini] Nenhuma chave de API configurada. Adicione sua chave em Ajustes ou em secrets.js.');
    return null;
  }

  for (const model of GEMINI_MODELS) {
    const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), GEMINI_TIMEOUT_MS);

    try {
      const response = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        signal: controller.signal,
        body: JSON.stringify({
          contents: [{ parts: [{ text: promptText }] }],
          generationConfig: {
            responseMimeType: 'application/json',
            temperature: 0.1,
            maxOutputTokens: 350
          }
        })
      });

      clearTimeout(timeoutId);

      if (response.ok) {
        const data = await response.json();
        const text = data?.candidates?.[0]?.content?.parts?.[0]?.text;
        if (text) return text;
      } else {
        const errorData = await response.text();
        console.warn(`[SafeWeb Gemini] Modelo ${model} retornou status ${response.status}:`, errorData.slice(0, 150));
        // Se for erro 503 (alta demanda) ou 404 (modelo descontinuado), tenta o próximo modelo da lista
        if (response.status === 503 || response.status === 404) {
          continue;
        }
      }
    } catch (err) {
      clearTimeout(timeoutId);
      console.warn(`[SafeWeb Gemini] Falha ao consultar modelo ${model}:`, err.message);
    }
  }

  return null;
}

/**
 * Analisa uma notícia ou publicação com a Gemini API.
 * Identifica fake news, alarmismo/sensacionalismo e credibilidade de fontes.
 *
 * @param {string} titulo - Título da matéria
 * @param {string} texto - Texto ou trecho da matéria
 * @param {string} url - Link de origem
 * @returns {Promise<{veredicto: string, badge: string, badgeColor: string, explicacao: string, fonte: string}>}
 */
export async function analisarComGemini(titulo, texto, url = '') {
  let dominio = '';
  try {
    if (url) {
      dominio = new URL(url.startsWith('http') ? url : `https://${url}`).hostname.replace(/^www\./, '').toLowerCase();
    }
  } catch {
    dominio = '';
  }

  const isTrusted = dominio && TRUSTED_DOMAINS.some(d => dominio === d || dominio.endsWith('.' + d));
  const whitelistList = TRUSTED_DOMAINS.slice(0, 10).join(', ') + '...';

  const promptText = `
Você é um verificador de fatos e credibilidade jornalística do projeto SafeWeb Informa.
Analise a publicação abaixo de forma estrita, inteligente e sem preconceitos ideológicos:
- Título: "${(titulo || '(não informado)').replace(/"/g, '\\"')}"
- Texto / Trecho: "${(texto || '(não informado)').slice(0, 2000).replace(/"/g, '\\"')}"
- URL informada: "${url || '(não informada)'}"
- Domínio: "${dominio || '(não identificado)'}"
- Está na lista de grandes veículos de imprensa auditados: ${isTrusted ? 'SIM' : 'NÃO'} (Exemplos de confiáveis: ${whitelistList})

CRITÉRIOS DE AVALIAÇÃO:
1. Tom da linguagem: É caça-cliques (clickbait), excessivamente alarmista, em caixa alta ou com tom de conspiração?
2. Coerência do domínio: É um site jornalístico sério, um blog desconhecido com promessas milagrosas ou um clone falso?
3. Veracidade aparente: Promete cura milagrosa, fatos extraordinários sem fontes, teorias da conspiração já desmentidas ou golpes financeiros?
4. Equilíbrio: Não trate toda notícia como duvidosa. Portais sérios com dados coerentes devem ser reconhecidos como confiáveis.

ESTRUTURA DE RESPOSTA OBRIGATÓRIA (Responda APENAS com este JSON válido):
{
  "veredicto": "CONFIAVEL" | "SUSPEITO" | "FAKE_NEWS",
  "badge": "🟢 FONTE CONFIÁVEL" | "🟡 ALERTA DE SENSACIONALISMO" | "🔴 ALERTA DE FAKE NEWS",
  "explicacao": "Uma frase direta, clara e sem jargões técnicos para um usuário leigo."
}
`.trim();

  try {
    const rawResult = await callGeminiApi(promptText);

    if (rawResult) {
      const jsonMatch = rawResult.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        const parsed = JSON.parse(jsonMatch[0]);

        if (parsed.veredicto && parsed.badge && parsed.explicacao) {
          const colorMap = {
            'CONFIAVEL': '#16a34a',
            'SUSPEITO': '#d97706',
            'FAKE_NEWS': '#dc2626'
          };

          return {
            veredicto: parsed.veredicto,
            badge: parsed.badge,
            badgeColor: colorMap[parsed.veredicto] || '#d97706',
            explicacao: parsed.explicacao,
            fonte: 'gemini'
          };
        }
      }
    }
  } catch (err) {
    console.error('[SafeWeb Gemini] Erro ao processar resposta do Gemini:', err);
  }

  // Fallback seguro em caso de indisponibilidade de rede ou erro na chave
  return {
    veredicto: 'SUSPEITO',
    badge: '🟡 PRECISA DE MAIS VERIFICAÇÃO',
    badgeColor: '#d97706',
    explicacao: 'Não foi possível confirmar os indícios pela IA no momento. Recomendamos cautela e consulta a fontes oficiais.',
    fonte: 'fallback'
  };
}

/**
 * Avalia a segurança geral de um site usando a inteligência do Gemini para o módulo de monitoramento.
 * @param {string} url 
 * @param {string} title 
 * @returns {Promise<Object|null>}
 */
export async function avaliarSegurancaSiteComGemini(url, title = '') {
  let dominio = '';
  try {
    dominio = new URL(url.startsWith('http') ? url : `https://${url}`).hostname.replace(/^www\./, '').toLowerCase();
  } catch {
    dominio = url;
  }

  const promptText = `
Você é um especialista em cibersegurança digital do SafeWeb.
Avalie a reputação e o risco de segurança deste domínio/site:
- URL: "${url}"
- Domínio: "${dominio}"
- Título da página: "${title || '(não informado)'}"

Classifique quanto a riscos de phishing, golpes digitais, sites falsos ou se é um domínio legítimo reconhecido.
Responda APENAS em formato JSON:
{
  "riskLevel": "low" | "attention" | "high",
  "classification": "🟢 Domínio Confiável" | "🟡 Requer Atenção" | "🔴 Possível Ameaça / Phishing",
  "reason": "Explicação resumida em uma frase."
}
`.trim();

  try {
    const rawResult = await callGeminiApi(promptText);
    if (rawResult) {
      const match = rawResult.match(/\{[\s\S]*\}/);
      if (match) {
        return JSON.parse(match[0]);
      }
    }
  } catch (err) {
    console.warn('[SafeWeb Gemini] Falha na avaliação de segurança do site:', err.message);
  }

  return null;
}
