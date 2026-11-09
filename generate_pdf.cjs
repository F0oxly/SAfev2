const fs = require('fs');
const path = require('path');
const PDFDocument = require('./backend/node_modules/pdfkit/js/pdfkit.js');

const outputPath = path.join(__dirname, 'Apresentacao_SafeWeb.pdf');
const doc = new PDFDocument({
  size: 'A4',
  margins: { top: 40, bottom: 40, left: 45, right: 45 }
});

const writeStream = fs.createWriteStream(outputPath);
doc.pipe(writeStream);

// Paleta de Cores
const C_PRIMARY = '#1e3a8a';   // Azul escuro
const C_ACCENT = '#2563eb';    // Azul principal
const C_TEXT = '#1e293b';      // Texto principal escuro
const C_MUTED = '#64748b';     // Cinza suave
const C_GREEN = '#16a34a';     // Verde confiável
const C_AMBER = '#d97706';     // Âmbar alerta
const C_RED = '#dc2626';       // Vermelho perigo
const C_BG_CARD = '#f8fafc';   // Fundo cartão
const C_LINE = '#e2e8f0';      // Borda

function drawHeader(title, subtitle) {
  doc.rect(45, 30, 505, 55).fill(C_PRIMARY);
  doc.fillColor('#ffffff').fontSize(16).font('Helvetica-Bold')
     .text(title, 60, 42);
  doc.fillColor('#93c5fd').fontSize(10).font('Helvetica')
     .text(subtitle, 60, 62);
  doc.y = 100;
}

function drawSlideCard(slideNum, slideTitle, points, speakerNotes, tag = null) {
  // Verifica espaço na página
  if (doc.y > 640) {
    doc.addPage();
    drawHeader('SafeWeb 🛡️ • Apresentação do Projeto', 'Iury & Equipe • Slides para PowerPoint');
  }

  const startY = doc.y;

  // Cabeçalho do Slide
  doc.rect(45, startY, 505, 24).fill('#e0e7ff');
  doc.fillColor(C_PRIMARY).fontSize(11).font('Helvetica-Bold')
     .text(`SLIDE ${slideNum}: ${slideTitle.toUpperCase()}`, 55, startY + 6);

  if (tag) {
    doc.fillColor(C_ACCENT).fontSize(9).font('Helvetica-Bold')
       .text(tag, 400, startY + 7, { align: 'right', width: 140 });
  }

  doc.y = startY + 32;

  // Pontos do Slide
  points.forEach(p => {
    doc.fillColor(C_ACCENT).fontSize(10).font('Helvetica-Bold').text('• ', 60, doc.y, { continued: true });
    if (typeof p === 'string') {
      doc.fillColor(C_TEXT).font('Helvetica').text(p);
    } else {
      doc.fillColor(C_TEXT).font('Helvetica-Bold').text(p.title + ': ', { continued: true });
      doc.fillColor(C_TEXT).font('Helvetica').text(p.desc);
    }
    doc.moveDown(0.25);
  });

  // Notas de Fala do Apresentador
  if (speakerNotes) {
    doc.moveDown(0.3);
    const noteY = doc.y;
    doc.rect(55, noteY, 485, 36).fill('#f1f5f9');
    doc.fillColor(C_MUTED).fontSize(8.5).font('Helvetica-Oblique')
       .text(`Fala sugerida: "${speakerNotes}"`, 65, noteY + 6, { width: 465 });
    doc.y = noteY + 44;
  }

  doc.moveDown(0.8);
}

// ─── PÁGINA 1: CAPA & VISÃO GERAL ───────────────────────────────────────────
drawHeader('SafeWeb 🛡️ • Apresentação Completa do Projeto', 'Extensão Chrome Manifest V3, Uptime, IA Gemini e Defesa contra Desinformação');

doc.moveDown(0.5);
doc.fillColor(C_TEXT).fontSize(12).font('Helvetica-Bold')
   .text('Resumo Executivo para Apresentação em Sala de Aula e Bancas Acadêmicas');
doc.fillColor(C_MUTED).fontSize(10).font('Helvetica')
   .text('Desenvolvido por: Iury & Equipe • Tecnologias: Chrome MV3, Gemini 3.5 Flash Lite, Node.js, SQLite');
doc.moveDown(0.8);

