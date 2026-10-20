/**
 * SafeWeb - Client News & Disinformation Analyzer (SafeWeb Informa)
 * Desenvolvido por Iury & Equipe.
 * Analisador de confiabilidade, indícios de clickbait e checagem cruzada.
 * Camada primária: Gemini AI via backend e gemini-analyzer.js
 * Camada de fallback: heurísticas locais (sem dependência de rede)
 */

import { analisarComGemini } from './gemini-analyzer.js';

export const DEMO_CASES = [
  {
    id: 'demo_1',
    label: '1. Notícia Verificada (Ciência & Saúde)',
    tag: '🟢 Boa Confiabilidade',
    title: 'Fiocruz avança para fase final de testes de vacina nacional com apoio do Ministério da Saúde',
    text: 'A Fundação Oswaldo Cruz (Fiocruz) anunciou nesta terça-feira a conclusão da fase de ensaios clínicos em 2.500 voluntários. O estudo foi conduzido pela equipe da Drª Maria Albuquerque com dados publicados e revisados por pares na revista Lancet. O relatório técnico está disponível no portal da Fiocruz e na plataforma Lattes.',
    url: 'https://fiocruz.br/noticias/ensaios-clinicos-fase-final'
  },
  {
    id: 'demo_2',
    label: '2. Clickbait Alarmista & Sem Fontes',
    tag: '🟠 Sinais de Alerta',
    title: 'URGENTE: BOMBA! O QUE A MÍDIA NÃO MOSTRA SOBRE A DOENÇA SECRETA QUE CHOROU O BRASIL!!!',
    text: 'Especialistas afirmam que uma doença misteriosa está sendo ocultada da população. Fontes próximas garantem que medicamentos comuns causam problemas graves. Compartilhe antes que apaguem! Repasse para todos os seus grupos de família agora mesmo!',
    url: 'https://noticias-urgentes-bomba.xyz/revelacao'
  },
  {
    id: 'demo_3',
    label: '3. Notícia Antiga ou Fora de Contexto',
    tag: '🟡 Precisa Verificação',
    title: 'Prefeitura decreta fechamento temporário de comércios a partir da próxima segunda-feira',
    text: 'Em pronunciamento extraordinário, a administração municipal informa que os estabelecimentos não essenciais deverão suspender as atividades presenciais por 14 dias para controle de circulação.',
    url: 'https://portal-regional-noticias.com/decreto'
  },
  {
    id: 'demo_4',
    label: '4. Boato Desmentido por Agências Oficiais',
    tag: '🔴 Desmentida por Checagem',
    title: 'Descoberta revolucionária: chá de folhas medicinais promete cura definitiva do câncer em 7 dias',
    text: 'Pesquisador anônimo desenvolve fórmula caseira que promete curar todas as formas de câncer em 7 dias sem quimioterapia. A indústria farmacêutica não quer que você descubra essa verdade oculta. Divulgue ao máximo para salvar vidas!',
    url: 'https://saude-natural-milagres.site/cura-cancer'
  },
  {
    id: 'demo_5',
    label: '5. Blog Desconhecido ou Informação Vaga',
    tag: '🟡 Precisa Verificação',
    title: 'Novo aplicativo pode aumentar a produtividade no trabalho em 80%, dizem estudos',
    text: 'Estudos comprovam que uma nova ferramenta digital lançada esta semana dobra o rendimento diário de profissionais em qualquer área. Usuários relatam melhorias nos primeiros dias de uso.',
    url: 'https://tech-tendencias-hoje.com/novo-app'
  }
];

// Veículos com conselho editorial reconhecido e expediente público auditável
const TRUSTED_DOMAINS = [
  'g1.globo.com', 'folha.uol.com.br', 'estadao.com.br', 'uol.com.br',
  'bbc.com', 'cnnbrasil.com.br', 'agenciabrasil.ebc.com.br', 'reuters.com',
  'elpais.com', 'nexojornal.com.br', 'fiocruz.br', 'butantan.gov.br',
  'gov.br', 'who.int', 'nature.com', 'sciencedirect.com', 'usp.br',
  'globo.com', 'metropoles.com', 'poder360.com.br', 'jota.info'
];

// TLDs de baixo custo comumente usados para gerar sites temporários de spam e fake news
const SUSPICIOUS_TLDS = ['.xyz', '.top', '.site', '.click', '.club', '.online', '.buzz', '.info', '.work', '.live', '.tk', '.ml'];

