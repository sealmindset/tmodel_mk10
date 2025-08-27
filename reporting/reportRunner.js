/**
 * Report Runner
 * 
 * Orchestrates the generation of reports by fetching data, 
 * processing it with a selected LLM prompt, and returning the result.
 */

const db = require('../database');
const ProjectModel = require('../database/models/project'); // Assuming this model exists and fetches project data
const ComponentModel = require('./componentModel');
const LLMClient = require('./llmClient');
const settingsService = require('../services/settingsService');
const DEFAULT_OLLAMA_MAX_TOKENS = 512;
const OLLAMA_TIMEOUT_MS = 60000; // 60 seconds

const ReportRunner = {
    /**
     * Generate a report based on type and prompt.
     * 
     * @param {string} reportType The type of report (e.g., 'project_portfolio').
     * @param {string|number} templateId The ID of the report template to use. Accepts UUID (report_templates) or numeric (reports).
     * @param {object} filters Optional filters for data fetching.
     * @returns {Promise<string>} The generated report content (raw text from LLM).
     * @throws {Error} If prompt not found, data fetching fails, or LLM call fails.
     */
    generateReport: async function(reportType, templateId, filters = {}) {
        console.log(`[ReportRunner] Generating report. Type: ${reportType}, Template ID: ${templateId}`);

        // 1. Fetch the report template from appropriate source
        const tidStr = (templateId != null) ? String(templateId).trim() : '';
        const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(tidStr);
        let templateRow;
        try {
            if (isUuid) {
                console.log('[ReportRunner] Loading template by UUID from report_templates.*');
                const { rows } = await db.query(
                    `SELECT 
                       t.id AS uuid_id,
                       t.name,
                       t.description,
                       COALESCE(
                         tv.content->>'template_content',
                         tv.content->>'content',
                         tv.content::text
                       ) AS template_content
                     FROM report_templates.template t
                     LEFT JOIN report_templates.template_version tv ON tv.id = t.latest_version_id
                     WHERE t.id = $1`,
                    [tidStr]
                );
                templateRow = rows && rows[0];
                // Fallback: if no content via latest_version_id, get most recent version by version desc
                if (!templateRow || !templateRow.template_content) {
                    const { rows: vrows } = await db.query(
                        `SELECT 
                           t.id AS uuid_id,
                           t.name,
                           t.description,
                           COALESCE(
                             tv.content->>'template_content',
                             tv.content->>'content',
                             tv.content::text
                           ) AS template_content
                         FROM report_templates.template t
                         JOIN report_templates.template_version tv ON tv.template_id = t.id
                         WHERE t.id = $1
                         ORDER BY tv.version DESC NULLS LAST, tv.created_at DESC
                         LIMIT 1`,
                        [tidStr]
                    );
                    templateRow = vrows && vrows[0];
                }
            } else {
                const numericId = Number(tidStr);
                if (Number.isNaN(numericId)) {
                    throw new Error(`Invalid templateId format: ${tidStr}`);
                }
                console.log('[ReportRunner] Loading template by numeric id from reports.template');
                const { rows } = await db.query(
                    'SELECT id, name, description, template_content FROM reports.template WHERE id = $1',
                    [numericId]
                );
                templateRow = rows && rows[0];
            }
        } catch (e) {
            console.error('[ReportRunner] Error querying template source:', e);
            throw new Error('Failed to load report template');
        }
        if (!templateRow || !templateRow.template_content) {
            throw new Error(`Report template with ID ${templateId} not found or missing content.`);
        }
        // Diagnostics: confirm which template content is used
        try {
            const tname = templateRow.name || '';
            const preview = String(templateRow.template_content).slice(0, 160);
            console.log('[ReportRunner] Using template:', { id: templateId, name: tname, contentPreview: preview });
        } catch(_) {}

        // 2.a Build generic context for token injection (best-effort)
        const nowIso = new Date().toISOString();
        const author = (filters && filters.author) || 'system';
        const env = process.env.NODE_ENV || 'development';
        const ciExample = (filters && filters.ci_example) || 'GitHub Actions';
        // Helpers for safe model loads
        const safeGetAll = async (fn, def) => { try { return await fn(filters || {}); } catch (_) { return def; } };
        // Projects/components reused for both token JSON and legacy injections
        const projectsAll = await safeGetAll(ProjectModel.getAll.bind(ProjectModel), []);
        const componentsAll = await safeGetAll(ComponentModel.getAll.bind(ComponentModel), []);
        // Optional datasets
        let threatsAll = [];
        let vulnerabilitiesAll = [];
        let safeguardsMap = [];
        try {
            const ThreatModel = require('../database/models/threatModel');
            threatsAll = await safeGetAll(ThreatModel.getAll.bind(ThreatModel), []);
        } catch(_) {}
        try {
            const VulnerabilityModel = require('../database/models/vulnerability');
            vulnerabilitiesAll = await safeGetAll(VulnerabilityModel.getAll.bind(VulnerabilityModel), []);
        } catch(_) {}
        try {
            const SafeguardModel = require('../database/models/safeguard');
            safeguardsMap = await safeGetAll(SafeguardModel.getThreatSafeguards?.bind(SafeguardModel) || (async()=>[]), []);
        } catch(_) {}

        const statistics = (()=>{
            const vulnCounts = { Critical:0, High:0, Medium:0, Low:0 };
            (Array.isArray(vulnerabilitiesAll)?vulnerabilitiesAll:[]).forEach(v=>{ const s=(v.severity||'').toString(); if (vulnCounts[s] != null) vulnCounts[s]++; });
            return {
                components: Array.isArray(componentsAll)?componentsAll.length:0,
                threat_models: Array.isArray(threatsAll)?threatsAll.length:0,
                vulnerabilities: vulnCounts,
                incidents: { High:0, Medium:0, Low:0 }
            };
        })();

        // Build replacements only for tokens present
        const tokenReplacements = new Map([
            ['{{GENERATED_AT}}', nowIso],
            ['{{AUTHOR}}', author],
            ['{{ENV}}', env],
            ['{{CI_EXAMPLE}}', ciExample],
            ['<ISO-timestamp>', nowIso],
            ['<username>', author],
            ['{{PROJECTS_JSON}}', JSON.stringify(projectsAll)],
            ['{{PROJECTS_COUNT}}', String(Array.isArray(projectsAll)?projectsAll.length:0)],
            ['{{PROJECT_NAMES_CSV}}', (Array.isArray(projectsAll)?projectsAll.map(p=>p.name).filter(Boolean).join(', '):'')],
            ['{{COMPONENTS_JSON}}', JSON.stringify(componentsAll)],
            ['{{COMPONENTS_COUNT}}', String(Array.isArray(componentsAll)?componentsAll.length:0)],
            ['{{THREATS_JSON}}', JSON.stringify(threatsAll)],
            ['{{VULNERABILITIES_JSON}}', JSON.stringify(vulnerabilitiesAll)],
            ['{{THREAT_SAFEGUARDS_JSON}}', JSON.stringify(safeguardsMap)],
            ['{{STATISTICS_JSON}}', JSON.stringify(statistics)],
            ['{{PIPELINE_STEPS_JSON}}', JSON.stringify((filters && filters.pipeline_steps) || [])],
            ['{{TERRAFORM_TAGS_JSON}}', JSON.stringify((filters && filters.tags) || {})],
            ['{{AWS_ACCOUNTS_JSON}}', JSON.stringify((filters && filters.aws_accounts) || [])]
        ]);

        let finalPromptText = templateRow.template_content || '';
        try {
            // Normalize common brace variants and HTML entities first
            const beforeNormLen = finalPromptText.length;
            finalPromptText = finalPromptText
                .replace(/&#123;/g, '{')
                .replace(/&#125;/g, '}')
                .replace(/&lbrace;/g, '{')
                .replace(/&rbrace;/g, '}')
                .replace(/\uFF5B|［/g, '{') // fullwidth or CJK bracket variants
                .replace(/\uFF5D|］/g, '}');
            if (finalPromptText.length !== beforeNormLen) {
                console.log('[ReportRunner] Normalization: replaced HTML/fullwidth braces to ASCII');
            }

            // Diagnostics: detect tokens present before replacement
            const tokenKeys = Array.from(tokenReplacements.keys());
            const presentBefore = tokenKeys.filter(k => finalPromptText.includes(k));
            console.log('[ReportRunner] Tokens present before replacement:', presentBefore.slice(0, 20), presentBefore.length > 20 ? `(+${presentBefore.length-20} more)` : '');

            // Replace only tokens that occur to keep cost low
            let replacedCount = 0;
            const whitespaceVariant = (t) => {
                // Convert '{{FOO}}' -> /\{\{\s*FOO\s*\}\}/g
                const inner = t.replace(/^\{\{/, '').replace(/\}\}$/, '');
                return new RegExp(`\\{\\{\\s*${inner.replace(/[.*+?^${}()|[\\]\\]/g, '\\$&')}\\s*\\}\\}`, 'g');
            };
            for (const [tok, val] of tokenReplacements.entries()) {
                // Exact match
                if (finalPromptText.includes(tok)) {
                    const parts = finalPromptText.split(tok);
                    if (parts.length > 1) replacedCount += (parts.length - 1);
                    finalPromptText = parts.join(val);
                }
                // Optional whitespace variant
                const rx = whitespaceVariant(tok);
                const before = finalPromptText;
                finalPromptText = finalPromptText.replace(rx, () => { replacedCount++; return val; });
                if (before !== finalPromptText) {
                    // replaced via regex; count already incremented per match
                }
            }
            console.log(`[ReportRunner] Token replacements applied: ${replacedCount}`);
            // Severity badge macro helper: {{SEVERITY_BADGE:Critical}}
            finalPromptText = finalPromptText.replace(/\{\{SEVERITY_BADGE:([^}]+)\}\}/g, (_m, sev) => `[\`${sev.trim()}\`]`);
            // Simple Confluence macro passthroughs are left as-is by design

            // Diagnostics: unreplaced {{...}} tokens (first 20)
            const unreplaced = finalPromptText.match(/\{\{[^}]+\}\}/g) || [];
            if (unreplaced.length) {
                console.log('[ReportRunner] Unreplaced tokens after injection (first 20):', Array.from(new Set(unreplaced)).slice(0,20));
            }
        } catch (e) {
            console.warn('[ReportRunner] Token replacement failed; sending template as-is', e);
        }

        let rawData;
        try {
            switch (reportType) {
                case 'project_portfolio':
                    rawData = await ProjectModel.getAll(filters); // Assuming getAll supports filters
                    break;
                case 'component_inventory':
                    rawData = await ComponentModel.getAll(filters);
                    break;
                case 'safeguard_status':
                    // Fetch all safeguards
                    const SafeguardModel = require('../database/models/safeguard');
                    const ComponentModel = require('./componentModel');
                    rawData = await SafeguardModel.getAll(filters);
                    // For each safeguard, fetch components applied
                    for (const sg of rawData) {
                        // Returns array of components for this safeguard
                        const comps = await SafeguardModel.getComponents(sg.id);
                        sg.components_applied = Array.isArray(comps) ? comps.map(c => c.name || c.id) : [];
                    }
                    break;
                case 'threat_model_summary':
                    const ThreatModel = require('../database/models/threatModel');
                    rawData = await ThreatModel.getAll(filters);
                    break;
                default:
                    throw new Error(`Unsupported report type: ${reportType}`);
            }
        } catch (error) {
            console.error(`[ReportRunner] Error fetching data for ${reportType}:`, error);
            throw new Error(`Failed to fetch data for report type ${reportType}: ${error.message}`);
        }
        // 3. Prepare legacy data injections (optional, only if tokens exist)
        // Limit number of items injected for testing to avoid LLM timeouts
        const MAX_ITEMS_FOR_PROMPT = 10;
        if (reportType === 'project_portfolio') {
            // Example: Replace placeholder with JSON string of projects
            // The prompt should be designed to handle this structure.
            const projectDataForPrompt = rawData.slice(0, MAX_ITEMS_FOR_PROMPT).map(p => ({
                id: p.id,
                name: p.name,
                description: p.description,
                status: p.status,
                business_unit: p.business_unit,
                criticality: p.criticality,
                data_classification: p.data_classification,
                created_at: p.created_at,
                updated_at: p.updated_at
            }));
            finalPromptText = finalPromptText.replace('{{PROJECT_DATA_JSON}}', JSON.stringify(projectDataForPrompt, null, 2));
            
            // Example for a {{PROJECT_TABLE}} placeholder (very basic markdown table)
            let projectTableMd = 'Name | Status | Business Unit | Criticality\n';
            projectTableMd += '---- | ------ | ------------- | -----------\n';
            projectDataForPrompt.slice(0, 10).forEach(p => { // Limit to 10 for brevity in this example
                projectTableMd += `${p.name || ''} | ${p.status || ''} | ${p.business_unit || ''} | ${p.criticality || ''}\n`;
            });
            finalPromptText = finalPromptText.replace('{{PROJECT_TABLE}}', projectTableMd);
        } else if (reportType === 'component_inventory') {
            // Inject component data JSON and markdown table
            // Limit to 5 components for Ollama performance tuning
            const maxComponents = 5;
            const componentDataForPrompt = rawData.slice(0, Math.min(maxComponents, MAX_ITEMS_FOR_PROMPT)).map(c => ({
                id: c.id,
                name: c.name,
                type: c.type,
                description: c.description,
                version: c.version,
                is_reusable: c.is_reusable,
                tags: c.tags,
                projects: c.projects // Add project mapping if available, else leave blank
            }));
            finalPromptText = finalPromptText.replace('{{COMPONENT_DATA_JSON}}', JSON.stringify(componentDataForPrompt, null, 2));

            // Markdown table: Name | Type | Reusable | Tags | Projects
            let componentTableMd = 'Name | Type | Reusable | Tags | Projects\n';
            componentTableMd += '---- | ---- | -------- | ---- | --------\n';
            componentDataForPrompt.forEach(c => {
                const tags = Array.isArray(c.tags) ? c.tags.join(', ') : '';
                const projects = Array.isArray(c.projects) ? c.projects.join(', ') : '';
                componentTableMd += `${c.name || ''} | ${c.type || ''} | ${c.is_reusable ? 'Yes' : 'No'} | ${tags} | ${projects}\n`;
            });
            finalPromptText = finalPromptText.replace('{{COMPONENT_TABLE}}', componentTableMd);
        } else if (reportType === 'safeguard_status') {
            // Prepare safeguard data for prompt
            const safeguardDataForPrompt = rawData.slice(0, MAX_ITEMS_FOR_PROMPT).map(sg => ({
                id: sg.id,
                name: sg.name,
                type: sg.type,
                implementation_status: sg.implementation_status,
                effectiveness: sg.effectiveness,
                components_applied: sg.components_applied || []
            }));
            finalPromptText = finalPromptText.replace('{{SAFEGUARD_DATA_JSON}}', JSON.stringify(safeguardDataForPrompt, null, 2));

            // Markdown table: Name | Type | Status | Effectiveness | Components Applied
            let safeguardTableMd = 'Name | Type | Status | Effectiveness | Components Applied\n';
            safeguardTableMd += '---- | ---- | ------ | ------------- | -------------------\n';
            safeguardDataForPrompt.forEach(sg => {
                const comps = Array.isArray(sg.components_applied) ? sg.components_applied.join(', ') : '';
                safeguardTableMd += `${sg.name || ''} | ${sg.type || ''} | ${sg.implementation_status || ''} | ${sg.effectiveness || ''} | ${comps}\n`;
            });
            finalPromptText = finalPromptText.replace('{{SAFEGUARD_TABLE}}', safeguardTableMd);
        } else if (reportType === 'threat_model_summary') {
            // Helper to format dates from string/Date/other into YYYY-MM-DD
            const fmtDate = (v) => {
                if (!v) return '';
                if (typeof v === 'string') {
                    const idx = v.indexOf('T');
                    return idx > 0 ? v.slice(0, idx) : v;
                }
                try {
                    const d = (v instanceof Date) ? v : new Date(v);
                    if (Number.isNaN(d.getTime())) return '';
                    return d.toISOString().split('T')[0];
                } catch (_) { return ''; }
            };
            // Prepare threat model data for prompt
            const threatModels = rawData.slice(0, MAX_ITEMS_FOR_PROMPT).map(tm => ({
                id: tm.id,
                name: tm.name,
                status: tm.status,
                project_name: tm.project_name,
                created_at: tm.created_at,
                updated_at: tm.updated_at
            }));
            finalPromptText = finalPromptText.replace('{{THREAT_MODEL_DATA_JSON}}', JSON.stringify(threatModels, null, 2));

            // Status summary (markdown)
            const statusCounts = {};
            threatModels.forEach(tm => {
                statusCounts[tm.status] = (statusCounts[tm.status] || 0) + 1;
            });
            let statusSummary = 'Status | Count\n';
            statusSummary += '------ | -----\n';
            Object.entries(statusCounts).forEach(([status, count]) => {
                statusSummary += `${status} | ${count}\n`;
            });
            finalPromptText = finalPromptText.replace('{{STATUS_SUMMARY}}', statusSummary);

            // Threat models by project (markdown)
            let threatModelTable = 'Project | Threat Model | Status | Created | Updated\n';
            threatModelTable += '------- | ------------ | ------ | ------- | -------\n';
            threatModels.forEach(tm => {
                threatModelTable += `${tm.project_name || ''} | ${tm.name || ''} | ${tm.status || ''} | ${fmtDate(tm.created_at)} | ${fmtDate(tm.updated_at)}\n`;
            });
            finalPromptText = finalPromptText.replace('{{THREAT_MODEL_TABLE}}', threatModelTable);

            // Recent activity (last 90 days)
            const now = new Date();
            const recentModels = threatModels.filter(tm => {
                const created = tm.created_at ? new Date(tm.created_at) : null;
                const updated = tm.updated_at ? new Date(tm.updated_at) : null;
                return (created && (now - created) / (1000 * 60 * 60 * 24) <= 90) || (updated && (now - updated) / (1000 * 60 * 60 * 24) <= 90);
            });
            let recentActivityTable = 'Project | Threat Model | Status | Created | Updated\n';
            recentActivityTable += '------- | ------------ | ------ | ------- | -------\n';
            recentModels.forEach(tm => {
                recentActivityTable += `${tm.project_name || ''} | ${tm.name || ''} | ${tm.status || ''} | ${fmtDate(tm.created_at)} | ${fmtDate(tm.updated_at)}\n`;
            });
            finalPromptText = finalPromptText.replace('{{RECENT_ACTIVITY_TABLE}}', recentActivityTable);
        }
        // Add data injection logic for other report types...

        // 4. Log prompt size and preview, then call LLM
        // Estimate token count (roughly 4 chars per token for English)
        const promptLength = finalPromptText.length;
        const tokenEstimate = Math.ceil(promptLength / 4);
        console.log(`[ReportRunner] Prompt length: ${promptLength} chars, ~${tokenEstimate} tokens`);
        console.log(`[ReportRunner] Prompt preview:\n${finalPromptText.slice(0, 500)}${promptLength > 500 ? '\n...[truncated]' : ''}`);
        // 4. Call LLM with the final prompt
        try {
            // Allow client override via filters.llmOverride
            let llmProvider;
            let llmModel;
            const override = (filters && filters.llmOverride) ? filters.llmOverride : null;
            if (override && (override.provider || override.model)) {
                llmProvider = (override.provider || 'openai').toString().toLowerCase();
                llmModel = override.model || (llmProvider === 'ollama' ? 'llama3.1:latest' : 'gpt-4o-mini');
            } else {
                // Resolve provider/model from settings to avoid undefined usage
                const providerRaw = await settingsService.getSetting('settings:llm:provider', 'openai', true);
                llmProvider = (providerRaw ?? 'openai').toString().toLowerCase();
                if (llmProvider === 'ollama') {
                    llmModel = await settingsService.getSetting('settings:api:ollama:model', 'llama3.1:latest', true);
                } else {
                    // Default to OpenAI
                    llmModel = await settingsService.getSetting('openai.model', 'gpt-4o-mini', true);
                }
            }

            const startTime = Date.now();
            console.log(`[ReportRunner] Calling LLM provider: ${llmProvider}, model: ${llmModel}`);
            // Note: LLMClient.getCompletion signature: (promptText, provider, model)
            const llmResponse = await LLMClient.getCompletion(finalPromptText, llmProvider, llmModel);
            const elapsed = Date.now() - startTime;
            console.log(`[ReportRunner] LLM response received for ${reportType} in ${elapsed}ms.`);
            return llmResponse;
        } catch (error) {
            console.error(`[ReportRunner] LLMClient failed for ${reportType}:`, error);
            throw new Error(`LLM processing failed: ${error.message}`);
        }
    }
};

module.exports = ReportRunner;
