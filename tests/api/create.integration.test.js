const express = require('express');
const session = require('express-session');
const request = require('supertest');

// Mock downstream dependencies to avoid external calls and DB writes
jest.mock('../../services/promptService', () => ({
  getPromptById: jest.fn(),
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
    choices: [{ message: { content: `OPENAI_OK:${model}:${String(maxTokens)}:${prompt.slice(0, 40)}` } }],
  })),
}));

jest.mock('../../utils/ollama', () => ({
  getCompletion: jest.fn(async (prompt, model) => `OLLAMA_OK:${model}:${prompt.slice(0, 40)}`),
  init: jest.fn(async () => {}),
}));

jest.mock('../../services/threatModelService', () => ({
  createThreatModel: jest.fn(async (data) => ({ id: 'tm-id-1', ...data })),
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
  app.use(session({ secret: 'itest', resave: false, saveUninitialized: true }));
  app.use('/', router);
  return app;
}

describe('Integration: /create with template-driven prompt for OpenAI and Ollama', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('OpenAI path composes template with SUBJECT and succeeds', async () => {
    // Arrange settings and template
    settingsService.getSettingByKey.mockImplementation(async (key) => {
      if (key === 'llm.provider') return 'openai';
      if (key === 'openai.model') return 'gpt-4o-mini';
      return null;
    });
    promptService.getPromptById.mockResolvedValueOnce({
      id: 1,
      prompt_text: 'Please analyze {{SUBJECT}} thoroughly.',
    });

    const app = makeApp();

    // Act
    const res = await request(app)
      .post('/create')
      .set('Accept', 'application/json')
      .send({ subject: 'Payments API', selectedPromptId: 1 })
      .expect(200);

    // Assert
    expect(res.body).toEqual(expect.objectContaining({ success: true, id: 'tm-id-1' }));
    expect(openaiUtil.getCompletion).toHaveBeenCalledTimes(1);
    const [promptArg, modelArg, maxTokensArg] = openaiUtil.getCompletion.mock.calls[0];
    expect(modelArg).toBe('gpt-4o-mini');
    expect(typeof maxTokensArg === 'number' || Number.isNaN(maxTokensArg)).toBe(true);
    expect(promptArg).toContain('Please analyze Payments API thoroughly.');
  });

  test('Ollama path composes template with SYSTEM and succeeds', async () => {
    // Arrange settings and template
    settingsService.getSettingByKey.mockImplementation(async (key) => {
      if (key === 'llm.provider') return 'ollama';
      if (key === 'ollama.model') return 'llama3.3:latest';
      return null;
    });
    promptService.getPromptById.mockResolvedValueOnce({
      id: 2,
      prompt_text: 'Threat model for [[SYSTEM]] with details.',
    });

    const app = makeApp();

    // Act
    const res = await request(app)
      .post('/create')
      .set('Accept', 'application/json')
      .send({ subject: 'Billing Service', selectedPromptId: 2 })
      .expect(200);

    // Assert
    expect(res.body).toEqual(expect.objectContaining({ success: true, id: 'tm-id-1' }));
    expect(ollamaUtil.getCompletion).toHaveBeenCalledTimes(1);
    const [promptArg, modelArg] = ollamaUtil.getCompletion.mock.calls[0];
    expect(modelArg).toBe('llama3.3:latest');
    expect(promptArg).toContain('Threat model for Billing Service with details.');
  });
});
