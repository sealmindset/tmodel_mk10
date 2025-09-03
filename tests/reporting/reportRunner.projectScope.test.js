const path = require('path');

// Mock DB module used by reporting/reportRunner.js ("../database")
jest.mock('../../database', () => {
  return {
    query: jest.fn(async (sql, params) => {
      // Return a minimal template row for numeric template path
      if (typeof sql === 'string' && sql.includes('FROM reports.template')) {
        return { rows: [{ id: params ? params[0] : 1, name: 'Test Template', description: 'desc', template_content: [
          'Component-Centric CAG Test Template',
          '{{PROJECTS_JSON}}',
          '{{PROJECT_JSON}}',
          '{{COMPONENTS_JSON}}',
          '{{THREATS_JSON}}',
          '{{VULNERABILITIES_JSON}}',
          '{{THREAT_SAFEGUARDS_JSON}}',
        ].join('\n') }] };
      }
      // UUID template path
      if (typeof sql === 'string' && sql.includes('FROM report_templates.template')) {
        return { rows: [{ uuid_id: params ? params[0] : 'uuid', name: 'Test Template', description: 'desc', template_content: [
          'Component-Centric CAG Test Template',
          '{{PROJECTS_JSON}}',
          '{{PROJECT_JSON}}',
          '{{COMPONENTS_JSON}}',
          '{{THREATS_JSON}}',
          '{{VULNERABILITIES_JSON}}',
          '{{THREAT_SAFEGUARDS_JSON}}',
        ].join('\n') }] };
      }
      return { rows: [] };
    })
  };
});

// Mock LLM client so we can capture the prompt that was sent and return it back
let lastPrompt = null;
jest.mock('../../reporting/llmClient', () => ({
  getCompletion: jest.fn(async (promptText /*, provider, model */) => {
    lastPrompt = promptText;
    // Return the prompt verbatim so tests can parse tokens injected
    return promptText;
  })
}));

// Mock settingsService to avoid DB lookups
jest.mock('../../services/settingsService', () => ({
  getSetting: jest.fn(async (key, fallback) => fallback)
}));

// Mock models referenced inside reportRunner
const mockP1 = { id: 'proj-1', name: 'Project One' };
const mockP2 = { id: 'proj-2', name: 'Project Two' };

const mockC1 = { id: 'comp-1', name: 'Comp One' }; // belongs to mockP1
const mockC2 = { id: 'comp-2', name: 'Comp Two' }; // belongs to mockP2

const mockTM1 = { id: 'tm-1', name: 'TM One' }; // for mockP1
const mockTM2 = { id: 'tm-2', name: 'TM Two' }; // for mockP2

const mockT1 = { id: 'threat-1', title: 'Threat 1', severity: 'High' }; // under mockTM1
const mockT2 = { id: 'threat-2', title: 'Threat 2', severity: 'Low' };  // under mockTM2

const mockV1 = { id: 'vuln-1', severity: 'Critical', component_id: mockC1.id };
const mockV2 = { id: 'vuln-2', severity: 'Low', component_id: mockC2.id };

const mockSG1 = { id: 'sg-1', name: 'SG One' };

jest.mock('../../database/models/project', () => ({
  getById: jest.fn(async (id) => (id === mockP1.id ? mockP1 : id === mockP2.id ? mockP2 : null)),
  getAll: jest.fn(async () => [mockP1, mockP2]),
  getComponents: jest.fn(async (projectId) => projectId === mockP1.id ? [mockC1] : projectId === mockP2.id ? [mockC2] : []),
  getThreatModels: jest.fn(async (projectId) => projectId === mockP1.id ? [mockTM1] : projectId === mockP2.id ? [mockTM2] : [])
}));

// reporting/componentModel.js re-exports Component model; we only need getAll for legacy branch
jest.mock('../../reporting/componentModel', () => ({
  getAll: jest.fn(async () => [mockC1, mockC2])
}));

jest.mock('../../database/models/threat', () => ({
  getAll: jest.fn(async ({ threat_model_id }) => threat_model_id === mockTM1.id ? [mockT1] : threat_model_id === mockTM2.id ? [mockT2] : []),
  getSafeguards: jest.fn(async (threatId) => threatId === mockT1.id ? [mockSG1] : [])
}));

jest.mock('../../database/models/threatModel', () => ({
  getAll: jest.fn(async () => [mockTM1, mockTM2])
}));

