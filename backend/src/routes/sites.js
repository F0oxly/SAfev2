/**
 * SafeWeb - Sites Routes
 * Desenvolvido por Iury.
 */

import { Router } from 'express';
import { monitorService } from '../services/monitor.js';

const router = Router();

// Listar todos os sites monitorados
router.get('/', async (req, res) => {
  try {
    const sites = await monitorService.getSites();
    res.json({ success: true, count: sites.length, sites });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// Cadastrar novo site
router.post('/', async (req, res) => {
  const { url, alias, id } = req.body;
  if (!url) {
    return res.status(400).json({ success: false, error: 'URL é obrigatória.' });
  }

  const siteId = id || 'site_' + Date.now();
  const site = {
    id: siteId,
    url,
    alias: alias || url,
    status: 'checking',
    httpStatus: null,
    responseTimeMs: null,
    lastChecked: null,
    addedAt: new Date().toISOString()
  };

  try {
    await monitorService.addOrUpdateSite(site);

    // Checagem imediata assíncrona
    monitorService.checkUrl(url).then(async result => {
      site.status = result.status;
      site.httpStatus = result.httpStatus;
      site.responseTimeMs = result.responseTimeMs;
      site.lastChecked = result.checkedAt;
      await monitorService.addOrUpdateSite(site);
    });

    res.status(201).json({ success: true, site });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// Checar status imediato de uma URL (sem cadastrar)
router.post('/check', async (req, res) => {
  const { url } = req.body;
  if (!url) {
    return res.status(400).json({ success: false, error: 'URL é obrigatória.' });
  }

  try {
    const result = await monitorService.checkUrl(url);
    res.json(result);
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// Sincronizar múltiplos sites da extensão
router.post('/sync', async (req, res) => {
  const { sites } = req.body;
  if (Array.isArray(sites)) {
    try {
      await monitorService.syncSites(sites);
      res.json({ success: true, synced: sites.length });
    } catch (err) {
      res.status(500).json({ success: false, error: err.message });
    }
  } else {
    res.status(400).json({ success: false, error: 'Array de sites esperado.' });
  }
});

// Remover site
router.delete('/:id', async (req, res) => {
  const { id } = req.params;
  try {
    const existed = await monitorService.removeSite(id);
    res.json({ success: existed });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

export default router;
