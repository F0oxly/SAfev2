/**
 * SafeWeb - Backend Server
 * Desenvolvido integralmente por Iury.
 * Servidor Express com suporte a CORS, health checks, inicialização do Monitor Service
 * e Módulo SafeWeb Informa (Detecção de Desinformação).
 */

import 'dotenv/config';
import express from 'express';
import cors from 'cors';

import sitesRouter from './routes/sites.js';
import historyRouter from './routes/history.js';
import securityRouter from './routes/security.js';
import reportsRouter from './routes/reports.js';
import newsRouter from './routes/news.js';
import { monitorService } from './services/monitor.js';

const app = express();
const PORT = process.env.PORT || 3000;
const MONITOR_INTERVAL = parseInt(process.env.MONITOR_INTERVAL_SECONDS || '60', 10);

// Middlewares
app.use(cors({
  origin: '*', // Permite requisições da extensão Chrome
  methods: ['GET', 'POST', 'DELETE', 'PUT', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));

app.use(express.json());

// Endpoint de Health Check
app.get('/api/health', async (req, res) => {
  let stats = { monitoredSites: 0, reports: 0, newsAnalyses: 0 };
  try {
    const { getDb } = await import('./database.js');
    const db = await getDb();
    const sitesRow = await db.get('SELECT COUNT(*) as count FROM monitored_sites');
    const reportsRow = await db.get('SELECT COUNT(*) as count FROM reports');
    const newsRow = await db.get('SELECT COUNT(*) as count FROM news_analyses');
    stats = {
      monitoredSites: sitesRow?.count || 0,
      reports: reportsRow?.count || 0,
      newsAnalyses: newsRow?.count || 0
    };
  } catch {}

  res.json({
    status: 'ok',
    service: 'SafeWeb Backend & Informa',
    author: 'Iury',
    version: '2.5.0',
    uptimeSeconds: Math.floor(process.uptime()),
    stats,
    timestamp: new Date().toISOString()
  });
});

// Rotas da API
app.use('/api/sites', sitesRouter);
app.use('/api/history', historyRouter);
app.use('/api/security', securityRouter);
app.use('/api/reports', reportsRouter);
app.use('/api/news', newsRouter);

// Tratamento de Rota Não Encontrada
app.use((req, res) => {
  res.status(404).json({ success: false, error: 'Endpoint não encontrado.' });
});

// Inicialização do Servidor
app.listen(PORT, async () => {
  console.log(`=========================================`);
  console.log(`🛡️  SafeWeb Backend & Informa ativo na porta ${PORT}`);
  console.log(`👨‍💻 Desenvolvido por Iury`);
  console.log(`📰 Módulo SafeWeb Informa: /api/news`);
  console.log(`🌐 Health check: http://localhost:${PORT}/api/health`);
  console.log(`=========================================`);

  // Iniciar serviço de monitoramento contínuo independente
  monitorService.start(MONITOR_INTERVAL);
});
