# 📊 Roteiro de Apresentação — SafeWeb 🛡️
### Guia Completo para Slides de PowerPoint e Defesa do Projeto Acadêmico

> **Projeto:** SafeWeb — Extensão de Segurança, Monitoramento de Uptime e Combate à Desinformação  
> **Desenvolvedores:** Iury & Equipe  
> **Tecnologias Centrais:** Google Chrome Extensions (Manifest V3), Google Gemini AI API, JavaScript Moderno, Node.js, Express, SQLite.

---

## 🖥️ Slide 1: Capa do Projeto

### Conteúdo do Slide:
- **Título:** SafeWeb 🛡️
- **Subtítulo:** Extensão de Segurança Proativa, Monitoramento de Uptime e Inteligência Artificial no Combate à Desinformação
- **Autoria:** Iury & Equipe
- **Contexto:** Projeto Integrado / Trabalho de Conclusão Acadêmica

### 🎙️ Fala do Apresentador (Notas):
> *"Boa noite a todos! Hoje vamos apresentar o SafeWeb, uma solução desenvolvida em extensão para Google Chrome Manifest V3 que une duas áreas cruciais da tecnologia moderna: a segurança cibernética contra golpes e o combate à desinformação online utilizando inteligência artificial generativa."*

---

## 🖥️ Slide 2: O Problema

### Conteúdo do Slide:
- **Crescimento de Ameaças Web:**
  - Proliferação de links falsificados (Phishing e Golpes Pix).
  - Imitação visual de grandes marcas e bancos (*Combosquatting* e *Typosquatting*).
- **Quedas e Indisponibilidade de Serviços:**
  - Usuários e empresas são os últimos a saber quando um serviço sai do ar.
- **Epidemia de Desinformação & Fake News:**
  - Notícias falsas compartilhadas por apelo emocional, alarmismo e títulos caça-cliques.
  - Dificuldade do usuário comum em verificar fontes e checar alegações.

### 🎙️ Fala do Apresentador (Notas):
> *"Na internet de hoje, enfrentamos três grandes dores: primeiro, links maliciosos que imitam bancos e serviços governamentais; segundo, a perda de tempo e prejuízos causados por serviços que caem sem aviso prévio; e terceiro, a velocidade com que notícias falsas e sensacionalistas se espalham nas redes sociais."*

---

## 🖥️ Slide 3: A Proposta do SafeWeb

### Conteúdo do Slide:
- **Solução Leve, Transparente e Acessível:**
  - 100% integrada à rotina do usuário através do navegador.
  - Sem necessidade de servidores pesados para o funcionamento diário.
- **Três Pilares de Atuação:**
  1. **Disponibilidade:** Monitoramento contínuo em segundo plano com notificações nativas.
  2. **Segurança Heurística:** Auditoria estrutural de URLs e detecção de ataques antes do clique.
  3. **SafeWeb Informa:** Inteligência artificial com a Gemini API para avaliar notícias em tempo real.

### 🎙️ Fala do Apresentador (Notas):
> *"O SafeWeb foi desenhado com uma regra de ouro: ser extremamente leve, rápido e não sobrecarregar a máquina do usuário. Ele monitora a saúde dos sites cadastrados e analisa em tempo real se uma notícia ou link apresenta indícios de manipulação."*

---

## 🖥️ Slide 4: Arquitetura & Tecnologias

### Conteúdo do Slide:
- **Lado do Cliente (Chrome Extension Manifest V3):**
  - `chrome.storage.local`: Persistência de sites, histórico e configurações locais.
  - `chrome.alarms`: Execução econômica e programada de testes periódicos.
  - `chrome.scripting`: Extração ética de título, autor e texto da aba aberta.
  - `chrome.notifications`: Alertas visuais nativos no sistema operacional.
- **Camada de Inteligência Artificial:**
  - **Google Gemini API (`gemini-3.5-flash-lite`):** Inferência semântica ultra-rápida (< 1s) para análise de credibilidade jornalística.
