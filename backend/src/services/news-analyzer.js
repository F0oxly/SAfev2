/**
 * SafeWeb - News & Disinformation Analyzer (SafeWeb Informa)
 * Desenvolvido por Iury para fins acadêmicos e educativos.
 * 
 * Análise em camadas de indícios de confiabilidade e desinformação:
 * 1. Extração estruturada (Título, Veículo, Autor, Data, Conteúdo)
 * 2. Análise linguística e indícios de atenção (sensacionalismo, anonimato, urgência)
 * 3. Gatilhos psicológicos (apelo emocional, viés de confirmação, pressão social)
 * 4. Links diretos para checagem em agências oficiais reconhecidas
 * 5. Classificação transparente e educativa (sem falsas promessas de 100% certeza)
 */

import { getDb } from '../database.js';

// Veículos e instituições de referência com conselho editorial ou expediente transparente
const TRUSTED_OUTLETS = [
  'g1.globo.com', 'folha.uol.com.br', 'estadao.com.br', 'uol.com.br',
  'bbc.com', 'cnnbrasil.com.br', 'agenciabrasil.ebc.com.br', 'reuters.com',
  'elpais.com', 'nexojornal.com.br', 'fiocruz.br', 'butantan.gov.br',
  'gov.br', 'who.int', 'nature.com', 'sciencedirect.com', 'usp.br'
];

// Agências de checagem de fatos reconhecidas no Brasil e no mundo
const FACT_CHECKING_PLATFORMS = [
  { name: 'Fato ou Fake (G1)', searchUrl: 'https://www.google.com/search?q=site:g1.globo.com/fato-ou-fake+' },
  { name: 'Agência Lupa', searchUrl: 'https://www.google.com/search?q=site:lupa.uol.com.br+' },
  { name: 'Aos Fatos', searchUrl: 'https://www.google.com/search?q=site:aosfatos.org+' },
  { name: 'UOL Confere', searchUrl: 'https://www.google.com/search?q=site:noticias.uol.com.br/confere+' },
  { name: 'Google Fact Check Explorer', searchUrl: 'https://toolbox.google.com/factcheck/explorer/search/list?hl=pt-BR&query=' }
];

// Termos e expressões comumente empregados em desinformação e clickbait alarmista
const SENSATIONALIST_PATTERNS = [
  'bomba', 'urgente', 'chocante', 'escandalo', 'revelado', 'o que a midia nao mostra',
  'nao querem que voce saiba', 'acabou de sair', 'inacreditavel', 'descoberta historica',
  'cura definitiva', 'milagre', 'exclusivo', 'perigo iminente', 'segredo revelado',
  'verdade oculta', 'absurdo', 'veja antes que apaguem', 'chocou o brasil', 'chocou o mundo'
];

// Expressões de pressão psicológica e urgência de compartilhamento
const URGENCY_TRIGGERS = [
  'compartilhe antes que apaguem', 'repasse para todos', 'nao deixe de compartilhar',
  'divulgue ao maximo', 'urgente compartilhe', 'avise seus amigos', 'atencao pais',
  'alerta geral', 'cuidado urgente', 'espalhe para sua familia', 'vamos fazer viralizar'
];

// Termos vagos que simulam fontes sem citar nomes ou instituições reais
const VAGUE_SOURCE_PATTERNS = [
  'segundo especialistas', 'estudos comprovam', 'pesquisadores afirmam',
  'fontes confiaveis garantem', 'segundo medicos', 'cientistas revelam',
  'fontes proximas confirmam', 'circula nos grupos', 'dizem que'
];

