const express = require('express');
const request = require('supertest');

function makeApp() {
  const app = express();
  app.use(express.json());
  // inject a fake user to simulate ensureAuthenticated-mounted router behavior
  app.use((req, _res, next) => { req.user = { username: 'tester' }; next(); });
  const router = require('../../routes/api/rtg.js');
  app.use('/api/rtg', router);
  return app;
}

describe('RTG Templates API', () => {
  beforeAll(() => {
    const repoPath = require.resolve('../../build/rtg/server/templatesRepo.js');
    jest.resetModules();
    jest.doMock(repoPath, () => ({
      listTemplates: jest.fn(async (q, limit, offset) => ({
        items: [
          { id: '11111111-1111-1111-1111-111111111111', api_id: 1, name: 'T1', description: 'd', content_md: '# one', created_by: 'u', created_at: '2025-08-31T00:00:00.000Z', updated_at: '2025-08-31T00:00:00.000Z' }
        ],
        total: 1
      })),
      createTemplate: jest.fn(async (name, description, content_md, created_by) => ({
        id: '22222222-2222-2222-2222-222222222222', api_id: 2, name, description, content_md, created_by, created_at: '2025-08-31T00:00:00.000Z', updated_at: '2025-08-31T00:00:00.000Z'
      })),
      getTemplate: jest.fn(async (id) => id === 'notfound' ? null : ({ id, api_id: 3, name: 'Found', description: null, content_md: '# md', created_by: 'u', created_at: '2025-08-31T00:00:00.000Z', updated_at: '2025-08-31T00:00:00.000Z' })),
      updateTemplate: jest.fn(async (id, fields, changelog) => id === 'notfound' ? null : ({ id, api_id: 4, name: fields.name || 'Found', description: fields.description ?? null, content_md: fields.content_md || '# md', created_by: 'u', created_at: '2025-08-31T00:00:00.000Z', updated_at: '2025-08-31T00:05:00.000Z', changelog: changelog || null })),
      deleteTemplate: jest.fn(async (id) => id !== 'notfound'),
      listVersions: jest.fn(async (templateId, limit, offset) => ({
        items: [
          { id: 'v1', api_id: 10, template_id: templateId, version: 1, content_md: '# v1', changelog: 'init', created_by: 'u', created_at: '2025-08-31T00:00:00.000Z' }
        ],
        total: 1
      })),
      getVersion: jest.fn(async (templateId, version) => version === 404 ? null : ({ id: 'v2', api_id: 11, template_id: templateId, version, content_md: '# v2', changelog: null, created_by: 'u', created_at: '2025-08-31T00:10:00.000Z' }))
    }), { virtual: false });
  });

  test('GET /templates lists items', async () => {
    const app = makeApp();
    const res = await request(app).get('/api/rtg/templates?q=T1&limit=10&offset=0');
    expect(res.status).toBe(200);
    expect(res.body.items.length).toBe(1);
    expect(res.body.total).toBe(1);
  });

  test('POST /templates creates and returns row', async () => {
    const app = makeApp();
    const res = await request(app)
      .post('/api/rtg/templates')
      .send({ name: 'New', description: 'desc', content_md: '# new' });
    expect(res.status).toBe(201);
    expect(res.body.name).toBe('New');
    expect(res.body.content_md).toContain('# new');
  });

  test('GET /templates/:id 404s properly', async () => {
    const app = makeApp();
    const res = await request(app).get('/api/rtg/templates/notfound');
    expect(res.status).toBe(404);
  });

  test('PUT /templates/:id updates fields', async () => {
    const app = makeApp();
    const res = await request(app)
      .put('/api/rtg/templates/33333333-3333-3333-3333-333333333333')
      .send({ content_md: '# updated', changelog: 'ch' });
    expect(res.status).toBe(200);
    expect(res.body.content_md).toContain('updated');
  });

  test('DELETE /templates/:id returns ok', async () => {
    const app = makeApp();
    const res = await request(app).delete('/api/rtg/templates/33333333-3333-3333-3333-333333333333');
    expect(res.status).toBe(200);
    expect(res.body.ok).toBe(true);
  });

  test('GET /templates/:id/versions lists versions', async () => {
    const app = makeApp();
    const res = await request(app).get('/api/rtg/templates/33333333-3333-3333-3333-333333333333/versions?limit=5&offset=0');
    expect(res.status).toBe(200);
    expect(res.body.items.length).toBe(1);
  });

  test('GET /templates/:id/versions/:version gets version', async () => {
    const app = makeApp();
    const res = await request(app).get('/api/rtg/templates/33333333-3333-3333-3333-333333333333/versions/2');
    expect(res.status).toBe(200);
    expect(res.body.version).toBe(2);
  });
});