const SENSATIONALIST_WORDS = [
  'bomba', 'urgente', 'chocante', 'escandalo', 'revelado', 'o que a midia nao mostra',
  'nao querem que voce saiba', 'acabou de sair', 'inacreditavel', 'descoberta historica',
  'cura definitiva', 'milagre', 'exclusivo', 'perigo iminente', 'segredo revelado',
  'verdade oculta', 'absurdo', 'veja antes que apaguem', 'chocou o brasil', 'chocou o mundo',
  'cuidado geral', 'parem tudo', 'denuncia gravissima'
];

const URGENCY_TRIGGERS = [
  'compartilhe antes que apaguem', 'repasse para todos', 'nao deixe de compartilhar',
  'divulgue ao maximo', 'urgente compartilhe', 'avise seus amigos', 'atencao pais',
  'alerta geral', 'cuidado urgente', 'espalhe para sua familia', 'vamos viralizar',
  'repasse urgente', 'nao guarde isso'
];

const VAGUE_SOURCES = [
  'segundo especialistas', 'estudos comprovam', 'pesquisadores afirmam',
  'fontes confiaveis garantem', 'segundo medicos', 'cientistas revelam',
  'fontes proximas confirmam', 'circula nos grupos', 'dizem que', 'ouvi dizer'
];

const DEBUNKED_PATTERNS = [
  {
    regex: /cura\s+(definitiva|milagrosa)\s+do\s+cancer/i,
    topic: 'Cura milagrosa do câncer',
    debunkedBy: 'Instituto Nacional de Câncer (INCA) e Agência Lupa',
    explanation: 'Não existe remédio único ou caseiro que cure todos os tipos de câncer. Tratamentos oncológicos dependem de diagnóstico e acompanhamento médico.'
  },
  {
    regex: /(chip|5g|magnetismo|rastreamento)\s+na\s+vacina/i,
    topic: 'Microchip ou magnetismo em vacinas',
    debunkedBy: 'Fiocruz, Butantan e Aos Fatos',
    explanation: 'Vacinas não possuem chips, metais pesados ou propriedades magnéticas. São compostos biológicos testados e aprovados pela Anvisa.'
  },
  {
    regex: /fim\s+do\s+pix|taxa\s+(de\s+)?(50%|transacao)\s+no\s+pix/i,
    topic: 'Fim do Pix ou cobrança abusiva geral',
    debunkedBy: 'Banco Central do Brasil e Fato ou Fake (G1)',
    explanation: 'O Banco Central já esclareceu formalmente que o Pix para pessoas físicas segue gratuito e sem previsão de término.'
  },
  {
    regex: /cha\s+de\s+(erva|alho|limao)\s+cura\s+(covid|dengue)/i,
    topic: 'Chás e receitas caseiras como cura definitiva de vírus',
    debunkedBy: 'Organização Mundial da Saúde (OMS) e Ministério da Saúde',
    explanation: 'Infusões caseiras ajudam na hidratação e alívio sintomático, mas não eliminam infecções virais nem substituem cuidados médicos.'
  }
];

export class LocalNewsAnalyzer {
  static clean(text) {
    if (!text) return '';
    return text.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().trim();
  }

