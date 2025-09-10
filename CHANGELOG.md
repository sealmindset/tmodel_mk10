# Change Log
### Removed
- Legacy Report Templates page and manager script removed in favor of RTG
  - Deleted `views/report-templates.ejs`
  - Deleted `public/js/report-templates-manager.js`
  - Route `/report-templates` now issues a 301 redirect to `/rtg/` (file: `routes/main.js`)


All notable changes to this project will be documented in this file.

This project adheres to Keep a Changelog and Semantic Versioning where possible.

- Format: https://keepachangelog.com/en/1.1.0/
- SemVer: https://semver.org/spec/v2.0.0.html

## About This Project

Enhanced Threat Modeling Platform (Mark 10) is a full‑stack application that unifies classic threat modeling with real‑world vulnerability data and AI‑assisted analysis. It provides:

- Project and component management for organizing models and safeguards
- Integrations with scanning tools (e.g., Rapid7) to ground threats in evidence
- AI providers (OpenAI, Ollama) for content generation and analysis
- Postgres‑backed persistence with RLS, API views, and PostgREST for HTTP access
- A modern UI with reusable partials, dashboards, and consistent navigation

Key technologies:

- Backend: Node.js/Express, PostgreSQL, PostgREST, Redis
- Frontend: EJS views, Bootstrap, modular JS bundles, XHR
- AI: OpenAI and Ollama providers (switchable at runtime)
- Architecture: MACH‑inspired modularity with API‑first boundaries and SRP‑focused modules

Primary goals:

- Maintain a single source of truth for templates and reports (RTG tables)
- Keep identifiers consistent: expose numeric `api_id` at HTTP boundary, use UUIDs internally
- Cache where helpful; prefer simple solutions and avoid duplication
- Ensure clean, consistent UX across pages via shared header/footer partials

---

## Capabilities Overview

### Architecture
- Backend: Node.js/Express app entrypoints `app.js`, `safeguard-app.js`, REST routes in `routes/` with subroutes under `routes/api/`.
- Database: PostgreSQL with migrations in `db/migrations/` and `database/migrations/`. Base schema files: `db/full_init.sql`, `database/clean-init.sql`. RTG schema under `report-template-service/schema/` and `db/migrations/*rtg*`.
- API Layer: PostgREST configured by `postgrest.conf`. Exposes `api` schema (views), followed by `reports` and `report_templates`. Served on port 3010 by default.
- Frontend: EJS views in `views/` with shared partials `views/partials/header.ejs` and `views/partials/footer.ejs`. Public assets under `public/` (CSS/JS). Vite config present for RTG bundles (`vite.rtg.config.js`).
- Services: Domain logic under `services/` and `reporting/`. Caching and utilities under `utils/`.
- Middleware: Auth, rate limiting, validation in `middleware/` and `src/server/middlewares/`.
- RTG (Report Template Generator): Frontend UI page `views/rtg/index.ejs`, scripts `public/js/rtg-ui.bundle.js`, supporting editor assets `public/css/gfm-editor.css`, `public/js/gfm-editor.js`.

### Identifiers and Data Conventions
- Canonical internal identifier: UUID `id` used in SQL, ORM, services, and joins.
- Numeric `api_id` (bigserial) is exposed via PostgREST API views only. Use it exclusively in HTTP payloads and paths when interacting over HTTP.
- Never join on `api_id` in database or application code. Map `api_id` to internal UUID at the boundary.
- UI/UX should display names/titles; do not show UUID/api_id except in admin/debug screens.
- Enforce RLS on base tables; expose only views in the `api` schema for PostgREST.

### Major Features
- Projects, Components, Safeguards, Threat Models, Vulnerabilities with dashboards and editors.
- Rapid7 integration for vulnerability ingestion and correlation.
- AI‑assisted analysis (OpenAI & Ollama) for report generation and threat content.
- Report Template Generator (RTG) with RTG‑managed tables as the system of record.
- Caching, centralized logging (to PostgreSQL in production), and settings management UI.

### UI Pages (selected)
- `views/index.ejs`: Home dashboard.
- `views/projects/*.ejs`: Project list and detail.
- `views/components/*.ejs`: Components management.
- `views/safeguards/*.ejs`: Safeguards management.
- `views/vulnerability-dashboard.ejs`: Vulnerability dashboards.
- `views/reports-generate.ejs`: Report generation (uses RTG templates via PostgREST).
- `views/rtg/index.ejs`: RTG page (now using shared header/footer, mounts `#rtg-root`).
- Shared partials: `views/partials/header.ejs`, `views/partials/footer.ejs`.