// Casos conhecidos de alegações amplamente desmentidas por agências para demonstração segura
const KNOWN_DEBUNKED_PATTERNS = [
  {
    pattern: /cura\s+(definitiva|milagrosa)\s+do\s+cancer/i,
    topic: 'Cura milagrosa do câncer',
    debunkedBy: 'Instituto Nacional de Câncer (INCA) e Agência Lupa',
    explanation: 'Não existe tratamento único ou caseiro capaz de curar todos os tipos de câncer. O tratamento depende de diagnóstico específico.'
  },
  {
    pattern: /(chip|5g|magnetismo|rastreamento)\s+na\s+vacina/i,
    topic: 'Microchip ou magnetismo em vacinas',
    debunkedBy: 'Fiocruz, Butantan e Aos Fatos',
    explanation: 'Vacinas não possuem microchips, metais pesados ou propriedades magnéticas. São compostos biológicos aprovados pela Anvisa.'
  },
  {
    pattern: /fim\s+do\s+pix|taxa\s+(de\s+)?(50%|transacao)\s+no\s+pix/i,
    topic: 'Fim do Pix ou cobrança abusiva de taxa geral',
    debunkedBy: 'Banco Central do Brasil e Fato ou Fake',
    explanation: 'O Banco Central já esclareceu que o Pix para pessoas físicas continua gratuito e que não há encerramento do serviço programado.'
  },
  {
    pattern: /cha\s+de\s+(erva|alho|limao)\s+cura\s+(covid|dengue)/i,
    topic: 'Chás e receitas caseiras como cura definitiva de vírus',
    debunkedBy: 'Organização Mundial da Saúde (OMS) e Ministério da Saúde',
    explanation: 'Infusões e chás podem auxiliar no conforto térmico e hidratação, mas não eliminam infecções virais nem substituem tratamento médico.'
  }
];

export class NewsAnalyzerService {
  /**
   * Normaliza texto para facilitar checagens de regex
   */
  static cleanText(str) {
    if (!str) return '';
    return str
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .toLowerCase()
      .trim();
  }

  /**
   * Extrai metadados básicos de uma URL legítima sem dependências pesadas
   */
  static async extractUrlMetadata(url) {
    try {
      const parsedUrl = new URL(url);
      const domain = parsedUrl.hostname.replace(/^www\./, '').toLowerCase();

      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 4000); // 4s timeout

      const response = await fetch(url, {
        method: 'GET',
        signal: controller.signal,
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) SafeWeb-Informa/2.0'
        }
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        return {
          accessible: false,
          domain,
          error: `O servidor retornou status HTTP ${response.status}.`
        };
      }

      const html = await response.text();

