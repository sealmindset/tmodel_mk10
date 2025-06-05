const request = require('supertest');
const app = require('../../app');
const db = require('../../database');

describe('POST /settings', () => {
  afterAll(async () => {
    if (db && db.end) {
      await db.end();
    }
  });

  test('saves OpenAI settings', async () => {
    await request(app)
      .post('/settings')
      .send({
        settingsType: 'openai',
        openaiApiKey: 'test-key',
        openaiModel: 'gpt-4'
      })
      .expect(302);
  });

  test('saves Ollama settings', async () => {
    await request(app)
      .post('/settings')
      .send({
        settingsType: 'ollama',
        ollamaApiUrl: 'http://localhost:11434',
        ollamaModel: 'llama3'
      })
      .expect(302);
  });

  test('saves Rapid7 settings', async () => {
    await request(app)
      .post('/settings')
      .send({
        settingsType: 'rapid7',
        rapid7ApiUrl: 'https://example.com',
        rapid7ApiKey: 'abc123'
      })
      .expect(302);
  });
});
