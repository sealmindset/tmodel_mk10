"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.fetchScopedData = fetchScopedData;
exports.buildBudgets = buildBudgets;
exports.stringifyWithBudget = stringifyWithBudget;
const path_1 = __importDefault(require("path"));
function safeRequire(p) {
    // Resolve from repo root to avoid fragile relative paths after build
    const full = path_1.default.join(process.cwd(), p);
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    return require(full);
}
async function fetchScopedData(filters) {
    const projectId = filters && (filters.projectUuid || filters.project_id || filters.projectId);
    const ProjectModel = safeRequire('database/models/project');
    const ComponentModel = safeRequire('reporting/componentModel');
    let selectedProject = null;
    let projectsAll = [];
    let componentsAll = [];
    let threatsAll = [];
    let vulnerabilitiesAll = [];
    let safeguardsMap = {};
    if (projectId) {
        try {
            selectedProject = await ProjectModel.getById(projectId);
            projectsAll = selectedProject ? [selectedProject] : [];
        }
        catch (_) {
            projectsAll = [];
        }
        try {
            componentsAll = await ProjectModel.getComponents(projectId);
        }
        catch (_) {
            componentsAll = [];
        }
        try {
            const ThreatModel = safeRequire('database/models/threatModel');
            const Threat = safeRequire('database/models/threat');
            // Prefer direct linkage
            let threatModels = [];
            try {
                const tmAll = await ThreatModel.getAll({ project_id: projectId });
                threatModels = Array.isArray(tmAll) ? tmAll : [];
            }
            catch (_) {
                threatModels = [];
            }
            if (!Array.isArray(threatModels) || threatModels.length === 0) {
                try {
                    threatModels = await ProjectModel.getThreatModels(projectId);
                }
                catch (_) {
                    threatModels = [];
                }
            }
            const threatModelIds = Array.isArray(threatModels) ? threatModels.map((tm) => tm.id) : [];
            if (threatModelIds.length) {
                const db = safeRequire('db/db');
                try {
                    const placeholders = threatModelIds.map((_, i) => `$${i + 1}`).join(', ');
                    const sql = `SELECT * FROM threat_model.threats WHERE threat_model_id IN (${placeholders})`;
                    const { rows } = await db.query(sql, threatModelIds);
                    threatsAll = Array.isArray(rows) ? rows : [];
                }
                catch (_) {
                    // Fallback per-model
                    const per = [];
                    for (const tmId of threatModelIds) {
                        try {
                            const tset = await Threat.getAll({ threat_model_id: tmId });
                            if (Array.isArray(tset) && tset.length)
                                per.push(...tset);
                        }
                        catch (_) { }
                    }
                    threatsAll = per;
                }
            }
            else {
                threatsAll = [];
            }
            // Vulnerabilities per component
            try {
                const VulnerabilityModel = safeRequire('database/models/vulnerability');
                const per = [];
                for (const c of componentsAll) {
                    try {
                        const vset = await VulnerabilityModel.getAll({ component_id: c.id });
                        if (Array.isArray(vset) && vset.length)
                            per.push(...vset);
                    }
                    catch (_) { }
                }
                const compIds = new Set(componentsAll.map((c) => c.id));
                vulnerabilitiesAll = per.filter(v => compIds.has(v.component_id || v.componentId));
            }
            catch (_) {
                vulnerabilitiesAll = [];
            }
            // Safeguards per threat
            try {
                const Threat = safeRequire('database/models/threat');
                const sgMap = {};
                for (const t of threatsAll) {
                    try {
                        const sgs = await Threat.getSafeguards(t.id);
                        sgMap[t.id] = Array.isArray(sgs) ? sgs : [];
                    }
                    catch (_) {
                        sgMap[t.id] = [];
                    }
                }
                safeguardsMap = sgMap;
            }
            catch (_) {
                safeguardsMap = {};
            }
        }
        catch (_) { }
    }
    else {
        // Broad fetch as legacy fallback
        try {
            projectsAll = await ProjectModel.getAll({});
        }
        catch (_) {
            projectsAll = [];
        }
        try {
            componentsAll = await ComponentModel.getAll({});
        }
        catch (_) {
            componentsAll = [];
        }
        try {
            const ThreatModel = safeRequire('database/models/threatModel');
            threatsAll = await ThreatModel.getAll({});
        }
        catch (_) {
            threatsAll = [];
        }
        try {
            const VulnerabilityModel = safeRequire('database/models/vulnerability');
            vulnerabilitiesAll = await VulnerabilityModel.getAll({});
        }
        catch (_) {
            vulnerabilitiesAll = [];
        }
        safeguardsMap = {};
    }
    return { selectedProject, projectsAll, componentsAll, threatsAll, vulnerabilitiesAll, safeguardsMap };
}
function buildBudgets() {
    return {
        project: 50000,
        components: 150000,
        threats: 120000,
        vulnerabilities: 120000,
        safeguards: 120000,
        statistics: 20000
    };
}
function stringifyWithBudget(obj, budget, label) {
    try {
        const text = JSON.stringify(obj);
        if (text.length <= budget)
            return { text, truncated: false, length: text.length, count: Array.isArray(obj) ? obj.length : undefined };
        const count = Array.isArray(obj) ? obj.length : undefined;
        const summary = { truncated: true, count: count ?? null, note: `${label} exceeded budget (${text.length} > ${budget})` };
        return { text: JSON.stringify(summary), truncated: true, length: text.length, count };
    }
    catch (_) {
        return { text: 'null', truncated: false, length: 0 };
    }
}
//# sourceMappingURL=dataFetcher.js.map