      // Extração leve de título
      const titleMatch = html.match(/<meta property=["']og:title["'] content=["']([^"']+)["']/i) ||
                         html.match(/<title[^>]*>([^<]+)<\/title>/i);
      const title = titleMatch ? titleMatch[1].trim() : '';

      // Extração de autor
      const authorMatch = html.match(/<meta name=["']author["'] content=["']([^"']+)["']/i) ||
                          html.match(/<meta property=["']article:author["'] content=["']([^"']+)["']/i) ||
                          html.match(/class=["'][^"']*(?:author|autor|byline)[^"']*["'][^>]*>([^<]+)</i);
      const author = authorMatch ? authorMatch[1].trim() : null;

      // Extração de data de publicação
      const dateMatch = html.match(/<meta property=["']article:published_time["'] content=["']([^"']+)["']/i) ||
                        html.match(/<time[^>]*datetime=["']([^"']+)["']/i) ||
                        html.match(/<meta name=["']date["'] content=["']([^"']+)["']/i);
      const publishDate = dateMatch ? dateMatch[1].trim() : null;

      // Extração de texto principal resumido (remove scripts, estilos e tags)
      const textSample = html
        .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, ' ')
        .replace(/<style\b[^<]*(?:(?!<\/style>)<[^<]*)*<\/style>/gi, ' ')
        .replace(/<[^>]+>/g, ' ')
        .replace(/\s+/g, ' ')
        .slice(0, 3000)
        .trim();

      return {
        accessible: true,
        domain,
        title: title || domain,
        author,
        publishDate,
        textSample
      };
    } catch (err) {
      return {
        accessible: false,
        error: err.name === 'AbortError' ? 'Tempo de conexão esgotado ao buscar a página.' : 'Não foi possível carregar a página automaticamente.'
      };
    }
  }

  /**
   * Executa a análise completa da notícia (Etapas A, B, C e D)
   */
  static async analyzeNews({ url = '', text = '', title = '' }) {
    const cleanUrl = url.trim();
    let effectiveTitle = title.trim();
    let effectiveText = text.trim();
    let domain = '';
    let author = null;
    let publishDate = null;
    let extractionMethod = 'manual';

    // Etapa A: Identificação da Notícia
    if (cleanUrl) {
      try {
        const parsed = new URL(cleanUrl.startsWith('http') ? cleanUrl : `https://${cleanUrl}`);
        domain = parsed.hostname.replace(/^www\./, '').toLowerCase();

        const meta = await this.extractUrlMetadata(parsed.href);
        if (meta.accessible) {
          extractionMethod = 'automatic_url';
          if (!effectiveTitle && meta.title) effectiveTitle = meta.title;
          if (!effectiveText && meta.textSample) effectiveText = meta.textSample;
          if (meta.author) author = meta.author;
          if (meta.publishDate) publishDate = meta.publishDate;
        }
      } catch {
        // Formato de URL inválido, prossegue com os dados de texto
      }
    }

    if (!effectiveTitle && effectiveText) {
      // Usa a primeira linha ou primeiras palavras do texto como título
      const firstLine = effectiveText.split('\n')[0].slice(0, 120);
      effectiveTitle = firstLine;
    }

    if (!effectiveTitle) {
      effectiveTitle = 'Texto ou alegação sem título definido';
    }

    // Combina título e corpo para avaliação linguística
    const fullContent = `${effectiveTitle} ${effectiveText}`;
    const normalizedContent = this.cleanText(fullContent);
    const normalizedTitle = this.cleanText(effectiveTitle);

    // Etapa B: Sinais de Atenção (Indícios)
    const reasons = [];
    const evidence = [];
    const unverified = [];
    const nextSteps = [];
    const psychologyNotes = [];
    let attentionScore = 0; // 0 a 100

    // 1. Checagem de Alegações Desmentidas por Evidências Conhecidas
    let debunkMatch = null;
    for (const item of KNOWN_DEBUNKED_PATTERNS) {
      if (item.pattern.test(normalizedContent)) {
        debunkMatch = item;
        break;
      }
    }

    if (debunkMatch) {
      attentionScore += 80;
      reasons.push(`Alegação desmentida por verificações prévias: "${debunkMatch.topic}".`);
      evidence.push(`Desmentido oficial registrado por: ${debunkMatch.debunkedBy}. ${debunkMatch.explanation}`);
      psychologyNotes.push({
        concept: 'Efeito de Repetição (Ilusão da Verdade)',
        description: 'Informações desmentidas continuam circulando porque a repetição constante faz com que pareçam familiares e plausíveis aos olhos do público.'
      });
    }

    // 2. Clickbait e Sensacionalismo no Título
    const foundSensationalist = SENSATIONALIST_PATTERNS.filter(pattern => normalizedTitle.includes(pattern));
    const uppercaseLetters = (effectiveTitle.match(/[A-ZÁÉÍÓÚÂÊÎÔÛÃÕÇ]/g) || []).length;
    const isHeavyCaps = effectiveTitle.length > 20 && (uppercaseLetters / effectiveTitle.length) > 0.4;
    const hasAlarmPunctuation = /[?!]{2,}/.test(effectiveTitle);

    if (foundSensationalist.length > 0 || isHeavyCaps || hasAlarmPunctuation) {
      attentionScore += 25;
      const detailsList = [];
      if (foundSensationalist.length > 0) detailsList.push(`palavras de choque ("${foundSensationalist.slice(0, 3).join(', ')}")`);
      if (isHeavyCaps) detailsList.push('uso expressivo de letras maiúsculas');
      if (hasAlarmPunctuation) detailsList.push('pontuação alarmista excessiva');

      reasons.push(`Título com indícios de sensacionalismo ou clickbait (${detailsList.join(', ')}).`);
      psychologyNotes.push({
        concept: 'Apelo Emocional',
        description: 'Títulos alarmistas são projetados para ativar reações emocionais imediatas (como medo, raiva ou indignação), contornando o filtro analítico do leitor.'
      });
    }

    // 3. Pressão Psicológica para Compartilhamento Imediato
    const foundUrgency = URGENCY_TRIGGERS.filter(pattern => normalizedContent.includes(pattern));
    if (foundUrgency.length > 0) {
      attentionScore += 30;
      reasons.push(`Uso de frases que pressionam o compartilhamento urgente ("${foundUrgency[0]}").`);
      psychologyNotes.push({
        concept: 'Pressão de Urgência',
        description: 'Gatilhos de urgência procuram fazer a pessoa repassar a mensagem aos seus contatos antes que tenha tempo de parar e verificar a veracidade dos fatos.'
      });
    }

    // 4. Ausência de Autoria e Responsabilidade
    if (!author) {
      attentionScore += 15;
      reasons.push('Ausência de autoria identificável assinando o conteúdo.');
      unverified.push('Não foi possível identificar quem escreveu ou se responsabiliza pela publicação.');
    } else {
      evidence.push(`Autoria identificada: "${author}".`);
    }

    // 5. Ausência de Data de Publicação
    if (!publishDate && cleanUrl) {
      attentionScore += 15;
      reasons.push('Falta de data de publicação visível (notícias antigas costumam ser recicladas como se fossem atuais).');
      unverified.push('Data precisa da veiculação original não confirmada.');
      nextSteps.push('Pesquise a data original para verificar se a informação não é um caso antigo sendo reaproveitado.');
    } else if (publishDate) {
      evidence.push(`Data de publicação indicada: ${publishDate.slice(0, 10)}.`);
    }

    // 6. Fontes Vagas vs. Fontes Verificáveis
    const foundVagueSources = VAGUE_SOURCE_PATTERNS.filter(pattern => normalizedContent.includes(pattern));
    if (foundVagueSources.length > 0) {
      attentionScore += 20;
      reasons.push(`Presença de fontes vagas ou anônimas ("${foundVagueSources[0]}"), sem apontar instituições ou nomes específicos.`);
    }

    // 7. Avaliação do Veículo de Comunicação (Domínio)
    const isRecognizedOutlet = domain && TRUSTED_OUTLETS.some(to => domain === to || domain.endsWith('.' + to));
    if (isRecognizedOutlet) {
      attentionScore = Math.max(0, attentionScore - 35);
      evidence.push(`Veículo de comunicação com expediente editorial reconhecido (${domain}).`);
    } else if (domain) {
      unverified.push(`O domínio "${domain}" não consta entre os veículos de referência com conselho editorial auditado.`);
      nextSteps.push(`Verifique se veículos de imprensa conhecidos também noticiaram o mesmo fato.`);
    }

    // Sempre adicionar o Viés de Confirmação como nota educativa de reflexão psicológica
    psychologyNotes.push({
      concept: 'Viés de Confirmação',
      description: 'Tendemos a aceitar com facilidade alegações que confirmam nossas crenças e ideais prévios, enquanto exigimos provas rigorosas de notícias com as quais discordamos.'
    });

    // Etapa C: Links Úteis para Checagem
    const searchTerms = encodeURIComponent(effectiveTitle.slice(0, 60));
    const factCheckLinks = FACT_CHECKING_PLATFORMS.map(p => ({
      name: p.name,
      url: `${p.searchUrl}${searchTerms}`
    }));

    // Etapa D: Classificação Rigorosa
    let classification = '';
    let riskLevel = ''; // 'reliable' | 'needs_verification' | 'warning' | 'debunked'
    let badgeColor = '';

    if (debunkMatch) {
      classification = '🔴 ALEGAÇÃO DESMENTIDA POR EVIDÊNCIAS';
      riskLevel = 'debunked';
      badgeColor = '#dc2626';
      nextSteps.unshift('Evite compartilhar esta mensagem: organizações de checagem já confirmaram que ela contém informações falsas ou distorcidas.');
    } else if (attentionScore >= 30 || foundSensationalist.length > 0 || foundUrgency.length > 0) {
      classification = '🟠 SINAIS DE ALERTA';
      riskLevel = 'warning';
      badgeColor = '#ea580c';
      nextSteps.unshift('Recomenda-se muita cautela antes de compartilhar. Foram identificados indícios de sensacionalismo ou pressão de compartilhamento.');
    } else if (isRecognizedOutlet && foundSensationalist.length === 0 && effectiveText.length > 60) {
      classification = '🟢 BOAS EVIDÊNCIAS DE CONFIABILIDADE';
      riskLevel = 'reliable';
      badgeColor = '#16a34a';
      reasons.push(`Publicado por veículo com conselho editorial auditável (${domain}) e padrão redacional informativo.`);
      nextSteps.unshift('Apresenta boas evidências institucionais. Ainda assim, consulte outras fontes para ampliar a compreensão.');
    } else {
      classification = '🟡 PRECISA DE MAIS VERIFICAÇÃO';
      riskLevel = 'needs_verification';
      badgeColor = '#d97706';
      if (!isRecognizedOutlet && domain) {
        reasons.push(`O veículo "${domain}" não consta entre os veículos de imprensa de referência pública auditados.`);
      }
      if (effectiveText.length < 60) {
        reasons.push('Volume de texto insuficiente para validar fontes primárias ou citações no conteúdo.');
      }
      nextSteps.unshift('As evidências disponíveis são insuficientes para apoiar a alegação com segurança. Aguarde confirmações em fontes oficiais.');
    }

    // Próximos passos comuns e educativos
    nextSteps.push('Consulte os links das agências de checagem sugeridos abaixo para ver se há notas oficiais sobre o tema.');

    const analysisResult = {
      id: 'news_' + Date.now() + '_' + Math.random().toString(36).substr(2, 5),
      url: cleanUrl || null,
      domain: domain || 'Texto colado',
      title: effectiveTitle,
      author: author || 'Não identificado',
      publishDate: publishDate || 'Não identificada',
      classification,
      riskLevel,
      badgeColor,
      attentionScore: Math.min(100, Math.max(0, attentionScore)),
      reasons,
      evidence: evidence.length > 0 ? evidence : ['Nenhum dado confirmatório institucional foi identificado no texto.'],
      unverified: unverified.length > 0 ? unverified : ['Nenhuma lacuna crítica evidente foi constatada nos elementos fornecidos.'],
      nextSteps,
      psychologyNotes,
      factCheckLinks,
      analyzedAt: new Date().toISOString()
    };

    // Salvar análise no banco de dados SQLite para histórico persistente
    try {
      const db = await getDb();
      await db.run(
        `INSERT INTO news_analyses 
         (id, url, title, domain, author, publish_date, classification, risk_level, reasons, evidence, sources, unverified, next_steps, analyzed_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          analysisResult.id,
          analysisResult.url,
          analysisResult.title,
          analysisResult.domain,
          analysisResult.author,
          analysisResult.publishDate,
          analysisResult.classification,
          analysisResult.riskLevel,
          JSON.stringify(analysisResult.reasons),
          JSON.stringify(analysisResult.evidence),
          JSON.stringify(analysisResult.factCheckLinks),
          JSON.stringify(analysisResult.unverified),
          JSON.stringify(analysisResult.nextSteps),
          analysisResult.analyzedAt
        ]
      );
    } catch (err) {
      console.warn('[SafeWeb Informa] Falha ao persistir no SQLite:', err.message);
    }

    return analysisResult;
  }

  /**
   * Retorna os casos de teste pré-configurados para a demonstração na aula de Psicologia
   */
  static getEducationalDemoCases() {
    return [
      {
        id: 'demo_1',
        label: '1. Notícia com Boas Evidências',
        categoryTag: '🟢 Confiabilidade',
        title: 'Fiocruz inicia nova fase de ensaios clínicos para vacina nacional com apoio do Ministério da Saúde',
        text: 'A Fundação Oswaldo Cruz (Fiocruz) anunciou nesta terça-feira (15) o avanço da fase de ensaios clínicos com 2.500 participantes voluntários. A pesquisa é liderada pela Drª Maria Albuquerque e conta com financiamento do CNPq e Ministério da Saúde. O relatório foi publicado no periódico científico Lancet Infectious Diseases com dados revisados por pares.',
        url: 'https://fiocruz.br/noticias/ensaios-clinicos-fase-2'
      },
      {
        id: 'demo_2',
        label: '2. Título Sensacionalista e Sem Fontes',
        categoryTag: '🟠 Sinais de Alerta',
        title: 'URGENTE: BOMBA! O QUE A MÍDIA NÃO MOSTRA SOBRE A NOVA DOENÇA SECRETA QUE CHOROU O BRASIL!!!',
        text: 'Especialistas afirmam que uma doença misteriosa está sendo ocultada das pessoas. Fontes próximas garantem que remédios comuns causam problemas graves. Compartilhe antes que apaguem! Repasse para todos os seus grupos de família agora mesmo!',
        url: 'https://noticias-urgentes-bombas.xyz/revelacao'
      },
      {
        id: 'demo_3',
        label: '3. Notícia Antiga Apresentada como Recente',
        categoryTag: '🟡 Precisa Verificação',
        title: 'Prefeitura decreta fechamento temporário de comércios a partir da próxima segunda-feira',
        text: 'Em pronunciamento extraordinário, a administração municipal informa que os estabelecimentos não essenciais deverão suspender as atividades presenciais por 14 dias para controle de circulação. A medida foi discutida em reunião de emergência.',
        url: 'https://portal-regional-noticias.com/decreto-comercio'
      },
      {
        id: 'demo_4',
        label: '4. Alegação Desmentida (Fake News Clássica)',
        categoryTag: '🔴 Alegação Desmentida',
        title: 'Descoberta revolucionária: chá de folhas medicinais promete cura definitiva do câncer',
        text: 'Pesquisador anônimo desenvolve fórmula caseira que promete curar todas as formas de câncer em 7 dias sem quimioterapia. A indústria não quer que você descubra essa verdade. Divulgue ao máximo para salvar vidas!',
        url: 'https://saude-natural-milagres.site/cura-definitiva-cancer'
      },
      {
        id: 'demo_5',
        label: '5. Informação Vaga (Precisa de Mais Verificação)',
        categoryTag: '🟡 Precisa Verificação',
        title: 'Novo aplicativo pode aumentar a produtividade no trabalho em 80%, dizem estudos',
        text: 'Estudos comprovam que uma nova ferramenta digital lançada esta semana dobra o rendimento diário de profissionais em qualquer área. Usuários relatam melhorias nos primeiros dias de uso.',
        url: 'https://tech-tendencias-hoje.com/novo-app-produtividade'
      }
    ];
  }

  /**
   * Obtém histórico recente de análises do banco
   */
  static async getHistory(limit = 30) {
    try {
      const db = await getDb();
      const rows = await db.all(
        `SELECT * FROM news_analyses ORDER BY analyzed_at DESC LIMIT ?`,
        [limit]
      );
      return rows.map(r => ({
        ...r,
        reasons: JSON.parse(r.reasons || '[]'),
        evidence: JSON.parse(r.evidence || '[]'),
        factCheckLinks: JSON.parse(r.sources || '[]'),
        unverified: JSON.parse(r.unverified || '[]'),
        nextSteps: JSON.parse(r.next_steps || '[]')
      }));
    } catch {
      return [];
    }
  }
}
