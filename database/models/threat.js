/**
 * Threat Model
 * 
 * Provides data access methods for threats in the database
 */
const db = require('../index');

class Threat {
  /**
   * Create a new threat
   * 
   * @param {Object} threatData - Threat data
   * @returns {Promise<Object>} - Created threat
   */
  static async create(threatData) {
    const { 
      threat_model_id,
      name, 
      description, 
      category,
      likelihood = 'Medium',
      impact = 'Medium',
      risk_score = 50,
      status = 'Open',
      created_by 
    } = threatData;
    
    const query = `
      INSERT INTO threat_model.threats 
        (threat_model_id, name, description, category, likelihood, 
         impact, risk_score, status, created_by)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
      RETURNING *
    `;
    
    const values = [
      threat_model_id,
      name, 
      description, 
      category,
      likelihood,
      impact,
      risk_score,
      status,
      created_by
    ];
    
    const result = await db.query(query, values);
    return result.rows[0];
  }
  
  /**
   * Get threat by ID
   * 
   * @param {string} id - Threat ID
   * @returns {Promise<Object>} - Threat data
   */
  static async getById(id) {
    const query = 'SELECT * FROM threat_model.threats WHERE id = $1';
    const result = await db.query(query, [id]);
    return result.rows[0];
  }
  
  /**
   * Get all threats
   * 
   * @param {Object} filters - Optional filters
   * @returns {Promise<Array>} - Array of threats
   */
  static async getAll(filters = {}) {
    const { 
      threat_model_id, 
      category, 
      status, 
      min_risk_score, 
      max_risk_score 
    } = filters;
    
    let query = 'SELECT * FROM threat_model.threats';
    const values = [];
    
    // Add filters if provided
    const conditions = [];
    if (threat_model_id) {
      conditions.push(`threat_model_id = $${values.length + 1}`);
      values.push(threat_model_id);
    }
    
    if (category) {
      conditions.push(`category = $${values.length + 1}`);
      values.push(category);
    }
    
    if (status) {
      conditions.push(`status = $${values.length + 1}`);
      values.push(status);
    }
    
    if (min_risk_score !== undefined) {
      conditions.push(`risk_score >= $${values.length + 1}`);
      values.push(min_risk_score);
    }
    
    if (max_risk_score !== undefined) {
      conditions.push(`risk_score <= $${values.length + 1}`);
      values.push(max_risk_score);
    }
    
    if (conditions.length > 0) {
      query += ' WHERE ' + conditions.join(' AND ');
    }
    
    query += ' ORDER BY risk_score DESC, name';
    
    const result = await db.query(query, values);
    return result.rows;
  }
  
  /**
   * Update a threat
   * 
   * @param {string} id - Threat ID
   * @param {Object} threatData - Threat data to update
   * @returns {Promise<Object>} - Updated threat
   */
  static async update(id, threatData) {
    const { 
      name, 
      description, 
      category,
      likelihood,
      impact,
      risk_score,
      status,
      mitigation_notes
    } = threatData;
    
    const query = `
      UPDATE threat_model.threats
      SET 
        name = $1,
        description = $2,
        category = $3,
        likelihood = $4,
        impact = $5,
        risk_score = $6,
        status = $7,
        mitigation_notes = $8,
        updated_at = CURRENT_TIMESTAMP
      WHERE id = $9
      RETURNING *
    `;
    
    const values = [
      name, 
      description, 
      category,
      likelihood,
      impact,
      risk_score,
      status,
      mitigation_notes,
      id
    ];
    
    const result = await db.query(query, values);
    return result.rows[0];
  }
  
  /**
   * Delete a threat
   * 
   * @param {string} id - Threat ID
   * @returns {Promise<boolean>} - True if deleted
   */
  static async delete(id) {
    const query = 'DELETE FROM threat_model.threats WHERE id = $1';
    const result = await db.query(query, [id]);
    return result.rowCount > 0;
  }
  
  /**
   * Add a safeguard to a threat
   * 
   * @param {string} threatId - Threat ID
   * @param {string} safeguardId - Safeguard ID
   * @param {Object} data - Additional data
   * @returns {Promise<Object>} - Junction record
   */
  static async addSafeguard(threatId, safeguardId, data = {}) {
    const { 
      effectiveness = 50, 
      notes = null 
    } = data;
    
    const query = `
      INSERT INTO threat_model.threat_safeguards (threat_id, safeguard_id, effectiveness, notes)
      VALUES ($1, $2, $3, $4)
      ON CONFLICT (threat_id, safeguard_id) 
      DO UPDATE SET effectiveness = $3, notes = $4
      RETURNING *
    `;
    
    const result = await db.query(query, [threatId, safeguardId, effectiveness, notes]);
    return result.rows[0];
  }
  
  /**
   * Remove a safeguard from a threat
   * 
   * @param {string} threatId - Threat ID
   * @param {string} safeguardId - Safeguard ID
   * @returns {Promise<boolean>} - True if removed
   */
  static async removeSafeguard(threatId, safeguardId) {
    const query = `
      DELETE FROM threat_model.threat_safeguards 
      WHERE threat_id = $1 AND safeguard_id = $2
    `;
    
    const result = await db.query(query, [threatId, safeguardId]);
    return result.rowCount > 0;
  }
  