### Client Scripts (selected)
- `public/js/reports-generate.js`: Loads RTG templates from `/report_templates` (PostgREST), initiates report generation.
- `public/js/report-templates-select.js`: Modal selector for RTG templates (numeric `id`).
- `public/js/service-status-checker.js`: Health/status indicators in navbar.
- `public/js/openai-monitor.js`, `assistantFrontend.js`: Monitoring and assistant integrations.

### Backend Services and Modules
- `reporting/reportRunner.js`: Resolves templates (RTG first for numeric IDs), runs report generation via LLM providers; caches content.
- `services/*`: Business services (analytics, components, settings, etc.).
- `routes/api/*`: API endpoints for app server (distinct from PostgREST). Example: `routes/api/components.js`, `routes/api/analytics.js`.
- `middleware/*`: `auth.js`, `rateLimiter.js`, `validation.js` for request lifecycle.

### APIs
- App Server (Express): Endpoints under `/api/...` provided by `routes/api/` modules.
- PostgREST (port 3010): Exposes database via HTTP. Use unqualified resource paths like `/report_templates` relying on schema exposure order (`api` first). Select fields with `?select=...` and order with `&order=...`.

### RTG Data Model (high level)
- `reports.report_templates (uuid id, bigserial api_id, name, description, ...)`
- `reports.report_template_versions (template_id uuid FK->report_templates.id, version, content_md, created_at, ...)`
- API views in `api.*` expose `api_id as id` for PostgREST. UI uses numeric `id`; server resolves to UUID internally.

### Settings & Providers
- Settings pages under `/settings/*` configure LLM provider, OpenAI, Ollama, and integrations (Rapid7, Jira, Confluence, AuditBoard, Lucid).
- Provider selection affects UI (e.g., monitor buttons) and is persisted in the `settings` table.

### Logging & Monitoring
- Production logs persisted to PostgreSQL (`app_logs`).
- Navbar status indicators for Redis, PostgreSQL, Rapid7, OpenAI, Ollama (`service-status-checker.js`).
- OpenAI/Ollama monitor modals included by footer partial.

### Testing
- Tests in `tests/` include API tests, reporting tests, and RTG compile/submit flows.
- Use `npm test` (or project’s configured test scripts) to run.

### Scripts & Utilities
- PostgREST management: `manage-postgrest.sh` (start/stop/restart/status) using `postgrest.conf`.
- RAG ingestion/check: `scripts/ingest-rag.js`, `scripts/check-rag.js`.
- Batch tools and utilities in `utils/` (e.g., `cacheManager.js`, `circuitBreaker.js`).

### Deployment & Runtime
- App runs on Node.js; configure environment via `.env` (never overwrite without confirmation). Ports typically 3000 (app) and 3010 (PostgREST).
- PostgREST `db-schemas` exposure order must list `api` first to make unqualified paths like `/report_templates` resolve to API views.
- CORS is open and all HTTP access uses XHR.

### Troubleshooting Checklist
- PostgREST 404 or double schema prefix errors: ensure frontend uses `/report_templates` (no `api.` prefix) and `postgrest.conf` exposes `api` first. Restart PostgREST via `manage-postgrest.sh restart` and confirm port 3010 is free.
- Template loading failures: check network to PostgREST, verify `api.report_templates` view exists, confirm RLS grants via views. Inspect console/network tabs.
- LLM provider UI mismatch: footer script toggles monitor buttons based on provider; check `/api/settings/provider` and sessionStorage `currentLlmProvider`.
- ID handling bugs: ensure UI passes numeric `id` (api_id) to server; backend converts to UUID internally.

## [Unreleased]

### Added
- RTG page now uses shared header/footer partials for consistent navbar and layout
  - File: `views/rtg/index.ejs` now includes `views/partials/header.ejs` and `views/partials/footer.ejs`
  - Active nav state set via `active: 'reportTemplates'`
  - RTG bundles loaded as module: `/js/rtg-ui.bundle.js` with flags pre‑defined
- Comprehensive change log added with project overview
- Generate Report page parity features with RTG prompts/tokens:
  - Prompt selection modal wired on `/projects/:uuid/reports/new` (files: `views/reports-generate.ejs`, `public/js/prompts-select.js`, `views/partials/prompts-select-table.ejs`)
  - Read‑only Prompt Preview card shows the selected LLM prompt (fetched from `/api/prompts/:id`)
  - Token toolbar above the Markdown editor with quick insert buttons (`{{PROJECT_JSON}}`, `{{COMPONENT_TABLE}}`, `{{THREAT_MODEL_DATA_JSON}}`, `{{COMPONENT_DATA_JSON}}`)
  - Live token validation with inline warnings for unknown tokens
  - Template preview: when a template is selected, the latest version Markdown is fetched from PostgREST (`/report_template_versions`) and shown in the same `#resultMd` textarea as a preview. Clicking Generate overwrites that textarea with the produced output (file: `public/js/reports-generate.js`).

