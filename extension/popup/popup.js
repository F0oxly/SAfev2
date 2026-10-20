/**
 * SafeWeb - Popup Controller (v1.1)
 * Desenvolvido integralmente por Iury.
 * Gerenciamento de eventos, abas, captura ativa de abas do navegador,
 * heurísticas de segurança, exportação de relatórios e configurações personalizadas.
 */

import { SitesStorage } from '../storage/sites-storage.js';
import { HistoryStorage } from '../storage/history-storage.js';
import { StorageManager, DEFAULT_CONFIG } from '../storage/storage-manager.js';
import { SecurityAnalyzer } from '../services/security-analyzer.js';
import { ApiClient } from '../services/api-client.js';
import { LocalNewsAnalyzer, DEMO_CASES } from '../services/news-analyzer.js';

// Estado Local da UI
let currentSiteFilter = 'all'; // 'all' | 'online' | 'offline'
let currentSiteSearch = '';
let currentHistoryFilter = 'all'; // 'all' | 'news_analysis' | 'status_change' | 'recovery' | 'initial_check'
let currentInformaMode = 'url'; // 'url' | 'text' | 'demo'

// Elementos do DOM
const DOM = {
  tabButtons: document.querySelectorAll('.tab-btn'),
  tabContents: document.querySelectorAll('.tab-content'),
  sitesContainer: document.getElementById('sites-container'),
  historyContainer: document.getElementById('history-container'),
  statTotal: document.getElementById('stat-total'),
  statOnline: document.getElementById('stat-online'),
  statOffline: document.getElementById('stat-offline'),
  statUptime: document.getElementById('stat-uptime'),
  backendIndicator: document.getElementById('backend-status-indicator'),
  btnRefreshAll: document.getElementById('btn-refresh-all'),
  btnClearHistory: document.getElementById('btn-clear-history'),
  btnExportSites: document.getElementById('btn-export-sites'),
  btnExportHistoryJson: document.getElementById('btn-export-history-json'),
  btnExportHistoryCsv: document.getElementById('btn-export-history-csv'),
  searchSites: document.getElementById('search-sites'),
  siteFilterChips: document.querySelectorAll('[data-site-filter]'),
  historyFilterChips: document.querySelectorAll('[data-history-filter]'),
  btnAutofillCurrentTab: document.getElementById('btn-autofill-current-tab'),
  inputSiteUrl: document.getElementById('input-site-url'),
  inputSiteAlias: document.getElementById('input-site-alias'),
  btnSaveSite: document.getElementById('btn-save-site'),
  addSecurityPreview: document.getElementById('add-security-preview'),
  previewRiskBadge: document.getElementById('preview-risk-badge'),
  previewRiskReasons: document.getElementById('preview-risk-reasons'),
  settingCheckInterval: document.getElementById('setting-check-interval'),
  settingSensitivity: document.getElementById('setting-sensitivity'),
  settingBackendUrl: document.getElementById('setting-backend-url'),
  settingNotificationsEnabled: document.getElementById('setting-notifications-enabled'),
  btnSaveSettings: document.getElementById('btn-save-settings'),
  btnResetSettings: document.getElementById('btn-reset-settings'),
  siteModal: document.getElementById('site-modal'),
  modalSiteTitle: document.getElementById('modal-site-title'),
  modalSiteBody: document.getElementById('modal-site-body'),
  btnCloseModal: document.getElementById('btn-close-modal'),
  toast: document.getElementById('toast'),
  // Denúncias
  btnReportAutofill: document.getElementById('btn-report-autofill'),
  reportDomain: document.getElementById('report-domain'),
  reportCategory: document.getElementById('report-category'),
  reportDescription: document.getElementById('report-description'),
  btnSubmitReport: document.getElementById('btn-submit-report'),
  reportResult: document.getElementById('report-result'),
  // SafeWeb Informa
  btnInformaModeUrl: document.getElementById('btn-informa-mode-url'),
  btnInformaModeText: document.getElementById('btn-informa-mode-text'),
  btnInformaModeDemo: document.getElementById('btn-informa-mode-demo'),
  informaPanelUrl: document.getElementById('informa-panel-url'),
  informaPanelText: document.getElementById('informa-panel-text'),
  informaPanelDemo: document.getElementById('informa-panel-demo'),
  inputNewsUrl: document.getElementById('input-news-url'),
  inputNewsTitle: document.getElementById('input-news-title'),
  inputNewsText: document.getElementById('input-news-text'),
  btnInformaAutofill: document.getElementById('btn-informa-autofill'),
  demoCasesContainer: document.getElementById('demo-cases-container'),
  btnAnalyzeNews: document.getElementById('btn-analyze-news'),
  informaAnalysisStatus: document.getElementById('informa-analysis-status'),
  informaResultBox: document.getElementById('informa-result-box')
};

// Inicialização da Aplicação
document.addEventListener('DOMContentLoaded', async () => {
  setupTabs();
  setupEventListeners();
  initInformaModule();
  await checkBackendStatus();
  await renderDashboard();
  await renderHistory();
  await loadSettings();
});

/**
 * Configuração e Alternância das Abas
 */
function setupTabs() {
  DOM.tabButtons.forEach(btn => {
    btn.addEventListener('click', () => {
      const targetId = btn.getAttribute('data-tab');

      DOM.tabButtons.forEach(b => b.classList.remove('active'));
      DOM.tabContents.forEach(c => c.classList.remove('active'));

      btn.classList.add('active');
      const targetContent = document.getElementById(targetId);
      if (targetContent) {
        targetContent.classList.add('active');
      }

      if (targetId === 'tab-dashboard') renderDashboard();
      if (targetId === 'tab-history') renderHistory();
      if (targetId === 'tab-settings') loadSettings();
      if (targetId === 'tab-informa') renderDemoCases();
    });
  });
}

/**
 * Captura informações da aba ativa no Chrome, incluindo metadados da página
 * @returns {Promise<{ url, title, author, publishDate, text }|null>}
 */
