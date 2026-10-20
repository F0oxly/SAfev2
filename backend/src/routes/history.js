/**
 * SafeWeb - History Routes
 */

import { Router } from 'express';
import { monitorService } from '../services/monitor.js';

const router = Router();

// Obter histórico de ocorrências
router.get('/', (req, res) => {
  res.json({
    success: true,
    count: monitorService.history.length,
    history: monitorService.history
  });
});

// Limpar histórico
router.delete('/', (req, res) => {
  monitorService.history = [];
  res.json({ success: true, message: 'Histórico limpo com sucesso.' });
});

export default router;
