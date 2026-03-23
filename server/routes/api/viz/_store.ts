import Database from 'better-sqlite3';
import { resolve } from 'node:path';

export interface StoredFile {
  id: string;
  text: string;
  name: string;
  description: string;
  updatedAt: string;
  format: string | null;
  originalText: string | null;
  likesCount: number;
  youHaveLiked: boolean;
  project: {
    id: string;
    name: string;
    owner: {
      id: string;
      displayName: string;
      avatarUrl: string;
    };
  };
}

const DB_PATH = process.env.DB_PATH === ':memory:' ? ':memory:' : resolve(process.cwd(), process.env.DB_PATH || 'sketch.db');
const db = new Database(DB_PATH);

db.pragma('journal_mode = WAL');

db.exec(`
  CREATE TABLE IF NOT EXISTS source_files (
    id TEXT PRIMARY KEY,
    text TEXT NOT NULL,
    name TEXT NOT NULL,
    description TEXT NOT NULL DEFAULT '',
    updated_at TEXT NOT NULL,
    fork_from_id TEXT,
    format TEXT,
    original_text TEXT
  )
`);

// Add columns if they don't exist (migration for existing DBs)
try { db.exec('ALTER TABLE source_files ADD COLUMN format TEXT'); } catch {}
try { db.exec('ALTER TABLE source_files ADD COLUMN original_text TEXT'); } catch {}

let counter = db.prepare('SELECT COUNT(*) as c FROM source_files').get() as {
  c: number;
};
let nextId = counter.c;

// --- Files ---

export function createFile(
  text: string,
  name: string,
  forkFromId?: string,
  format?: string,
  originalText?: string,
): StoredFile {
  const id = `local-${++nextId}-${Date.now().toString(36)}`;
  const updatedAt = new Date().toISOString();

  db.prepare(
    'INSERT INTO source_files (id, text, name, description, updated_at, fork_from_id, format, original_text) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
  ).run(id, text, name, '', updatedAt, forkFromId ?? null, format ?? null, originalText ?? null);

  return toStoredFile({ id, text, name, description: '', updated_at: updatedAt, format: format ?? null, original_text: originalText ?? null });
}

export function getFile(id: string): StoredFile | undefined {
  const row = db.prepare('SELECT * FROM source_files WHERE id = ?').get(id) as
    | { id: string; text: string; name: string; description: string; updated_at: string; format: string | null; original_text: string | null }
    | undefined;
  if (!row) return undefined;
  return toStoredFile(row);
}

function toStoredFile(
  row: {
    id: string;
    text: string;
    name: string;
    description: string;
    updated_at: string;
    format: string | null;
    original_text: string | null;
  },
): StoredFile {
  return {
    id: row.id,
    text: row.text,
    name: row.name,
    description: row.description,
    updatedAt: row.updated_at,
    format: row.format,
    originalText: row.original_text,
    likesCount: 0,
    youHaveLiked: false,
    project: {
      id: 'local-project',
      name: 'Local',
      owner: {
        id: 'anonymous',
        displayName: 'Anonymous',
        avatarUrl: '',
      },
    },
  };
}
