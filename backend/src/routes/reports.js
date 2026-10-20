/**
 * SafeWeb - Reports Routes (Base Comunitária)
 * Desenvolvido por Iury.
 */

import { Router } from 'express';
import { ReportsService, VALID_CATEGORIES } from '../services/reports.js';

const router = Router();

// Obter categorias válidas para denúncia
router.get('/categories', (req, res) => {
  res.json({
    success: true,
    categories: Object.entries(VALID_CATEGORIES).map(([key, label]) => ({
      key,
      label
    }))
  });
});

// Cadastrar nova denúncia de site
router.post('/', async (req, res) => {
  const { domain, url, category, description } = req.body;

  if (!domain && !url) {
    return res.status(400).json({ success: false, error: 'Domínio ou URL é obrigatório.' });
  }

  try {
    const result = await ReportsService.createReport({
      domain,
      url,
      category,
      description
    });
    res.status(201).json(result);
  } catch (err) {
    res.status(400).json({ success: false, error: err.message });
  }
});

// Consultar resumo comunitário de um domínio específico
router.get('/domain/:domain', async (req, res) => {
  const { domain } = req.params;

  try {
    const summary = await ReportsService.getDomainSummary(domain);
    res.json({ success: true, summary });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// Listar denúncias recentes
router.get('/', async (req, res) => {
  const limit = parseInt(req.query.limit || '50', 10);

  try {
    const reports = await ReportsService.listRecentReports(limit);
    res.json({ success: true, count: reports.length, reports });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// Atualizar status de uma denúncia (confirmada, descartada, inconclusiva)
router.patch('/:id/status', async (req, res) => {
  const { id } = req.params;
  const { status, reviewNotes } = req.body;

  if (!status) {
    return res.status(400).json({ success: false, error: 'Status é obrigatório.' });
  }

  try {
    const updated = await ReportsService.updateStatus(id, status, reviewNotes);
    if (!updated) {
      return res.status(404).json({ success: false, error: 'Denúncia não encontrada.' });
    }
    res.json({ success: true, message: `Status da denúncia atualizado para "${status}".` });
  } catch (err) {
    res.status(400).json({ success: false, error: err.message });
  }
});

export default router;
