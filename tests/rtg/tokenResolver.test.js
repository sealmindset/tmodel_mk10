const path = require('path');

describe('tokenResolver', () => {
  const modPath = path.join(process.cwd(), 'build/rtg/server/tokenResolver.js');
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const { resolveTokens } = require(modPath);

  test('replaces known tokens and warns on unknown', () => {
    const content = 'Hello {{ AUTHOR }} on {{GENERATED_AT}} X {{UNKNOWN_TOKEN}} and {{SEVERITY_BADGE:High}}';
    const replacements = new Map([
      ['{{AUTHOR}}', 'tester'],
      ['{{GENERATED_AT}}', '2025-01-01T00:00:00.000Z']
    ]);
    const known = ['{{AUTHOR}}', '{{GENERATED_AT}}'];
    const out = resolveTokens(content, { author: 'tester' }, replacements, known);
    expect(out.content).toContain('tester');
    expect(out.content).toContain('2025-01-01T00:00:00.000Z');
    expect(out.content).toContain('[High]');
    expect(Array.isArray(out.warnings)).toBe(true);
    expect(out.warnings.length).toBeGreaterThanOrEqual(1);
  });
});
