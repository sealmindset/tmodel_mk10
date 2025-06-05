/**
 * Report Runner
 * 
 * Orchestrates the generation of reports by fetching data, 
 * processing it with a selected LLM prompt, and returning the result.
 */

const ReportPromptModel = require('../database/models/reportPromptModel');
const ProjectModel = require('../database/models/project'); // Assuming this model exists and fetches project data
const ComponentModel = require('./componentModel');
const LLMClient = require('./llmClient');
const DEFAULT_OLLAMA_MAX_TOKENS = 512;
const OLLAMA_TIMEOUT_MS = 60000; // 60 seconds

const ReportRunner = {
    /**
     * Generate a report based on type and prompt.
     * 
     * @param {string} reportType The type of report (e.g., 'project_portfolio').
     * @param {string} promptId The ID of the prompt template to use.
     * @param {object} filters Optional filters for data fetching.
     * @returns {Promise<string>} The generated report content (raw text from LLM).
     * @throws {Error} If prompt not found, data fetching fails, or LLM call fails.
     */
    generateReport: async function(reportType, promptId, filters = {}) {
        console.log(`[ReportRunner] Generating report. Type: ${reportType}, Prompt ID: ${promptId}`);

        // 1. Fetch the prompt template
        const promptTemplate = await ReportPromptModel.getById(promptId);
        if (!promptTemplate) {
            throw new Error(`Prompt template with ID ${promptId} not found.`);
        }
        if (promptTemplate.report_type !== reportType) {
            throw new Error(`Prompt ${promptId} is for report type ${promptTemplate.report_type}, but ${reportType} was requested.`);
        }

        // 2. Fetch data based on reportType
        let rawData;
        try {
            switch (reportType) {
                case 'project_portfolio':
                    rawData = await ProjectModel.getAll(filters); // Assuming getAll supports filters
                    break;
                case 'component_inventory':
                    rawData = await ComponentModel.getAll(filters);
                    break;
                case 'safeguard_status':
                    // Fetch all safeguards
                    const SafeguardModel = require('../database/models/safeguard');
                    const ComponentModel = require('./componentModel');
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
                    rawData = await ThreatModel.getAll(filters);
                    break;
                default:
                    throw new Error(`Unsupported report type: ${reportType}`);
            }
        } catch (error) {
            console.error(`[ReportRunner] Error fetching data for ${reportType}:`, error);
            throw new Error(`Failed to fetch data for report type ${reportType}: ${error.message}`);
        }
        // 3. Prepare data and inject into prompt (simple example)
        // More sophisticated templating (like Handlebars) could be used here.
        let finalPromptText = promptTemplate.prompt_text;
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
                const projects = Array.isArray(c.projects) ? c.projects.join(', ') : '';
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
                threatModelTable += `${tm.project_name || ''} | ${tm.name || ''} | ${tm.status || ''} | ${tm.created_at ? tm.created_at.split('T')[0] : ''} | ${tm.updated_at ? tm.updated_at.split('T')[0] : ''}\n`;
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
                recentActivityTable += `${tm.project_name || ''} | ${tm.name || ''} | ${tm.status || ''} | ${tm.created_at ? tm.created_at.split('T')[0] : ''} | ${tm.updated_at ? tm.updated_at.split('T')[0] : ''}\n`;
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
            const llmProvider = promptTemplate.llm_provider;
            const llmModel = promptTemplate.llm_model;
            const startTime = Date.now();
            console.log(`[ReportRunner] Calling LLM provider: ${llmProvider}, model: ${llmModel}`);
            let llmResponse;
            if (llmProvider && llmProvider.toLowerCase() === 'ollama') {
                // Apply lower maxTokens and timeout for Ollama
                llmResponse = await Promise.race([
                    LLMClient.getCompletion(finalPromptText, llmProvider, llmModel, DEFAULT_OLLAMA_MAX_TOKENS),
                    new Promise((_, reject) => setTimeout(() => reject(new Error('Ollama LLM call timed out after 60s')), OLLAMA_TIMEOUT_MS))
                ]);
            } else {
                // Use default behavior for other providers
                llmResponse = await LLMClient.getCompletion(finalPromptText, llmProvider, llmModel);
            }
            const elapsed = Date.now() - startTime;
            console.log(`[ReportRunner] LLM response received for ${reportType} in ${elapsed}ms.`);
            return llmResponse;
        } catch (error) {
            console.error(`[ReportRunner] LLMClient failed for ${reportType}:`, error);
            throw new Error(`LLM processing failed: ${error.message}`);
        }
    }
};

module.exports = ReportRunner;
