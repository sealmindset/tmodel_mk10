import fs from 'fs/promises';
import path from 'path';

function safeRequire(p: string) {
  const full = path.join(process.cwd(), p);
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  return require(full);
}

const db = safeRequire('db/db.js');
import * as repo from './templatesRepo';

export interface ImportResult {
  scanned: number;
  created: number;
  updated: number;
  skipped: number;
  errors: { file: string; error: string }[];
  items: { name: string; action: 'created'|'updated'|'skipped'|'error'; id?: string }[];
}

function baseNameWithoutExt(file: string) {
  const base = path.basename(file);
  const idx = base.lastIndexOf('.');
  if (idx <= 0) return base; // no ext or dotfile
  return base.slice(0, idx);
}

async function existsByName(name: string): Promise<{ id: string } | null> {
  const sql = `SELECT id FROM reports.report_templates WHERE name = $1 LIMIT 1`;
  const { rows } = await db.query(sql, [name]);
  return rows?.[0] || null;
}

async function updateContent(id: string, content_md: string): Promise<void> {
  const sql = `UPDATE reports.report_templates SET content_md = $2, updated_at = now() WHERE id = $1`;
  await db.query(sql, [id, content_md]);
}

export async function importDocsTemplates(directory?: string, opts: { overwrite?: boolean } = {}): Promise<ImportResult> {
  const dir = directory || path.join(process.cwd(), 'docs', 'report-templates');
  const overwrite = !!opts.overwrite;
  const result: ImportResult = { scanned: 0, created: 0, updated: 0, skipped: 0, errors: [], items: [] };

  let names: string[];
  try {
    names = await fs.readdir(dir);
  } catch (e: any) {
    result.errors.push({ file: dir, error: e?.message || String(e) });
    return result;
  }

  for (const baseName of names) {
    if (!baseName || baseName.startsWith('.')) continue;
    const full = path.join(dir, baseName);
    try {
      const stat = await fs.stat(full);
      if (!stat.isFile()) continue;
    } catch (_) { continue; }

    result.scanned += 1;
    try {
      const content = await fs.readFile(full, 'utf8');
      const name = baseNameWithoutExt(baseName);
      const firstLine = (content.split(/\r?\n/).find((l) => l.trim().length > 0) || '').trim();
      const description = firstLine && firstLine.length <= 200 ? firstLine : null;

      const existing = await existsByName(name);
      if (existing) {
        if (overwrite) {
          await updateContent(existing.id, content);
          result.updated += 1;
          result.items.push({ name, action: 'updated', id: existing.id });
        } else {
          result.skipped += 1;
          result.items.push({ name, action: 'skipped', id: existing.id });
        }
        continue;
      }

      const row = await repo.createTemplate(name, description, content, 'system');
      result.created += 1;
      result.items.push({ name, action: 'created', id: row.id });
    } catch (e: any) {
      result.errors.push({ file: full, error: e?.message || String(e) });
      result.items.push({ name: baseName, action: 'error' });
    }
  }

  return result;
}
