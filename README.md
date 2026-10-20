# SafeWeb 🛡️ (v1.1)
> **Projeto Acadêmico:** Extensão para Google Chrome (Manifest V3) & Backend Auxiliar em Node.js  
> **Autor & Desenvolvimento:** Iury  
> **Objetivo:** Segurança proativa durante a navegação web e monitoramento contínuo de disponibilidade de serviços (Uptime).

---

## 📌 Sumário
- [Visão Geral](#-visão-geral)
- [Novidades da Versão 1.1](#-novidades-da-versão-11)
- [Estrutura do Repositório](#-estrutura-do-repositório)
- [Arquitetura do Sistema](#-arquitetura-do-sistema)
- [Níveis de Risco de Segurança](#-níveis-de-risco-de-segurança)
- [Como Instalar e Testar a Extensão](#-como-instalar-e-testar-a-extensão)
- [Como Executar o Backend (Node.js)](#-como-executar-o-backend-nodejs)
- [Segurança & Gestão de Segredos](#-segurança--gestão-de-segredos)
- [APIs do Chrome Utilizadas](#-apis-do-chrome-utilizadas)
- [Licença](#-licença)

---

## 🌐 Visão Geral

O **SafeWeb** foi desenvolvido como uma solução híbrida para dois problemas fundamentais da web moderna:
1. **Monitoramento de Disponibilidade:** Acompanha o status de sites cadastrados pelo usuário, calculando métricas de disponibilidade (Uptime), detectando quedas de conexão, erros HTTP (4xx, 5xx), timeouts e disparando notificações nativas no sistema operacional.
2. **Análise de Risco de URLs:** Avalia aspectos estruturais de URLs (protocolo HTTP vs HTTPS, ataques homográficos/IDN Punycode, combosquatting de marcas, typosquatting via distância Levenshtein, uso de IPs literais, entropia de Shannon, encurtadores e TLDs de alto risco), fornecendo orientações claras sem falsas promessas de "100% de segurança".

---

## ⚡ Novidades da Versão 1.1

- 🎯 **Captura Automática da Aba Atual:** Botões inteligentes no formulário de cadastro e no scanner que puxam a URL e o título da aba aberta no Chrome com um único clique.
- 🔍 **Detecção de Typosquatting e Combosquatting:** Identificação de imitação e falsificação de marcas populares brasileiras e globais (ex: Nubank, Itaú, Bradesco, Caixa, Mercado Livre, Gov.br, Google, Apple) através de comparação de raízes e algoritmo de distância Levenshtein.
- 🔗 **Detecção de Encurtadores de Link & Spoofing:** Identificação de serviços como `bit.ly`, `tinyurl` e uso malicioso do caractere `@` para mascaramento de destino.
- ⚙️ **Painel de Ajustes (Configurações):** Controle de frequência de checagem do alarme (1 a 30 min), alternância de notificações nativas, configuração da URL do backend e seleção do modo de sensibilidade heurística (Padrão vs Rigorosa/Strict).
- 📊 **Exportação de Dados (Auditoria Acadêmica):** Download de relatórios de monitoramento e logs de ocorrências em formatos **JSON** e **CSV**.
- 🔎 **Filtros e Métricas em Tempo Real:** Campo de busca rápida, filtros por status (Online/Offline) e indicador de percentual médio de **Uptime**.

---

## 📂 Estrutura do Repositório

```text
SAfev2/
├── extension/                      # Código da Extensão Google Chrome (Manifest V3)
│   ├── manifest.json               # Configuração e permissões do Manifest V3
│   ├── popup/                      # Interface visual do Popup
│   │   ├── popup.html              # Estrutura HTML semântica com abas e filtros
│   │   ├── popup.css               # Estilização moderna e acadêmica
│   │   └── popup.js                # Lógica, captura de abas e exportações
│   ├── background/
│   │   └── service-worker.js       # Background Service Worker e Alarmes dinâmicos
│   ├── services/
│   │   ├── security-analyzer.js    # Módulo heurístico avançado de análise de risco
│   │   └── api-client.js           # Comunicação com o backend
│   ├── storage/
│   │   ├── storage-manager.js      # Wrapper sobre chrome.storage.local e configs
│   │   ├── sites-storage.js        # Persistência de sites cadastrados
│   │   └── history-storage.js      # Persistência do histórico de eventos
│   ├── styles/
│   │   └── common.css              # Design System e variáveis CSS
│   └── icons/                      # Ícones nos tamanhos exigidos (16, 48, 128)
│       ├── icon-16.png
│       ├── icon-48.png
│       └── icon-128.png
│
├── backend/                        # Serviço Auxiliar em Node.js (Express)
│   ├── src/
│   │   ├── server.js               # Ponto de entrada do servidor HTTP
│   │   ├── services/
│   │   │   ├── monitor.js          # Worker de monitoramento e testes HTTP
│   │   │   └── security.js         # Gateway para Google Safe Browsing
│   │   └── routes/
│   │       ├── sites.js            # Rotas de cadastro e sincronização
│   │       ├── history.js          # Rotas de histórico de incidentes
│   │       └── security.js         # Rotas de análise de reputação
│   ├── package.json
│   └── .env.example                # Exemplo de configuração de variáveis
│
└── README.md                       # Documentação completa
```

---

## 🏛️ Arquitetura do Sistema

O sistema opera com independência de camadas:
* **Modo Autônomo (Extensão Pura):** Caso o backend não esteja ativo, o Service Worker da extensão utiliza `chrome.alarms` e `fetch` em background para checar os domínios e executar a análise heurística de risco localmente.
* **Modo Estendido (Extensão + Backend):** Com o backend em execução na porta 3000, o monitoramento ganha capacidade de checagem contínua, métricas consolidadas de latência e integração com APIs de inteligência contra ameaças.
* **Auditoria Gemini de Sites:** Ao cadastrar ou testar um domínio sem ameaça grave confirmada, o backend envia ao Gemini a URL, o título da página e até 1.800 caracteres de contexto visível (quando a aba ativa pertence ao domínio) para procurar sinais de phishing, imitação de marcas, lojas falsas, pirataria e ofertas fraudulentas. O resultado é exibido nos detalhes do site; sites classificados como suspeitos recebem o alerta **🔴 SITE SUSPEITO**. A chave `GEMINI_API_KEY` permanece apenas no `.env` do backend.

---

## 🛡️ Níveis de Risco de Segurança

Em conformidade com as boas práticas acadêmicas de segurança da informação, o SafeWeb **não utiliza declarações absolutas como "Site 100% Seguro"**. O sistema adota três classificações fundamentadas:

| Indicador | Significado | Critérios Avaliados |
| :--- | :--- | :--- |
| 🟢 **Nenhum risco conhecido** | Baixa probabilidade de anomalia estrutural | HTTPS válido, domínio padrão, baixa entropia, sem termos maliciosos identificados. |
| 🟡 **Atenção** | Fatores que demandam cautela do usuário | Conexão HTTP sem TLS, encurtador de URL, subdomínios excessivos, portas incomuns ou termos sensíveis. |
| 🔴 **Possível ameaça** | Múltiplos indicadores críticos de perigo | Combosquatting/Typosquatting de bancos e marcas, ataque Punycode (`xn--`), IP literal, download direto de executáveis ou TLDs de alto abuso. |

---

## 🚀 Como Instalar e Testar a Extensão

1. Abra o navegador **Google Chrome**.
2. Acesse `chrome://extensions` na barra de endereços.
3. No canto superior direito, ative a opção **Modo do desenvolvedor** (*Developer mode*).
4. Clique no botão **Carregar sem compactação** (*Load unpacked*).
5. Selecione a pasta `extension/` deste projeto:
   ```text
   C:\Users\iury\Documents\Faculdade\SAfev2\extension
   ```
6. O ícone do **SafeWeb** aparecerá na barra de ferramentas do Chrome.
7. Clique no ícone para abrir o Painel de Controle:
   * **Sites:** Visualize status online/offline, filtre, busque e exporte dados.
   * **Cadastrar:** Adicione domínios manualmente ou use o botão para capturar a aba atual.
   * **Histórico:** Consulte ocorrências, filtre eventos e exporte em JSON/CSV.
   * **Scanner:** Analise a segurança de qualquer URL ou da página atual.
   * **Ajustes:** Personalize intervalos de verificação, sensibilidade heurística e alertas.

---

## ⚙️ Como Executar o Backend (Node.js)

1. Certifique-se de ter o Node.js (v18+) instalado.
2. Navegue até o diretório `backend`:
   ```bash
   cd backend
   ```
3. Crie o arquivo `.env` a partir do exemplo:
   ```bash
   copy .env.example .env
   ```
   Para habilitar a análise com IA, preencha `GEMINI_API_KEY` nesse arquivo.
4. Instale as dependências:
   ```bash
   npm install
   ```
5. Inicie o servidor:
   ```bash
   npm start
   ```
6. O servidor iniciará em `http://localhost:3000`. O popup da extensão detectará automaticamente a conexão.

---

## 🔐 Segurança & Gestão de Segredos

* **Extensão (Zero Secrets):** Nenhuma chave de API privada ou segredo é embarcado no código da extensão.
* **Backend:** Todas as credenciais de serviços externos, inclusive `GEMINI_API_KEY`, residem exclusivamente no arquivo `.env` do backend, fora do controle de versão. Sem a chave, a extensão continua usando a análise heurística local.
* **Chave anteriormente exposta:** Se uma chave Gemini já foi incluída em uma versão anterior da extensão, revogue-a no Google AI Studio e gere outra antes de configurar o `.env`.
* **Permissões Mínimas:** O `manifest.json` declara apenas as permissões essenciais (`storage`, `alarms`, `notifications`, `activeTab`, `tabs`).

---

## 🧩 APIs do Chrome Utilizadas

* `chrome.storage.local`: Persistência local assíncrona dos dados de monitoramento, configurações e histórico.
* `chrome.alarms`: Execução programada e econômica de checagens em segundo plano.
* `chrome.notifications`: Disparo de avisos nativos em caso de indisponibilidade ou recuperação de domínios.
* `chrome.tabs`: Leitura segura da URL e título da aba ativa sob demanda.
* `chrome.action`: Gerenciamento do popup e badges informativos de alerta no ícone.
* `chrome.runtime`: Comunicação assíncrona entre o Popup e o Service Worker.

---

## 👨‍💻 Autoria & Desenvolvimento
Projeto idealizado, arquitetado e desenvolvido por **Iury**, contemplando todas as etapas e componentes acadêmicos.

---

## 📄 Licença
Projeto desenvolvido para fins acadêmicos e educacionais. Distribuído sob a licença MIT.
