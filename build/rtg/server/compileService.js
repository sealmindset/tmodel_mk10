"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.KNOWN_TOKENS = void 0;
exports.compile = compile;
const tokenResolver_1 = require("./tokenResolver");
const dataFetcher_1 = require("./dataFetcher");
exports.KNOWN_TOKENS = [
    '{{GENERATED_AT}}',
    '{{AUTHOR}}',
    '{{ENV}}',
    '{{CI_EXAMPLE}}',
    '<ISO-timestamp>',
    '<username>',
    '{{PROJECT_KEY}}',
    '{{RESILIENCY_TARGET}}',
    '{{PROJECTS_JSON}}',
    '{{PROJECT_JSON}}',
    '{{PROJECTS_COUNT}}',
    '{{PROJECT_NAMES_CSV}}',
    '{{COMPONENTS_JSON}}',
    '{{COMPONENTS_COUNT}}',
    '{{COMPONENT_TABLE}}',
    '{{THREATS_JSON}}',
    '{{THREAT_MODEL_TABLE}}',
    '{{VULNERABILITIES_JSON}}',
    '{{VULNERABILITY_TABLE}}',
    '{{THREAT_SAFEGUARDS_JSON}}',
    '{{STATISTICS_JSON}}',
    '{{PIPELINE_STEPS_JSON}}',
    '{{TERRAFORM_TAGS_JSON}}',
    '{{AWS_ACCOUNTS_JSON}}'
];
async function compile(req) {
    const nowIso = new Date().toISOString();
    const env = process.env.NODE_ENV || 'development';
    const author = (req.filters && req.filters.author) || 'system';
    const ci = (req.filters && req.filters.ci_example) || 'GitHub Actions';
    const filters = req.filters;
    // Fetch scoped datasets mirroring reporting/reportRunner.js behavior
    const scoped = await (0, dataFetcher_1.fetchScopedData)(filters);
    let { selectedProject, projectsAll, componentsAll, threatsAll, vulnerabilitiesAll, safeguardsMap } = scoped;
    if (!selectedProject) {
        selectedProject = Array.isArray(projectsAll) && projectsAll.length ? projectsAll[0] : null;
    }
    // Deterministic ordering similar to reportRunner
    const sevOrder = { Critical: 4, High: 3, Medium: 2, Low: 1 };
    const byName = (a, b) => String(a?.name || '').localeCompare(String(b?.name || ''));
    const bySeverityThenTitle = (a, b) => {
        const sa = sevOrder[String(a?.severity || '')] || 0;
        const sb = sevOrder[String(b?.severity || '')] || 0;
        if (sa !== sb)
            return sb - sa;
        return String(a?.title || '').localeCompare(String(b?.title || ''));
    };
    const bySeverityThenCreatedDesc = (a, b) => {
        const sa = sevOrder[String(a?.severity || '')] || 0;
        const sb = sevOrder[String(b?.severity || '')] || 0;
        if (sa !== sb)
            return sb - sa;
        const da = a?.created_at ? new Date(a.created_at).getTime() : 0;
        const db = b?.created_at ? new Date(b.created_at).getTime() : 0;
        return db - da;
    };
    const componentsSorted = Array.isArray(componentsAll) ? [...componentsAll].sort(byName) : [];
    const threatsSorted = Array.isArray(threatsAll) ? [...threatsAll].sort(bySeverityThenTitle) : [];
    const vulnerabilitiesSorted = Array.isArray(vulnerabilitiesAll) ? [...vulnerabilitiesAll].sort(bySeverityThenCreatedDesc) : [];
    // Simple Markdown table helpers
    const toMarkdownTable = (headers, rows) => {
        if (!rows || rows.length === 0)
            return '';
        const head = `| ${headers.join(' | ')} |`;
        const sep = `| ${headers.map(() => '---').join(' | ')} |`;
        const body = rows.map(r => `| ${r.map(v => String(v ?? '')).join(' | ')} |`).join('\n');
        return `${head}\n${sep}\n${body}`;
    };
    const componentTableMd = toMarkdownTable(['Name', 'Type'], (componentsSorted || []).map((c) => [c?.name || '', c?.type || c?.kind || c?.category || '']));
    const threatsTableMd = toMarkdownTable(['Title', 'Severity'], (threatsSorted || []).map((t) => [t?.title || t?.name || '', t?.severity || '']));
    const vulnTableMd = toMarkdownTable(['Title', 'Severity'], (vulnerabilitiesSorted || []).map((v) => [v?.title || v?.name || '', v?.severity || '']));
    // Budgeted JSON strings
    const BUDGET = (0, dataFetcher_1.buildBudgets)();
    const projectJsonS = (0, dataFetcher_1.stringifyWithBudget)(projectsAll, BUDGET.project, 'project');
    const componentsJsonS = (0, dataFetcher_1.stringifyWithBudget)(componentsSorted, BUDGET.components, 'components');
    const threatsJsonS = (0, dataFetcher_1.stringifyWithBudget)(threatsSorted, BUDGET.threats, 'threats');
    const vulnsJsonS = (0, dataFetcher_1.stringifyWithBudget)(vulnerabilitiesSorted, BUDGET.vulnerabilities, 'vulnerabilities');
    const safeguardsJsonS = (0, dataFetcher_1.stringifyWithBudget)(safeguardsMap, BUDGET.safeguards, 'safeguards');
    // Statistics object
    const vulnerabilities_by_severity = { Critical: 0, High: 0, Medium: 0, Low: 0 };
    (Array.isArray(vulnerabilitiesSorted) ? vulnerabilitiesSorted : []).forEach((v) => {
        const s = String(v?.severity || '');
        if (vulnerabilities_by_severity[s] != null)
            vulnerabilities_by_severity[s]++;
    });
    const statistics = {
        counts: {
            components: componentsSorted.length,
            threats: threatsSorted.length,
            vulnerabilities: Array.isArray(vulnerabilitiesSorted) ? vulnerabilitiesSorted.length : 0
        },
        truncation: {
            project_truncated: projectJsonS.truncated,
            components_truncated: componentsJsonS.truncated,
            threats_truncated: threatsJsonS.truncated,
            vulnerabilities_truncated: vulnsJsonS.truncated,
            safeguards_truncated: safeguardsJsonS.truncated
        },
        lengths: {
            project_len: projectJsonS.length,
            components_len: componentsJsonS.length,
            threats_len: threatsJsonS.length,
            vulnerabilities_len: vulnsJsonS.length,
            safeguards_len: safeguardsJsonS.length
        },
        vulnerabilities_by_severity,
        incidents: { High: 0, Medium: 0, Low: 0 }
    };
    // Derive optional tokens
    const slugify = (s) => !s ? '' : String(s).trim().toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 64);
    const projectKey = (() => {
        try {
            if (selectedProject && (selectedProject.key || selectedProject.project_key))
                return String(selectedProject.key || selectedProject.project_key);
            const base = selectedProject && (selectedProject.name || selectedProject.project_name || selectedProject.title);
            return slugify(base);
        }
        catch {
            return '';
        }
    })();
    const resiliencyTarget = (() => {
        try {
            if (selectedProject) {
                const slo = selectedProject.sla_slo;
                if (slo && typeof slo === 'object' && slo.slo_target)
                    return String(slo.slo_target);
                if (typeof slo === 'string') {
                    try {
                        const obj = JSON.parse(slo);
                        if (obj && obj.slo_target)
                            return String(obj.slo_target);
                    }
                    catch { }
                }
                if (selectedProject.slo_target)
                    return String(selectedProject.slo_target);
                if (selectedProject.sloTarget)
                    return String(selectedProject.sloTarget);
            }
            return '99.9';
        }
        catch {
            return '99.9';
        }
    })();
    const replacements = new Map([
        ['{{GENERATED_AT}}', nowIso],
        ['{{AUTHOR}}', author],
        ['{{ENV}}', env],
        ['{{CI_EXAMPLE}}', ci],
        ['<ISO-timestamp>', nowIso],
        ['<username>', author],
        ['{{PROJECT_KEY}}', projectKey],
        ['{{RESILIENCY_TARGET}}', resiliencyTarget],
        ['{{PROJECTS_JSON}}', projectJsonS.text],
        ['{{PROJECT_JSON}}', JSON.stringify(selectedProject || {})],
        ['{{PROJECTS_COUNT}}', String(Array.isArray(projectsAll) ? projectsAll.length : 0)],
        ['{{PROJECT_NAMES_CSV}}', (Array.isArray(projectsAll) ? projectsAll.map((p) => p?.name).filter(Boolean).join(', ') : '')],
        ['{{COMPONENTS_JSON}}', componentsJsonS.text],
        ['{{COMPONENTS_COUNT}}', String(Array.isArray(componentsAll) ? componentsAll.length : 0)],
        ['{{COMPONENT_TABLE}}', componentTableMd],
        ['{{THREATS_JSON}}', threatsJsonS.text],
        ['{{THREAT_MODEL_TABLE}}', threatsTableMd],
        ['{{VULNERABILITIES_JSON}}', vulnsJsonS.text],
        ['{{VULNERABILITY_TABLE}}', vulnTableMd],
        ['{{THREAT_SAFEGUARDS_JSON}}', safeguardsJsonS.text],
        ['{{STATISTICS_JSON}}', JSON.stringify(statistics)],
        ['{{PIPELINE_STEPS_JSON}}', JSON.stringify((filters && filters.pipeline_steps) || [])],
        ['{{TERRAFORM_TAGS_JSON}}', JSON.stringify((filters && filters.tags) || {})],
        ['{{AWS_ACCOUNTS_JSON}}', JSON.stringify((filters && filters.aws_accounts) || [])]
    ]);
    const { content, warnings } = (0, tokenResolver_1.resolveTokens)(req.content || '', req.filters, replacements, exports.KNOWN_TOKENS);
    return {
        content,
        warnings,
        meta: {
            generatedAt: nowIso,
            author,
            env
        }
    };
}
//# sourceMappingURL=compileService.js.map