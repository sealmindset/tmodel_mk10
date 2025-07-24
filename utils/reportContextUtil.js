/**
 * Report Context Utility
 * 
 * This utility provides functions for generating context-aware, section-specific
 * LLM prompts for report generation.
 */

// Import the database pool directly
const pool = require('../db/db');

// Add a safety check for undefined pool
if (!pool) {
  throw new Error('Database pool is undefined - check db/db.js exports');
}
const openaiUtil = require('./openai'); // Corrected path
const ollamaUtil = require('./ollama'); // Corrected path
const logger = require('../logger');

/**
 * Get full project context including components and threat models
 * @param {string|number} projectId - The project ID (UUID or integer)
 * @param {boolean} isUuid - Whether the projectId is a UUID (true) or integer (false)
 * @returns {Object} Complete project context object
 */
async function getProjectContext(projectId, isUuid = true) {
  // Validate project ID format
  if (!projectId) {
    throw new Error('Project ID is required');
  }
  
  // Convert numeric string to actual number if it's an integer ID
  if (!isUuid && typeof projectId === 'string' && !isNaN(projectId)) {
    projectId = parseInt(projectId, 10);
  }
  try {
    // Fetch project details using the appropriate column type
    const projectQuery = await pool.query(
      `SELECT * FROM threat_model.projects WHERE id = $1`,
      [projectId]
    );
    
    if (projectQuery.rows.length === 0) {
      throw new Error(`Project with ID ${projectId} not found`);
    }
    
    const project = projectQuery.rows[0];

    // Fetch threat models for the project
    // If using UUID, need to get the integer ID first since threat_models links to integer ID
    const projectId_int = isUuid ? project.id : projectId;
    
    const threatModelsQuery = await pool.query(
      'SELECT * FROM threat_model.threat_models WHERE project_id = $1',
      [projectId_int]
    );
    const threatModels = threatModelsQuery.rows;
    
    // Since the relationship between components and threat models isn't properly
    // maintained in the database (threat_model_id is NULL for all components),
    // and no join table exists, we'll include all components as a fallback
    const componentsQuery = await pool.query(
      'SELECT id, name, hostname, ip_address, type, description, created_at, updated_at FROM threat_model.components'
    );
    
    const components = componentsQuery.rows;
    
    // Log for debugging
    logger.info(`Fetched all ${components.length} components as fallback since threat_model_id relationship is not maintained`, {
      projectId,
      threatModelCount: threatModels.length
    });
    
    // Fetch threats for each threat model
    for (const threatModel of threatModels) {
      const threatsQuery = await pool.query(
        'SELECT * FROM threat_model.threats WHERE threat_model_id = $1',
        [threatModel.id]
      );
      threatModel.threats = threatsQuery.rows;
      
      // Get mitigations for each threat in this threat model
      // Mitigations are linked to threats, not directly to threat models
      const mitigationPromises = threatModel.threats.map(async (threat) => {
        const mitigationsQuery = await pool.query(
          'SELECT * FROM threat_model.mitigations WHERE threat_id = $1',
          [threat.id]
        );
        return mitigationsQuery.rows;
      });
      
      // Flatten the array of mitigations arrays
      threatModel.mitigations = (await Promise.all(mitigationPromises)).flat();
    }
    
    // Return comprehensive project context
    return {
      project,
      components,
      threatModels,
      timestamp: new Date().toISOString()
    };
  } catch (error) {
    logger.error(`Error fetching project context: ${error.message}`, { projectId });
    throw error;
  }
}

/**
 * Generate section-specific prompt for LLM
 * @param {Object} context - Project context object
 * @param {string} sectionType - Type of section (overview, threats, mitigations, etc.)
 * @returns {string} Formatted prompt for the LLM
 */
