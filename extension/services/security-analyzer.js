/**
 * SafeWeb - Security & Risk Analyzer (v1.1)
 * Desenvolvido integralmente por Iury.
 * Módulo heurístico avançado de análise de risco e reputação de URLs.
 * 
 * Regra fundamental: NUNCA afirmar que um site é 100% seguro.
 * Classificações adotadas:
 * - "Nenhum risco conhecido" (baixo risco detectado)
 * - "Atenção" (anomalias, padrões incomuns ou encurtadores)
 * - "Possível ameaça" (múltiplos fatores de risco crítico, typosquatting de bancos, etc.)
 */

export class SecurityAnalyzer {
  // Lista de TLDs com alta taxa histórica de abuso/phishing
  static SUSPICIOUS_TLDS = [
    '.tk', '.ml', '.ga', '.cf', '.gq', '.xyz', '.top', '.work', 
    '.click', '.loan', '.zip', '.mov', '.surf', '.cam', '.fit',
    '.buzz', '.monster', '.rest', '.sbs', '.cfd'
  ];

  // Palavras-chave comumente usadas em campanhas de engenharia social
  static PHISHING_KEYWORDS = [
    'login', 'signin', 'verify', 'verification', 'update-account',
    'secure-account', 'banking', 'recovery', 'auth-check', 'confirm-identity',
    'wallet', 'redefinir', 'recuperar-conta', 'atualizacao', 'seguranca',
    'fatura', 'boleto', 'pix', 'promocao', 'premiado', 'rastreio-encomenda'
  ];

  // Serviços conhecidos de encurtamento de URL (ofuscam o destino real)
  static URL_SHORTENERS = [
    'bit.ly', 'tinyurl.com', 't.co', 'is.gd', 'cutt.ly', 'ow.ly',
    'rebrand.ly', 'encurta.net', 'shorte.st', 'trib.al', 'buff.ly',
    'adf.ly', 'v.gd', 'rotf.lol', 'tiny.cc', 's.id'
  ];

  // Extensões de arquivos perigosos ou executáveis diretos na URL
  static DANGEROUS_EXTENSIONS = [
    '.exe', '.scr', '.bat', '.cmd', '.vbs', '.vbe', '.js', '.jse',
    '.wsf', '.wsh', '.iso', '.msi', '.apk', '.pif', '.hta', '.com'
  ];

  // Assinaturas e padrões internacionais de testes de malware (EICAR / Antivirus Testbeds)
  static MALWARE_TEST_PATTERNS = [
    'eicar', 'anti-malware-testfile', 'malware-test', 'virus-test', 'testfile'
  ];

  // Marcas e serviços frequentemente visados por phishing/combosquatting
  static TARGET_BRANDS = [
    { name: 'Nubank', key: 'nubank', official: ['nubank.com.br', 'nu.com.br'] },
    { name: 'Itaú', key: 'itau', official: ['itau.com.br', 'itaubankline.com.br'] },
    { name: 'Bradesco', key: 'bradesco', official: ['bradesco.com.br', 'bancobradesco.com.br'] },
    { name: 'Santander', key: 'santander', official: ['santander.com.br'] },
    { name: 'Caixa Econômica', key: 'caixa', official: ['caixa.gov.br'] },
    { name: 'Banco do Brasil', key: 'bancodobrasil', official: ['bb.com.br'] },
    { name: 'Banco Inter', key: 'bancointer', official: ['bancointer.com.br', 'inter.co'] },
    { name: 'Mercado Livre', key: 'mercadolivre', official: ['mercadolivre.com.br', 'mercadolibre.com'] },
    { name: 'Mercado Pago', key: 'mercadopago', official: ['mercadopago.com.br'] },
    { name: 'Correios', key: 'correios', official: ['correios.com.br'] },
    { name: 'Gov.br', key: 'gov', official: ['gov.br'] },
    { name: 'PayPal', key: 'paypal', official: ['paypal.com'] },
    { name: 'Google', key: 'google', official: ['google.com', 'google.com.br'] },
    { name: 'Microsoft', key: 'microsoft', official: ['microsoft.com', 'live.com', 'office.com', 'outlook.com'] },
    { name: 'Apple', key: 'apple', official: ['apple.com', 'icloud.com'] },
    { name: 'Netflix', key: 'netflix', official: ['netflix.com'] },
    { name: 'Amazon', key: 'amazon', official: ['amazon.com', 'amazon.com.br'] },
    { name: 'Shopee', key: 'shopee', official: ['shopee.com.br', 'shopee.com'] },
    { name: 'WhatsApp', key: 'whatsapp', official: ['whatsapp.com'] },
    { name: 'Instagram', key: 'instagram', official: ['instagram.com'] },
    { name: 'Facebook', key: 'facebook', official: ['facebook.com'] }
  ];

