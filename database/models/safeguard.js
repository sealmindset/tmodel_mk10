/**
 * Safeguard Model
 * 
 * Provides data access methods for security safeguards/controls in the database
 */
const db = require('../index');

class Safeguard {
  /**
   * Create a new safeguard
   * 
   * @param {Object} safeguardData - Safeguard data
   * @returns {Promise<Object>} - Created safeguard
   */
  static async create(safeguardData) {
    const { 
      name, 
      type, 
      description, 
      effectiveness, 
      implementation_status = 'Planned',
      implementation_details,
      verification_method,
      created_by 
    } = safeguardData;
    
    const query = `
      INSERT INTO threat_model.safeguards 
        (name, type, description, effectiveness, implementation_status, 
         implementation_details, verification_method, created_by)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
      RETURNING *
    `;
    
    const values = [
      name, 
      type, 
      description, 
      effectiveness, 
      implementation_status,
      implementation_details,
      verification_method,
      created_by
    ];
    
    const result = await db.query(query, values);
    return result.rows[0];
  }
  
  /**
   * Get safeguard by ID
   * 
   * @param {string} id - Safeguard ID
   * @returns {Promise<Object>} - Safeguard data
   */
  static async getById(id) {
    const query = 'SELECT * FROM threat_model.safeguards WHERE id = $1';
    const result = await db.query(query, [id]);
    return result.rows[0];
  }
  
  /**
   * Get all safeguards
   * 
   * @param {Object} filters - Optional filters
   * @returns {Promise<Array>} - Array of safeguards
   */
  static async getAll(filters = {}) {
    const { type, implementation_status, effectiveness_min } = filters;
    let query = 'SELECT * FROM threat_model.safeguards';
    const values = [];
    
    // Add filters if provided
    const conditions = [];
    if (type) {
      conditions.push(`type = $${values.length + 1}`);
      values.push(type);
    }
    
    if (implementation_status) {
      conditions.push(`implementation_status = $${values.length + 1}`);
      values.push(implementation_status);
    }
    
    if (effectiveness_min !== undefined) {
      conditions.push(`effectiveness >= $${values.length + 1}`);
      values.push(effectiveness_min);
    }
    
    if (conditions.length > 0) {
      query += ' WHERE ' + conditions.join(' AND ');
    }
    
    query += ' ORDER BY type, name';
    
    const result = await db.query(query, values);
    return result.rows;
  }
  
  /**
   * Update a safeguard
   * 
   * @param {string} id - Safeguard ID
   * @param {Object} safeguardData - Safeguard data to update
   * @returns {Promise<Object>} - Updated safeguard
   */
  static async update(id, safeguardData) {
    const { 
      name, 
      type, 
      description, 
      effectiveness, 
      implementation_status, 
      implementation_details,
      verification_method, 
      last_verified 
    } = safeguardData;
    
    const query = `
      UPDATE threat_model.safeguards
      SET 
        name = $1,
        type = $2,
        description = $3,
        effectiveness = $4,
        implementation_status = $5,
        implementation_details = $6,
        verification_method = $7,
        last_verified = $8,
        updated_at = CURRENT_TIMESTAMP
      WHERE id = $9
      RETURNING *
    `;
    
    const values = [
      name, 
      type, 
      description, 
      effectiveness, 
      implementation_status,
      implementation_details,
      verification_method,
      last_verified,
      id
    ];
    
    const result = await db.query(query, values);
    return result.rows[0];
  }
  
  /**
   * Delete a safeguard
   * 
   * @param {string} id - Safeguard ID
   * @returns {Promise<boolean>} - True if deleted
   */
  static async delete(id) {
    const query = 'DELETE FROM threat_model.safeguards WHERE id = $1';
    const result = await db.query(query, [id]);
    return result.rowCount > 0;
  }
  
  /**
   * Get components using this safeguard
   * 
   * @param {string} safeguardId - Safeguard ID
   * @returns {Promise<Array>} - Components using this safeguard
   */
  static async getComponents(safeguardId) {
    const query = `
      SELECT c.*, cs.status, cs.notes 
      FROM threat_model.components c
      JOIN threat_model.component_safeguards cs ON c.id = cs.component_id
      WHERE cs.safeguard_id = $1
    `;
    
    const result = await db.query(query, [safeguardId]);
    return result.rows;
  }
  
  /**
   * Get compliance requirements for this safeguard
   * 
   * @param {string} safeguardId - Safeguard ID
   * @returns {Promise<Array>} - Compliance requirements
   */
  static async getComplianceRequirements(safeguardId) {
    const query = `
      SELECT cr.*, cf.name as framework_name, sc.notes
      FROM threat_model.compliance_requirements cr
      JOIN threat_model.compliance_frameworks cf ON cr.framework_id = cf.id
      JOIN threat_model.safeguard_compliance sc ON cr.id = sc.requirement_id
      WHERE sc.safeguard_id = $1
    `;
    
    const result = await db.query(query, [safeguardId]);
    return result.rows;
  }
  
  /**
   * Add compliance requirement to safeguard
   * 
   * @param {string} safeguardId - Safeguard ID
   * @param {string} requirementId - Requirement ID
   * @param {string} notes - Optional notes
   * @returns {Promise<Object>} - Junction record
   */
  static async addComplianceRequirement(safeguardId, requirementId, notes = null) {
    const query = `
      INSERT INTO threat_model.safeguard_compliance (safeguard_id, requirement_id, notes)
      VALUES ($1, $2, $3)
      ON CONFLICT (safeguard_id, requirement_id) 
      DO UPDATE SET notes = $3
      RETURNING *
    `;
    
    const result = await db.query(query, [safeguardId, requirementId, notes]);
    return result.rows[0];
  }
  
  /**
   * Remove compliance requirement from safeguard
   * 
   * @param {string} safeguardId - Safeguard ID
   * @param {string} requirementId - Requirement ID
   * @returns {Promise<boolean>} - True if removed
   */
  static async removeComplianceRequirement(safeguardId, requirementId) {
    const query = `
      DELETE FROM threat_model.safeguard_compliance 
      WHERE safeguard_id = $1 AND requirement_id = $2
    `;
    
    const result = await db.query(query, [safeguardId, requirementId]);
    return result.rowCount > 0;
  }
  
  /**
   * Get safeguard effectiveness statistics
   * 
   * @returns {Promise<Object>} - Effectiveness statistics
   */
  static async getEffectivenessStatistics() {
    const query = `
      SELECT 
        type,
        ROUND(AVG(effectiveness))::integer as avg_effectiveness,
        COUNT(*)::integer as count
      FROM threat_model.safeguards
      GROUP BY type
      ORDER BY type
    `;
    
    const result = await db.query(query);
    
    // Format the results as an object
    const statistics = {};
    result.rows.forEach(row => {
      statistics[row.type] = {
        avg_effectiveness: row.avg_effectiveness,
        count: row.count
      };
    });
    
    return statistics;
  }
  
  /**
   * Update verification status
   * 
   * @param {string} id - Safeguard ID
   * @param {string} method - Verification method
   * @returns {Promise<Object>} - Updated safeguard
   */
  static async updateVerification(id, method) {
    const query = `
      UPDATE threat_model.safeguards
      SET 
        verification_method = $1,
        last_verified = CURRENT_TIMESTAMP,
        updated_at = CURRENT_TIMESTAMP
      WHERE id = $2
      RETURNING *
    `;
    
    const result = await db.query(query, [method, id]);
    return result.rows[0];
  }
}

module.exports = Safeguard;