- **Backend Opcional (Node.js + SQLite):**
  - Sincronização com blocklists globais de ameaças (**URLhaus** e **OpenPhish**).

### 🎙️ Fala do Apresentador (Notas):
> *"A arquitetura do SafeWeb é híbrida e autônoma. A extensão roda 100% de forma independente no Chrome, consultando a IA do Gemini de maneira segura e direta, mas também possui suporte a um backend em Node.js com SQLite para quem desejar integrar bases comunitárias de denúncias e listas globais de malware."*

---

## 🖥️ Slide 5: Módulo de Monitoramento & Uptime

### Conteúdo do Slide:
- **Painel de Controle em Tempo Real:**
  - Contadores dinâmicos de sites **Total**, **Online** e **Offline**.
  - Cálculo percentual contínuo de **Uptime**.
- **Automação Inteligente:**
  - Testes periódicos com frequência configurável (1 a 30 minutos).
  - Alerta imediato no desktop se um site monitorado cair ou for restabelecido.
  - Captura da aba atual em 1 clique para cadastro imediato.
- **Auditoria Acadêmica:**
  - Exportação de dados do monitoramento em formatos **JSON** e **CSV**.

### 🎙️ Fala do Apresentador (Notas):
> *"Na primeira aba da extensão, o usuário tem um painel de observabilidade completo. Se você administra um site ou depende de um sistema da faculdade ou empresa, o SafeWeb monitora silenciosamente em background e te avisa assim que o serviço fica fora do ar."*

---

## 🖥️ Slide 6: Módulo de Segurança Heurística

### Conteúdo do Slide:
- **Análise Sem Falsas Promessas:**
  - O SafeWeb adota a boa prática acadêmica: **nunca afirma que um site é 100% seguro**.
- **Regras Heurísticas Implementadas:**
  - Verificação de criptografia (HTTP vs HTTPS).
  - Detecção de IPs literais na URL (técnica comum em servidores maliciosos).
  - Ataques Homográficos / Punycode (`xn--`).
  - Entropia de Shannon (detecção de domínios aleatórios gerados por bots / DGA).
  - **Typosquatting & Combosquatting:** Algoritmo de distância Levenshtein contra marcas populares (Nubank, Itaú, Bradesco, Caixa, Mercado Livre, Gov.br, Google, Apple).

### 🎙️ Fala do Apresentador (Notas):
> *"Nossa análise de segurança não é baseada em adivinhação. Implementamos algoritmos consagrados como a Entropia de Shannon e a Distância Levenshtein para identificar se um endereço malicioso está tentando se passar por um banco ou instituição governamental."*

---

## 🖥️ Slide 7: Módulo SafeWeb Informa (IA Contra Desinformação)

### Conteúdo do Slide:
- **Objetivo Educativo:**
  - Ajudar o usuário comum a identificar indícios de manipulação e exercitar o senso crítico.
- **Como Funciona:**
  1. O usuário cola o link da notícia ou clica em **Capturar Aba Atual**.
  2. O SafeWeb extrai o texto legítimo e consulta a **Gemini API**.
  3. A IA avalia tom alarmista, reputação do domínio, coerência e fontes primárias.
- **Três Veredictos Didáticos:**
  - 🟢 **FONTE CONFIÁVEL:** Veículo com histórico auditável e conteúdo informativo.
  - 🟡 **ALERTA DE SENSACIONALISMO / PRECISA DE MAIS VERIFICAÇÃO:** Títulos caça-cliques, promessas exageradas ou blogs anônimos.
  - 🔴 **ALERTA DE FAKE NEWS:** Notícias falsas comprovadas, curas milagrosas falsas ou teorias conspiratórias.
- **Checagem Cruzada:** Atalhos para checar no *Fato ou Fake (G1)*, *Lupa*, *Aos Fatos* e *UOL Confere*.