async function getActiveTabInfo() {
  try {
    const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
    if (!tabs || tabs.length === 0 || !tabs[0].url) {
      showToast('Nenhuma aba ativa identificada.');
      return null;
    }
    const tab = tabs[0];
    if (tab.url.startsWith('chrome://') || tab.url.startsWith('edge://') || tab.url.startsWith('about:')) {
      showToast('Páginas de sistema do navegador não podem ser analisadas.');
      return null;
    }

    const base = { url: tab.url, title: tab.title || '', author: '', publishDate: '', text: '' };

    // Tenta extrair metadados avançados da página via scripting
    try {
      const results = await chrome.scripting.executeScript({
        target: { tabId: tab.id },
        func: () => {
          const getMeta = (name) =>
            document.querySelector(`meta[name="${name}"]`)?.content ||
            document.querySelector(`meta[property="${name}"]`)?.content || '';

          // Texto principal — tenta article, main, body em ordem de preferência
          const articleEl = document.querySelector('article') || document.querySelector('main');
          let text = '';
          if (articleEl) {
            text = articleEl.innerText.replace(/\s+/g, ' ').trim().slice(0, 3000);
          } else {
            const paragraphs = Array.from(document.querySelectorAll('p'));
            text = paragraphs.map(p => p.innerText.trim()).filter(t => t.length > 40).join(' ').slice(0, 3000);
          }

          return {
            author: getMeta('author') || getMeta('article:author') || '',
            publishDate: getMeta('article:published_time') || getMeta('pubdate') || getMeta('date') || '',
            description: getMeta('description') || getMeta('og:description') || '',
            ogTitle: getMeta('og:title') || '',
            text: text
          };
        }
      });

      if (results && results[0] && results[0].result) {
        const extracted = results[0].result;
        return {
          ...base,
          title: extracted.ogTitle || base.title,
          author: extracted.author,
          publishDate: extracted.publishDate,
          text: extracted.text || extracted.description
        };
      }
    } catch (scriptErr) {
      // Scripting falhou (ex: página restrita) — retorna apenas dados básicos
      console.warn('[SafeWeb] Scripting restrito nesta aba:', scriptErr.message);
    }

    return base;
  } catch (err) {
    console.error('[SafeWeb] Erro ao obter aba ativa:', err);
    showToast('Não foi possível ler a aba ativa.');
    return null;
  }
}

async function getSitePageContext(url) {
  try {
    const target = new URL(url);
    const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
    const tab = tabs?.[0];
    if (!tab?.id || !tab.url || new URL(tab.url).hostname !== target.hostname) {
      return { title: '', context: '' };
    }

    const results = await chrome.scripting.executeScript({
      target: { tabId: tab.id },
      func: () => {
        const description =
          document.querySelector('meta[name="description"]')?.content ||
          document.querySelector('meta[property="og:description"]')?.content ||
          '';
        const visibleText = (document.body?.innerText || '').replace(/\s+/g, ' ').trim();
        return {
          title: document.title || '',
          context: `${description} ${visibleText}`.trim().slice(0, 1800)
        };
      }
    });

    return results?.[0]?.result || { title: tab.title || '', context: '' };
  } catch (err) {
    console.warn('[SafeWeb] Não foi possível obter o contexto da página para análise:', err.message);
    return { title: '', context: '' };
  }
}

/**
 * Utilitário de Download de Arquivo (Exportações JSON / CSV)
 */
function downloadFile(content, filename, mimeType) {
  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  setTimeout(() => {
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }, 100);
}

/**
 * Listeners de Eventos Principais
 */