drawSlideCard(1, 'Capa & Apresentação da Equipe', [
  { title: 'Projeto', desc: 'SafeWeb — Segurança Proativa, Uptime e Combate à Desinformação.' },
  { title: 'Autoria', desc: 'Iury & Equipe.' },
  { title: 'Proposta', desc: 'Uma ferramenta leve e integrada ao navegador para proteção contra ameaças digitais e letramento contra notícias falsas.' }
], 'Boa noite a todos! Vamos apresentar o SafeWeb, uma solução híbrida para Chrome que monitora disponibilidade e analisa desinformação com IA.');

drawSlideCard(2, 'O Problema Contemporâneo da Web', [
  { title: 'Quedas Silenciosas de Serviços', desc: 'Usuários perdem tempo sem saber se um sistema caiu ou se a falha é na internet local.' },
  { title: 'Phishing e Golpes Pix', desc: 'Falsificação e clonagem de bancos e portais oficiais (typosquatting e combosquatting).' },
  { title: 'Disseminação de Fake News', desc: 'Notícias manipuladas com títulos alarmistas que induzem ao compartilhamento por medo ou apelo emocional.' }
], 'Na web atual enfrentamos três dores: quedas de sistemas, clonagem de marcas bancárias e a rápida viralização de notícias falsas.');

drawSlideCard(3, 'A Proposta e Pilares do SafeWeb', [
  { title: 'Extremamente Leve', desc: 'Sem sobrecarga de memória; processamento inteligente e direto no cliente.' },
  { title: 'Três Pilares Integrados', desc: '1. Monitoramento de Uptime | 2. Análise Heurística de URLs | 3. SafeWeb Informa com Gemini AI.' },
  { title: 'Independência de Camadas', desc: 'Funciona 100% autônomo na extensão e suporta backend Node.js opcional para Threat Intelligence.' }
], 'O SafeWeb opera no navegador do usuário de forma rápida, sem exigir servidores pesados para o dia a dia.');

// ─── PÁGINA 2: ARQUITETURA & MÓDULOS ─────────────────────────────────────────
doc.addPage();
drawHeader('SafeWeb 🛡️ • Arquitetura & Módulos Funcionais', 'Detalhamento Técnico dos Componentes da Extensão');

drawSlideCard(4, 'Arquitetura do Sistema (Manifest V3 + IA)', [
  { title: 'Chrome Manifest V3', desc: 'Background Service Worker (chrome.alarms, chrome.storage.local, chrome.notifications).' },
  { title: 'Extração via chrome.scripting', desc: 'Inspeção legítima do DOM da aba ativa para capturar título, autor e texto da matéria.' },
  { title: 'Camada de Inteligência Artificial', desc: 'Google Gemini API (gemini-3.5-flash-lite) com inferência em tempo real (< 1s).' },
  { title: 'Backend Auxiliar (Node.js)', desc: 'Sincronização com blocklists mundiais (URLhaus da abuse.ch e OpenPhish).' }
], 'A extensão usa APIs modernas do Manifest V3 e conecta diretamente à API do Gemini para categorização precisa.');

drawSlideCard(5, 'Módulo 1: Monitoramento & Uptime', [
  { title: 'Observabilidade em Tempo Real', desc: 'Contadores de sites Total, Online e Offline com cálculo percentual contínuo de Uptime.' },
  { title: 'Automação em Segundo Plano', desc: 'Testes programados (intervalo de 1 a 30 min) com notificações nativas no desktop quando sites caem.' },
  { title: 'Captura em 1 Clique', desc: 'Botão "Capturar Aba Atual" para adicionar qualquer site em teste imediatamente.' },
  { title: 'Exportação para Auditoria', desc: 'Download de relatórios consolidados em formatos JSON e CSV.' }
], 'O usuário cadastra os sites essenciais e a extensão avisa na hora se houver queda ou restauração do serviço.');

