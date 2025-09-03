"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.importDocsTemplates = importDocsTemplates;
const promises_1 = __importDefault(require("fs/promises"));
const path_1 = __importDefault(require("path"));
function safeRequire(p) {
    const full = path_1.default.join(process.cwd(), p);
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    return require(full);
}
const db = safeRequire('db/db.js');
const repo = __importStar(require("./templatesRepo"));
function baseNameWithoutExt(file) {
    const base = path_1.default.basename(file);
    const idx = base.lastIndexOf('.');
    if (idx <= 0)
        return base; // no ext or dotfile
    return base.slice(0, idx);
}
async function existsByName(name) {
    const sql = `SELECT id FROM reports.report_templates WHERE name = $1 LIMIT 1`;
    const { rows } = await db.query(sql, [name]);
    return rows?.[0] || null;
}
async function updateContent(id, content_md) {
    const sql = `UPDATE reports.report_templates SET content_md = $2, updated_at = now() WHERE id = $1`;
    await db.query(sql, [id, content_md]);
}
async function importDocsTemplates(directory, opts = {}) {
    const dir = directory || path_1.default.join(process.cwd(), 'docs', 'report-templates');
    const overwrite = !!opts.overwrite;
    const result = { scanned: 0, created: 0, updated: 0, skipped: 0, errors: [], items: [] };
    let names;
    try {
        names = await promises_1.default.readdir(dir);
    }
    catch (e) {
        result.errors.push({ file: dir, error: e?.message || String(e) });
        return result;
    }
    for (const baseName of names) {
        if (!baseName || baseName.startsWith('.'))
            continue;
        const full = path_1.default.join(dir, baseName);
        try {
            const stat = await promises_1.default.stat(full);
            if (!stat.isFile())
                continue;
        }
        catch (_) {
            continue;
        }
        result.scanned += 1;
        try {
            const content = await promises_1.default.readFile(full, 'utf8');
            const name = baseNameWithoutExt(baseName);
            const firstLine = (content.split(/\r?\n/).find((l) => l.trim().length > 0) || '').trim();
            const description = firstLine && firstLine.length <= 200 ? firstLine : null;
            const existing = await existsByName(name);
            if (existing) {
                if (overwrite) {
                    await updateContent(existing.id, content);
                    result.updated += 1;
                    result.items.push({ name, action: 'updated', id: existing.id });
                }
                else {
                    result.skipped += 1;
                    result.items.push({ name, action: 'skipped', id: existing.id });
                }
                continue;
            }
            const row = await repo.createTemplate(name, description, content, 'system');
            result.created += 1;
            result.items.push({ name, action: 'created', id: row.id });
        }
        catch (e) {
            result.errors.push({ file: full, error: e?.message || String(e) });
            result.items.push({ name: baseName, action: 'error' });
        }
    }
    return result;
}
//# sourceMappingURL=templatesImporter.js.map