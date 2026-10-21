/**
 * SafeWeb - Background Service Worker (Manifest V3)
 * Desenvolvido integralmente por Iury.
 * Responsável pelo ciclo de vida, alarmes periódicos, checagem de disponibilidade,
 * notificações e gerenciamento de badges.
 */

import { StorageManager, DEFAULT_CONFIG } from '../storage/storage-manager.js';
import { SitesStorage } from '../storage/sites-storage.js';
import { HistoryStorage } from '../storage/history-storage.js';
import { SecurityAnalyzer } from '../services/security-analyzer.js';
import { ApiClient } from '../services/api-client.js';

const ALARM_NAME = 'safeweb_periodic_check';

// Ciclo de Inicialização da Extensão
chrome.runtime.onInstalled.addListener(async () => {
  console.log('[SafeWeb] Extensão instalada com sucesso.');
  await setupPeriodicAlarm();
  await updateBadge();
});

chrome.runtime.onStartup.addListener(async () => {
  console.log('[SafeWeb] Inicializando serviço em background...');
  await setupPeriodicAlarm();
  await updateBadge();
});

/**
 * Configura o alarme periódico no chrome.alarms
 */
async function setupPeriodicAlarm() {
  const config = await StorageManager.getConfig();
  const periodInMinutes = Math.max(1, config.checkIntervalMinutes || 2);

  chrome.alarms.clear(ALARM_NAME, () => {
    chrome.alarms.create(ALARM_NAME, {
      periodInMinutes: periodInMinutes,
      delayInMinutes: 0.2 // Primeira execução rápida
    });
    console.log(`[SafeWeb] Alarme periódico agendado a cada ${periodInMinutes} minuto(s).`);
  });
}

// Listener de Alarmes
chrome.alarms.onAlarm.addListener(async (alarm) => {
  if (alarm.name === ALARM_NAME) {
    console.log('[SafeWeb] Executando rotina de verificação periódica...');
    await checkAllSites();
  }
});

/**
 * Executa a checagem de todos os sites cadastrados
 */
export async function checkAllSites() {
  const sites = await SitesStorage.getAll();
  if (sites.length === 0) {
    await updateBadge();
    return [];
  }

  const results = [];
  for (const site of sites) {
    const result = await checkSingleSite(site);
    if (result) results.push(result);
  }

  await updateBadge();
  return results;
}

/**
 * Realiza o teste de conectividade e status de um site específico
 * @param {Object} site 
 */
export async function checkSingleSite(site) {
  const startTime = Date.now();
  const previousStatus = site.status;
  let isOnline = false;
  let httpStatus = null;
  let errorMessage = null;

  // 1. Tentar verificar via Backend se disponível
  const backendOnline = await ApiClient.isBackendAvailable();
  if (backendOnline) {
    const backendResult = await ApiClient.checkSite(site.url);
    if (backendResult && backendResult.checked) {
      isOnline = backendResult.status === 'online';
      httpStatus = backendResult.httpStatus;
      errorMessage = backendResult.error || null;
    }
  }

  // 2. Fallback: Verificação direta a partir do Service Worker
  if (httpStatus === null) {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 6000); // 6s timeout

      // Tenta primeiro método HEAD (leve) e faz fallback para GET se não suportado
      let response;
      try {
        response = await fetch(site.url, {
          method: 'HEAD',
          signal: controller.signal,
          mode: 'no-cors', // Garante execução sem bloqueio de CORS no fetch opaco
          cache: 'no-store'
        });
      } catch {
        response = await fetch(site.url, {
          method: 'GET',
          signal: controller.signal,
          mode: 'no-cors',
          cache: 'no-store'
        });
      }

      clearTimeout(timeoutId);
      
      // Em modo no-cors o status vem 0 (sucesso opaco = site respondeu)
      httpStatus = response.status === 0 ? 200 : response.status;
      isOnline = httpStatus >= 200 && httpStatus < 400;
    } catch (err) {
      isOnline = false;
      httpStatus = null;
      errorMessage = err.name === 'AbortError' ? 'Tempo limite esgotado (Timeout)' : 'Falha na conexão de rede';
    }
  }

  const responseTimeMs = Date.now() - startTime;
  const newStatus = isOnline ? 'online' : 'offline';
  const nowIso = new Date().toISOString();

  // Atualizar dados do site no Storage
  const updatedSite = await SitesStorage.update(site.id, {
    status: newStatus,
    httpStatus: httpStatus,
    responseTimeMs: responseTimeMs,
    lastChecked: nowIso,
    lastStatusChange: (previousStatus !== newStatus) ? nowIso : site.lastStatusChange
  });
  if (!updatedSite) return null;

  // Detecção de Mudança de Estado e Notificações
  if (previousStatus && previousStatus !== 'unknown' && previousStatus !== newStatus) {
    if (newStatus === 'offline') {
      // Site caiu
      await HistoryStorage.addEntry({
        siteId: site.id,
        url: site.url,
        type: 'status_change',
        message: `O site ficou INDISPONÍVEL (${errorMessage || (httpStatus ? 'HTTP ' + httpStatus : 'Sem resposta')}).`,
        httpStatus: httpStatus,
        responseTimeMs: responseTimeMs,
        previousStatus: previousStatus,
        newStatus: newStatus
      });

      await triggerNotification(
        `safeweb_offline_${site.id}_${Date.now()}`,
        '⚠️ Alerta de Indisponibilidade - SafeWeb',
        `O site monitorado "${site.alias || site.hostname}" está fora do ar!`
      );
    } else if (newStatus === 'online') {
      // Site recuperou
      await HistoryStorage.addEntry({
        siteId: site.id,
        url: site.url,
        type: 'recovery',
        message: `O site recuperou a conexão e voltou a responder normalmente (${responseTimeMs}ms).`,
        httpStatus: httpStatus,
        responseTimeMs: responseTimeMs,
        previousStatus: previousStatus,
        newStatus: newStatus
      });

      await triggerNotification(
        `safeweb_online_${site.id}_${Date.now()}`,
        '✅ Site Recuperado - SafeWeb',
        `O site "${site.alias || site.hostname}" voltou a ficar online.`
      );
    }
  }

  return updatedSite;
}

