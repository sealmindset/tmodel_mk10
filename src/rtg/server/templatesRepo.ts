import path from 'path';

function safeRequire(p: string) {
  const full = path.join(process.cwd(), p);
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  return require(full);
}

const db = safeRequire('db/db.js');

export interface TemplateRow {
  id: string;
  api_id: number;
  name: string;
  description?: string | null;
  content_md: string;
  created_by?: string | null;
  created_at: string;
  updated_at: string;
}

export interface VersionRow {
  id: string;
  api_id: number;
  template_id: string;
  version: number;
  content_md: string;
  changelog?: string | null;
  created_by?: string | null;
  created_at: string;
}

export async function listTemplates(q?: string, limit = 50, offset = 0): Promise<{ items: TemplateRow[]; total: number }>{
  const where = q ? `WHERE lower(name) LIKE lower($1)` : '';
  const params: any[] = q ? [`%${q}%`, limit, offset] : [limit, offset];
  const baseIdx = q ? 2 : 0;
  const sql = `SELECT id, api_id, name, description, content_md, created_by, created_at, updated_at
               FROM reports.report_templates ${where}
               ORDER BY updated_at DESC
               LIMIT $${baseIdx + 1} OFFSET $${baseIdx + 2}`;
  const countSql = `SELECT COUNT(*) AS total FROM reports.report_templates ${where}`;
  const [rowsRes, countRes] = await Promise.all([
    db.query(sql, params),
    db.query(countSql, q ? [params[0]] : [])
  ]);
  const total = parseInt(countRes.rows?.[0]?.total || '0', 10);
  return { items: rowsRes.rows || [], total };
}

export async function createTemplate(name: string, description: string | null, content_md: string, created_by: string | null): Promise<TemplateRow>{
  const sql = `INSERT INTO reports.report_templates (name, description, content_md, created_by)
               VALUES ($1, $2, $3, $4)
               RETURNING id, api_id, name, description, content_md, created_by, created_at, updated_at`;
  const { rows } = await db.query(sql, [name, description, content_md, created_by]);
  return rows[0];
}

export async function getTemplate(id: string): Promise<TemplateRow | null> {
  const sql = `SELECT id, api_id, name, description, content_md, created_by, created_at, updated_at
               FROM reports.report_templates WHERE id = $1`;
  const { rows } = await db.query(sql, [id]);
  return rows[0] || null;
}

export async function updateTemplate(id: string, fields: Partial<Pick<TemplateRow, 'name'|'description'|'content_md'>>, changelog?: string | null): Promise<TemplateRow | null> {
  const sets: string[] = [];
  const params: any[] = [];
  let idx = 1;
  if (fields.name != null) { sets.push(`name = $${idx++}`); params.push(fields.name); }
  if (fields.description !== undefined) { sets.push(`description = $${idx++}`); params.push(fields.description); }
  if (fields.content_md != null) { sets.push(`content_md = $${idx++}`); params.push(fields.content_md); }
  if (!sets.length) {
    return await getTemplate(id); // no-op
  }
  const sql = `UPDATE reports.report_templates SET ${sets.join(', ')}, updated_at = now() WHERE id = $${idx} RETURNING id, api_id, name, description, content_md, created_by, created_at, updated_at`;
  params.push(id);
  const { rows } = await db.query(sql, params);
  const updated = rows[0] || null;
  // If content changed and changelog was provided, set changelog on latest version
  if (updated && fields.content_md != null && changelog) {
    await updateLatestVersionChangelog(id, changelog);
  }
  return updated;
}

export async function deleteTemplate(id: string): Promise<boolean> {
  const sql = `DELETE FROM reports.report_templates WHERE id = $1`;
  const res = await db.query(sql, [id]);
  // node-postgres returns rowCount for DELETE; if undefined, treat as true
  return typeof res.rowCount === 'number' ? res.rowCount > 0 : true;
}

export async function listVersions(templateId: string, limit = 50, offset = 0): Promise<{ items: VersionRow[]; total: number }>{
  const sql = `SELECT id, api_id, template_id, version, content_md, changelog, created_by, created_at
               FROM reports.report_template_versions WHERE template_id = $1
               ORDER BY created_at DESC
               LIMIT $2 OFFSET $3`;
  const countSql = `SELECT COUNT(*) AS total FROM reports.report_template_versions WHERE template_id = $1`;
  const [rowsRes, countRes] = await Promise.all([
    db.query(sql, [templateId, limit, offset]),
    db.query(countSql, [templateId])
  ]);
  const total = parseInt(countRes.rows?.[0]?.total || '0', 10);
  return { items: rowsRes.rows || [], total };
}

export async function getVersion(templateId: string, version: number): Promise<VersionRow | null> {
  const sql = `SELECT id, api_id, template_id, version, content_md, changelog, created_by, created_at
               FROM reports.report_template_versions WHERE template_id = $1 AND version = $2`;
  const { rows } = await db.query(sql, [templateId, version]);
  return rows[0] || null;
}

export async function updateLatestVersionChangelog(templateId: string, changelog: string): Promise<void> {
  const sql = `UPDATE reports.report_template_versions v
               SET changelog = $2
               WHERE v.template_id = $1 AND v.version = (
                 SELECT MAX(version) FROM reports.report_template_versions WHERE template_id = $1
               )`;
  await db.query(sql, [templateId, changelog]);
}
