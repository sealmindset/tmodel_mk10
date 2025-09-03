import path from 'path';
import { RtgFilters } from '../types';

export interface ScopedData {
  selectedProject: any | null;
  projectsAll: any[];
  componentsAll: any[];
  threatsAll: any[];
  vulnerabilitiesAll: any[];
  safeguardsMap: Record<string, any[]>;
}

function safeRequire(p: string) {
  // Resolve from repo root to avoid fragile relative paths after build
  const full = path.join(process.cwd(), p);
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  return require(full);
}

export async function fetchScopedData(filters?: RtgFilters): Promise<ScopedData> {
  const projectId = filters && (filters.projectUuid || (filters.project_id as any) || (filters.projectId as any));

  const ProjectModel = safeRequire('database/models/project');
  const ComponentModel = safeRequire('reporting/componentModel');

  let selectedProject: any = null;
  let projectsAll: any[] = [];
  let componentsAll: any[] = [];
  let threatsAll: any[] = [];
  let vulnerabilitiesAll: any[] = [];
  let safeguardsMap: Record<string, any[]> = {};

  if (projectId) {
    try {
      selectedProject = await ProjectModel.getById(projectId);
      projectsAll = selectedProject ? [selectedProject] : [];
    } catch (_) {
      projectsAll = [];
    }
    try {
      componentsAll = await ProjectModel.getComponents(projectId);
    } catch (_) {
      componentsAll = [];
    }
    try {
      const ThreatModel = safeRequire('database/models/threatModel');
      const Threat = safeRequire('database/models/threat');
      // Prefer direct linkage
      let threatModels: any[] = [];
      try {
        const tmAll = await ThreatModel.getAll({ project_id: projectId });
        threatModels = Array.isArray(tmAll) ? tmAll : [];
      } catch (_) {
        threatModels = [];
      }
      if (!Array.isArray(threatModels) || threatModels.length === 0) {
        try {
          threatModels = await ProjectModel.getThreatModels(projectId);
        } catch (_) {
          threatModels = [];
        }
      }
      const threatModelIds = Array.isArray(threatModels) ? threatModels.map((tm: any) => tm.id) : [];
      if (threatModelIds.length) {
        const db = safeRequire('db/db');
        try {
          const placeholders = threatModelIds.map((_: any, i: number) => `$${i + 1}`).join(', ');
          const sql = `SELECT * FROM threat_model.threats WHERE threat_model_id IN (${placeholders})`;
          const { rows } = await db.query(sql, threatModelIds);
          threatsAll = Array.isArray(rows) ? rows : [];
        } catch (_) {
          // Fallback per-model
          const per: any[] = [];
          for (const tmId of threatModelIds) {
            try {
              const tset = await Threat.getAll({ threat_model_id: tmId });
              if (Array.isArray(tset) && tset.length) per.push(...tset);
            } catch (_) {}
          }
          threatsAll = per;
        }
      } else {
        threatsAll = [];
      }
      // Vulnerabilities per component
      try {
        const VulnerabilityModel = safeRequire('database/models/vulnerability');
        const per: any[] = [];
        for (const c of componentsAll) {
          try {
            const vset = await VulnerabilityModel.getAll({ component_id: c.id });
            if (Array.isArray(vset) && vset.length) per.push(...vset);
          } catch (_) {}
        }
        const compIds = new Set(componentsAll.map((c: any) => c.id));
        vulnerabilitiesAll = per.filter(v => compIds.has(v.component_id || v.componentId));
      } catch (_) {
        vulnerabilitiesAll = [];
      }
      // Safeguards per threat
      try {
        const Threat = safeRequire('database/models/threat');
        const sgMap: Record<string, any[]> = {};
        for (const t of threatsAll) {
          try {
            const sgs = await Threat.getSafeguards(t.id);
            sgMap[t.id] = Array.isArray(sgs) ? sgs : [];
          } catch (_) {
            sgMap[t.id] = [];
          }
        }
        safeguardsMap = sgMap;
      } catch (_) {
        safeguardsMap = {};
      }
    } catch (_) {}
  } else {
    // Broad fetch as legacy fallback
    try { projectsAll = await ProjectModel.getAll({}); } catch (_) { projectsAll = []; }
    try { componentsAll = await ComponentModel.getAll({}); } catch (_) { componentsAll = []; }
    try {
      const ThreatModel = safeRequire('database/models/threatModel');
      threatsAll = await ThreatModel.getAll({});
    } catch (_) { threatsAll = []; }
    try {
      const VulnerabilityModel = safeRequire('database/models/vulnerability');
      vulnerabilitiesAll = await VulnerabilityModel.getAll({});
    } catch (_) { vulnerabilitiesAll = []; }
    safeguardsMap = {};
  }

  return { selectedProject, projectsAll, componentsAll, threatsAll, vulnerabilitiesAll, safeguardsMap };
}

export function buildBudgets() {
  return {
    project: 50_000,
    components: 150_000,
    threats: 120_000,
    vulnerabilities: 120_000,
    safeguards: 120_000,
    statistics: 20_000
  } as const;
}

export function stringifyWithBudget(obj: any, budget: number, label: string) {
  try {
    const text = JSON.stringify(obj);
    if (text.length <= budget) return { text, truncated: false, length: text.length, count: Array.isArray(obj) ? obj.length : undefined };
    const count = Array.isArray(obj) ? obj.length : undefined;
    const summary = { truncated: true, count: count ?? null, note: `${label} exceeded budget (${text.length} > ${budget})` };
    return { text: JSON.stringify(summary), truncated: true, length: text.length, count };
  } catch (_) {
    return { text: 'null', truncated: false, length: 0 };
  }
}
