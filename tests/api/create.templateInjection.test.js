const express = require('express');
const session = require('express-session');
const request = require('supertest');

// Mock dependencies used by routes/main.js
jest.mock('../../services/promptService', () => ({
  getPromptById: jest.fn(),
  getAllPrompts: jest.fn(),
}));

jest.mock('../../services/settingsService', () => ({
  getSettingByKey: jest.fn(async (key) => {
    if (key === 'llm.provider') return 'openai';
    if (key === 'openai.model') return 'gpt-4o-mini';
    if (key === 'ollama.model') return 'llama3.3:latest';
    return null;
  }),
}));

jest.mock('../../utils/openai', () => ({
  getCompletion: jest.fn(async (prompt, model, maxTokens) => ({
    choices: [{ message: { content: `MOCK_OPENAI:${prompt.slice(0, 50)}` } }],
  })),
}));

jest.mock('../../utils/ollama', () => ({
  getCompletion: jest.fn(async (prompt /*, model, maxTokens, opts*/ ) => `MOCK_OLLAMA:${prompt.slice(0, 50)}`),
  init: jest.fn(async () => {}),
}));

jest.mock('../../services/threatModelService', () => ({
  createThreatModel: jest.fn(async (data) => ({ id: 'uuid-123', ...data })),
  listThreatModels: jest.fn(async () => []),
  getThreatModel: jest.fn(async () => ({ id: 'uuid-123', title: 't', description: 'd' })),
}));

const promptService = require('../../services/promptService');
const settingsService = require('../../services/settingsService');
const openaiUtil = require('../../utils/openai');
const ollamaUtil = require('../../utils/ollama');
const router = require('../../routes/main');

function makeApp() {
  const app = express();
  app.use(express.json());
  app.use(express.urlencoded({ extended: true }));
  app.use(session({ secret: 'test', resave: false, saveUninitialized: true }));
  app.use('/', router);
  return app;
}

describe('POST /create - template injection', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('supports SYSTEM and SYSTEM_TO_ANALYZE placeholders with multiple delimiters and case-insensitive', async () => {
    promptService.getPromptById.mockResolvedValueOnce({
      id: 55,
      prompt_text: 'Assess {{SYSTEM}}; Map [[system_to_analyze]]; Echo ${system}.',
    });
    settingsService.getSettingByKey.mockImplementation(async (key) => {
      if (key === 'llm.provider') return 'openai';
      if (key === 'openai.model') return 'gpt-4o-mini';
      return null;
    });

    const app = makeApp();

    const res = await request(app)
      .post('/create')
      .set('Accept', 'application/json')
      .send({ subject: 'Checkout Service', selectedPromptId: 55, llmProvider: 'openai', model: 'gpt-4o-mini' })
      .expect(200);

    expect(res.body).toHaveProperty('success', true);
    expect(openaiUtil.getCompletion).toHaveBeenCalledTimes(1);
    const [promptArg] = openaiUtil.getCompletion.mock.calls[0];
    expect(promptArg).toContain('Assess Checkout Service; Map Checkout Service; Echo Checkout Service.');
  });

  test('injects SUBJECT placeholders from selectedPromptId and calls OpenAI with composed prompt', async () => {
    promptService.getPromptById.mockResolvedValueOnce({
      id: 42,
      prompt_text: 'Analyze {{SUBJECT}} in detail. Also see [[SUBJECT]].',
    });
    settingsService.getSettingByKey.mockImplementation(async (key) => {
      if (key === 'llm.provider') return 'openai';
      if (key === 'openai.model') return 'gpt-4o-mini';
      return null;
    });

    const app = makeApp();

    const body = {
      subject: 'Payment API',
      llmProvider: 'openai',
      model: 'gpt-4o-mini',
      selectedPromptId: 42,
    };

    const res = await request(app)
      .post('/create')
      .set('Accept', 'application/json')
      .send(body)
      .expect(200);

    expect(res.body).toHaveProperty('success', true);
    expect(openaiUtil.getCompletion).toHaveBeenCalledTimes(1);
    const [promptArg, modelArg] = openaiUtil.getCompletion.mock.calls[0];
    expect(modelArg).toBe('gpt-4o-mini');
    expect(promptArg).toContain('Analyze Payment API in detail. Also see Payment API.');
  });

  test('falls back to subject when template missing or has no prompt_text', async () => {
    promptService.getPromptById.mockResolvedValueOnce({ id: 99 });
    settingsService.getSettingByKey.mockImplementation(async (key) => {
      if (key === 'llm.provider') return 'openai';
      if (key === 'openai.model') return 'gpt-4o-mini';
      return null;
    });

    const app = makeApp();

    const res = await request(app)
      .post('/create')
      .set('Accept', 'application/json')
      .send({ subject: 'Inventory System', selectedPromptId: 99, llmProvider: 'openai', model: 'gpt-4o-mini' })
      .expect(200);

    expect(res.body).toHaveProperty('success', true);
    expect(openaiUtil.getCompletion).toHaveBeenCalledTimes(1);
    const [promptArg] = openaiUtil.getCompletion.mock.calls[0];
    expect(promptArg).toBe('Inventory System');
  });

  test('Ollama path uses composed prompt as well', async () => {
    promptService.getPromptById.mockResolvedValueOnce({
      id: 7,
      prompt_text: 'Threat model for ${SUBJECT} with notes about {{ subject }}.',
    });
    settingsService.getSettingByKey.mockImplementation(async (key) => {
      if (key === 'llm.provider') return 'ollama';
      if (key === 'ollama.model') return 'llama3.3:latest';
      return null;
    });

    const app = makeApp();

    const res = await request(app)
      .post('/create')
      .set('Accept', 'application/json')
      .send({ subject: 'Billing Service', selectedPromptId: 7, llmProvider: 'ollama', model: 'llama3.3:latest' })
      .expect(200);

    expect(res.body).toHaveProperty('success', true);
    expect(ollamaUtil.getCompletion).toHaveBeenCalledTimes(1);
    const [promptArg, modelArg] = ollamaUtil.getCompletion.mock.calls[0];
    expect(modelArg).toBe('llama3.3:latest');
    expect(promptArg).toContain('Threat model for Billing Service with notes about Billing Service.');
  });

  test('returns 400 when subject is missing', async () => {
    const app = makeApp();
    const res = await request(app)
      .post('/create')
      .set('Accept', 'application/json')
      .send({})
      .expect(400);
    expect(res.body).toHaveProperty('success', false);
    expect(res.body.error).toMatch(/System to Analyze \(subject\) is required/);
  });
});