  /**
   * Calcula a distância de edição de Levenshtein entre duas strings
   * @param {string} a 
   * @param {string} b 
   * @returns {number}
   */
  static levenshteinDistance(a, b) {
    if (!a || !b) return (a || '').length + (b || '').length;
    const al = a.length;
    const bl = b.length;
    const dp = Array.from({ length: al + 1 }, () => new Array(bl + 1).fill(0));

    for (let i = 0; i <= al; i++) dp[i][0] = i;
    for (let j = 0; j <= bl; j++) dp[0][j] = j;

    for (let i = 1; i <= al; i++) {
      for (let j = 1; j <= bl; j++) {
        const cost = a[i - 1] === b[j - 1] ? 0 : 1;
        dp[i][j] = Math.min(
          dp[i - 1][j] + 1,       // deleção
          dp[i][j - 1] + 1,       // inserção
          dp[i - 1][j - 1] + cost // substituição
        );
      }
    }
    return dp[al][bl];
  }

  /**
   * Valida sintaticamente uma URL
   * @param {string} inputUrl 
   * @returns {{ valid: boolean, error?: string, urlObj?: URL, cleanUrl?: string, rawInput?: string }}
   */
  static validateUrl(inputUrl) {
    if (!inputUrl || typeof inputUrl !== 'string') {
      return { valid: false, error: 'URL não pode ser vazia.' };
    }

    const rawInput = inputUrl.trim();
    let urlToParse = rawInput;
    if (!/^https?:\/\//i.test(urlToParse)) {
      urlToParse = 'https://' + urlToParse;
    }

    try {
      const parsed = new URL(urlToParse);
      
      if (!parsed.hostname || parsed.hostname.length < 3) {
        return { valid: false, error: 'Domínio ou hostname inválido.' };
      }

      // Validação básica de formato de hostname
      const hostnamePattern = /^([a-zA-Z0-9-]+\.)+[a-zA-Z]{2,}$|^localhost$|^(\d{1,3}\.){3}\d{1,3}$/;
      if (!hostnamePattern.test(parsed.hostname) && !parsed.hostname.startsWith('xn--')) {
        return { valid: false, error: 'Formato de domínio não reconhecido.' };
      }

      const cleanUrl = parsed.origin + (parsed.pathname !== '/' ? parsed.pathname : '');
      return { valid: true, urlObj: parsed, cleanUrl, rawInput };
    } catch {
      return { valid: false, error: 'A URL informada possui formato inválido.' };
    }
  }

  /**
   * Calcula a entropia de Shannon de uma string (detecção de DGAs / domínios aleatórios)
   * @param {string} str 
   * @returns {number}
   */
  static calculateEntropy(str) {
    if (!str) return 0;
    const len = str.length;
    const frequencies = {};

    for (let i = 0; i < len; i++) {
      const char = str[i];
      frequencies[char] = (frequencies[char] || 0) + 1;
    }

    let entropy = 0;
    for (const char in frequencies) {
      const p = frequencies[char] / len;
      entropy -= p * Math.log2(p);
    }

    return entropy;
  }

