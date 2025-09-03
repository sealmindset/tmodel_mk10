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

describe('RTG Compile & Submit API', () => {
  beforeAll(() => {
    jest.resetModules();
    const compilePath = require.resolve('../../build/rtg/server/compileService.js');
    const submitPath = require.resolve('../../build/rtg/server/submitService.js');

    jest.doMock(compilePath, () => ({
      compile: jest.fn(async ({ content, filters }) => ({
        content: `COMPILED:${content}`,
        warnings: filters && filters.warn ? ['w1'] : [],
        meta: { length: (content || '').length }
      }))
    }), { virtual: false });

    jest.doMock(submitPath, () => ({
      submit: jest.fn(async ({ content, provider = 'openai', model = 'gpt-4o-mini' }) => ({
        output: `LLM:${provider}:${model}:${content.slice(0, 10)}`,
        meta: { provider, model, tokens: 42 }
      }))
    }), { virtual: false });
  });

  test('POST /compile returns compiled content and meta', async () => {
    const app = makeApp();
    const res = await request(app)
      .post('/api/rtg/compile')
      .send({ content: 'Hello {{AUTHOR}}', filters: { author: 'alice' } });
    expect(res.status).toBe(200);
    expect(res.body.content).toMatch(/^COMPILED:/);
    expect(res.body.meta).toBeDefined();
    // CORS header present
    expect(res.headers['access-control-allow-origin']).toBe('*');
  });

  test('POST /submit returns output and meta', async () => {
    const app = makeApp();
    const res = await request(app)
      .post('/api/rtg/submit')
      .send({ content: 'gen', provider: 'ollama', model: 'llama3.1' });
    expect(res.status).toBe(200);
    expect(res.body.output).toMatch(/^LLM:ollama:llama3.1:/);
    expect(res.body.meta).toEqual(expect.objectContaining({ provider: 'ollama', model: 'llama3.1' }));
    expect(res.headers['access-control-allow-origin']).toBe('*');
  });
});
