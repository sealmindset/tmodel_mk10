---
name: Component-Centric CAG Report
version: 1.0.0
notes: |
  This markdown template is designed for Context-As-Grounding (CAG) report generation.
  It expects the backend to inject JSON tokens before the LLM is called.
  Tokens below are replaced by `reporting/reportRunner.js`.
---

Instructions to the model:
- Use provided JSON strictly as context (CAG). Do not invent facts.
- If context is missing, state limitations explicitly.
- Follow the template structure and keep outputs concise and deterministic.

Metadata
- Generated at: {{GENERATED_AT}}
- Author: {{AUTHOR}}
- Environment: {{ENV}}

# Context (JSON)

Project:
```json
{{PROJECT_JSON}}
```

Components:
```json
{{COMPONENTS_JSON}}
```

Threats:
```json
{{THREATS_JSON}}
```

Threat→Safeguards Mapping:
```json
{{THREAT_SAFEGUARDS_JSON}}
```

Vulnerabilities:
```json
{{VULNERABILITIES_JSON}}
```

Statistics:
```json
{{STATISTICS_JSON}}
```

---

# Executive Summary

Briefly describe the project’s purpose and business context based on PROJECT_JSON.
Summarize component count, notable technologies, and integration surfaces.
Summarize overall threat exposure: top threat categories and severities observed.
Summarize safeguard coverage: strengths, gaps, and highest-impact recommendations.

# Methodology

- Source: Project-linked context (components, threats, vulnerabilities, safeguards).
- Approach: Context-As-Grounding (CAG) using the JSON blocks above.
- Scope: The project and all components listed in COMPONENTS_JSON.

# Component Analysis

For each component in COMPONENTS_JSON (sorted by name), produce a subsection:

## Component: {component.name}

- Purpose: Summarize its primary function and criticality based on available fields.
- Attack Surface: List external/internal interfaces, data flows, protocols, and trust boundaries.

- Relevant Threats:
  - Identify threats that apply to this component from THREATS_JSON (by category, preconditions, or mapping). Include rationale for applicability.

- Safeguards:
  - From THREAT_SAFEGUARDS_JSON, list controls that mitigate the above threats for this component. Note current status if available (implemented, planned, gap).

### Known Vulnerabilities (if any)
Only include this section if vulnerabilities in VULNERABILITIES_JSON map to this component. Summarize entries with severity and status.

### Residual Risk
Provide a brief statement of residual risks given current safeguards and known vulnerabilities.

# Cross-Cutting Threats and Controls

- Highlight threats that affect multiple components and the shared mitigations.
- Identify systemic weaknesses (e.g., authn/authz, secrets mgmt, supply chain, logging).

## Safeguard Gap Analysis

- Gaps: Controls not implemented or insufficiently implemented.
- Impact: Potential outcomes from intentional or accidental failures.

# Prioritized Remediation Plan

1. Highest-value safeguard to implement with justification (threat reduction, feasibility).
2. Next highest-value safeguard.
3. Third highest-value safeguard.

## Risk Summary

- Top risks (by severity/likelihood/data sensitivity).
- Risk drivers and affected components.
- Expected risk reduction after applying the prioritized safeguards.

## Appendix

- Counts (from STATISTICS_JSON): components, threats, vulns, safeguards.
- Any referenced identifiers or tags that help teams trace back in tooling.
