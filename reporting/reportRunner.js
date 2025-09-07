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
const { getCacheManager, CACHE_NAMESPACES } = require('../utils/cacheManager');
const { getMetricsCollector, METRICS } = require('../utils/metrics');
const DEFAULT_OLLAMA_MAX_TOKENS = 512;
const OLLAMA_TIMEOUT_MS = 60000; // 60 seconds

const ReportRunner = {
    // Initialize cache manager
    cache: getCacheManager({
        ttl: 300, // 5 minutes
        memoryMaxSize: 200,
        redisEnabled: process.env.REDIS_URL ? true : false
    }),

    // Initialize metrics collector
    metrics: getMetricsCollector({
        enabled: process.env.METRICS_ENABLED !== 'false'
    }),
    /**
     * Generate a report based on type and prompt.
     * 
     * @param {string} reportType The type of report (e.g., 'project_portfolio').
     * @param {string|number} templateId The ID of the report template to use. Accepts UUID (report_templates) or numeric (reports).
     * @param {object} filters Optional filters for data fetching.
     * @returns {Promise<string>} The generated report content (raw text from LLM).
     * @throws {Error} If prompt not found, data fetching fails, or LLM call fails.
     */
    generateReport: async function(reportType, templateId, filters = {}, options = {}) {
        const startTime = Date.now();
        const reportTags = {
            report_type: reportType,
            template_id: String(templateId),
            has_project_filter: !!(filters && (filters.projectUuid || filters.project_id || filters.projectId))
        };

        // Helper to promptly stop work when upstream aborts (client disconnect or route timeout)
        const abortIfRequested = (stage) => {
            try {
                if (options && options.signal && options.signal.aborted) {
                    const err = new Error(`Aborted${stage ? ' during ' + stage : ''}`);
                    err.name = 'AbortError';
                    throw err;
                }
            } catch (_) {}
        };

        // Start overall timing
        const endTiming = this.metrics.startTimer(METRICS.REPORT_GENERATION_DURATION, reportTags);

        try {
            console.log(`[ReportRunner] Generating report. Type: ${reportType}, Template ID: ${templateId}`);
            abortIfRequested('start');

            // 1. Fetch the report template from appropriate source with caching
            const tidStr = (templateId != null) ? String(templateId).trim() : '';
            const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(tidStr);
            let templateRow;

            // Try to get from cache first
            const cacheKey = isUuid ? tidStr : `numeric:${tidStr}`;
            templateRow = await this.cache.get(CACHE_NAMESPACES.TEMPLATE, cacheKey);

            if (!templateRow) {
                cacheHit = false;
                console.log(`[ReportRunner] Template cache miss for ${cacheKey}, fetching from database`);
                try {
                    if (isUuid) {
                        console.log('[ReportRunner] Loading template by UUID from report_templates.*');
                        console.log(`[ReportRunner] Attempting to fetch template with ID: ${templateId}, type: ${typeof templateId}`);
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
                        const templateUuidResult = rows && rows[0];
                        console.log(`[ReportRunner] UUID fetch result:`, templateUuidResult ? 'Found' : 'Not found');
                        templateRow = templateUuidResult;
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
                            const templateUuidFallbackResult = vrows && vrows[0];
                            console.log(`[ReportRunner] UUID fallback fetch result:`, templateUuidFallbackResult ? 'Found' : 'Not found');
                            templateRow = templateUuidFallbackResult;
                        }
                        // Additional fallback: if still not found, try threat_model.report_prompts (custom prompts)
                        if (!templateRow || !templateRow.template_content) {
                            console.log('[ReportRunner] UUID not found in report_templates.*; attempting threat_model.report_prompts by id');
                            const { rows: prows } = await db.query(
                                `SELECT 
                                    id AS uuid_id,
                                    name,
                                    NULL AS description,
                                    report_prompt_text AS template_content
                                 FROM threat_model.report_prompts
                                 WHERE id = $1`,
                                [tidStr]
                            );
                            const promptResult = prows && prows[0];
                            console.log('[ReportRunner] Report prompts fetch result:', promptResult ? 'Found' : 'Not found');
                            templateRow = promptResult || templateRow;
                        }
                    } else {
                        const numericId = Number(tidStr);
                        if (Number.isNaN(numericId)) {
                            throw new Error(`Invalid templateId format: ${tidStr}`);
                        }
                        // First, try RTG-managed templates in reports.report_templates by api_id
                        console.log('[ReportRunner] Loading template by numeric id, trying reports.report_templates (RTG) by api_id');
                        console.log(`[ReportRunner] Attempting to fetch RTG template with api_id: ${numericId}`);
                        const { rows: rtgRows } = await db.query(
                            `SELECT
                               t.api_id,
                               t.id AS uuid_id,
                               t.name,
                               t.description,
                               v.content_md AS template_content
                             FROM reports.report_templates t
                             JOIN LATERAL (
                               SELECT content_md
                               FROM reports.report_template_versions vv
                               WHERE vv.template_id = t.id
                               ORDER BY vv.version DESC NULLS LAST, vv.created_at DESC
                               LIMIT 1
                             ) v ON TRUE
                             WHERE t.api_id = $1`,
                            [numericId]
                        );
                        let templateNumericResult = rtgRows && rtgRows[0];
                        console.log(`[ReportRunner] RTG api_id fetch result:`, templateNumericResult ? 'Found' : 'Not found');
                        // Fallback to legacy reports.template if RTG not found
                        if (!templateNumericResult || !templateNumericResult.template_content) {
                            console.log('[ReportRunner] Falling back to legacy reports.template for numeric id');
                            const { rows } = await db.query(
                                'SELECT id, name, description, template_content FROM reports.template WHERE id = $1',
                                [numericId]
                            );
                            templateNumericResult = rows && rows[0];
                        }
                        console.log(`[ReportRunner] Numeric ID fetch result:`, templateNumericResult ? 'Found' : 'Not found');
                        templateRow = templateNumericResult;
                    }

                    // Cache the template if found
                    if (templateRow && templateRow.template_content) {
                        await this.cache.set(CACHE_NAMESPACES.TEMPLATE, cacheKey, templateRow, {}, 600); // Cache for 10 minutes
                        console.log(`[ReportRunner] Template cached: ${cacheKey}`);
                    }
                } catch (e) {
                    console.error('[ReportRunner] Error querying template source:', e);
                    throw new Error('Failed to load report template');
                }
            } else {
                cacheHit = true;
                console.log(`[ReportRunner] Template cache hit for ${cacheKey}`);
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
        const projectId = filters && (filters.projectUuid || filters.project_id || filters.projectId);
        let selectedProject = null;
        let projectsAll = [];
        let componentsAll = [];
        let threatsAll = [];
        let vulnerabilitiesAll = [];
        let safeguardsMap = {};

        if (projectId) {
            // Project-scoped fetching with caching
            try {
                // Try cache first for project data
                const projectCacheKey = projectId;
                selectedProject = await this.cache.get(CACHE_NAMESPACES.PROJECT, projectCacheKey);

                if (!selectedProject) {
                    console.log(`[ReportRunner] Project cache miss for ${projectCacheKey}, fetching from database`);
                    selectedProject = await ProjectModel.getById(projectId);

                    if (selectedProject) {
                        await this.cache.set(CACHE_NAMESPACES.PROJECT, projectCacheKey, selectedProject, {}, 300); // Cache for 5 minutes
                        console.log(`[ReportRunner] Project cached: ${projectCacheKey}`);
                    }
                } else {
                    console.log(`[ReportRunner] Project cache hit for ${projectCacheKey}`);
                }

                projectsAll = selectedProject ? [selectedProject] : [];
            } catch (e) {
                console.warn('[ReportRunner] Failed to load selected project by id; falling back to empty array', e?.message || e);
                projectsAll = [];
            }

            try {
                // Try cache first for components
                const componentsCacheKey = projectId;
                componentsAll = await this.cache.get(CACHE_NAMESPACES.COMPONENTS, componentsCacheKey);

                if (!componentsAll) {
                    console.log(`[ReportRunner] Components cache miss for ${componentsCacheKey}, fetching from database`);
                    componentsAll = await ProjectModel.getComponents(projectId);

                    if (componentsAll) {
                        await this.cache.set(CACHE_NAMESPACES.COMPONENTS, componentsCacheKey, componentsAll, {}, 300); // Cache for 5 minutes
                        console.log(`[ReportRunner] Components cached: ${componentsCacheKey}`);
                    }
                } else {
                    console.log(`[ReportRunner] Components cache hit for ${componentsCacheKey}`);
                }

                // Defensive: ensure only components associated with the selected project remain
                if (Array.isArray(componentsAll) && componentsAll.length) {
                    componentsAll = componentsAll.filter(c => {
                        // Some queries (like ProjectModel.getComponents) return only component columns (c.*)
                        // with no project_id or projects[] in-row. In that case, trust the query scoping and keep.
                        const hasProjectIndicators = (
                            c.project_id || c.projectId || c.project_uuid || c.projectUuid || Array.isArray(c.projects)
                        );
                        if (!hasProjectIndicators) return true;
                        const pid = c.project_id || c.projectId || c.project_uuid || c.projectUuid;
                        const list = Array.isArray(c.projects) ? c.projects : [];
                        return (pid && pid === projectId) || list.includes(projectId);
                    });
                }
            } catch (e) {
                console.warn('[ReportRunner] Failed to load components for project; defaulting to []', e?.message || e);
                componentsAll = [];
            }
            try {
                const ThreatModel = require('../database/models/threatModel');
                const Threat = require('../database/models/threat');
                // Get threat models for the project using direct project_id linkage
                let threatModels = [];
                let modelSource = 'direct_project_id';
                try {
                    const tmAll = await ThreatModel.getAll({ project_id: projectId });
                    // Filter by project association if the model objects contain hints
                    threatModels = Array.isArray(tmAll) ? tmAll.filter(tm => {
                        const pid = tm?.project_id || tm?.projectId || tm?.project_uuid || tm?.projectUuid;
                        const list = Array.isArray(tm?.projects) ? tm.projects : [];
                        return (pid && pid === projectId) || list.includes(projectId);
                    }) : [];
                } catch (tmErr) {
                    console.warn('[ReportRunner] ThreatModel.getAll direct linkage failed', tmErr?.message || tmErr);
                    threatModels = [];
                }
                // Fallback: if none via direct linkage/filtering, try junction table association
                if (!Array.isArray(threatModels) || threatModels.length === 0) {
                    try {
                        threatModels = await ProjectModel.getThreatModels(projectId);
                        modelSource = 'project_threat_models_junction';
                    } catch (tmErr) {
                        console.warn('[ReportRunner] Fallback via ProjectModel.getThreatModels failed', tmErr?.message || tmErr);
                    }
                }
                const threatModelIds = Array.isArray(threatModels) ? threatModels.map(tm => tm.id) : [];
                if (Array.isArray(threatModels) && threatModels.length) {
                    const preview = threatModels.slice(0, 3).map(tm => ({ id: tm.id, name: tm.name, project_id: tm.project_id, threat_count: tm.threat_count }));
                    console.log('[ReportRunner] Threat model discovery', { projectId: String(projectId), modelCount: threatModelIds.length, source: modelSource, preview });
                } else {
                    console.log('[ReportRunner] Threat model discovery', { projectId: String(projectId), modelCount: 0, source: modelSource });
                }
                // If we still have no models, attempt a direct threats-by-project join as last resort
                if (threatModelIds.length === 0) {
                    try {
                        const sqlDirect = `
                            SELECT t.*
                            FROM threat_model.threats t
                            JOIN threat_model.threat_models tm ON t.threat_model_id = tm.id
                            WHERE tm.project_id = $1
                        `;
                        const { rows: byProjectDirect } = await db.query(sqlDirect, [projectId]);
                        if (Array.isArray(byProjectDirect) && byProjectDirect.length) {
                            console.log('[ReportRunner] Direct join fetched threats by tm.project_id:', byProjectDirect.length);
                            threatsAll = byProjectDirect;
                            // Short-circuit to avoid further per-model loops
                            throw { __shortCircuit: true };
                        }
                    } catch (e) {
                        if (e && e.__shortCircuit) { /* handled */ } else {
                            console.warn('[ReportRunner] Direct threats-by-project join failed or returned none', e?.message || e);
                        }
                    }
                    try {
                        const sqlJunction = `
                            SELECT t.*
                            FROM threat_model.threats t
                            JOIN threat_model.threat_models tm ON t.threat_model_id = tm.id
                            JOIN threat_model.project_threat_models ptm ON tm.id = ptm.threat_model_id
                            WHERE ptm.project_id = $1
                        `;
                        const { rows: byProjectJunction } = await db.query(sqlJunction, [projectId]);
                        if (Array.isArray(byProjectJunction) && byProjectJunction.length) {
                            console.log('[ReportRunner] Junction join fetched threats by ptm.project_id:', byProjectJunction.length);
                            threatsAll = byProjectJunction;
                            // Short-circuit
                            throw { __shortCircuit: true };
                        }
                    } catch (e) {
                        if (e && e.__shortCircuit) { /* handled */ } else {
                            console.warn('[ReportRunner] Junction threats-by-project join failed or returned none', e?.message || e);
                        }
                    }
                }
                if (!Array.isArray(threatsAll) || threatsAll.length === 0) {
                    const perModelThreats = [];
                    for (const tmId of threatModelIds) {
                        abortIfRequested('loading threats per model');
                        try {
                            const tset = await Threat.getAll({ threat_model_id: tmId });
                            if (Array.isArray(tset) && tset.length) perModelThreats.push(...tset);
                        } catch (e) {
                            console.warn('[ReportRunner] Failed loading threats for threat_model_id', tmId, e?.message || e);
                        }
                    }
                    const sumDeclared = (Array.isArray(threatModels)?threatModels.reduce((a,tm)=>a + (Number(tm.threat_count)||0),0):0);
                    console.log('[ReportRunner] Per-model threats fetched', { perModelCount: perModelThreats.length, declaredCountFromModels: sumDeclared });
                    // Fallback: if no threats were returned via per-model calls but models exist, fetch in bulk
                    if ((!perModelThreats || perModelThreats.length === 0) && threatModelIds.length > 0) {
                        try {
                            const placeholders = threatModelIds.map((_, i) => `$${i + 1}`).join(', ');
                            const sql = `SELECT * FROM threat_model.threats WHERE threat_model_id IN (${placeholders})`;
                            const { rows: bulkRows } = await db.query(sql, threatModelIds);
                            if (Array.isArray(bulkRows) && bulkRows.length) {
                                console.log('[ReportRunner] Bulk IN-query fetched threats:', bulkRows.length, 'for models:', threatModelIds.length);
                                threatsAll = bulkRows;
                            } else {
                                threatsAll = [];
                            }
                        } catch (bulkErr) {
                            console.warn('[ReportRunner] Bulk threat fetch failed; defaulting to perModelThreats length', perModelThreats.length, bulkErr?.message || bulkErr);
                            threatsAll = perModelThreats;
                        }
                    } else {
                        threatsAll = perModelThreats;
                    }
                    if ((threatsAll.length === 0) && sumDeclared > 0) {
                        console.warn('[ReportRunner] Inconsistency: models declare threats but none fetched', { modelCount: threatModelIds.length, sumDeclared });
                    }
                } else {
                    console.log('[ReportRunner] Retaining threats from earlier fallback path:', threatsAll.length);
                }
            } catch (e) {
                console.warn('[ReportRunner] Failed to load threats for project; defaulting to []', e?.message || e);
                threatsAll = [];
            }
            try {
                const VulnerabilityModel = require('../database/models/vulnerability');
                // Gather vulnerabilities for each component
                const perComponentVulns = [];
                for (const c of (componentsAll || [])) {
                    abortIfRequested('loading component vulnerabilities');
                    try {
                        const vset = await VulnerabilityModel.getAll({ component_id: c.id });
                        if (Array.isArray(vset) && vset.length) perComponentVulns.push(...vset);
                    } catch (e) {
                        console.warn('[ReportRunner] Failed loading vulnerabilities for component', c?.id, e?.message || e);
                    }
                }
                // Defensive: ensure vulnerabilities only for components in-scope
                const compIds = new Set((componentsAll || []).map(c => c.id));
                vulnerabilitiesAll = perComponentVulns.filter(v => compIds.has(v.component_id || v.componentId));
            } catch (e) {
                console.warn('[ReportRunner] Failed to load vulnerabilities for project; defaulting to []', e?.message || e);
                vulnerabilitiesAll = [];
            }
            try {
                const Threat = require('../database/models/threat');
                // Build a map of threat_id -> safeguards[]
                const sgMap = {};
                for (const t of (threatsAll || [])) {
                    abortIfRequested('loading safeguards per threat');
                    try {
                        const sgs = await Threat.getSafeguards(t.id);
                        sgMap[t.id] = Array.isArray(sgs) ? sgs : [];
                    } catch (e) {
                        console.warn('[ReportRunner] Failed loading safeguards for threat', t?.id, e?.message || e);
                        sgMap[t.id] = [];
                    }
                }
                safeguardsMap = sgMap;
            } catch (e) {
                console.warn('[ReportRunner] Failed to load safeguards for threats; defaulting to {}', e?.message || e);
                safeguardsMap = {};
            }
            console.log('[ReportRunner] Project-scoped fetch complete', {
                projectId: String(projectId),
                components: componentsAll.length,
                threats: threatsAll.length,
                vulnerabilities: vulnerabilitiesAll.length,
                safeguardsForThreats: Object.keys(safeguardsMap).length
            });
        } else {
            // Legacy broad fetching when no project is specified
            projectsAll = await safeGetAll(ProjectModel.getAll.bind(ProjectModel), []);
            componentsAll = await safeGetAll(ComponentModel.getAll.bind(ComponentModel), []);
            try {
                const ThreatModel = require('../database/models/threatModel');
                threatsAll = await safeGetAll(ThreatModel.getAll.bind(ThreatModel), []);
            } catch(_) {}
            try {
                const VulnerabilityModel = require('../database/models/vulnerability');
                vulnerabilitiesAll = await safeGetAll(VulnerabilityModel.getAll.bind(VulnerabilityModel), []);
            } catch(_) {}
            // Keep safeguards as empty object in legacy mode unless future global API exists
            safeguardsMap = {};
        }

        // Deterministic ordering helpers
        const sevOrder = { Critical:4, High:3, Medium:2, Low:1 };
        const byName = (a,b)=> String(a?.name||'').localeCompare(String(b?.name||''));
        const bySeverityThenTitle = (a,b)=>{
            const sa = sevOrder[String(a?.severity||'')]||0;
            const sb = sevOrder[String(b?.severity||'')]||0;
            if (sa!==sb) return sb-sa; // desc
            return String(a?.title||'').localeCompare(String(b?.title||''));
        };
        const bySeverityThenCreatedDesc = (a,b)=>{
            const sa = sevOrder[String(a?.severity||'')]||0;
            const sb = sevOrder[String(b?.severity||'')]||0;
            if (sa!==sb) return sb-sa; // desc
            const da = a?.created_at ? new Date(a.created_at).getTime() : 0;
            const db = b?.created_at ? new Date(b.created_at).getTime() : 0;
            return db - da; // recent first
        };

        const componentsSorted = Array.isArray(componentsAll) ? [...componentsAll].sort(byName) : [];
        const threatsSorted = Array.isArray(threatsAll) ? [...threatsAll].sort(bySeverityThenTitle) : [];
        const vulnerabilitiesSorted = Array.isArray(vulnerabilitiesAll) ? [...vulnerabilitiesAll].sort(bySeverityThenCreatedDesc) : [];
        const safeguardsSorted = Array.isArray(safeguardsMap) ? [...safeguardsMap] : safeguardsMap;

        // Size guards and summarization
        const BUDGET = {
            project: 50_000,
            components: 150_000,
            threats: 120_000,
            vulnerabilities: 120_000,
            safeguards: 120_000,
            statistics: 20_000
        };
        const stringifyWithBudget = (obj, budget, label)=>{
            try {
                const text = JSON.stringify(obj);
                if (text.length <= budget) return { text, truncated:false, length:text.length, count: Array.isArray(obj)?obj.length:undefined };
                const count = Array.isArray(obj)?obj.length:undefined;
                const summary = { truncated:true, count: count ?? null, note:`${label} exceeded budget (${text.length} > ${budget})` };
                return { text: JSON.stringify(summary), truncated:true, length:text.length, count };
            } catch (e) {
                return { text: 'null', truncated:false, length:0 };
            }
        };

        const projectJsonS = stringifyWithBudget(projectsAll, BUDGET.project, 'project');
        const componentsJsonS = stringifyWithBudget(componentsSorted, BUDGET.components, 'components');
        const threatsJsonS = stringifyWithBudget(threatsSorted, BUDGET.threats, 'threats');
        const vulnsJsonS = stringifyWithBudget(vulnerabilitiesSorted, BUDGET.vulnerabilities, 'vulnerabilities');
        const safeguardsJsonS = stringifyWithBudget(safeguardsSorted, BUDGET.safeguards, 'safeguards');

        const statistics = (()=>{
            const vulnCounts = { Critical:0, High:0, Medium:0, Low:0 };
            (Array.isArray(vulnerabilitiesSorted)?vulnerabilitiesSorted:[]).forEach(v=>{ const s=(v.severity||'').toString(); if (vulnCounts[s] != null) vulnCounts[s]++; });
            return {
                counts: {
                    components: componentsSorted.length,
                    threats: threatsSorted.length,
                    vulnerabilities: (Array.isArray(vulnerabilitiesSorted)?vulnerabilitiesSorted.length:0)
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
                vulnerabilities_by_severity: vulnCounts,
                incidents: { High:0, Medium:0, Low:0 }
            };
        })();
        console.log('[ReportRunner] Context sizes (chars):', statistics.lengths, 'Truncation:', statistics.truncation);

        // Build replacements only for tokens present
        // Resolve a single project object for singular token usage (prefer project-scoped loaded one)
        if (!selectedProject) {
            const arr = Array.isArray(projectsAll) ? projectsAll : [];
            selectedProject = arr.length ? arr[0] : null;
        }

        // Derive optional tokens (best-effort; no external calls)
        const slugify = (s) => {
            if (!s) return '';
            return String(s).trim().toLowerCase()
                .replace(/[^a-z0-9]+/g, '-')
                .replace(/^-+|-+$/g, '')
                .slice(0, 64);
        };
        const projectKey = (() => {
            try {
                if (selectedProject && (selectedProject.key || selectedProject.project_key)) {
                    return String(selectedProject.key || selectedProject.project_key);
                }
                const base = selectedProject && (selectedProject.name || selectedProject.project_name || selectedProject.title);
                return slugify(base);
            } catch (_) {
                return '';
            }
        })();
        const resiliencyTarget = (() => {
            try {
                if (selectedProject) {
                    const slo = selectedProject.sla_slo;
                    if (slo && typeof slo === 'object' && slo.slo_target) return String(slo.slo_target);
                    if (typeof slo === 'string') {
                        try {
                            const obj = JSON.parse(slo);
                            if (obj && obj.slo_target) return String(obj.slo_target);
                        } catch (_) {}
                    }
                    if (selectedProject.slo_target) return String(selectedProject.slo_target);
                    if (selectedProject.sloTarget) return String(selectedProject.sloTarget);
                }
                return '99.9';
            } catch (_) {
                return '99.9';
            }
        })();
        console.log('[ReportRunner] Derived optional tokens', { project_key: projectKey, resiliency_target: resiliencyTarget });

        const tokenReplacements = new Map([
            ['{{GENERATED_AT}}', nowIso],
            ['{{AUTHOR}}', author],
            ['{{ENV}}', env],
            ['{{CI_EXAMPLE}}', ciExample],
            ['<ISO-timestamp>', nowIso],
            ['<username>', author],
            ['{{PROJECT_KEY}}', projectKey],
            ['{{RESILIENCY_TARGET}}', resiliencyTarget],
            ['{{PROJECTS_JSON}}', projectJsonS.text],
            ['{{PROJECT_JSON}}', JSON.stringify(selectedProject || {})],
            ['{{PROJECTS_COUNT}}', String(Array.isArray(projectsAll)?projectsAll.length:0)],
            ['{{PROJECT_NAMES_CSV}}', (Array.isArray(projectsAll)?projectsAll.map(p=>p.name).filter(Boolean).join(', '):'')],
            ['{{COMPONENTS_JSON}}', componentsJsonS.text],
            ['{{COMPONENTS_COUNT}}', String(Array.isArray(componentsAll)?componentsAll.length:0)],
            ['{{THREATS_JSON}}', threatsJsonS.text],
            ['{{VULNERABILITIES_JSON}}', vulnsJsonS.text],
            ['{{THREAT_SAFEGUARDS_JSON}}', safeguardsJsonS.text],
            ['{{STATISTICS_JSON}}', JSON.stringify(statistics)],
            ['{{PIPELINE_STEPS_JSON}}', JSON.stringify((filters && filters.pipeline_steps) || [])],
            ['{{TERRAFORM_TAGS_JSON}}', JSON.stringify((filters && filters.tags) || {})],
            ['{{AWS_ACCOUNTS_JSON}}', JSON.stringify((filters && filters.aws_accounts) || [])]
        ]);

        let finalPromptText = templateRow.template_content || '';
        // Idempotent instruction prelude to reinforce CAG usage
        try {
            const hasPrelude = /Use (ONLY|provided)\s+the\s+JSON/i.test(finalPromptText) || /Context-As-Grounding/i.test(finalPromptText);
            if (!hasPrelude) {
                const prelude = [
                    'Instructions to the model:',
                    '- Use provided JSON strictly as context (CAG). Do not invent facts.',
                    '- If context is missing, state limitations explicitly.',
                    '- Follow the template structure and keep outputs concise and deterministic.',
                    ''
                ].join('\n');
                finalPromptText = prelude + '\n' + finalPromptText;
            }
        } catch(_) {}
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
            // Additionally support bare and backticked token names (e.g., PROJECT_JSON or `PROJECT_JSON`)
            for (const [tok, val] of tokenReplacements.entries()) {
                const m = tok.match(/^\{\{\s*([^}]+?)\s*\}\}$/);
                if (!m) continue;
                const name = m[1];
                // Backticked variant: `NAME`
                const backtickRx = new RegExp('`' + name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '`', 'g');
                const beforeBT = finalPromptText;
                finalPromptText = finalPromptText.replace(backtickRx, () => { replacedCount++; return val; });
                // Bare variant with word boundaries: NAME
                const bareRx = new RegExp('(?:^|[^A-Za-z0-9_`])(' + name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + ')(?=$|[^A-Za-z0-9_`])', 'g');
                const beforeBare = finalPromptText;
                finalPromptText = finalPromptText.replace(bareRx, (match, p1) => {
                    // Preserve preceding char if present, substitute only the token portion
                    const prefix = match.slice(0, match.length - p1.length);
                    replacedCount++;
                    return prefix + val;
                });
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

        // Before data fetch, check for abort
        abortIfRequested('before data fetch');
        let rawData;
        try {
            switch (reportType) {
                case 'project_portfolio':
                    rawData = await ProjectModel.getAll(filters); // Assuming getAll supports filters
                    break;
                case 'component_inventory':
                    // Use project-scoped components if project filter provided
                    rawData = projectId ? (Array.isArray(componentsAll) ? componentsAll : [])
                                        : await ComponentModel.getAll(filters);
                    break;
                case 'safeguard_status':
                    // Fetch all safeguards
                    const SafeguardModel = require('../database/models/safeguard');
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
                    // Use project-scoped threat models if project filter provided (direct project_id linkage)
                    rawData = projectId ? await ThreatModel.getAll({ project_id: projectId })
                                        : await ThreatModel.getAll(filters);
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
                // If a project filter is applied, show only the selected project's name to avoid cross-project associations
                const projects = (projectId && (selectedProject && selectedProject.name))
                    ? selectedProject.name
                    : (Array.isArray(c.projects) ? c.projects.join(', ') : '');
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
            // Determine provider-specific timeout if not explicitly provided
            const externalSignal = options.signal;
            const explicitTimeout = Number.isFinite(options.timeoutMs) ? options.timeoutMs : undefined;
            const defaultTimeout = llmProvider === 'ollama' ? 15000 : 45000; // 15s Ollama, 45s OpenAI
            const timeoutMs = explicitTimeout || defaultTimeout;
            console.log(`[ReportRunner] Calling LLM provider: ${llmProvider}, model: ${llmModel}, timeoutMs=${timeoutMs}${explicitTimeout ? ' (explicit)' : ' (default)'}`);
            abortIfRequested('before LLM call');
            // Forward signal/timeout and minimal metadata for usage logs
            const llmResponse = await LLMClient.getCompletion(
                finalPromptText,
                llmProvider,
                llmModel,
                {
                    signal: externalSignal,
                    timeoutMs,
                    maxRetries: llmProvider === 'ollama' ? 1 : 2, // Fewer retries for Ollama due to local processing
                    task_type: 'report_generation',
                    meta: { reportType, templateId }
                }
            );
            const elapsed = Date.now() - startTime;
            console.log(`[ReportRunner] LLM response received for ${reportType} in ${elapsed}ms.`);
            try {
                const respStr = (typeof llmResponse === 'string') ? llmResponse : (llmResponse == null ? '' : String(llmResponse));
                console.log('[ReportRunner] LLM output summary:', {
                    length: respStr.length,
                    preview: respStr.slice(0, 200)
                });
            } catch (_) {}
            return llmResponse;
        } catch (error) {
            console.error(`[ReportRunner] LLMClient failed for ${reportType}:`, error);
            throw new Error(`LLM processing failed: ${error.message}`);
        }
    } catch (err) {
        console.error('[ReportRunner] Unhandled error during report generation:', err);
        throw err;
    } finally {
        try { endTiming(); } catch (_) {}
    }
}};

module.exports = ReportRunner;
