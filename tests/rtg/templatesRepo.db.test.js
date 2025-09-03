const path = require('path');

// Skip if RTG schema/tables are not present
async function checkRtgTables() {
  try {
    const db = require('../../db/db.js');
    const sql = "select to_regclass('reports.report_templates') as t, to_regclass('reports.report_template_versions') as v";
    const { rows } = await db.query(sql);
    return rows && rows[0] && rows[0].t && rows[0].v;
  } catch (_) {
    return false;
  }
}

describe('templatesRepo (DB-backed)', () => {
  let repo;
  let db;
  let enabled = false;

  beforeAll(async () => {
    jest.setTimeout(10000);
    enabled = await checkRtgTables();
    if (enabled) {
      repo = require(path.join(process.cwd(), 'build/rtg/server/templatesRepo.js'));
      db = require('../../db/db.js');
    }
  });

  test('create -> update content_md -> version bump -> list versions', async () => {
    if (!enabled) {
      console.warn('[SKIP] RTG tables not found; skipping DB-backed templatesRepo test');
      return;
    }
    const created = await repo.createTemplate('Test Repo Template', 'desc', '# v1', 'jest');
    expect(created && created.id).toBeTruthy();

    const updated = await repo.updateTemplate(created.id, { content_md: '# v2' }, 'bump');
    expect(updated && updated.content_md).toContain('# v2');

    const versions = await repo.listVersions(created.id, 10, 0);
    expect(Array.isArray(versions.items)).toBe(true);
    expect(versions.items.length).toBeGreaterThanOrEqual(1);

    // Try to find highest version
    const maxVer = versions.items.reduce((m, r) => Math.max(m, r.version), 0);
    expect(maxVer).toBeGreaterThanOrEqual(2);

    // cleanup
    const ok = await repo.deleteTemplate(created.id);
    expect(ok).toBe(true);
  });
});