function setupEventListeners() {
  // Atualizar todos os sites
  DOM.btnRefreshAll.addEventListener('click', async () => {
    showToast('Atualizando status de todos os sites...');
    DOM.btnRefreshAll.classList.add('rotating');
    try {
      await chrome.runtime.sendMessage({ action: 'CHECK_ALL_SITES' });
      await renderDashboard();
      await renderHistory();
      showToast('Verificação concluída!');
    } catch (err) {
      showToast('Erro ao atualizar: ' + err.message);
    } finally {
      DOM.btnRefreshAll.classList.remove('rotating');
    }
  });

  // Capturar aba atual no formulário de Cadastro
  if (DOM.btnAutofillCurrentTab) {
    DOM.btnAutofillCurrentTab.addEventListener('click', async () => {
      const info = await getActiveTabInfo();
      if (info) {
        DOM.inputSiteUrl.value = info.url;
        DOM.inputSiteAlias.value = info.title.substring(0, 45);
        await runLivePreview(info.url);
        showToast('Aba atual capturada com sucesso!');
      }
    });
  }

  // Digitação da URL no cadastro (Live Heuristic Preview)
  let typingTimer;
  DOM.inputSiteUrl.addEventListener('input', () => {
    clearTimeout(typingTimer);
    const url = DOM.inputSiteUrl.value.trim();
    if (!url) {
      DOM.addSecurityPreview.style.display = 'none';
      return;
    }
    typingTimer = setTimeout(async () => {
      await runLivePreview(url);
    }, 250);
  });

  // Salvar novo site
  DOM.btnSaveSite.addEventListener('click', async () => {
    await handleAddSite();
  });

  // Pesquisa dinâmica na lista de sites
  if (DOM.searchSites) {
    DOM.searchSites.addEventListener('input', () => {
      currentSiteSearch = DOM.searchSites.value.trim().toLowerCase();
      renderDashboard();
    });
  }

  // Filtros de Status de Sites
  DOM.siteFilterChips.forEach(chip => {
    chip.addEventListener('click', () => {
      DOM.siteFilterChips.forEach(c => c.classList.remove('active'));
      chip.classList.add('active');
      currentSiteFilter = chip.getAttribute('data-site-filter');
      renderDashboard();
    });
  });

  // Filtros de Tipo de Histórico
  DOM.historyFilterChips.forEach(chip => {
    chip.addEventListener('click', () => {
      DOM.historyFilterChips.forEach(c => c.classList.remove('active'));
      chip.classList.add('active');
      currentHistoryFilter = chip.getAttribute('data-history-filter');
      renderHistory();
    });
  });

  // Exportar dados dos Sites
  if (DOM.btnExportSites) {
    DOM.btnExportSites.addEventListener('click', async () => {
      const sites = await SitesStorage.getAll();
      if (sites.length === 0) {
        showToast('Nenhum domínio cadastrado para exportação.');
        return;
      }
      downloadFile(JSON.stringify(sites, null, 2), 'safeweb_sites.json', 'application/json');
      showToast('Dados de monitoramento exportados!');
    });
  }

  // Exportar histórico em JSON
  if (DOM.btnExportHistoryJson) {
    DOM.btnExportHistoryJson.addEventListener('click', async () => {
      const history = await HistoryStorage.getAll(200);
      if (history.length === 0) {
        showToast('Histórico vazio para exportar.');
        return;
      }
      downloadFile(JSON.stringify(history, null, 2), 'safeweb_historico.json', 'application/json');
      showToast('Histórico em JSON exportado!');
    });
  }

  // Exportar histórico em CSV
  if (DOM.btnExportHistoryCsv) {
    DOM.btnExportHistoryCsv.addEventListener('click', async () => {
      const history = await HistoryStorage.getAll(200);
      if (history.length === 0) {
        showToast('Histórico vazio para exportar.');
        return;
      }
      const headers = ['ID', 'Data/Hora', 'Tipo', 'URL', 'Status HTTP', 'Latencia (ms)', 'Mensagem'];
      const rows = history.map(item => [
        item.id,
        item.timestamp,
        item.type,
        `"${(item.url || '').replace(/"/g, '""')}"`,
        item.httpStatus !== null ? item.httpStatus : '',
        item.responseTimeMs !== null ? item.responseTimeMs : '',
        `"${(item.message || '').replace(/"/g, '""')}"`
      ]);
      const csv = [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
      downloadFile(csv, 'safeweb_historico.csv', 'text/csv;charset=utf-8;');
      showToast('Histórico em CSV exportado!');
    });
  }

  // Limpar histórico
  DOM.btnClearHistory.addEventListener('click', async () => {
    if (confirm('Deseja realmente limpar todo o histórico de ocorrências?')) {
      await HistoryStorage.clear();
      await renderHistory();
      showToast('Histórico limpo com sucesso.');
    }
  });

  // Salvar Configurações
  if (DOM.btnSaveSettings) {
    DOM.btnSaveSettings.addEventListener('click', async () => {
      const updatedConfig = {
        checkIntervalMinutes: parseInt(DOM.settingCheckInterval.value, 10) || 2,
        threatSensitivity: DOM.settingSensitivity.value || 'standard',
        backendUrl: DOM.settingBackendUrl.value.trim() || 'http://localhost:3000',
        notificationsEnabled: DOM.settingNotificationsEnabled.checked
      };

      await StorageManager.setConfig(updatedConfig);

      // Notifica o Background Service Worker para reajustar o alarme
      try {
        await chrome.runtime.sendMessage({ action: 'RELOAD_ALARM' });
      } catch (err) {
        console.warn('[SafeWeb] Background não respondeu ao recarregar alarme:', err);
      }

      await checkBackendStatus();
      showToast('Configurações salvas com sucesso!');
    });
  }

  // Restaurar Configurações Padrão
  if (DOM.btnResetSettings) {
    DOM.btnResetSettings.addEventListener('click', async () => {
      if (confirm('Deseja redefinir todas as configurações para os padrões de fábrica?')) {
        await StorageManager.setConfig(DEFAULT_CONFIG);
        await loadSettings();
        try {
          await chrome.runtime.sendMessage({ action: 'RELOAD_ALARM' });
        } catch (err) {}
        showToast('Padrões restaurados!');
      }
    });
  }

  // Fechar Modal
  DOM.btnCloseModal.addEventListener('click', () => {
    DOM.siteModal.classList.remove('show');
  });

  DOM.siteModal.addEventListener('click', (e) => {
    if (e.target === DOM.siteModal) {
      DOM.siteModal.classList.remove('show');
    }
  });

  // Aba Denúncia — Preencher com aba atual
  if (DOM.btnReportAutofill) {
    DOM.btnReportAutofill.addEventListener('click', async () => {
      const info = await getActiveTabInfo();
      if (info) {
        try {
          const parsed = new URL(info.url);
          let host = parsed.hostname.replace(/^www\./, '');
          DOM.reportDomain.value = host;
          showToast(`Domínio "${host}" preenchido automaticamente.`);
        } catch {
          DOM.reportDomain.value = info.url;
        }
      }
    });
  }

  // Aba Denúncia — Enviar denúncia
  if (DOM.btnSubmitReport) {
    DOM.btnSubmitReport.addEventListener('click', async () => {
      const domain = (DOM.reportDomain.value || '').trim();
      const category = DOM.reportCategory.value;
      const description = (DOM.reportDescription.value || '').trim();

      if (!domain) {
        showToast('⚠️ Informe o domínio antes de enviar.');
        return;
      }
      if (!category) {
        showToast('⚠️ Selecione uma categoria para a denúncia.');
        return;
      }

      DOM.btnSubmitReport.disabled = true;
      DOM.btnSubmitReport.textContent = 'Enviando...';

      const result = await ApiClient.submitReport({ domain, category, description });

      DOM.btnSubmitReport.disabled = false;
      DOM.btnSubmitReport.innerHTML = `
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
          <line x1="22" y1="2" x2="11" y2="13"></line>
          <polygon points="22 2 15 22 11 13 2 9 22 2"></polygon>
        </svg>
        Enviar Denúncia`;

      DOM.reportResult.style.display = 'block';

      if (result && result.success) {
        const isDuplicate = result.duplicated;
        DOM.reportResult.innerHTML = `
          <div style="font-size: 12px; color: var(--text-muted); line-height: 1.6;">
            <div style="font-size: 13px; font-weight: 600; color: ${isDuplicate ? '#f59e0b' : '#22c55e'}; margin-bottom: 6px;">
              ${isDuplicate ? '⚠️ Denúncia já registrada recentemente' : '✅ Denúncia enviada com sucesso'}
            </div>
            <strong>Domínio:</strong> ${escapeHtml(result.domain)}<br/>
            ${!isDuplicate ? `<strong>Categoria:</strong> ${escapeHtml(result.categoryLabel || category)}<br/>` : ''}
            <strong>Status:</strong> Aguardando análise<br/>
            <span style="font-size: 10.5px; margin-top: 4px; display: block; color: var(--text-muted);">
              ${result.message || 'Obrigado pelo relato. Denúncias são indicadores de risco, não confirmações automáticas.'}
            </span>
          </div>`;
        // Limpa o formulário após envio bem-sucedido (sem duplicata)
        if (!isDuplicate) {
          DOM.reportDomain.value = '';
          DOM.reportCategory.value = '';
          DOM.reportDescription.value = '';
        }
        showToast(isDuplicate ? 'Denúncia recente já registrada.' : '✅ Denúncia enviada!');
      } else {
        DOM.reportResult.innerHTML = `
          <div style="font-size: 12px; color: #ef4444; line-height: 1.6;">
            <strong>❌ Falha no envio</strong><br/>
            ${escapeHtml(result?.error || 'Verifique se o backend está ativo e tente novamente.')}<br/>
            <span style="font-size: 10.5px; color: var(--text-muted);">
              O backend SafeWeb precisa estar rodando para enviar denúncias comunitárias.
            </span>
          </div>`;
        showToast('❌ Falha ao enviar denúncia.');
      }
    });
  }
}

/**
 * Carrega as preferências do usuário na tela de Ajustes
 */
async function loadSettings() {
  const config = await StorageManager.getConfig();
  if (DOM.settingCheckInterval) {
    DOM.settingCheckInterval.value = String(config.checkIntervalMinutes || 2);
  }
  if (DOM.settingSensitivity) {
    DOM.settingSensitivity.value = config.threatSensitivity || 'standard';
  }
  if (DOM.settingBackendUrl) {
    DOM.settingBackendUrl.value = config.backendUrl || 'http://localhost:3000';
  }
  if (DOM.settingNotificationsEnabled) {
    DOM.settingNotificationsEnabled.checked = config.notificationsEnabled !== false;
  }
}

/**
 * Verifica se o backend Node.js está respondendo
 */
async function checkBackendStatus() {
  const isAvailable = await ApiClient.isBackendAvailable();
  if (isAvailable) {
    DOM.backendIndicator.textContent = 'Backend Conectado (Node.js)';
    DOM.backendIndicator.style.color = '#a7f3d0';
  } else {
    DOM.backendIndicator.textContent = 'Modo Autônomo Local';
    DOM.backendIndicator.style.color = 'rgba(255, 255, 255, 0.8)';
  }
}

/**
 * Executa análise heurística em tempo real durante digitação
 */
async function runLivePreview(url) {
  const config = await StorageManager.getConfig();
  const analysis = SecurityAnalyzer.analyze(url, config.threatSensitivity);
  DOM.addSecurityPreview.style.display = 'flex';

  DOM.previewRiskBadge.textContent = analysis.label;
  DOM.previewRiskBadge.className = `badge badge-risk-${analysis.level}`;

  DOM.previewRiskReasons.innerHTML = '';
  analysis.reasons.forEach(r => {
    const li = document.createElement('li');
    li.textContent = r;
    DOM.previewRiskReasons.appendChild(li);
  });
}

function getSiteSecurityFields(analysis, reputation) {
  const isGeminiSuspicious = reputation?.geminiAnalysis?.veredicto === 'SUSPEITO';
  const remoteLevel = reputation?.riskLevel === 'critical' || reputation?.riskLevel === 'high'
    ? 'high'
    : (reputation?.riskLevel === 'attention' ? 'attention' : 'low');
  const riskPriority = { low: 0, attention: 1, high: 2 };
  const useRemoteRisk = reputation && riskPriority[remoteLevel] > riskPriority[analysis.level];
  const riskLevel = isGeminiSuspicious || useRemoteRisk ? remoteLevel : analysis.level;
  const riskLabel = isGeminiSuspicious
    ? '🔴 SITE SUSPEITO'
    : (useRemoteRisk ? reputation.classification : analysis.label);
  const riskDetails = [...analysis.reasons];

  if (Array.isArray(reputation?.reasons)) {
    reputation.reasons.forEach(reason => {
      if (!riskDetails.includes(reason)) riskDetails.push(reason);
    });
  }

  return {
    riskLevel,
    riskLabel,
    riskDetails,
    geminiAnalysis: reputation?.geminiAnalysis || null
  };
}

/**
 * Adiciona novo site monitorado
 */
async function handleAddSite() {
  const rawUrl = DOM.inputSiteUrl.value.trim();
  const alias = DOM.inputSiteAlias.value.trim();

  if (!rawUrl) {
    showToast('Informe uma URL válida.');
    DOM.inputSiteUrl.focus();
    return;
  }

  const validation = SecurityAnalyzer.validateUrl(rawUrl);
  if (!validation.valid) {
    showToast(validation.error || 'URL com formato inválido.');
    return;
  }

  const config = await StorageManager.getConfig();
  const analysis = SecurityAnalyzer.analyze(rawUrl, config.threatSensitivity);

  try {
    DOM.btnSaveSite.disabled = true;
    DOM.btnSaveSite.textContent = 'Cadastrando...';

    const pageContext = await getSitePageContext(validation.cleanUrl);
    const reputation = await ApiClient.evaluateSecurity(validation.cleanUrl, {
      title: pageContext.title || alias || validation.urlObj.hostname,
      context: pageContext.context
    });
    const securityFields = getSiteSecurityFields(analysis, reputation);

    const newSite = await SitesStorage.add({
      url: validation.cleanUrl,
      alias: alias || validation.urlObj.hostname,
      ...securityFields,
      status: 'checking'
    });

    // Registrar no histórico
    await HistoryStorage.addEntry({
      siteId: newSite.id,
      url: newSite.url,
      type: 'initial_check',
      message: `Domínio cadastrado para monitoramento com avaliação: ${securityFields.riskLabel}.`,
      riskLevel: securityFields.riskLevel,
      riskDetails: securityFields.riskDetails
    });

    // Disparar checagem inicial imediata via Service Worker
    chrome.runtime.sendMessage({ action: 'CHECK_SINGLE_SITE', siteId: newSite.id }, async () => {
      await renderDashboard();
    });

    // Limpar formulário
    DOM.inputSiteUrl.value = '';
    DOM.inputSiteAlias.value = '';
    DOM.addSecurityPreview.style.display = 'none';

    showToast('Site cadastrado com sucesso!');

    // Alternar para a aba de Dashboard
    const dashboardTabBtn = document.querySelector('[data-tab="tab-dashboard"]');
    if (dashboardTabBtn) dashboardTabBtn.click();
  } catch (err) {
    showToast(err.message);
  } finally {
    DOM.btnSaveSite.disabled = false;
    DOM.btnSaveSite.textContent = 'Adicionar ao Monitoramento';
  }
}

/**
 * Renderiza o Dashboard com a lista de sites e filtros
 */
async function renderDashboard() {
  const sites = await SitesStorage.getAll();

  // Contadores Globais
  const total = sites.length;
  const online = sites.filter(s => s.status === 'online').length;
  const offline = sites.filter(s => s.status === 'offline').length;
  const uptimeRate = total > 0 ? Math.round((online / total) * 100) : 100;

  DOM.statTotal.textContent = total;
  DOM.statOnline.textContent = online;
  DOM.statOffline.textContent = offline;
  if (DOM.statUptime) {
    DOM.statUptime.textContent = `${uptimeRate}%`;
  }

  // Filtragem local por Status e Busca
  let filtered = sites;
  if (currentSiteFilter === 'online') {
    filtered = filtered.filter(s => s.status === 'online');
  } else if (currentSiteFilter === 'offline') {
    filtered = filtered.filter(s => s.status === 'offline');
  }

  if (currentSiteSearch) {
    filtered = filtered.filter(s =>
      (s.alias && s.alias.toLowerCase().includes(currentSiteSearch)) ||
      (s.url && s.url.toLowerCase().includes(currentSiteSearch))
    );
  }

  DOM.sitesContainer.innerHTML = '';

  if (filtered.length === 0) {
    const isSearching = currentSiteSearch || currentSiteFilter !== 'all';
    DOM.sitesContainer.innerHTML = `
      <div class="empty-state">
        <div class="empty-icon">${isSearching ? '🔍' : '🌐'}</div>
        <div class="empty-title">${isSearching ? 'Nenhum site encontrado' : 'Nenhum site monitorado'}</div>
        <p>${isSearching ? 'Tente ajustar os filtros ou o termo de busca pesquisado.' : 'Cadastre uma URL na aba "Cadastrar" para iniciar o acompanhamento.'}</p>
      </div>
    `;
    return;
  }

  filtered.forEach(site => {
    const card = document.createElement('div');
    card.className = 'site-card';

    const statusBadgeClass = `badge ${site.status || 'unknown'}`;
    const statusText = site.status === 'online' ? 'Online' : (site.status === 'offline' ? 'Offline' : (site.status === 'checking' ? 'Checando...' : 'Pendente'));

    const riskBadgeClass = `badge badge-risk-${site.riskLevel || 'low'}`;
    const riskText = site.riskLabel || 'Nenhum risco conhecido';

    const responseTimeText = site.responseTimeMs !== null ? `${site.responseTimeMs}ms` : '--';
    const httpStatusText = site.httpStatus !== null ? `HTTP ${site.httpStatus}` : 'Sem resposta';
    const lastCheckedText = site.lastChecked ? formatTimeAgo(site.lastChecked) : 'Ainda não verificado';

    card.innerHTML = `
      <div class="site-card-top">
        <div class="site-info">
          <div class="site-alias" title="${site.alias}">${escapeHtml(site.alias)}</div>
          <div class="site-url" title="${site.url}">${escapeHtml(site.url)}</div>
          ${site.geminiAnalysis ? `<div class="site-gemini-note">🤖 Análise Gemini AI: ${escapeHtml(site.geminiAnalysis.explicacao)}</div>` : ''}
        </div>
        <div class="site-badges">
          <span class="${riskBadgeClass}" title="Avaliação de Risco">${riskText}</span>
          <span class="${statusBadgeClass}">${statusText}</span>
        </div>
      </div>
      <div class="site-card-bottom">
        <div class="site-metrics">
          <span title="Código de Resposta">${httpStatusText}</span>
          <span>•</span>
          <span title="Latência / Tempo de Resposta">${responseTimeText}</span>
          <span>•</span>
          <span title="Última checagem">${lastCheckedText}</span>
        </div>
        <div class="site-actions">
          <button class="btn-mini btn-recheck" data-id="${site.id}" title="Re-testar conexão">Testar</button>
          <button class="btn-mini btn-details" data-id="${site.id}" title="Ver detalhes de segurança">Detalhes</button>
          <button class="btn-mini danger btn-delete" data-id="${site.id}" title="Remover monitoramento">Excluir</button>
        </div>
      </div>
    `;

    // Eventos dos Botões do Card
    card.querySelector('.btn-recheck').addEventListener('click', async () => {
      showToast(`Testando ${site.alias}...`);
      const badge = card.querySelector('.badge.online, .badge.offline, .badge.unknown, .badge.checking');
      if (badge) {
        badge.className = 'badge checking';
        badge.textContent = 'Checando...';
      }

      const config = await StorageManager.getConfig();
      const localAnalysis = SecurityAnalyzer.analyze(site.url, config.threatSensitivity);
      const pageContext = await getSitePageContext(site.url);
      const reputation = await ApiClient.evaluateSecurity(site.url, {
        title: pageContext.title || site.alias || site.hostname,
        context: pageContext.context
      });
      if (reputation) {
        await SitesStorage.update(site.id, getSiteSecurityFields(localAnalysis, reputation));
      }

      chrome.runtime.sendMessage({ action: 'CHECK_SINGLE_SITE', siteId: site.id }, async (response) => {
        if (response && response.success) {
          await renderDashboard();
          await renderHistory();
          showToast(`Concluído: ${site.alias} está ${response.site.status.toUpperCase()}`);
        } else {
          showToast('Falha no teste de conexão.');
        }
      });
    });

    card.querySelector('.btn-details').addEventListener('click', () => {
      openSiteDetailsModal(site);
    });

    card.querySelector('.btn-delete').addEventListener('click', async () => {
      if (confirm(`Deseja remover o monitoramento de "${site.alias}"?`)) {
        await SitesStorage.remove(site.id);
        await renderDashboard();
        showToast('Site removido com sucesso.');
      }
    });

    DOM.sitesContainer.appendChild(card);
  });
}

/**
 * Renderiza o Histórico de Ocorrências com Filtro por Tipo
 */
async function renderHistory() {
  const history = await HistoryStorage.getAll(60);
  DOM.historyContainer.innerHTML = '';

  let filtered = history;
  if (currentHistoryFilter !== 'all') {
    filtered = filtered.filter(item => item.type === currentHistoryFilter);
  }

  if (filtered.length === 0) {
    DOM.historyContainer.innerHTML = `
      <div class="empty-state">
        <div class="empty-icon">📜</div>
        <div class="empty-title">Nenhum evento registrado</div>
        <p>Alterações de disponibilidade, quedas de sites e análises de risco aparecerão aqui.</p>
      </div>
    `;
    return;
  }

  filtered.forEach(item => {
    const el = document.createElement('div');
    const isNews = item.type === 'news_analysis';
    el.className = `history-item ${item.type}`;

    const dateFormatted = formatDateTime(item.timestamp);

    if (isNews) {
      el.style.cursor = 'pointer';
      el.style.borderLeft = `3px solid ${item.badgeColor || '#3b82f6'}`;
      el.title = 'Clique para ver o relatório completo de desinformação';
      el.addEventListener('click', () => {
        if (item.rawAnalysis) {
          openNewsDetailsModal(item.rawAnalysis);
        }
      });
    }

    el.innerHTML = `
      <div class="history-header">
        <span class="history-url" title="${item.url}">${isNews ? '📰 ' : ''}${escapeHtml(item.domain || item.url)}</span>
        <span class="history-time">${dateFormatted}</span>
      </div>
      <div class="history-msg">${escapeHtml(item.message)}</div>
      ${isNews ? `<div style="font-size: 10px; color: var(--color-primary); margin-top: 3px; font-weight: 600;">Ver relatório educativo completo ↗</div>` : ''}
    `;

    DOM.historyContainer.appendChild(el);
  });
}


/**
 * Abre modal com detalhes completos do site
 */
function openSiteDetailsModal(site) {
  DOM.modalSiteTitle.textContent = site.alias || site.hostname;

  let detailsHtml = `
    <div style="display: flex; flex-direction: column; gap: 8px; font-size: 12px;">
      <div><strong>URL:</strong> <span style="word-break: break-all;">${escapeHtml(site.url)}</span></div>
      <div><strong>Status Atual:</strong> <span class="badge ${site.status}">${site.status ? site.status.toUpperCase() : 'UNKNOWN'}</span></div>
      <div><strong>Código HTTP:</strong> ${site.httpStatus !== null ? site.httpStatus : 'Sem resposta'}</div>
      <div><strong>Latência de Resposta:</strong> ${site.responseTimeMs !== null ? site.responseTimeMs + ' ms' : '--'}</div>
      <div><strong>Cadastrado em:</strong> ${formatDateTime(site.addedAt)}</div>
      <div><strong>Última Verificação:</strong> ${site.lastChecked ? formatDateTime(site.lastChecked) : 'Nunca'}</div>
      
      <hr style="border: 0; border-top: 1px solid var(--border-color); margin: 6px 0;"/>
      
      <div><strong>Avaliação de Segurança:</strong> <span class="badge badge-risk-${site.riskLevel}">${site.riskLabel}</span></div>
      ${site.geminiAnalysis ? `<div><strong>🤖 Análise Gemini AI:</strong> ${escapeHtml(site.geminiAnalysis.explicacao)}</div>` : ''}
      <div><strong>Indicadores de Risco:</strong></div>
      <ul class="security-reasons-list">
  `;

  if (site.riskDetails && site.riskDetails.length > 0) {
    site.riskDetails.forEach(d => {
      detailsHtml += `<li>${escapeHtml(d)}</li>`;
    });
  } else {
    detailsHtml += `<li>Nenhum fator suspeito detectado na estrutura do domínio.</li>`;
  }

  detailsHtml += `
      </ul>
    </div>
  `;

  DOM.modalSiteBody.innerHTML = detailsHtml;
  DOM.siteModal.classList.add('show');
}

/**
 * Utilitário de Toast Flutuante
 */
function showToast(message) {
  DOM.toast.textContent = message;
  DOM.toast.classList.add('show');
  setTimeout(() => {
    DOM.toast.classList.remove('show');
  }, 2600);
}

/**
 * Formatação de tempo relativo
 */
function formatTimeAgo(isoString) {
  try {
    const diff = Math.floor((Date.now() - new Date(isoString).getTime()) / 1000);
    if (diff < 10) return 'Agora mesmo';
    if (diff < 60) return `${diff}s atrás`;
    const mins = Math.floor(diff / 60);
    if (mins < 60) return `${mins}m atrás`;
    const hours = Math.floor(mins / 60);
    return `${hours}h atrás`;
  } catch {
    return 'Recentemente';
  }
}

/**
 * Formatação de Data e Hora
 */
function formatDateTime(isoString) {
  if (!isoString) return '--';
  try {
    const d = new Date(isoString);
    return d.toLocaleString('pt-BR', {
      day: '2-digit',
      month: '2-digit',
      year: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit'
    });
  } catch {
    return isoString;
  }
}

/**
 * Sanitização básica de HTML
 */
function escapeHtml(str) {
  if (!str) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

/* ========================================================
   MÓDULO SAFEWEB INFORMA (Controle e Interações)
   ======================================================== */

/**
 * Inicializa os controles e eventos do SafeWeb Informa
 */
function initInformaModule() {
  // Alternância de Modos (Link / Texto / Casos de Teste)
  if (DOM.btnInformaModeUrl) {
    DOM.btnInformaModeUrl.addEventListener('click', () => switchInformaMode('url'));
  }
  if (DOM.btnInformaModeText) {
    DOM.btnInformaModeText.addEventListener('click', () => switchInformaMode('text'));
  }
  if (DOM.btnInformaModeDemo) {
    DOM.btnInformaModeDemo.addEventListener('click', () => switchInformaMode('demo'));
  }

  // Capturar Aba Atual para o Informa (preenche URL, título e texto extraído)
  if (DOM.btnInformaAutofill) {
    DOM.btnInformaAutofill.addEventListener('click', async () => {
      showToast('Capturando dados da aba...');
      const info = await getActiveTabInfo();
      if (info) {
        if (DOM.inputNewsUrl) DOM.inputNewsUrl.value = info.url;
        if (DOM.inputNewsTitle && info.title) DOM.inputNewsTitle.value = info.title;
        if (DOM.inputNewsText && info.text) DOM.inputNewsText.value = info.text;
        showToast('Aba capturada! Clique em "Verificar Informação".');
      }
    });
  }

  // Botão de Análise de Notícia
  if (DOM.btnAnalyzeNews) {
    DOM.btnAnalyzeNews.addEventListener('click', async () => {
      await handleAnalyzeNews();
    });
  }

  // Renderização inicial dos casos de demonstração
  renderDemoCases();
}


/**
 * Alterna entre os modos de análise do SafeWeb Informa
 */
function switchInformaMode(mode) {
  currentInformaMode = mode;

  // Botões
  if (DOM.btnInformaModeUrl) DOM.btnInformaModeUrl.classList.toggle('active', mode === 'url');
  if (DOM.btnInformaModeText) DOM.btnInformaModeText.classList.toggle('active', mode === 'text');
  if (DOM.btnInformaModeDemo) DOM.btnInformaModeDemo.classList.toggle('active', mode === 'demo');

  // Painéis
  if (DOM.informaPanelUrl) DOM.informaPanelUrl.style.display = mode === 'url' ? 'block' : 'none';
  if (DOM.informaPanelText) DOM.informaPanelText.style.display = mode === 'text' ? 'block' : 'none';
  if (DOM.informaPanelDemo) DOM.informaPanelDemo.style.display = mode === 'demo' ? 'block' : 'none';
}

/**
 * Renderiza os Casos Didáticos Prontos para a Demonstração na Turma de Psicologia
 */
function renderDemoCases() {
  if (!DOM.demoCasesContainer) return;
  DOM.demoCasesContainer.innerHTML = '';

  DEMO_CASES.forEach(demo => {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'demo-item-btn';

    // Determina a cor da tag
    let tagBg = '#ecfdf5';
    let tagColor = '#16a34a';
    if (demo.tag.includes('Alerta')) {
      tagBg = '#fff7ed';
      tagColor = '#ea580c';
    } else if (demo.tag.includes('Desmentida')) {
      tagBg = '#fef2f2';
      tagColor = '#dc2626';
    } else if (demo.tag.includes('Verificação')) {
      tagBg = '#fffbeb';
      tagColor = '#d97706';
    }

    btn.innerHTML = `
      <div class="demo-item-header">
        <span class="demo-item-label">${escapeHtml(demo.label)}</span>
        <span class="demo-item-tag" style="background: ${tagBg}; color: ${tagColor};">${escapeHtml(demo.tag)}</span>
      </div>
      <div class="demo-item-title">${escapeHtml(demo.title)}</div>
    `;

    btn.addEventListener('click', async () => {
      // Preenche os campos
      if (DOM.inputNewsUrl) DOM.inputNewsUrl.value = demo.url || '';
      if (DOM.inputNewsTitle) DOM.inputNewsTitle.value = demo.title || '';
      if (DOM.inputNewsText) DOM.inputNewsText.value = demo.text || '';

      showToast(`Carregando: ${demo.label}...`);
      await handleAnalyzeNews(demo);
    });

    DOM.demoCasesContainer.appendChild(btn);
  });
}

/**
 * Executa a análise de notícia (por URL, texto ou caso de teste)
 */
async function handleAnalyzeNews(presetData = null) {
  let url = '';
  let title = '';
  let text = '';

  if (presetData) {
    url = presetData.url || '';
    title = presetData.title || '';
    text = presetData.text || '';
  } else if (currentInformaMode === 'url') {
    url = DOM.inputNewsUrl ? DOM.inputNewsUrl.value.trim() : '';
  } else if (currentInformaMode === 'text') {
    title = DOM.inputNewsTitle ? DOM.inputNewsTitle.value.trim() : '';
    text = DOM.inputNewsText ? DOM.inputNewsText.value.trim() : '';
  } else if (currentInformaMode === 'demo') {
    url = DOM.inputNewsUrl ? DOM.inputNewsUrl.value.trim() : '';
    title = DOM.inputNewsTitle ? DOM.inputNewsTitle.value.trim() : '';
    text = DOM.inputNewsText ? DOM.inputNewsText.value.trim() : '';
  }

  if (!url && !text && !title) {
    showToast('⚠️ Por favor, informe um link ou cole o texto da notícia.');
    return;
  }
  // Estado de carregamento da análise primária do Gemini.
  if (DOM.btnAnalyzeNews) {
    DOM.btnAnalyzeNews.disabled = true;
    DOM.btnAnalyzeNews.textContent = '🤖 Consultando Gemini AI...';
  }
  if (DOM.informaAnalysisStatus) {
    DOM.informaAnalysisStatus.textContent = 'Consultando Gemini AI...';
    DOM.informaAnalysisStatus.hidden = false;
  }

  try {
    const analysis = await LocalNewsAnalyzer.analyze({ url, text, title });

    // Renderiza o resultado, usando as heurísticas locais se o Gemini estiver indisponível.
    renderNewsResult(analysis);

    // Salva no Histórico local da extensão.
    await HistoryStorage.addNewsEntry(analysis);

    const usedGemini = analysis.analyzedBy && analysis.analyzedBy.includes('gemini');
    showToast(usedGemini ? '🤖 Análise com Gemini AI concluída!' : '✅ Análise local concluída.');
  } catch (err) {
    console.error('[SafeWeb Informa] Erro na análise:', err);
    showToast('Erro ao processar análise da notícia.');
  } finally {
    if (DOM.btnAnalyzeNews) {
      DOM.btnAnalyzeNews.disabled = false;
      DOM.btnAnalyzeNews.innerHTML = `
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
          <circle cx="11" cy="11" r="8"></circle>
          <line x1="21" y1="21" x2="16.65" y2="16.65"></line>
        </svg>
        Verificar Informação`;
    }
    if (DOM.informaAnalysisStatus) {
      DOM.informaAnalysisStatus.hidden = true;
      DOM.informaAnalysisStatus.textContent = '';
    }
  }
}

/**
 * Renderiza o cartão de resultados detalhados do SafeWeb Informa
 */
function renderNewsResult(analysis) {
  if (!DOM.informaResultBox) return;

  const badgeBg = analysis.badgeColor || '#3b82f6';
  const resultBadge = analysis.geminiBadge || analysis.classification;

  let reasonsHtml = '';
  if (analysis.reasons && analysis.reasons.length > 0) {
    analysis.reasons.forEach(r => {
      reasonsHtml += `<li>${escapeHtml(r)}</li>`;
    });
  } else {
    reasonsHtml = `<li>Nenhum sinal anômalo evidente foi detectado na estrutura examinada.</li>`;
  }

  let evidenceHtml = '';
  if (analysis.evidence && analysis.evidence.length > 0) {
    analysis.evidence.forEach(e => {
      evidenceHtml += `<li>${escapeHtml(e)}</li>`;
    });
  }

  let unverifiedHtml = '';
  if (analysis.unverified && analysis.unverified.length > 0) {
    analysis.unverified.forEach(u => {
      unverifiedHtml += `<li>${escapeHtml(u)}</li>`;
    });
  }

  let nextStepsHtml = '';
  if (analysis.nextSteps && analysis.nextSteps.length > 0) {
    analysis.nextSteps.forEach(s => {
      nextStepsHtml += `<li>${escapeHtml(s)}</li>`;
    });
  }

  let factCheckHtml = '';
  if (analysis.factCheckLinks && analysis.factCheckLinks.length > 0) {
    factCheckHtml = `
      <div class="informa-section-block">
        <div class="informa-section-title">🔍 Checar em Agências Reconhecidas:</div>
        <div class="factcheck-grid">
          ${analysis.factCheckLinks.map(fc => `
            <a href="${escapeHtml(fc.url)}" target="_blank" class="btn-factcheck" title="Pesquisar este título no ${escapeHtml(fc.name)}">
              ${escapeHtml(fc.name)} ↗
            </a>
          `).join('')}
        </div>
      </div>
    `;
  }

  // Badge opcional de "Analisado por Gemini AI"
  const geminiTagHtml = (analysis.analyzedBy && analysis.analyzedBy.includes('gemini'))
    ? `<div style="display:flex; align-items:center; gap:5px; margin-top:6px;">
         <span style="font-size:9.5px; background:rgba(255,255,255,0.18); color:#fff; padding:2px 7px; border-radius:20px; font-weight:600; letter-spacing:0.3px;">
           🤖 Analisado por Gemini AI
         </span>
       </div>`
    : `<div style="display:flex; align-items:center; gap:5px; margin-top:6px;">
         <span style="font-size:9.5px; background:rgba(255,255,255,0.12); color:rgba(255,255,255,0.7); padding:2px 7px; border-radius:20px;">
           🔎 Heurística local (offline)
         </span>
       </div>`;

  DOM.informaResultBox.style.display = 'block';
  DOM.informaResultBox.innerHTML = `
    <!-- Cabeçalho do Veredito -->
    <div class="informa-result-header" style="background: ${badgeBg};">
      <div class="informa-result-title">${escapeHtml(analysis.title)}</div>
      <div class="informa-result-classification">${escapeHtml(resultBadge)}</div>
      ${geminiTagHtml}
    </div>

    <!-- Metadados Extraídos -->
    <div style="font-size: 11px; color: var(--text-muted); line-height: 1.45; margin-bottom: 6px;">
      <strong>Veículo / Origem:</strong> ${escapeHtml(analysis.domain)}<br/>
      <strong>Autoria:</strong> ${escapeHtml(analysis.author)}<br/>
      <strong>Data de Publicação:</strong> ${escapeHtml(analysis.publishDate)}
    </div>

    ${analysis.geminiExplicacao ? `
    <div class="informa-gemini-explanation">
      <strong>Explicação do Gemini:</strong> ${escapeHtml(analysis.geminiExplicacao)}
    </div>` : ''}

    <!-- Por que chegamos a esse resultado? -->
    <div class="informa-section-block">
      <div class="informa-section-title">❓ Por que chegamos a esse resultado?</div>
      <ul class="informa-list">${reasonsHtml}</ul>
    </div>

    <!-- Evidências encontradas -->
    ${evidenceHtml ? `
    <div class="informa-section-block">
      <div class="informa-section-title">📌 Evidências e Elementos Encontrados:</div>
      <ul class="informa-list">${evidenceHtml}</ul>
    </div>` : ''}

    <!-- O que não foi possível verificar -->
    ${unverifiedHtml ? `
    <div class="informa-section-block">
      <div class="informa-section-title">⚠️ O que ainda não foi possível verificar:</div>
      <ul class="informa-list">${unverifiedHtml}</ul>
    </div>` : ''}

    <!-- Como você pode verificar? -->
    <div class="informa-section-block">
      <div class="informa-section-title">🧭 Como você pode verificar? (Próximos Passos)</div>
      <ul class="informa-list">${nextStepsHtml}</ul>
    </div>

    <!-- Links de Agências de Checagem -->
    ${factCheckHtml}
  `;


  // Rola suavemente até o resultado
  DOM.informaResultBox.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
}


/**
 * Abre o Modal com o Relatório Completo de uma Notícia clicada no Histórico
 */
function openNewsDetailsModal(analysis) {
  if (!DOM.modalSiteTitle || !DOM.modalSiteBody || !DOM.siteModal) return;

  DOM.modalSiteTitle.textContent = `SafeWeb Informa • ${analysis.title.slice(0, 40)}...`;

  let reasonsList = (analysis.reasons || []).map(r => `<li>${escapeHtml(r)}</li>`).join('');
  let evidenceList = (analysis.evidence || []).map(e => `<li>${escapeHtml(e)}</li>`).join('');
  let nextStepsList = (analysis.nextSteps || []).map(s => `<li>${escapeHtml(s)}</li>`).join('');

  DOM.modalSiteBody.innerHTML = `
    <div style="display: flex; flex-direction: column; gap: 8px; font-size: 11.5px; line-height: 1.45;">
      <div>
        <span class="badge" style="background: ${analysis.badgeColor || '#3b82f6'}; color: #fff; font-weight: 700; font-size: 11px;">
          ${escapeHtml(analysis.classification)}
        </span>
      </div>
      <div><strong>Título:</strong> ${escapeHtml(analysis.title)}</div>
      <div><strong>Veículo:</strong> ${escapeHtml(analysis.domain)}</div>
      <div><strong>Data da Análise:</strong> ${formatDateTime(analysis.analyzedAt)}</div>
      
      <hr style="border: 0; border-top: 1px solid var(--border-color); margin: 4px 0;"/>

      <div><strong>Por que chegamos a esse resultado?</strong></div>
      <ul class="informa-list">${reasonsList}</ul>

      ${evidenceList ? `
      <div><strong>Evidências identificadas:</strong></div>
      <ul class="informa-list">${evidenceList}</ul>` : ''}

      <div><strong>Orientações recomendadas:</strong></div>
      <ul class="informa-list">${nextStepsList}</ul>

      <div style="margin-top: 6px; padding: 6px 8px; background: #eff6ff; border-radius: var(--radius-sm); font-size: 10.5px; color: #1e3a8a;">
        💡 <em>Dica para reflexão:</em> Notícias que ativam fortes emoções (raiva, medo ou alívio) merecem uma pausa antes de serem compartilhadas.
      </div>
    </div>
  `;

  DOM.siteModal.classList.add('show');
}