### Changed
- Frontend template sources unified to RTG via PostgREST:
  - `public/js/reports-generate.js` now fetches from `/report_templates?select=id,name,description&order=name.asc`
  - `public/js/report-templates-select.js` modal fetches RTG templates only and binds numeric IDs to UI controls
- Backend template resolution prioritizes RTG tables for numeric IDs:
  - `reporting/reportRunner.js` resolves numeric `templateId` by first querying `reports.report_templates` (and latest `report_template_versions`), with fallback to legacy tables
  - Caching preserved; error handling and logging improved
- PostgREST configuration updated to expose schemas in order and avoid double‑prefix paths
  - `postgrest.conf` exposes: `api, reports, report_templates`
  - Frontend now uses unqualified `/report_templates` leveraging schema exposure order
 - RTG UI now shows a single page title; removed duplicate in‑app `h2` heading from `client/rtg/RtgApp.jsx` so only `views/rtg/index.ejs` renders the title.
 - RTG UI cleanup: removed red‑boxed sections per design update
  - Removed "Compile" button from `client/rtg/components/Toolbar.jsx`
  - Removed right‑side `SubmitPanel` (provider/model/author/project UUID form) from `client/rtg/RtgApp.jsx`
  - Removed `CompilePreview` panel from `client/rtg/RtgApp.jsx`
  - Rebuilt RTG bundle to reflect layout changes
 - Navigation: Updated header dropdown link "Report Templates" to point to `/rtg/` instead of `/report-templates/` (file: `views/partials/header.ejs`).

### Fixed
- Avoided `api.api.*` double schema prefix errors by using unqualified PostgREST paths
- Minor lint issues in `views/rtg/index.ejs` after refactor (removed stray brace)
- Reports Generate save path: switched PostgREST insert from `/reports.report` to unqualified `/report` to prevent 404s with current schema exposure order (file: `public/js/reports-generate.js`).

### Notes / Migration
- Ensure PostgREST is running and accessible at the configured base (default `http://localhost:3010`)
- For numeric template usage in UI and HTTP, use `api_id` exposed as `id` via API views
- Internally (DB/ORM/services), continue to use UUID `id` for joins and relations

---

## [10.2.0] - 2025-09-05

Baseline for Mark 10.2.0 per `README.md` with:

### Added
- Project/component/safeguard data model and dashboards
- Rapid7 integration for vulnerability ingestion and correlation
- OpenAI integration for content generation
- Redis for caching and sessions

### Changed
- Centralized logging persisted to PostgreSQL in production

---

## Historical

The following summarizes key areas prior to Mark 10.2.0 (aggregated due to unavailable git history in this environment):

### Core Platform
- Established project/component/safeguard/threat/vulnerability domain and associated UI pages under `views/`.
- Implemented Express routes under `routes/` and `routes/api/` for core CRUD and analytics operations.
- Added middleware for auth, rate limiting, and validation.

### Integrations
- Rapid7 ingestion and correlation services added with configuration under settings.
- OpenAI provider integration for content generation; later addition of Ollama provider with runtime switch.

### Persistence & Infra
- PostgreSQL schema initialization scripts (`db/full_init.sql`, `database/clean-init.sql`).
- Migrations added under `db/migrations/` and `database/migrations/` covering settings, analytics, and app tables.
- Redis introduced for caching and sessions.

### UI/UX
- Introduced shared header/footer partials for consistent layout and service status indicators.
- Added dashboards for vulnerabilities, threats, and analytics visualizations.

### Reporting
- Initial report generation workflows and templates (legacy), followed by work to move to RTG as the source of truth.

### Tooling & Tests
- Test suites under `tests/` for API and reporting flows.
- Utility scripts for RAG, ingestion, and PostgREST management.

---

## How to Brief Cascade Quickly Using This File
1. Read "Capabilities Overview" for architecture, conventions, and modules.
2. Scan "Unreleased" for the most recent work-in-progress items.
3. Check the latest release section (e.g., 10.2.0) for grouped, dated changes.
4. Use "Troubleshooting Checklist" when encountering runtime or API issues.
5. Follow "Identifiers and Data Conventions" to avoid `api_id`/UUID mix-ups.

[Unreleased]: https://example.com/compare/v10.2.0...HEAD
[10.2.0]: https://example.com/releases/v10.2.0