/**
 * Dispara uma notificação nativa para o usuário
 */
async function triggerNotification(notificationId, title, message) {
  const config = await StorageManager.getConfig();
  if (!config.notificationsEnabled) return;

  try {
    chrome.notifications.create(notificationId, {
      type: 'basic',
      iconUrl: chrome.runtime.getURL('icons/icon-128.png'),
      title: title,
      message: message,
      priority: 2
    });
  } catch (err) {
    console.error('[SafeWeb] Falha ao disparar notificação:', err);
  }
}

/**
 * Atualiza o badge no ícone da extensão
 */
export async function updateBadge() {
  try {
    const sites = await SitesStorage.getAll();
    const offlineCount = sites.filter(s => s.status === 'offline').length;

    if (offlineCount > 0) {
      await chrome.action.setBadgeText({ text: String(offlineCount) });
      await chrome.action.setBadgeBackgroundColor({ color: '#dc2626' }); // Vermelho
    } else {
      await chrome.action.setBadgeText({ text: '' });
    }
  } catch (err) {
    console.error('[SafeWeb] Erro ao atualizar badge:', err);
  }
}

// Comunicação com o Popup (Message Passing)
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  (async () => {
    try {
      if (message.action === 'CHECK_ALL_SITES') {
        const results = await checkAllSites();
        sendResponse({ success: true, sites: results });
      } else if (message.action === 'CHECK_SINGLE_SITE') {
        const site = await SitesStorage.getById(message.siteId);
        if (!site) {
          sendResponse({ success: false, error: 'Site não encontrado' });
          return;
        }
        const updated = await checkSingleSite(site);
        if (!updated) {
          sendResponse({ success: false, error: 'Site não encontrado' });
          return;
        }
        await updateBadge();
        sendResponse({ success: true, site: updated });
      } else if (message.action === 'ANALYZE_URL_SECURITY') {
        const config = await StorageManager.getConfig();
        const analysis = SecurityAnalyzer.analyze(message.url, config.threatSensitivity);
        sendResponse({ success: true, analysis });
      } else if (message.action === 'RELOAD_ALARM') {
        await setupPeriodicAlarm();
        sendResponse({ success: true });
      } else {
        sendResponse({ success: false, error: 'Ação não reconhecida' });
      }
    } catch (err) {
      console.error('[SafeWeb SW] Erro ao processar mensagem:', err);
      sendResponse({ success: false, error: err.message });
    }
  })();

  return true; // Mantém o canal de resposta assíncrona aberto
});
