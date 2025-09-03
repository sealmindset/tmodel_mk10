const path = require('path');

jest.mock('../../reporting/llmClient.js', () => ({
  getCompletion: jest.fn(async (promptText, provider, model) => {
    return `MOCK_COMPLETION for ${provider}:${model} -> ${promptText.slice(0, 20)}...`;
  })
}));

describe('submitService', () => {
  const svcPath = path.join(process.cwd(), 'build/rtg/server/submitService.js');
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const { submit } = require(svcPath);

  test('compiles, extracts prompt, calls LLM, returns output (no persistence path)', async () => {
    const req = {
      content: 'Header\nPROMPT Summarize {{AUTHOR}} for {{PROJECT_KEY}}',
      filters: { author: 'tester' },
      provider: 'openai',
      model: 'gpt-4o-mini'
    };
    const res = await submit(req);
    expect(typeof res.output).toBe('string');
    expect(res.output).toContain('MOCK_COMPLETION');
    expect(res.meta.provider).toBe('openai');
    expect(res.meta.model).toBe('gpt-4o-mini');
    expect(res.meta.createdAt).toMatch(/T/);
  });
});
