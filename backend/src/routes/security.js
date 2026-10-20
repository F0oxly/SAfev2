/**
 * SafeWeb - Security & Reputation Routes
 * Desenvolvido por Iury.
 */

import { Router } from 'express';
import { SecurityService } from '../services/security.js';

const router = Router();

// Avaliação completa de reputação (Fontes confiáveis + Base Comunitária + Cache)
router.post('/evaluate', async (req, res) => {
  const { url, domain, title = '', context = '' } = req.body;
  const target = url || domain;

  if (!target) {
    return res.status(400).json({ success: false, error: 'URL ou domínio é obrigatório.' });
  }
  if (typeof title !== 'string' || typeof context !== 'string') {
    return res.status(400).json({ success: false, error: 'Título e contexto devem ser textos.' });
  }

  try {
    const evaluation = await SecurityService.evaluateReputation(target, {
      title: title.slice(0, 300),
      context: context.slice(0, 1800)
    });
    res.json({ success: true, evaluation });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// Consulta rápida de reputação de domínio
router.get('/reputation/:domain', async (req, res) => {
  const { domain } = req.params;

  try {
    const evaluation = await SecurityService.evaluateReputation(domain);
    res.json({ success: true, evaluation });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// Endpoint legado mantido para compatibilidade
router.post('/analyze', async (req, res) => {
  const { url } = req.body;
  if (!url) {
    return res.status(400).json({ success: false, error: 'URL é obrigatória.' });
  }

  try {
    const evaluation = await SecurityService.evaluateReputation(url);
    res.json({
      success: true,
      analysis: {
        url,
        level: evaluation.riskLevel,
        label: evaluation.classification,
        reasons: evaluation.reasons,
        providers: evaluation.sources,
        geminiAnalysis: evaluation.geminiAnalysis || null,
        community: evaluation.community,
        analyzedAt: evaluation.checkedAt
      }
    });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

export default router;