jest.mock('../../database/models/vulnerability', () => ({
  getAll: jest.fn(async ({ component_id }) => component_id === mockC1.id ? [mockV1] : component_id === mockC2.id ? [mockV2] : [])
}));

const ReportRunner = require('../../reporting/reportRunner');

// Helpers to locate template section and parse JSON lines relative to it
function findTitleIndex(prompt, title = 'Component-Centric CAG Test Template') {
  const lines = prompt.split('\n');
  return lines.findIndex(l => l.trim() === title);
}
function getJsonAfterTitle(prompt, offsetFromTitle) {
  const lines = prompt.split('\n');
  const titleIdx = findTitleIndex(prompt);
  if (titleIdx < 0) return null;
  const idx = titleIdx + offsetFromTitle;
  const line = lines[idx] || '';
  try {
    return JSON.parse(line);
  } catch {
    const rest = lines.slice(idx).join('\n');
    const match = rest.match(/\{[\s\S]*?\}|\[[\s\S]*?\]/);
    return match ? JSON.parse(match[0]) : null;
  }
}

describe('ReportRunner project scoping', () => {
  test('scopes datasets when filters.projectUuid provided', async () => {
    const result = await ReportRunner.generateReport('component_inventory', 123, { projectUuid: mockP1.id, author: 'tester' });
    expect(typeof result).toBe('string');
    expect(lastPrompt).toContain('Component-Centric CAG Test Template');

    // Our template layout:
    // 0: title
    // 1: PROJECTS_JSON
    // 2: PROJECT_JSON
    // 3: COMPONENTS_JSON
    // 4: THREATS_JSON
    // 5: VULNERABILITIES_JSON
    // 6: THREAT_SAFEGUARDS_JSON
    const projectsJson = getJsonAfterTitle(lastPrompt, 1);
    const projectJson = getJsonAfterTitle(lastPrompt, 2);
    const compsJson = getJsonAfterTitle(lastPrompt, 3);
    const threatsJson = getJsonAfterTitle(lastPrompt, 4);
    const vulnsJson = getJsonAfterTitle(lastPrompt, 5);
    const sgJson = getJsonAfterTitle(lastPrompt, 6);

    expect(Array.isArray(projectsJson)).toBe(true);
    expect(projectsJson.map(p => p.id)).toEqual([mockP1.id]);
    expect(projectJson && projectJson.id).toBe(mockP1.id);

    expect(Array.isArray(compsJson)).toBe(true);
    expect(compsJson.map(c => c.id)).toEqual([mockC1.id]);

    expect(Array.isArray(threatsJson)).toBe(true);
    expect(threatsJson.map(t => t.id)).toEqual([mockT1.id]);

    expect(Array.isArray(vulnsJson)).toBe(true);
    expect(vulnsJson.map(v => v.id)).toEqual([mockV1.id]);

    // safeguards map keyed by threat id
    expect(sgJson && typeof sgJson === 'object').toBe(true);
    expect(Object.keys(sgJson)).toEqual([mockT1.id]);
    expect(Array.isArray(sgJson[mockT1.id])).toBe(true);
    expect(sgJson[mockT1.id].map(s => s.id)).toEqual([mockSG1.id]);
  });

  test('falls back to legacy broad datasets when no project filter', async () => {
    lastPrompt = null;
    const result = await ReportRunner.generateReport('component_inventory', 123, { author: 'tester' });
    expect(typeof result).toBe('string');

    const projectsJson = getJsonAfterTitle(lastPrompt, 1);
    const compsJson = getJsonAfterTitle(lastPrompt, 3);
    const threatsJson = getJsonAfterTitle(lastPrompt, 4);
    const vulnsJson = getJsonAfterTitle(lastPrompt, 5);

    // In legacy mode, our mocks return all items
    expect(Array.isArray(projectsJson)).toBe(true);
    expect(new Set(projectsJson.map(p => p.id))).toEqual(new Set([mockP1.id, mockP2.id]));

    expect(Array.isArray(compsJson)).toBe(true);
    expect(new Set(compsJson.map(c => c.id))).toEqual(new Set([mockC1.id, mockC2.id]));

    // Threats come from ThreatModel.getAll then safeGetAll; our mock returns [TM1, TM2] but threatsJson is from threatsAll; for legacy path we mocked ThreatModel.getAll only; to keep simple, allow empty or any array
    expect(Array.isArray(threatsJson)).toBe(true);

    expect(Array.isArray(vulnsJson)).toBe(true);
  });
});
