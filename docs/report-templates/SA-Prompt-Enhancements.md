# Security Architect Prompt: App and Database Enhancements

Version: 1.0.0
Generated at: {{GENERATED_AT}}
Author: {{AUTHOR}}
Environment: {{ENV}}

## Scope
This document proposes app- and database-level enhancements to better support the refined security architect prompt at `docs/report-templates/SA-Prompt`. Recommendations align with the app’s Context-As-Grounding (CAG) approach and current token replacement flow in `reporting/reportRunner.js`.

## Current Inputs and Tokens (supported)
From `reporting/reportRunner.js` token map:
- Meta: `{{GENERATED_AT}}`, `{{AUTHOR}}`, `{{ENV}}`, `{{CI_EXAMPLE}}`
- Project(s): `{{PROJECTS_JSON}}`, `{{PROJECT_JSON}}`, `{{PROJECTS_COUNT}}`, `{{PROJECT_NAMES_CSV}}`
- Components: `{{COMPONENTS_JSON}}`, `{{COMPONENTS_COUNT}}`
- Threats: `{{THREATS_JSON}}`
- Vulnerabilities: `{{VULNERABILITIES_JSON}}`
- Threat→Safeguards map: `{{THREAT_SAFEGUARDS_JSON}}`
- Statistics: `{{STATISTICS_JSON}}`
- Optional: `{{PIPELINE_STEPS_JSON}}`, `{{TERRAFORM_TAGS_JSON}}`, `{{AWS_ACCOUNTS_JSON}}`

## Prompt-Facing Token Additions (recommended)
Add derived tokens to reduce reasoning and make outputs more deterministic:
- `{{PROJECT_KEY}}` (string)
  - Source: prefer `PROJECT_JSON.key`; else derive a slug from `PROJECT_JSON.name` (lowercase, alnum+dashes).
  - Use: resource naming in IaC snippets (currently we embed an instruction to compute this inline).
- `{{RESILIENCY_TARGET}}` (string/number)
  - Source: `PROJECT_JSON.sla_slo.slo_target` if present; else default `"99.9"`.
  - Use: SLO/Resiliency section.
- `{{PROVIDER_COUNTS_JSON}}` (object)
  - Shape: `{ azure: 0, aws: 0, gcp: 0, datacenter: 0, saas: 0 }` derived from `COMPONENTS_JSON`.
- `{{RISK_BANDS_JSON}}` (object)
  - Shape: `{ high: N, medium: M, low: L }` derived from threat `risk_score` if present, else computed.
- `{{COMPONENT_SAFEGUARDS_JSON}}` (object)
  - Shape: `{ [component_id]: { current: string[], planned: string[], gaps: string[] } }` derived from `THREAT_SAFEGUARDS_JSON` and component mappings.

These are optional—preserve backward compatibility. They simplify prompt logic and reduce token usage inside the model.

## ReportRunner Enhancements (recommended)
- Inject new optional tokens above if available; otherwise omit gracefully.
- Derive `project_key` in app code when `PROJECT_JSON.key` is absent; expose as `{{PROJECT_KEY}}`.
- Compute `{{RESILIENCY_TARGET}}` from `PROJECT_JSON.sla_slo.slo_target` fallback 99.9.
- Continue to prepend the CAG prelude if not already present (current behavior).
- Ensure token normalizer handles braces/backticks/bare variants consistently (current behavior ok).
- Default provider timeouts retained (Ollama 15s, OpenAI 45s) with abort propagation (already implemented).

## Database and API (PostgREST) Enhancements
Follow user rules: UUID `id` is canonical in DB, `api_id` bigserial for PostgREST, RLS enforced, API exposed via views that alias `api_id` as `id`.

1) Projects
- Fields (ensure or add):
  - `id uuid primary key default gen_random_uuid()`
  - `api_id bigserial unique`
  - `key text unique` (stable slug used in naming)
  - `name text not null`
  - `sla_slo jsonb` (e.g., `{ "slo_target": "99.9" }`)
  - `compliance_tags text[]` (optional)
- Indexes:
  - `create index on projects using gin (sla_slo);`
  - `create index on projects using gin (compliance_tags);`
- API view (example):
  - `api.v_projects` exposing `id := api_id`, `uuid := id`, plus business fields; RLS applied on base table.

2) Components
- Ensure FK: `project_id uuid references projects(id) on delete cascade`.
- Useful fields: `type`, `provider`, `exposure`, `data_classification`, `endpoints jsonb`.
- Indexes: `create index on components(project_id); create index on components(provider);`
- API view: `api.v_components` with `id := api_id`, includes `project_uuid` passthrough for internal correlation.

3) Threats / Threat Models
- Table `threat_models` (or `threats`) with FK to `components(id)`.
- Columns: `stride`, `description`, `preconditions jsonb`, `likelihood int`, `impact int`, `risk_score int generated always as (coalesce(likelihood,0)*coalesce(impact,0)) stored` (if appropriate).
- Indexes: `create index on threat_models(component_id);`

4) Safeguards and Mappings
- Table `safeguards` with FK to `components(id)` (component-scoped controls).
- Enum or constrained status: `status text check (status in ('implemented','planned','gap'))`.
- Mapping table `threat_safeguards` (many-to-many):
  - `id uuid pk`, `api_id bigserial unique`
  - `threat_id uuid references threat_models(id) on delete cascade`
  - `safeguard_id uuid references safeguards(id) on delete cascade`
  - Optional `status` override and `notes`
- Indexes: on `threat_id`, `safeguard_id`.
- API view: `api.v_threat_safeguards` aliasing ids as above.

5) Vulnerabilities
- Ensure component-scoped vulns are consistently linked: `component_id uuid references components(id)`.
- Indexes: on `component_id`, severity if present.
- API view: `api.v_vulnerabilities`.

6) Statistics
- Consider a database function `api.fn_project_statistics(project_uuid uuid)` returning JSON with counts to support `{{STATISTICS_JSON}}` deterministically. Optional—current app already computes stats.

7) Tags / IaC Metadata
- If IaC tagging is first-class, add `project_tags jsonb` or a `project_tag` table; surface via `{{TERRAFORM_TAGS_JSON}}`.
- Ensure `{{AWS_ACCOUNTS_JSON}}` and other provider account metadata have a durable source (settings table or per-project config).

## PostgREST Conventions and Security
- Expose only API views; never base tables directly.
- Enforce RLS on base tables. Grant PostgREST access only to API views.
- Map identifiers at the boundary: use numeric `id` (alias of `api_id`) over HTTP; convert to internal UUID in app.
- Log both UUID and `api_id` in server logs for correlation; never log IDs in client logs.

## Testing and Ops
- Add unit/integration tests for:
  - Abort and timeout propagation in report generation (pending tasks already noted).
  - Token replacement coverage for new tokens (when added) and missing-token behavior.
- Add structured logs around token derivation, input sizes, and LLM call timings (current logging is strong—extend for new tokens if added).

## Backward Compatibility
- Do not remove or rename existing tokens.
- Treat new tokens as optional; prompt continues to function without them.

## Next Steps
1) Decide which optional tokens to implement first (`PROJECT_KEY`, `RESILIENCY_TARGET` recommended).
2) Add derivation in `reporting/reportRunner.js` and update token map accordingly.
3) If needed, add DB fields and API views; include migrations in `db/migrations/` with RLS and indexes.
4) Extend tests to cover new tokens and ensure deterministic outputs.
