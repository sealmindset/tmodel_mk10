/**
 * Scan History Model
 * 
 * Tracks vulnerability scans from Rapid7 and other tools
 */
const db = require('../index');

class ScanHistory {
  /**
   * Create a new scan history record
   * 
   * @param {Object} scanData - Scan data
   * @returns {Promise<Object>} - Created scan record
   */
  static async create(scanData) {
    const { 
      source, 
      scan_id, 
      project_id, 
      scan_type,
      vulnerabilities_found = 0,
      started_at,
      completed_at,
      status = 'Scheduled'
    } = scanData;
    
    const query = `
      INSERT INTO threat_model.scan_history 
        (source, scan_id, project_id, scan_type, 
         vulnerabilities_found, started_at, completed_at, status)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
      RETURNING *
    `;
    
    const values = [
      source, 
      scan_id || null, 
      project_id, 
      scan_type,
      vulnerabilities_found,
      started_at || null,
      completed_at || null,
      status
    ];
    
    const result = await db.query(query, values);
    return result.rows[0];
  }
  
  /**
   * Get scan history by ID
   * 
   * @param {string} id - Scan history ID
   * @returns {Promise<Object>} - Scan history data
   */
  static async getById(id) {
    const query = 'SELECT * FROM threat_model.scan_history WHERE id = $1';
    const result = await db.query(query, [id]);
    return result.rows[0];
  }
  
  /**
   * Get scan history by external scan ID
   * 
   * @param {string} scanId - External scan ID (e.g., Rapid7 scan ID)
   * @param {string} source - Source system (e.g., 'rapid7')
   * @returns {Promise<Object>} - Scan history data
   */
  static async getByScanId(scanId, source) {
    const query = 'SELECT * FROM threat_model.scan_history WHERE scan_id = $1 AND source = $2';
    const result = await db.query(query, [scanId, source]);
    return result.rows[0];
  }
  
  /**
   * Get all scan history for a project
   * 
   * @param {string} projectId - Project ID
   * @returns {Promise<Array>} - Array of scan history
   */
  static async getByProject(projectId) {
    const query = `
      SELECT * FROM threat_model.scan_history
      WHERE project_id = $1
      ORDER BY created_at DESC
    `;
    
    const result = await db.query(query, [projectId]);
    return result.rows;
  }
  
  /**
   * Update a scan history record
   * 
   * @param {string} id - Scan history ID
   * @param {Object} scanData - Scan data to update
   * @returns {Promise<Object>} - Updated scan history
   */
  static async update(id, scanData) {
    const { 
      scan_id, 
      vulnerabilities_found,
      started_at,
      completed_at,
      status
    } = scanData;
    
    const query = `
      UPDATE threat_model.scan_history
      SET 
        scan_id = COALESCE($1, scan_id),
        vulnerabilities_found = COALESCE($2, vulnerabilities_found),
        started_at = COALESCE($3, started_at),
        completed_at = COALESCE($4, completed_at),
        status = COALESCE($5, status)
      WHERE id = $6
      RETURNING *
    `;
    
    const values = [
      scan_id, 
      vulnerabilities_found,
      started_at,
      completed_at,
      status,
      id
    ];
    
    const result = await db.query(query, values);
    return result.rows[0];
  }
  
  /**
   * Get scan history statistics
   * 
   * @param {string} projectId - Optional project ID to filter by
   * @returns {Promise<Object>} - Scan statistics
   */
  static async getStatistics(projectId = null) {
    let query = `
      SELECT 
        source,
        COUNT(*)::integer as total_scans,
        SUM(vulnerabilities_found)::integer as total_vulnerabilities,
        AVG(vulnerabilities_found)::integer as avg_vulnerabilities_per_scan,
        COUNT(CASE WHEN status = 'Completed' THEN 1 END)::integer as completed_scans,
        COUNT(CASE WHEN status = 'Failed' THEN 1 END)::integer as failed_scans,
        MAX(completed_at) as last_completed_scan
      FROM threat_model.scan_history
    `;
    
    const values = [];
    
    if (projectId) {
      query += ' WHERE project_id = $1';
      values.push(projectId);
    }
    
    query += ' GROUP BY source';
    
    const result = await db.query(query, values);
    
    // Format the results
    const statistics = {};
    
    result.rows.forEach(row => {
      statistics[row.source] = {
        total_scans: row.total_scans,
        total_vulnerabilities: row.total_vulnerabilities,
        avg_vulnerabilities_per_scan: row.avg_vulnerabilities_per_scan,
        completed_scans: row.completed_scans,
        failed_scans: row.failed_scans,
        last_completed_scan: row.last_completed_scan
      };
    });
    
    return statistics;
  }
}

module.exports = ScanHistory;
