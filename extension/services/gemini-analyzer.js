/**
 * SafeWeb - Gemini AI Analyzer
 * Requests Gemini analysis through the backend so API credentials stay server-side.
 */

import { ApiClient } from './api-client.js';

const GEMINI_TIMEOUT_MS = 15000;

export async function analisarComGemini(titulo, texto, url = '') {
  try {
    const baseUrl = await ApiClient.getBaseUrl();
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), GEMINI_TIMEOUT_MS);

    let response;
    try {
      response = await fetch(`${baseUrl}/api/news/gemini`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title: titulo, text: texto, url }),
        signal: controller.signal
      });
    } finally {
      clearTimeout(timeoutId);
    }

    if (!response.ok) {
      const errBody = await response.text();
      console.warn(`[SafeWeb Gemini] Backend retornou HTTP ${response.status}:`, errBody.slice(0, 200));
      return null;
    }

    const data = await response.json();
    return data.analysis || null;
  } catch (err) {
    if (err.name === 'AbortError') {
      console.warn('[SafeWeb Gemini] Timeout — análise demorou mais que', GEMINI_TIMEOUT_MS, 'ms');
    } else {
      console.warn('[SafeWeb Gemini] Backend indisponível para análise:', err.message);
    }
    return null;
  }
}