### 🎙️ Fala do Apresentador (Notas):
> *"O SafeWeb Informa é o coração da nossa inovação com IA. Ele não apenas classifica a notícia, mas entrega uma explicação clara em linguagem simples do porquê daquele veredito, além de oferecer botões diretos para checar o tema nas principais agências de fact-checking do país."*

---

## 🖥️ Slide 8: Casos de Teste Reais

### Conteúdo do Slide:
- **Demonstração em Sala de Aula:**
  - **Caso 1 (Notícia Real):** *"Fiocruz avança testes de vacina nacional com apoio do Ministério da Saúde"*
    - **Resultado:** 🟢 FONTE CONFIÁVEL | *Apoiada em dados institucionais oficiais e conselho editorial verificado.*
  - **Caso 2 (Clickbait Alarmista):** *"URGENTE: BOMBA! O QUE A MÍDIA NÃO MOSTRA SOBRE A DOENÇA SECRETA QUE CHOROU O BRASIL!!!"*
    - **Resultado:** 🔴 ALERTA DE FAKE NEWS | *Uso ostensivo de letras maiúsculas, urgência de compartilhamento e teorias sem embasamento.*
  - **Caso 3 (Boato Médico Perigoso):** *"Chá milagroso de folhas promete cura definitiva do câncer em 7 dias"*
    - **Resultado:** 🔴 ALERTA DE FAKE NEWS | *Promessa milagrosa desmentida pelo INCA e órgãos de saúde.*
  - **Caso 4 (Blog Desconhecido):** *"Aplicativo promete dobrar o rendimento nos estudos em 3 dias"*
    - **Resultado:** 🟡 ALERTA DE SENSACIONALISMO | *Promessa exagerada veiculada em domínio de baixa reputação.*

### 🎙️ Fala do Apresentador (Notas):
> *"Neste slide mostramos a resposta real da extensão para diferentes tipos de notícias. Ela não trata tudo como igual: sabe diferenciar uma matéria séria da Fiocruz de um boato perigoso de saúde ou de um caça-cliques."*

---

## 🖥️ Slide 9: Segurança de Segredos & Engenharia de Software

### Conteúdo do Slide:
- **Gestão Segura de Credenciais (Zero Secret Leaks):**
  - Chaves de API nunca são versionadas no Git ou enviadas para o GitHub.
  - A chave é salva apenas no armazenamento local do navegador (`chrome.storage.local`) ou no arquivo local `secrets.js` protegido no `.gitignore`.
  - Conformidade com as diretrizes do **GitHub Secret Scanning** e **Google Cloud Platform**.
- **Resiliência e Fallback Transparente:**
  - Se a IA estiver sem conexão, a extensão utiliza automaticamente heurísticas locais offline sem travar a tela do usuário.

### 🎙️ Fala do Apresentador (Notas):
> *"Na parte de engenharia e boas práticas, tratamos a segurança das credenciais com extremo rigor. A chave da API Gemini fica restrita ao navegador local do usuário, garantindo conformidade com as políticas de proteção de segredos do GitHub e da nuvem do Google."*

---

## 🖥️ Slide 10: Conclusão & Próximos Passos

### Conteúdo do Slide:
- **Resultados Alcançados:**
  - Extensão leve, funcional e visualmente profissional.
  - Integração bem-sucedida de IA Generativa de ponta (Gemini) em tempo real.
  - Ferramenta educativa pronta para uso prático e demonstração em salas de aula.
- **Evoluções Futuras:**
  - Suporte a análise multimodal de imagens e thumbnails caça-cliques.
  - Expansão da rede comunitária de denúncias para sincronização P2P.
- **Agradecimentos & Demonstração ao Vivo.**

### 🎙️ Fala do Apresentador (Notas):
> *"Concluímos o SafeWeb entregando uma ferramenta pronta, moderna e de impacto social real. Agora estamos abertos para perguntas e convidamos todos a testarem a extensão na prática. Muito obrigado!"*
