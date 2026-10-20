import sqlite3 from 'sqlite3';
import { open } from 'sqlite';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Garante que o caminho aponte para backend/data/safeweb.db
const dataDir = path.resolve(__dirname, '../data');
const dbPath = path.join(dataDir, 'safeweb.db');

let dbInstance = null;

export async function getDb() {
  if (dbInstance) return dbInstance;

  // Cria a pasta data automaticamente se não existir
  if (!fs.existsSync(dataDir)) {
    fs.mkdirSync(dataDir, { recursive: true });
  }

  dbInstance = await open({
    filename: dbPath,
    driver: sqlite3.Database
  });

  await initializeTables(dbInstance);
  return dbInstance;
}

async function initializeTables(db) {
  // Tabela para o monitoramento de disponibilidade (uptime)
  await db.exec(`
    CREATE TABLE IF NOT EXISTS monitored_sites (
      id TEXT PRIMARY KEY,
      url TEXT NOT NULL,
      alias TEXT,
      status TEXT DEFAULT 'unknown',
      http_status INTEGER,
      response_time_ms INTEGER,
      last_checked TEXT,
      last_status_change TEXT,
      failures_count INTEGER DEFAULT 0,
      added_at TEXT
    );
  `);

  // Tabela para a Base Comunitária de Denúncias
  await db.exec(`
    CREATE TABLE IF NOT EXISTS reports (
      id TEXT PRIMARY KEY,
      domain TEXT NOT NULL,
      url TEXT,
      category TEXT NOT NULL,
      description TEXT,
      status TEXT DEFAULT 'pending',
      review_notes TEXT,
      created_at TEXT NOT NULL,
      updated_at TEXT
    );
  `);

  // Tabela de Cache para reputação externa (ex: Google Safe Browsing e combinados)
  await db.exec(`
    CREATE TABLE IF NOT EXISTS reputation_cache (
      id TEXT PRIMARY KEY,
      domain TEXT NOT NULL UNIQUE,
      risk_level TEXT NOT NULL,
      classification TEXT NOT NULL,
      source TEXT NOT NULL,
      details TEXT,
      last_verified TEXT NOT NULL
    );
  `);

  // Tabela para o Módulo SafeWeb Informa (Análise de Notícias e Desinformação)
  await db.exec(`
    CREATE TABLE IF NOT EXISTS news_analyses (
      id TEXT PRIMARY KEY,
      url TEXT,
      title TEXT NOT NULL,
      domain TEXT,
      author TEXT,
      publish_date TEXT,
      classification TEXT NOT NULL,
      risk_level TEXT NOT NULL,
      reasons TEXT,
      evidence TEXT,
      sources TEXT,
      unverified TEXT,
      next_steps TEXT,
      analyzed_at TEXT NOT NULL
    );
  `);

  // Otimização: removemos a tabela pesada de blocklists antigas para poupar memória e processamento
  try {
    await db.exec(`DROP TABLE IF EXISTS known_threats;`);
  } catch {}

  // Migrações seguras caso tabelas anteriores existam com menos colunas
  const tryAddColumn = async (table, columnDef) => {
    try {
      await db.exec(`ALTER TABLE ${table} ADD COLUMN ${columnDef};`);
    } catch {
      // Ignora erro se coluna já existir
    }
  };

  await tryAddColumn('reports', 'url TEXT');
  await tryAddColumn('reports', 'review_notes TEXT');
  await tryAddColumn('reports', 'updated_at TEXT');
  await tryAddColumn('reputation_cache', 'classification TEXT');

  // A chave primária em id não é suficiente para o UPSERT que conflita por domain.
  const indexes = await db.all('PRAGMA index_list(reputation_cache)');
  let hasUniqueDomain = false;
  for (const index of indexes) {
    if (index.unique !== 1) continue;

    const quotedIndexName = index.name.replace(/"/g, '""');
    const columns = await db.all(`PRAGMA index_info("${quotedIndexName}")`);
    if (columns.length === 1 && columns[0].name === 'domain') {
      hasUniqueDomain = true;
      break;
    }
  }

  if (!hasUniqueDomain) {
    await db.exec('BEGIN IMMEDIATE');
    try {
      // Cache antigo pode conter várias entradas para o mesmo domínio.
      await db.exec(`
        DELETE FROM reputation_cache AS older
        WHERE EXISTS (
          SELECT 1
          FROM reputation_cache AS newer
          WHERE newer.domain = older.domain
            AND (
              newer.last_verified > older.last_verified
              OR (
                newer.last_verified = older.last_verified
                AND newer.rowid > older.rowid
              )
            )
        );
      `);
      await db.exec(`
        CREATE UNIQUE INDEX IF NOT EXISTS reputation_cache_domain_unique_idx
        ON reputation_cache(domain);
      `);
      await db.exec('COMMIT');
      console.log('[SafeWeb DB] Migração aplicada: índice UNIQUE(domain) criado em reputation_cache.');
    } catch (err) {
      try {
        await db.exec('ROLLBACK');
      } catch (rollbackError) {
        console.error('[SafeWeb DB] Falha ao reverter migração reputation_cache:', rollbackError.message);
      }
      throw err;
    }
  }
}
