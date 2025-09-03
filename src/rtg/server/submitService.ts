import path from 'path';
import { CompileRequest } from '../types';
import { compile } from './compileService';

function safeRequire(p: string) {
  const full = path.join(process.cwd(), p);
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  return require(full);
}

export interface SubmitRequest extends CompileRequest {
  provider?: 'openai' | 'ollama';
  model?: string;
  templateId?: string; // UUID of reports.report_templates.id
  templateVersion?: number; // version to record
}

export interface SubmitResult {
  output: string;
  meta: {
    provider: string;
    model: string;
    createdAt: string;
  };
}

function extractPromptFromContent(content: string): string {
  // Extract lines starting with "PROMPT " (as seeded in migration) into a single prompt
  const lines = content.split(/\r?\n/);
  const prompts = lines
    .map(l => l.trim())
    .filter(l => /^PROMPT\s+/i.test(l))
    .map(l => l.replace(/^PROMPT\s+/i, '').trim());
  if (prompts.length) return prompts.join('\n');
  // Fallback: return entire content if no explicit PROMPT lines
  return content;
}

function errorMessage(err: unknown): string {
  if (err && typeof err === 'object' && 'message' in err) {
    return String((err as any).message);
  }
  try { return JSON.stringify(err); } catch { return String(err); }
}

export async function submit(req: SubmitRequest): Promise<SubmitResult> {
  const createdAt = new Date().toISOString();
  const provider = (req.provider || process.env.RTG_PROVIDER || 'openai') as 'openai' | 'ollama';
  const model = req.model || process.env.RTG_MODEL || (provider === 'ollama' ? 'llama3:latest' : 'gpt-4o-mini');

  // First, compile to resolve tokens
  const compiled = await compile({ content: req.content || '', filters: req.filters });
  const promptText = extractPromptFromContent(compiled.content);

  // Call LLM via existing client (CommonJS module)
  const llmClient = safeRequire('reporting/llmClient.js');
  const controller = new AbortController();
  const timeoutMs = 60000;
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  let completion = '';
  try {
    completion = await llmClient.getCompletion(promptText, provider, model, { signal: controller.signal, timeoutMs });
  } finally {
    clearTimeout(timer);
  }

  // Persist output to reports.generated_reports if we have template and project
  const templateId = req.templateId;
  const templateVersion = req.templateVersion || 1;
  const projectId = (req.filters && (req.filters.projectUuid as any)) || null;

  if (templateId && projectId) {
    try {
      const db = safeRequire('db/db.js');
      const sql = `INSERT INTO reports.generated_reports (template_id, template_version, project_id, output_md, created_by)
                   VALUES ($1, $2, $3, $4, $5)`;
      const createdBy = (req.filters && (req.filters.author as any)) || 'system';
      await db.query(sql, [templateId, templateVersion, projectId, completion, createdBy]);
    } catch (e) {
      console.warn('[RTG] Failed to persist generated report:', errorMessage(e));
    }
  }

  return {
    output: completion,
    meta: { provider, model, createdAt }
  };
}
