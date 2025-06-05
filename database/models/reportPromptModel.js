/**
 * ReportPrompt Model
 * 
 * Provides data access methods for report prompt templates in the database.
 */
const pool = require('../../db/db'); // Corrected path to db/db.js

class ReportPrompt {
  /**
   * Create a new report prompt template
   * @param {Object} promptData - Prompt data
   * @returns {Promise<Object>} - Created prompt template
   */
  static async create(promptData) {
    const {
      report_type,
      name,
      prompt_text,
      llm_provider = 'openai',
      llm_model = 'gpt-3.5-turbo',
      is_default = false,
      created_by = 'system' // Default as auth is bypassed
    } = promptData;

    const query = `
      INSERT INTO threat_model.report_prompts
        (report_type, name, prompt_text, llm_provider, llm_model, is_default, created_by, updated_by)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $7) 
      RETURNING *;
    `;
    const values = [report_type, name, prompt_text, llm_provider, llm_model, is_default, created_by];
    
    try {
      const result = await pool.query(query, values);
      return result.rows[0];
    } catch (error) {
      console.error('Error creating report prompt:', error);
      throw error;
    }
  }

  /**
   * Get a report prompt template by its ID
   * @param {string} id - Prompt ID (UUID)
   * @returns {Promise<Object|null>} - Prompt template data or null if not found
   */
  static async getById(id) {
    const query = 'SELECT * FROM threat_model.report_prompts WHERE id = $1;';
    try {
      const result = await pool.query(query, [id]);
      return result.rows[0] || null;
    } catch (error) {
      console.error(`Error fetching report prompt by ID ${id}:`, error);
      throw error;
    }
  }

  /**
   * Get all report prompt templates, optionally filtered by report_type
   * @param {Object} filters - Optional filters (e.g., { report_type: 'project_portfolio' })
   * @returns {Promise<Array>} - Array of prompt templates
   */
  static async getAll(filters = {}) {
    let query = 'SELECT * FROM threat_model.report_prompts';
    const values = [];
    const conditions = [];

    if (filters.report_type) {
      values.push(filters.report_type);
      conditions.push(`report_type = $${values.length}`);
    }
    
    if (filters.llm_provider) {
      values.push(filters.llm_provider);
      conditions.push(`llm_provider = $${values.length}`);
    }

    if (conditions.length > 0) {
      query += ' WHERE ' + conditions.join(' AND ');
    }
    query += ' ORDER BY report_type, name, created_at DESC;';

    try {
      const result = await pool.query(query, values);
      return result.rows;
    } catch (error) {
      console.error('Error fetching all report prompts:', error);
      throw error;
    }
  }
  
  /**
   * Get all report prompt templates for a specific report type
   * @param {string} reportType - The type of the report
   * @returns {Promise<Array>} - Array of prompt templates for the given report type
   */
  static async getByReportType(reportType) {
    const query = 'SELECT * FROM threat_model.report_prompts WHERE report_type = $1 ORDER BY name, created_at DESC;';
    try {
      const result = await pool.query(query, [reportType]);
      return result.rows;
    } catch (error) {
      console.error(`Error fetching report prompts by report type ${reportType}:`, error);
      throw error;
    }
  }

  /**
   * Update an existing report prompt template
   * @param {string} id - Prompt ID (UUID)
   * @param {Object} updates - Fields to update
   * @returns {Promise<Object|null>} - Updated prompt template or null if not found
   */
  static async update(id, updates) {
    const {
      report_type,
      name,
      prompt_text,
      llm_provider,
      llm_model,
      is_default,
      updated_by = 'system' // Default as auth is bypassed
    } = updates;

    // Fetch existing to ensure it's not a default prompt being modified inappropriately if needed
    const existingPrompt = await this.getById(id);
    if (!existingPrompt) return null;
    // if (existingPrompt.is_default && (is_default === false || updates.prompt_text)) {
    //   // Potentially restrict modification of default prompts or handle cloning
    //   console.warn(`Attempting to modify a default prompt (ID: ${id}). This might be restricted.`);
    // }

    const setClauses = [];
    const values = [];
    let paramCount = 1;

    if (report_type !== undefined) { setClauses.push(`report_type = $${paramCount++}`); values.push(report_type); }
    if (name !== undefined) { setClauses.push(`name = $${paramCount++}`); values.push(name); }
    if (prompt_text !== undefined) { setClauses.push(`prompt_text = $${paramCount++}`); values.push(prompt_text); }
    if (llm_provider !== undefined) { setClauses.push(`llm_provider = $${paramCount++}`); values.push(llm_provider); }
    if (llm_model !== undefined) { setClauses.push(`llm_model = $${paramCount++}`); values.push(llm_model); }
    if (is_default !== undefined && !existingPrompt.is_default) { 
      // Only allow updating is_default if it's not already a default prompt, to prevent accidental change of system defaults.
      // Or, more simply, prevent changing is_default at all via this method for safety.
      // For now, let's assume is_default is not typically changed after creation for defaults.
      setClauses.push(`is_default = $${paramCount++}`); values.push(is_default); 
    }
    setClauses.push(`updated_by = $${paramCount++}`); values.push(updated_by);

    if (setClauses.length === 0) {
      return existingPrompt; // No actual updates to perform
    }

    const query = `
      UPDATE threat_model.report_prompts
      SET ${setClauses.join(', ')}, updated_at = CURRENT_TIMESTAMP
      WHERE id = $${paramCount}
      RETURNING *;
    `;
    values.push(id);

    try {
      const result = await pool.query(query, values);
      return result.rows[0] || null;
    } catch (error) {
      console.error(`Error updating report prompt ID ${id}:`, error);
      throw error;
    }
  }

  /**
   * Delete a report prompt template by its ID
   * @param {string} id - Prompt ID (UUID)
   * @returns {Promise<Object|null>} - Deleted prompt template or null if not found/not allowed
   */
  static async deleteById(id) {
    // Optional: Prevent deletion of default prompts
    const promptToDelete = await this.getById(id);
    if (promptToDelete && promptToDelete.is_default) {
      // console.warn(`Deletion of default prompt (ID: ${id}) is not allowed.`);
      // throw new Error('Default prompts cannot be deleted.');
      // Or simply return null/false
      return null; 
    }

    const query = 'DELETE FROM threat_model.report_prompts WHERE id = $1 AND is_default = FALSE RETURNING *;';
    try {
      const result = await pool.query(query, [id]);
      return result.rows[0] || null; // Returns the deleted row or null if not found or was a default
    } catch (error) {
      console.error(`Error deleting report prompt ID ${id}:`, error);
      throw error;
    }
  }
}

module.exports = ReportPrompt;