drawSlideCard(6, 'Módulo 2: Segurança Heurística de URLs', [
  { title: 'Princípio Acadêmico', desc: 'O SafeWeb NUNCA declara um site como "100% seguro" — avalia fatores de risco auditáveis.' },
  { title: 'Algoritmo Levenshtein', desc: 'Detecção de imitação de marcas populares (Nubank, Itaú, Bradesco, Caixa, Mercado Livre, Gov.br).' },
  { title: 'Entropia de Shannon', desc: 'Identificação de domínios aleatórios gerados por algoritmos maliciosos (DGA).' },
  { title: 'Estrutura da URL', desc: 'Verificação de protocolo HTTPS, IPs literais, ataques Punycode IDN (xn--) e encurtadores.' }
], 'Não fazemos promessas mágicas de segurança: aplicamos algoritmos matemáticos como Levenshtein e Entropia para detectar ameaças.');

// ─── PÁGINA 3: IA CONTRA FAKE NEWS & DEMONSTRAÇÃO ───────────────────────────
doc.addPage();
drawHeader('SafeWeb 🛡️ • Inteligência Artificial & Demonstração', 'SafeWeb Informa e Casos Práticos de Teste');

drawSlideCard(7, 'Módulo 3: SafeWeb Informa (Gemini AI)', [
  { title: 'Objetivo Educativo', desc: 'Promover senso crítico e letramento digital no combate à desinformação.' },
  { title: 'Classificações Claras', desc: '🟢 FONTE CONFIÁVEL | 🟡 ALERTA DE SENSACIONALISMO | 🔴 ALERTA DE FAKE NEWS.' },
  { title: 'Explicação Didática da IA', desc: 'Frase direta em português simples explicando o porquê daquele veredito sem jargões técnicos.' },
  { title: 'Checagem Cruzada em 1 Clique', desc: 'Atalhos de busca rápida no Fato ou Fake (G1), Agência Lupa, Aos Fatos e UOL Confere.' }
], 'O Informa usa o Gemini para analisar o texto da notícia e gerar um resumo educativo em linguagem acessível.');

drawSlideCard(8, 'Casos de Teste Reais (Demonstração em Aula)', [
  { title: 'Notícia Real (Fiocruz/G1)', desc: '🟢 FONTE CONFIÁVEL: Dados com fontes oficiais do Ministério da Saúde e conselho editorial auditável.' },
  { title: 'Clickbait Alarmista (.xyz)', desc: '🔴 ALERTA DE FAKE NEWS: Uso excessivo de maiúsculas, urgência de repasse e teorias conspiratórias.' },
  { title: 'Boato Médico Perigoso', desc: '🔴 ALERTA DE FAKE NEWS: Promessa de cura milagrosa de câncer em 7 dias, desmentida pelo INCA.' },
  { title: 'Blog Desconhecido (.top)', desc: '🟡 ALERTA DE SENSACIONALISMO: Promessa exagerada de rendimento sem embasamento ou equipe jornalística.' }
], 'A extensão não trata tudo como igual: ela distingue com clareza uma notícia legítima de um boato perigoso ou de um caça-cliques.');

drawSlideCard(9, 'Segurança de Credenciais & Gestão de Segredos', [
  { title: 'Zero Secret Leaks', desc: 'Nenhuma chave de API fica exposta no código-fonte enviado ao GitHub.' },
  { title: 'Armazenamento Local no Navegador', desc: 'A chave Gemini é salva com segurança no chrome.storage.local através da aba Ajustes.' },
  { title: 'Arquivo Local Protegido', desc: 'Suporte a secrets.js com regra rigorosa no .gitignore para desenvolvimento.' },
  { title: 'Conformidade com o GitHub', desc: 'Total alinhamento com as políticas de Secret Scanning e Push Protection do GitHub e Google Cloud.' }
], 'Protegemos totalmente as credenciais de API, garantindo que nenhum segredo seja exposto ou bloqueado no GitHub.');

drawSlideCard(10, 'Conclusão & Resultados Obtidos', [
  { title: 'Entrega Completa', desc: 'Extensão moderna, estável, intuitiva e com documentação técnica detalhada.' },
  { title: 'Impacto Social & Educativo', desc: 'Combinação pioneira de cibersegurança estrutural com checagem de fatos por IA.' },
  { title: 'Equipe do Projeto', desc: 'Desenvolvido por Iury & Equipe.' }
], 'Concluímos o SafeWeb entregando uma ferramenta inovadora de impacto real. Estamos prontos para a demonstração prática!');

doc.end();

writeStream.on('finish', () => {
  console.log('PDF gerado com sucesso em:', outputPath);
});