  /**
   * Executa a análise heurística de segurança e risco da URL
   * @param {string} targetUrl 
   * @param {string} sensitivity 'standard' | 'strict'
   * @returns {Object} Resultado estruturado da análise
   */
  static analyze(targetUrl, sensitivity = 'standard') {
    const validation = this.validateUrl(targetUrl);
    if (!validation.valid || !validation.urlObj) {
      return {
        level: 'high',
        label: 'Possível ameaça',
        score: 95,
        reasons: ['URL com estrutura malformada ou inválida.'],
        details: { flags: ['invalid_format'] }
      };
    }

    const url = validation.urlObj;
    const rawInput = validation.rawInput || '';
    const hostname = url.hostname.toLowerCase();
    const pathname = url.pathname.toLowerCase();
    const fullHref = url.href.toLowerCase();

    let score = 0; // 0 (sem riscos aparentes) a 100 (risco muito alto)
    const reasons = [];
    const flags = [];
    const brandsDetected = [];

    // 1. Verificação de Protocolo (HTTPS vs HTTP)
    const isHttps = url.protocol === 'https:';
    if (!isHttps && hostname !== 'localhost' && hostname !== '127.0.0.1') {
      score += 25;
      flags.push('no_https');
      reasons.push('Conexão não criptografada (HTTP). Dados trafegam em texto claro.');
    }

    // 2. Verificação de Endereço IP Direto
    const isIpAddress = /^(\d{1,3}\.){3}\d{1,3}$/.test(hostname);
    if (isIpAddress && hostname !== '127.0.0.1') {
      score += 35;
      flags.push('ip_hostname');
      reasons.push('Uso de endereço IP direto no lugar de um nome de domínio registrado.');
    }

    // 3. Detecção de Homografia / Punycode (IDN attacks)
    const isPunycode = hostname.startsWith('xn--') || hostname.includes('.xn--');
    if (isPunycode) {
      score += 35;
      flags.push('punycode_domain');
      reasons.push('Domínio utiliza codificação Punycode (IDN), comumente associada a ataques de homografia (imitação visual de caracteres).');
    }

    // 4. Detecção de Typosquatting / Combosquatting contra marcas conhecidas
    const parts = hostname.split('.');
    const sld = parts.length >= 2 ? parts[parts.length - 2] : parts[0];

    for (const brand of this.TARGET_BRANDS) {
      const isOfficial = brand.official.some(off => hostname === off || hostname.endsWith('.' + off));
      if (!isOfficial) {
        // Checagem 1: Combosquatting (marca embutida no domínio, ex: nubank-seguranca.com)
        if (hostname.includes(brand.key)) {
          score += 45;
          flags.push('brand_combosquatting');
          brandsDetected.push(brand.name);
          reasons.push(`Alerta de Combosquatting: o domínio faz uso do nome de marca "${brand.name}", mas NÃO pertence aos servidores oficiais registrados da empresa.`);
          break;
        }

        // Checagem 2: Typosquatting por proximidade de edição (Levenshtein)
        if (sld.length >= 4 && brand.key.length >= 4) {
          const distance = this.levenshteinDistance(sld, brand.key);
          if (distance === 1 || (distance === 2 && sld.length > 5)) {
            score += 40;
            flags.push('brand_typosquatting');
            brandsDetected.push(brand.name);
            reasons.push(`Alerta de Typosquatting: o domínio "${sld}" imita a grafia de "${brand.name}" com pequenas alterações (distância de edição ${distance}).`);
            break;
          }
        }
      }
    }

    // 5. Detecção de Encurtadores de URL
    const isShortener = this.URL_SHORTENERS.some(short => hostname === short || hostname.endsWith('.' + short));
    if (isShortener) {
      score += 20;
      flags.push('url_shortener');
      reasons.push(`Uso de encurtador de link (${hostname}). Encurtadores ofuscam o destino real e são frequentemente utilizados para burlar filtros de segurança.`);
    }

    // 6. Detecção de Arquivos Perigosos ou Executáveis na URL
    const matchedDangerousExt = this.DANGEROUS_EXTENSIONS.find(ext => pathname.endsWith(ext) || pathname.includes(ext + '?'));
    if (matchedDangerousExt) {
      score += 40;
      flags.push('dangerous_file_download');
      reasons.push(`O link aponta diretamente para o download de um arquivo executável ou de script de alto risco (${matchedDangerousExt}).`);
    }

    // 6.1 Detecção de Assinaturas de Teste de Malware (EICAR / Testbeds Acadêmicos)
    const isEicarOrTest = this.MALWARE_TEST_PATTERNS.some(p => fullHref.includes(p));
    if (isEicarOrTest) {
      score += 75;
      flags.push('malware_test_signature');
      reasons.push('Assinatura de Teste de Malware (EICAR / Testbed): A URL aponta para a assinatura oficial de teste de vírus/malware (EICAR Standard Test File), amplamente usada para validar mecanismos de segurança.');
    }

    // 7. Mascaramento com Caractere '@' (Autenticação RFC / URL Spoofing)
    if (rawInput.includes('@') || url.username) {
      score += 35;
      flags.push('auth_spoofing');
      reasons.push("Presença do caractere '@' na URL. Essa técnica é comumente empregada para enganar a visualização do usuário e redirecionar para outro servidor.");
    }

    // 8. Verificação de TLDs com histórico suspeito
    const matchedTld = this.SUSPICIOUS_TLDS.find(tld => hostname.endsWith(tld));
    if (matchedTld) {
      score += 20;
      flags.push('suspicious_tld');
      reasons.push(`Uso de terminação de domínio frequentemente associada a abusos (${matchedTld}).`);
    }

    // 9. Contagem excessiva de Subdomínios (técnica de mascaramento)
    const subdomainCount = Math.max(0, parts.length - 2);
    if (subdomainCount >= 3) {
      score += 20;
      flags.push('excessive_subdomains');
      reasons.push(`Estrutura profunda de subdomínios detectada (${subdomainCount} níveis).`);
    }

    // 10. Palavras-chave suspeitas em domínios ou subdomínios
    const foundKeywords = this.PHISHING_KEYWORDS.filter(kw => fullHref.includes(kw));
    if (foundKeywords.length > 0 && !this.isKnownTrustedDomain(hostname)) {
      score += foundKeywords.length * 15;
      flags.push('phishing_keywords');
      reasons.push(`Presença de termos comumente visados em golpes (${foundKeywords.slice(0, 3).join(', ')}) em domínio não reconhecido.`);
    }

    // 11. Número excessivo de hífens no hostname (ex: login-update-myaccount-bank.com)
    const hyphenCount = (hostname.match(/-/g) || []).length;
    if (hyphenCount >= 3) {
      score += 15;
      flags.push('excessive_hyphens');
      reasons.push(`Hostname contém múltiplos hífens (${hyphenCount}), comum em páginas fraudulentas de engenharia social.`);
    }

    // 12. Entropia do domínio (DGA / Domínios gerados aleatoriamente)
    const entropy = this.calculateEntropy(sld);
    if (sld.length > 10 && entropy > 3.8) {
      score += 20;
      flags.push('high_entropy');
      reasons.push(`Nome do domínio possui alta entropia aleatória (${entropy.toFixed(2)} bits), sugerindo geração algorítmica (DGA).`);
    }

    // 13. Uso de porta não padrão
    if (url.port && !['80', '443', '3000', '8080'].includes(url.port)) {
      score += 10;
      flags.push('non_standard_port');
      reasons.push(`Conexão utilizando porta de rede não convencional (:${url.port}).`);
    }

    // Determinação dos Níveis Acadêmicos Exigidos
    // Modo Strict possui limiares mais rigorosos
    const highThreshold = sensitivity === 'strict' ? 40 : 50;
    const attentionThreshold = sensitivity === 'strict' ? 15 : 20;

    let level = 'low';
    let label = 'Nenhum risco conhecido';

    if (score >= highThreshold) {
      level = 'high';
      label = 'Possível ameaça';
    } else if (score >= attentionThreshold) {
      level = 'attention';
      label = 'Atenção';
    } else {
      level = 'low';
      label = 'Nenhum risco conhecido';
      if (reasons.length === 0) {
        reasons.push('Estrutura de URL padrão com protocolo seguro e sem indicadores suspeitos conhecidos.');
      }
    }

    return {
      level,
      label,
      score: Math.min(score, 100),
      reasons,
      details: {
        protocol: url.protocol,
        isHttps,
        isIpAddress,
        isPunycode,
        isShortener,
        subdomainCount,
        brandsDetected,
        entropy: parseFloat(entropy.toFixed(2)),
        flags,
        sensitivity
      }
    };
  }

  /**
   * Auxiliar para checar se o hostname é um dos serviços comuns consolidados
   * @param {string} hostname 
   * @returns {boolean}
   */
  static isKnownTrustedDomain(hostname) {
    const trusted = [
      'google.com', 'github.com', 'microsoft.com', 'apple.com', 
      'wikipedia.org', 'mozilla.org', 'cloudflare.com', 'usp.br',
      'unicamp.br', 'ufrj.br', 'gov.br'
    ];
    return trusted.some(t => hostname === t || hostname.endsWith('.' + t));
  }
}