function generateSectionPrompt(context, sectionType) {
  // Base context information in the prompt
  let prompt = `Generate a ${sectionType} section for a security report about the project "${context.project.name}".\n\n`;
  
  // Add project description
  prompt += `PROJECT DESCRIPTION:\n${context.project.description || 'No description available'}\n\n`;
  
  // Add components information
  prompt += "PROJECT COMPONENTS:\n";
  if (context.components && context.components.length > 0) {
    context.components.forEach(comp => {
      prompt += `- ${comp.name}: ${comp.description || 'No description'}\n`;
    });
  } else {
    prompt += "No components available.\n";
  }
  prompt += "\n";
  
  // Add threat models information if available
  if (context.threatModels && context.threatModels.length > 0) {
    prompt += "THREAT MODELS:\n";
    context.threatModels.forEach(model => {
      prompt += `- ${model.name}: ${model.description || 'No description'}\n`;
      
      // Add threats if available
      if (model.threats && model.threats.length > 0) {
        prompt += "  Threats:\n";
        model.threats.forEach(threat => {
          prompt += `  - ${threat.name}: ${threat.description || 'No description'}\n`;
          prompt += `    Impact: ${threat.impact || 'Unknown'}, Likelihood: ${threat.likelihood || 'Unknown'}\n`;
        });
      }
      
      // Add mitigations if available
      if (model.mitigations && model.mitigations.length > 0) {
        prompt += "  Mitigations:\n";
        model.mitigations.forEach(mitigation => {
          prompt += `  - ${mitigation.name}: ${mitigation.description || 'No description'}\n`;
          prompt += `    Status: ${mitigation.status || 'Unknown'}\n`;
        });
      }
    });
    prompt += "\n";
  } else {
    prompt += "THREAT MODELS: No threat models available.\n\n";
  }
  
  // Section-specific instructions
  switch (sectionType.toLowerCase()) {
    case 'overview':
      prompt += "Generate a concise executive overview of the project security posture. Focus on the most significant aspects rather than listing every detail. Highlight the overall risk profile and key security challenges.\n";
      break;
    case 'threats':
      prompt += "Analyze and present the 3-5 most critical threats based on impact and likelihood. Group related threats where appropriate. DO NOT simply list all threats - focus on the ones that have the greatest business impact. Save the exhaustive listing for an appendix.\n";
      break;
    case 'vulnerabilities':
      prompt += "Identify and discuss the most significant vulnerabilities in the system. Focus on those that create the greatest risk exposure rather than listing every vulnerability. Prioritize based on exploitability and potential impact.\n";
      break;
    case 'mitigations':
      prompt += "Provide practical, effective mitigations for the key threats identified. Focus on high-impact solutions that address multiple risks where possible. Avoid repetition of similar mitigations across different threats.\n";
      break;
    case 'recommendations':
      prompt += "Provide actionable recommendations to improve the security posture. Prioritize recommendations based on effectiveness and feasibility. Include both short-term quick wins and longer-term strategic initiatives.\n";
      break;
    case 'appendix':
      prompt += "Create a comprehensive appendix listing ALL identified threats and vulnerabilities in a structured format. This should be exhaustive and include even low-impact items for reference purposes.\n";
      break;
    default:
      prompt += "Generate a well-structured section with relevant information based on the project context provided.\n";
  }
  
  // Final instructions for quality and format
  prompt += "\nEnsure the content is specific to this project, uses technical terminology appropriately, and provides actionable insights. Format the output in Markdown.\n";
  
  return prompt;
}

/**
 * Generate content for a specific report section using LLM
 * @param {string|number} projectId - The project ID (UUID or integer)
 * @param {string} sectionType - Type of section
 * @param {string} provider - LLM provider ('openai' or 'ollama')
 * @param {string} model - Model name
 * @param {boolean} isUuid - Whether the projectId is a UUID
 * @returns {Promise<string>} Generated section content
 */
async function generateSectionContent(projectId, sectionType, provider = 'openai', model, isUuid = true) {
  try {
    // Get project context with UUID flag
    const context = await getProjectContext(projectId, isUuid);
    
    // Generate section-specific prompt
    const prompt = generateSectionPrompt(context, sectionType);
    
    // Log the prompt being used (for debugging)
    logger.debug(`Generating ${sectionType} section for project ${projectId} using ${provider}`, {
      promptLength: prompt.length
    });
    
    // Call appropriate LLM based on provider
    let response;
    const maxTokens = 2500;
    
    if (provider === 'ollama') {
      response = await ollamaUtil.getCompletion(prompt, model || 'llama3', maxTokens);
    } else {
      // Default to OpenAI
      response = await openaiUtil.getCompletion(prompt, model || 'gpt-4', maxTokens);
    }
    
    return response;
  } catch (error) {
    logger.error(`Error generating section content: ${error.message}`, {
      projectId,
      sectionType,
      provider
    });
    throw error;
  }
}

/**
 * Generate a complete report with multiple sections
 * @param {string|number} projectId - The project ID (UUID or integer)
 * @param {Array<string>} sectionTypes - Array of section types to include
 * @param {string} provider - LLM provider ('openai' or 'ollama')
 * @param {string} model - Model name
 * @param {boolean} isUuid - Whether the projectId is a UUID
 * @param {Object} providedContext - Optional pre-fetched project context
 * @param {number} templateId - Optional template ID to use
 * @returns {Promise<Object>} Object with section contents
 */
async function generateCompleteReport(projectId, sectionTypes, provider = 'openai', model, isUuid = true, providedContext = null, templateId = null) {
  const reportSections = {};
  
  try {
    // Use provided context or get project context once to reuse
    const context = providedContext || await getProjectContext(projectId, isUuid);
    
    // Add template information if available
    if (templateId) {
      logger.info(`Using template ID ${templateId} for report generation`);
      // Could fetch template details from database if needed
    }
    
    // Generate each section in parallel
    const sectionPromises = sectionTypes.map(async (sectionType) => {
      const prompt = generateSectionPrompt(context, sectionType);
      
      let response;
      const maxTokens = 2500;
      
      if (provider === 'ollama') {
        response = await ollamaUtil.getCompletion(prompt, model || 'llama3', maxTokens);
      } else {
        response = await openaiUtil.getCompletion(prompt, model || 'gpt-4', maxTokens);
      }
      
      return { type: sectionType, content: response };
    });
    
    const results = await Promise.all(sectionPromises);
    
    // Organize results by section type
    results.forEach(result => {
      reportSections[result.type] = result.content;
    });
    
    return reportSections;
  } catch (error) {
    logger.error(`Error generating complete report: ${error.message}`, { projectId });
    throw error;
  }
}

module.exports = {
  getProjectContext,
  generateSectionPrompt,
  generateSectionContent,
  generateCompleteReport
};
