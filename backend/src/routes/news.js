/**
 * SafeWeb - News Routes (SafeWeb Informa)
 * Desenvolvido por Iury.
 */

import { Router } from 'express';
import { NewsAnalyzerService } from '../services/news-analyzer.js';
import { GeminiService } from '../services/gemini.js';

const router = Router();

// Análise Gemini (a chave é mantida exclusivamente no backend)
router.post('/gemini', async (req, res) => {
  const { url = '', text = '', title = '' } = req.body;

  if (!url && !text && !title) {
    return res.status(400).json({
      success: false,
      error: 'Informe a URL, o título ou o texto da notícia.'
    });
  }

  try {
    const analysis = await GeminiService.analyze({ url, text, title });
    res.json({ success: true, analysis });
  } catch (err) {
    console.error('[SafeWeb Gemini Route] Erro na análise:', err.message);
    res.status(err.statusCode || 502).json({ success: false, error: err.message });
  }
});

// Analisar notícia (por URL ou texto colado)
router.post('/analyze', async (req, res) => {
  const { url, text, title } = req.body;

  if (!url && !text && !title) {
    return res.status(400).json({
      success: false,
      error: 'Por favor, informe a URL da notícia ou cole o texto para análise.'
    });
  }

  try {
    const analysis = await NewsAnalyzerService.analyzeNews({ url, text, title });
    res.json({ success: true, analysis });
  } catch (err) {
    console.error('[SafeWeb News Route] Erro ao analisar notícia:', err);
    res.status(500).json({ success: false, error: err.message });
  }
});

// Casos demonstrativos para a aula da turma de Psicologia
router.get('/examples', (req, res) => {
  const examples = NewsAnalyzerService.getEducationalDemoCases();
  res.json({ success: true, count: examples.length, examples });
});

// Histórico de análises de notícias
router.get('/history', async (req, res) => {
  const limit = parseInt(req.query.limit || '30', 10);
  try {
    const history = await NewsAnalyzerService.getHistory(limit);
    res.json({ success: true, count: history.length, history });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

export default router;
