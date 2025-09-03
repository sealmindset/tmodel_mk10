"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.submit = submit;
const path_1 = __importDefault(require("path"));
const compileService_1 = require("./compileService");
function safeRequire(p) {
    const full = path_1.default.join(process.cwd(), p);
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    return require(full);
}
function extractPromptFromContent(content) {
    // Extract lines starting with "PROMPT " (as seeded in migration) into a single prompt
    const lines = content.split(/\r?\n/);
    const prompts = lines
        .map(l => l.trim())
        .filter(l => /^PROMPT\s+/i.test(l))
        .map(l => l.replace(/^PROMPT\s+/i, '').trim());
    if (prompts.length)
        return prompts.join('\n');
    // Fallback: return entire content if no explicit PROMPT lines
    return content;
}
function errorMessage(err) {
    if (err && typeof err === 'object' && 'message' in err) {
        return String(err.message);
    }
    try {
        return JSON.stringify(err);
    }
    catch {
        return String(err);
    }
}
async function submit(req) {
    const createdAt = new Date().toISOString();
    const provider = (req.provider || process.env.RTG_PROVIDER || 'openai');
    const model = req.model || process.env.RTG_MODEL || (provider === 'ollama' ? 'llama3:latest' : 'gpt-4o-mini');
    // First, compile to resolve tokens
    const compiled = await (0, compileService_1.compile)({ content: req.content || '', filters: req.filters });
    const promptText = extractPromptFromContent(compiled.content);
    // Call LLM via existing client (CommonJS module)
    const llmClient = safeRequire('reporting/llmClient.js');
    const controller = new AbortController();
    const timeoutMs = 60000;
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    let completion = '';
    try {
        completion = await llmClient.getCompletion(promptText, provider, model, { signal: controller.signal, timeoutMs });
    }
    finally {
        clearTimeout(timer);
    }
    // Persist output to reports.generated_reports if we have template and project
    const templateId = req.templateId;
    const templateVersion = req.templateVersion || 1;
    const projectId = (req.filters && req.filters.projectUuid) || null;
    if (templateId && projectId) {
        try {
            const db = safeRequire('db/db.js');
            const sql = `INSERT INTO reports.generated_reports (template_id, template_version, project_id, output_md, created_by)
                   VALUES ($1, $2, $3, $4, $5)`;
            const createdBy = (req.filters && req.filters.author) || 'system';
            await db.query(sql, [templateId, templateVersion, projectId, completion, createdBy]);
        }
        catch (e) {
            console.warn('[RTG] Failed to persist generated report:', errorMessage(e));
        }
    }
    return {
        output: completion,
        meta: { provider, model, createdAt }
    };
}
//# sourceMappingURL=submitService.js.map