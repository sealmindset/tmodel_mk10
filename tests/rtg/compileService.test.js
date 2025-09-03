const path = require('path');

describe('compileService', () => {
  const svcPath = path.join(process.cwd(), 'build/rtg/server/compileService.js');
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const { compile } = require(svcPath);

  test('resolves global tokens and produces statistics', async () => {
    const req = {
      content: 'Gen: {{GENERATED_AT}} Author: {{AUTHOR}} Env: {{ENV}} CI: {{CI_EXAMPLE}}',
      filters: { author: 'tester', ci_example: 'GA' }
    };
    const res = await compile(req);
    expect(typeof res.content).toBe('string');
    expect(res.content).toContain('tester');
    expect(res.meta).toBeDefined();
    expect(res.meta.author).toBe('tester');
    expect(Array.isArray(res.warnings)).toBe(true);
  });

  test('includes JSON tokens as strings with budgeting', async () => {
    const req = {
      content: 'PJ: {{PROJECTS_JSON}} CJ: {{COMPONENTS_JSON}} TJ: {{THREATS_JSON}} VJ: {{VULNERABILITIES_JSON}} SG: {{THREAT_SAFEGUARDS_JSON}} ST: {{STATISTICS_JSON}}',
      filters: {}
    };
    const res = await compile(req);
    for (const token of ['PJ:', 'CJ:', 'TJ:', 'VJ:', 'SG:', 'ST:']) {
      expect(res.content).toContain(token);
    }
  });
});