  /**
   * Analisa uma notícia combinando IA (Gemini) + heurísticas locais.
   * É assíncrono para suportar a chamada à Gemini API.
   *
   * @param {Object} param0 - { url, text, title, author, publishDate }
   * @returns {Promise<Object>} Objeto de análise completo
   */
  static async analyze({ url = '', text = '', title = '', author = '', publishDate = '' }) {
    let effectiveTitle = (title || '').trim();
    let effectiveText = (text || '').trim();
    let domain = '';

    if (url) {
      try {
        const parsed = new URL(url.startsWith('http') ? url : `https://${url}`);
        domain = parsed.hostname.replace(/^www\./, '').toLowerCase();
      } catch {}
    }

    if (!effectiveTitle && effectiveText) {
      effectiveTitle = effectiveText.split('\n')[0].slice(0, 120);
    }

    if (!effectiveTitle && domain) {
      effectiveTitle = `Notícia publicada em ${domain}`;
    }

    if (!effectiveTitle) {
      effectiveTitle = 'Texto ou alegação em análise';
    }

    const fullContent = `${effectiveTitle} ${effectiveText}`;
    const cleanContent = this.clean(fullContent);
    const cleanTitle = this.clean(effectiveTitle);

    const reasons = [];
    const evidence = [];
    const unverified = [];
    const nextSteps = [];
    let attentionScore = 0;

    // ── 1. Checagem de Desmentidos Conhecidos ────────────────────────────
    let debunkMatch = null;
    for (const item of DEBUNKED_PATTERNS) {
      if (item.regex.test(cleanContent)) {
        debunkMatch = item;
        break;
      }
    }

    if (debunkMatch) {
      attentionScore += 80;
      reasons.push(`Alegação desmentida por verificações oficiais prévias: "${debunkMatch.topic}".`);
      evidence.push(`Desmentido registrado por: ${debunkMatch.debunkedBy}. ${debunkMatch.explanation}`);
    }

    // ── 2. Sensacionalismo & Clickbait no Título ──────────────────────────
    const foundSensationalist = SENSATIONALIST_WORDS.filter(w => cleanTitle.includes(w));
    const uppercaseCount = (effectiveTitle.match(/[A-ZÁÉÍÓÚÂÊÎÔÛÃÕÇ]/g) || []).length;
    const hasAlarmCaps = effectiveTitle.length > 20 && (uppercaseCount / effectiveTitle.length) > 0.35;
    const hasAlarmPunct = /[?!]{2,}/.test(effectiveTitle);

    if (foundSensationalist.length > 0 || hasAlarmCaps || hasAlarmPunct) {
      attentionScore += 30;
      const details = [];
      if (foundSensationalist.length > 0) details.push(`expressões alarmistas ("${foundSensationalist.slice(0, 2).join(', ')}")`);
      if (hasAlarmCaps) details.push('letras maiúsculas excessivas');
      if (hasAlarmPunct) details.push('pontuação enfática (?? / !!)');
      reasons.push(`Título com indícios de sensacionalismo ou clickbait (${details.join(', ')}).`);
    }

    // ── 3. Pressão de Urgência de Compartilhamento ────────────────────────
    const foundUrgency = URGENCY_TRIGGERS.filter(u => cleanContent.includes(u));
    if (foundUrgency.length > 0) {
      attentionScore += 35;
      reasons.push(`Uso de apelo de urgência para forçar compartilhamento ("${foundUrgency[0]}").`);
    }

    // ── 4. Domínio com terminação suspeita ────────────────────────────────
    const hasSuspiciousTLD = domain && SUSPICIOUS_TLDS.some(tld => domain.endsWith(tld));
    if (hasSuspiciousTLD) {
      attentionScore += 30;
      reasons.push(`Domínio com terminação atípica ou de baixo custo (${domain}), comum em sites provisórios de desinformação.`);
    }

    // ── 5. Citações Vagas vs. Fontes Primárias ────────────────────────────
    const foundVague = VAGUE_SOURCES.filter(v => cleanContent.includes(v));
    if (foundVague.length > 0) {
      attentionScore += 20;
      reasons.push(`Citação de fontes vagas ("${foundVague[0]}"), sem nomear pesquisadores, instituições ou órgãos reguladores.`);
    }

    // ── 6. Avaliação do Veículo (Domínio) ─────────────────────────────────
    const isTrusted = domain && TRUSTED_DOMAINS.some(t => domain === t || domain.endsWith('.' + t));
    if (isTrusted) {
      evidence.push(`Veículo com conselho editorial auditável e equipe jornalística identificada (${domain}).`);
    } else if (domain) {
      unverified.push(`O veículo "${domain}" não possui conselho editorial público de referência auditado.`);
      nextSteps.push('Verifique se grandes veículos de imprensa ou fontes primárias também noticiaram o mesmo fato.');
    } else {
      unverified.push('Conteúdo colado em texto sem link do veículo original.');
      nextSteps.push('Busque trechos da notícia entre aspas no Google para encontrar a matéria original.');
    }

    // ── 7. Autoria e Data ────────────────────────────────────────────────
    if (author && author !== 'Não identificado') {
      evidence.push(`Autoria identificada: "${author}".`);
    } else {
      unverified.push('Não foi identificada autoria específica assinando a reportagem.');
    }

    if (publishDate && publishDate !== 'Não informada') {
      evidence.push(`Data de veiculação: ${publishDate.slice(0, 10)}.`);
    }

    // ── Links de checagem em agências ────────────────────────────────────
    const query = encodeURIComponent(effectiveTitle.slice(0, 50));
    const factCheckLinks = [
      { name: 'Fato ou Fake (G1)', url: `https://www.google.com/search?q=site:g1.globo.com/fato-ou-fake+${query}` },
      { name: 'Agência Lupa', url: `https://www.google.com/search?q=site:lupa.uol.com.br+${query}` },
      { name: 'Aos Fatos', url: `https://www.google.com/search?q=site:aosfatos.org+${query}` },
      { name: 'UOL Confere', url: `https://www.google.com/search?q=site:noticias.uol.com.br/confere+${query}` }
    ];

    // ══════════════════════════════════════════════════════════════════════
    // CLASSIFICAÇÃO LOCAL (heurística) — será sobrescrita pelo Gemini se OK
    // ══════════════════════════════════════════════════════════════════════
    let classification = '';
    let riskLevel = '';
    let badgeColor = '';

    if (debunkMatch) {
      classification = '🔴 ALEGAÇÃO DESMENTIDA POR EVIDÊNCIAS';
      riskLevel = 'debunked';
      badgeColor = '#dc2626';
      nextSteps.unshift('Evite compartilhar: organizações de checagem já confirmaram que ela contém informações falsas ou distorcidas.');
    } else if (attentionScore >= 30 || foundSensationalist.length > 0 || foundUrgency.length > 0 || hasSuspiciousTLD) {
      classification = '🟠 SINAIS DE ALERTA';
      riskLevel = 'warning';
      badgeColor = '#ea580c';
      nextSteps.unshift('Recomenda-se muita cautela. Foram detectados padrões alarmistas típicos de notícias manipuladas.');
    } else if (isTrusted && foundSensationalist.length === 0 && !hasAlarmCaps && !hasAlarmPunct && !hasSuspiciousTLD) {
      classification = '🟢 FONTE CONFIÁVEL';
      riskLevel = 'reliable';
      badgeColor = '#16a34a';
      reasons.push(`Publicado por veículo com conselho editorial auditável (${domain}) e padrão redacional informativo.`);
      nextSteps.unshift('Apresenta boas evidências institucionais. Ainda assim, consulte outras fontes para ampliar a compreensão.');
    } else {
      classification = '🟡 PRECISA DE MAIS VERIFICAÇÃO';
      riskLevel = 'needs_verification';
      badgeColor = '#d97706';
      if (!isTrusted && domain) {
        reasons.push(`O veículo "${domain}" não consta entre os veículos de imprensa de referência pública auditados.`);
      }
      if (effectiveText.length < 60) {
        reasons.push('Conteúdo com pouco texto informativo para auditar fontes primárias ou citações concretas.');
      }
      nextSteps.unshift('As evidências disponíveis são insuficientes para atestar a veracidade com segurança. Aguarde confirmação em fontes oficiais.');
    }

    // ══════════════════════════════════════════════════════════════════════
    // CAMADA PRIMÁRIA: GEMINI AI
    // O título ou a URL já fornecem contexto suficiente para analisar a notícia.
    // ══════════════════════════════════════════════════════════════════════
    let geminiResult = null;
    const hasGeminiInput = Boolean((title || '').trim() || (url || '').trim());

    if (hasGeminiInput) {
      try {
        geminiResult = await analisarComGemini(effectiveTitle, effectiveText, url);
      } catch (err) {
        console.warn('[SafeWeb] Gemini indisponível, usando heurística local:', err.message);
      }
    }

    // Se a Gemini retornou um resultado válido, sobrescreve a classificação local
    if (geminiResult) {
      const verdictMap = {
        'CONFIAVEL': { classification: '🟢 FONTE CONFIÁVEL', riskLevel: 'reliable', badgeColor: '#16a34a' },
        'SUSPEITO': { classification: '🟡 ALERTA DE SENSACIONALISMO', riskLevel: 'warning', badgeColor: '#d97706' },
        'FAKE_NEWS': { classification: '🔴 ALERTA DE FAKE NEWS', riskLevel: 'debunked', badgeColor: '#dc2626' }
      };

      const mapped = verdictMap[geminiResult.veredicto];
      if (mapped) {
        classification = mapped.classification;
        riskLevel = mapped.riskLevel;
        badgeColor = mapped.badgeColor;
      }

      // Insere a explicação da IA no topo de reasons como contexto primário
      if (geminiResult.explicacao) {
        reasons.unshift(`🤖 Análise Gemini AI: ${geminiResult.explicacao}`);
      }
    }

    return {
      id: 'local_news_' + Date.now(),
      url: url || null,
      domain: domain || 'Texto colado',
      title: effectiveTitle,
      author: author || 'Auditado no texto',
      publishDate: publishDate || 'Não informada',
      classification,
      riskLevel,
      badgeColor,
      attentionScore: Math.min(100, Math.max(0, attentionScore)),
      reasons,
      evidence: evidence.length > 0 ? evidence : ['Nenhum dado confirmatório institucional foi identificado no texto.'],
      unverified: unverified.length > 0 ? unverified : ['Nenhuma lacuna crítica evidente foi constatada nos elementos fornecidos.'],
      nextSteps,
      factCheckLinks,
      // Metadados da camada de IA (para debug/transparência)
      geminiVeredicto: geminiResult?.veredicto || null,
      geminiBadge: geminiResult?.badge || null,
      geminiExplicacao: geminiResult?.explicacao || null,
      analyzedBy: geminiResult ? 'gemini+heuristica' : 'heuristica',
      analyzedAt: new Date().toISOString()
    };
  }
}
