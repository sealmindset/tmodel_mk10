// tests/api/components.assignSafeguards.test.js
// Tests for the POST /api/components/:id/safeguards/assign endpoint

const request = require('supertest');
const app = require('../../app'); // Adjust if your Express app is exported elsewhere
const db = require('../../db'); // Adjust if your DB connection is elsewhere

// Helpers to create test data
async function createComponent(name = 'Test Component') {
  const res = await db.query(
    'INSERT INTO components (name) VALUES ($1) RETURNING id',
    [name]
  );
  return res.rows[0].id;
}

async function createSafeguard(name = 'Test Safeguard') {
  const res = await db.query(
    'INSERT INTO safeguards (name) VALUES ($1) RETURNING id',
    [name]
  );
  return res.rows[0].id;
}

describe('POST /api/components/:id/safeguards/assign', () => {
  let componentId, safeguardId1, safeguardId2;

  beforeAll(async () => {
    // Optionally, clean up tables
    await db.query('DELETE FROM component_safeguards');
    await db.query('DELETE FROM components');
    await db.query('DELETE FROM safeguards');
    componentId = await createComponent();
    safeguardId1 = await createSafeguard('Safeguard 1');
    safeguardId2 = await createSafeguard('Safeguard 2');
  });

  afterAll(async () => {
    await db.query('DELETE FROM component_safeguards WHERE component_id = $1', [componentId]);
    await db.end();
  });

  test('successfully assigns safeguards to a component', async () => {
    const res = await request(app)
      .post(`/api/components/${componentId}/safeguards/assign`)
      .send({ safeguardIds: [safeguardId1, safeguardId2] })
      .expect(200);
    expect(res.body.success).toBe(true);
    const { rows } = await db.query(
      'SELECT * FROM component_safeguards WHERE component_id = $1',
      [componentId]
    );
    expect(rows).toHaveLength(2);
  });

  test('returns error for invalid component ID', async () => {
    const res = await request(app)
      .post('/api/components/999999/safeguards/assign')
      .send({ safeguardIds: [safeguardId1] });
    expect(res.status).toBe(404);
  });

  test('returns error for invalid safeguard IDs', async () => {
    const res = await request(app)
      .post(`/api/components/${componentId}/safeguards/assign`)
      .send({ safeguardIds: [999999] });
    expect(res.status).toBe(400);
  });

  test('handles empty safeguard list', async () => {
    const res = await request(app)
      .post(`/api/components/${componentId}/safeguards/assign`)
      .send({ safeguardIds: [] });
    expect(res.status).toBe(200); // Or 400, depending on your API design
  });
});