  /**
   * Get safeguards for a threat
   * 
   * @param {string} threatId - Threat ID
   * @returns {Promise<Array>} - Array of safeguards
   */
  static async getSafeguards(threatId) {
    const query = `
      SELECT s.*, ts.effectiveness, ts.notes 
      FROM threat_model.safeguards s
      JOIN threat_model.threat_safeguards ts ON s.id = ts.safeguard_id
      WHERE ts.threat_id = $1
      ORDER BY ts.effectiveness DESC
    `;
    
    const result = await db.query(query, [threatId]);
    return result.rows;
  }
  
  /**
   * Get vulnerabilities related to a threat
   * 
   * @param {string} threatId - Threat ID
   * @returns {Promise<Array>} - Array of vulnerabilities
   */
  static async getVulnerabilities(threatId) {
    const query = `
      SELECT v.*, tv.match_confidence, tv.notes 
      FROM threat_model.vulnerabilities v
      JOIN threat_model.threat_vulnerabilities tv ON v.id = tv.vulnerability_id
      WHERE tv.threat_id = $1
      ORDER BY tv.match_confidence DESC
    `;
    
    const result = await db.query(query, [threatId]);
    return result.rows;
  }
  
  /**
   * Calculate risk metrics for threats
   * 
   * @param {string} threatModelId - Optional threat model ID to filter by
   * @returns {Promise<Object>} - Risk metrics
   */
  static async calculateRiskMetrics(threatModelId = null) {
    let query = `
      SELECT 
        COUNT(*) as total_threats,
        COUNT(CASE WHEN status = 'Open' THEN 1 END) as open_threats,
        COUNT(CASE WHEN status = 'Mitigated' THEN 1 END) as mitigated_threats,
        COUNT(CASE WHEN status = 'Accepted' THEN 1 END) as accepted_threats,
        AVG(risk_score)::integer as avg_risk_score,
        MAX(risk_score) as max_risk_score,
        COUNT(CASE WHEN risk_score >= 75 THEN 1 END) as high_risk_count,
        COUNT(CASE WHEN risk_score >= 50 AND risk_score < 75 THEN 1 END) as medium_risk_count,
        COUNT(CASE WHEN risk_score < 50 THEN 1 END) as low_risk_count
      FROM threat_model.threats
    `;
    
    const values = [];
    if (threatModelId) {
      query += ' WHERE threat_model_id = $1';
      values.push(threatModelId);
    }
    
    const result = await db.query(query, values);
    
    // Get top 5 threats by risk score
    let topThreatsQuery = `
      SELECT id, name, risk_score, category
      FROM threat_model.threats
    `;
    
    if (threatModelId) {
      topThreatsQuery += ' WHERE threat_model_id = $1';
    }
    
    topThreatsQuery += ' ORDER BY risk_score DESC LIMIT 5';
    
    const topThreatsResult = await db.query(topThreatsQuery, values);
    
    // Get threat distribution by category
    let categoryQuery = `
      SELECT 
        category, 
        COUNT(*)::integer as count,
        AVG(risk_score)::integer as avg_risk
      FROM threat_model.threats
    `;
    
    if (threatModelId) {
      categoryQuery += ' WHERE threat_model_id = $1';
    }
    
    categoryQuery += ' GROUP BY category ORDER BY count DESC';
    
    const categoryResult = await db.query(categoryQuery, values);
    
    return {
      summary: result.rows[0],
      topThreats: topThreatsResult.rows,
      byCategory: categoryResult.rows
    };
  }
  
  /**
   * Generate a risk matrix
   * 
   * @param {string} threatModelId - Optional threat model ID to filter by
   * @returns {Promise<Object>} - Risk matrix data
   */
  static async generateRiskMatrix(threatModelId = null) {
    let query = `
      SELECT 
        likelihood, 
        impact, 
        COUNT(*)::integer as count
      FROM threat_model.threats
    `;
    
    const values = [];
    if (threatModelId) {
      query += ' WHERE threat_model_id = $1';
      values.push(threatModelId);
    }
    
    query += ' GROUP BY likelihood, impact';
    
    const result = await db.query(query, values);
    
    // Format as a risk matrix
    const matrix = {
      likelihood: ['High', 'Medium', 'Low'],
      impact: ['Low', 'Medium', 'High'],
      data: {
        'High': { 'Low': 0, 'Medium': 0, 'High': 0 },
        'Medium': { 'Low': 0, 'Medium': 0, 'High': 0 },
        'Low': { 'Low': 0, 'Medium': 0, 'High': 0 }
      }
    };
    
    // Populate the matrix with actual data
    result.rows.forEach(row => {
      matrix.data[row.likelihood][row.impact] = row.count;
    });
    
    return matrix;
  }
}

module.exports = Threat;
