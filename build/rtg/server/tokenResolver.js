"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.resolveTokens = resolveTokens;
// Normalize various brace/entity variants to ASCII curly braces
function normalizeBraces(text) {
    return text
        .replace(/&#123;/g, '{')
        .replace(/&#125;/g, '}')
        .replace(/&lbrace;/g, '{')
        .replace(/&rbrace;/g, '}')
        .replace(/[\uFF5B［]/g, '{')
        .replace(/[\uFF5D］]/g, '}');
}
// Whitespace-tolerant token pattern maker, e.g., {{ PROJECT_JSON }}
function tokenPattern(token) {
    const inner = token.replace(/^\{\{|\}\}$/g, '').trim();
    const spaced = inner.replace(/\s+/g, '\\s*');
    return new RegExp(`\{\{\\s*${spaced}\\s*\}\}`, 'g');
}
function resolveTokens(input, filters, replacements, knownTokens) {
    let content = normalizeBraces(input);
    const warnings = [];
    // Replace using strict {{TOKEN}} first
    for (const [key, val] of replacements.entries()) {
        const pat = tokenPattern(key);
        content = content.replace(pat, val);
    }
    // Optional macro: {{SEVERITY_BADGE:Level}} -> [Level]
    content = content.replace(/\{\{\s*SEVERITY_BADGE\s*:\s*([^}]+)\}\}/g, (_, level) => `[${String(level).trim()}]`);
    // Collect unreplaced {{...}} tokens to warn
    const unreplaced = content.match(/\{\{[^}]+\}\}/g) || [];
    const unknown = Array.from(new Set(unreplaced.filter(t => !knownTokens.includes(t.replace(/\s+/g, '')))));
    if (unknown.length) {
        warnings.push({ code: 'UNKNOWN_TOKENS', message: `Found unknown/unresolved tokens: ${unknown.join(', ')}` });
    }
    return { content, warnings };
}
//# sourceMappingURL=tokenResolver.js.map