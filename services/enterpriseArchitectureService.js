/**
 * Enterprise Architecture Service
 * 
 * Provides services for managing the enhanced enterprise architecture features
 * including component libraries, safeguards, business impact analysis, and security metrics
 */
const db = require('../database');
const pool = require('../database').pool;
const rapid7Service = require('./rapid7Service');

/**
 * Get a project's security posture
 * @param {string} projectId - Project ID
 * @returns {Promise<Object>} - Security posture data
 */
async function getProjectSecurityPosture(projectId) {
  if (!projectId) {
    throw new Error('Project ID is required');
  }

  try {
    const query = `
      SELECT * FROM threat_model.project_security_posture
      WHERE project_id = $1
    `;
    
    const result = await pool.query(query, [projectId]);
    
    if (result.rows.length === 0) {
      return null;
    }
    
    return result.rows[0];
  } catch (error) {
    console.error('Error getting project security posture:', error);
    throw error;
  }
}

/**
 * Calculate and update a project's security posture score
 * @param {string} projectId - Project ID
 * @returns {Promise<number>} - Updated security posture score
 */
async function updateProjectSecurityPostureScore(projectId) {
  if (!projectId) {
    throw new Error('Project ID is required');
  }

  try {
    // Get current threat and safeguard data
    const securityDataQuery = `
      SELECT 
        COUNT(DISTINCT t.id) AS threat_count,
        COUNT(DISTINCT t.id) FILTER (WHERE t.status = 'Mitigated') AS mitigated_threat_count,
        COUNT(DISTINCT s.id) AS safeguard_count,
        COUNT(DISTINCT s.id) FILTER (WHERE cs.status = 'Implemented' AND s.implementation_status = 'Verified') AS verified_safeguard_count,
        COUNT(DISTINCT v.id) AS vulnerability_count,
        COUNT(DISTINCT v.id) FILTER (WHERE v.status = 'Remediated') AS remediated_vulnerability_count
      FROM 
        threat_model.projects p
      LEFT JOIN 
        threat_model.project_components pc ON p.id = pc.project_id
      LEFT JOIN 
        threat_model.components c ON pc.component_id = c.id
      LEFT JOIN 
        threat_model.project_threat_models ptm ON p.id = ptm.project_id
      LEFT JOIN 
        threat_model.threat_models tm ON ptm.threat_model_id = tm.id
      LEFT JOIN 
        threat_model.threats t ON tm.id = t.threat_model_id
      LEFT JOIN 
        threat_model.component_safeguards cs ON c.id = cs.component_id
      LEFT JOIN 
        threat_model.safeguards s ON cs.safeguard_id = s.id
      LEFT JOIN 
        threat_model.vulnerabilities v ON c.id = v.component_id
      WHERE 
        p.id = $1
    `;
    
    const securityDataResult = await pool.query(securityDataQuery, [projectId]);
    const securityData = securityDataResult.rows[0];
    
    // Calculate security posture score
    // Formula: (mitigated threats / total threats) * 40% + 
    //          (verified safeguards / total safeguards) * 30% +
    //          (remediated vulnerabilities / total vulnerabilities) * 30%
    
    let score = 0;
    
    // Threat mitigation score (40% of total)
    if (securityData.threat_count > 0) {
      score += (securityData.mitigated_threat_count / securityData.threat_count) * 40;
    } else {
      // No threats identified yet, assume neutral score
      score += 20;
    }
    
    // Safeguard implementation score (30% of total)
    if (securityData.safeguard_count > 0) {
      score += (securityData.verified_safeguard_count / securityData.safeguard_count) * 30;
    } else {
      // No safeguards identified yet, assume neutral score
      score += 15;
    }
    
    // Vulnerability remediation score (30% of total)
    if (securityData.vulnerability_count > 0) {
      score += (securityData.remediated_vulnerability_count / securityData.vulnerability_count) * 30;
    } else {
      // No vulnerabilities identified yet, assume full score
      score += 30;
    }
    
    // Round to nearest integer
    score = Math.round(score);
    
    // Update project security posture score
    const updateQuery = `
      UPDATE threat_model.projects
      SET 
        security_posture_score = $1,
        last_assessment_date = CURRENT_TIMESTAMP,
        updated_at = CURRENT_TIMESTAMP
      WHERE id = $2
      RETURNING security_posture_score
    `;
    
    const updateResult = await pool.query(updateQuery, [score, projectId]);
    
    // Record security metrics history
    await recordSecurityMetrics(projectId, securityData, score);
    
    return updateResult.rows[0].security_posture_score;
  } catch (error) {
    console.error('Error updating project security posture score:', error);
    throw error;
  }
}

/**
 * Record security metrics for historical tracking
 * @param {string} projectId - Project ID
 * @param {Object} securityData - Security data
 * @param {number} score - Security posture score
 * @returns {Promise<void>}
 */
async function recordSecurityMetrics(projectId, securityData, score) {
  try {
    const query = `
      INSERT INTO threat_model.security_metrics (
        project_id,
        security_posture_score,
        threat_count,
        mitigated_threat_count,
        vulnerability_count,
        remediated_vulnerability_count,
        safeguard_count,
        verified_safeguard_count
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
      RETURNING id
    `;
    
    await pool.query(query, [
      projectId,
      score,
      securityData.threat_count || 0,
      securityData.mitigated_threat_count || 0,
      securityData.vulnerability_count || 0,
      securityData.remediated_vulnerability_count || 0,
      securityData.safeguard_count || 0,
      securityData.verified_safeguard_count || 0
    ]);
  } catch (error) {
    console.error('Error recording security metrics:', error);
    // Don't throw error, just log it
  }
}

/**
 * Get security metrics history for a project
 * @param {string} projectId - Project ID
 * @param {string} timePeriod - Time period (1m, 3m, 6m, 1y, all)
 * @returns {Promise<Array>} - Security metrics history
 */
async function getSecurityMetricsHistory(projectId, timePeriod = '3m') {
  if (!projectId) {
    throw new Error('Project ID is required');
  }

  try {
    let timeFilter = '';
    
    switch (timePeriod) {
      case '1m':
        timeFilter = 'AND metric_date >= NOW() - INTERVAL \'1 month\'';
        break;
      case '3m':
        timeFilter = 'AND metric_date >= NOW() - INTERVAL \'3 months\'';
        break;
      case '6m':
        timeFilter = 'AND metric_date >= NOW() - INTERVAL \'6 months\'';
        break;
      case '1y':
        timeFilter = 'AND metric_date >= NOW() - INTERVAL \'1 year\'';
        break;
      default:
        // All time, no filter
        timeFilter = '';
    }
    
    const query = `
      SELECT *
      FROM threat_model.security_metrics
      WHERE project_id = $1 ${timeFilter}
      ORDER BY metric_date ASC
    `;
    
    const result = await pool.query(query, [projectId]);
    return result.rows;
  } catch (error) {
    console.error('Error getting security metrics history:', error);
    throw error;
  }
}

/**
 * Get component library items
 * @param {Object} filters - Optional filters
 * @returns {Promise<Array>} - Component library items
 */
async function getComponentLibrary(filters = {}) {
  try {
    let query = `
      SELECT *
      FROM threat_model.component_library
    `;
    
    const whereConditions = [];
    const params = [];
    
    if (filters.category) {
      whereConditions.push('category = $' + (params.length + 1));
      params.push(filters.category);
    }
    
    if (filters.name) {
      whereConditions.push('name ILIKE $' + (params.length + 1));
      params.push(`%${filters.name}%`);
    }
    
    if (whereConditions.length > 0) {
      query += ' WHERE ' + whereConditions.join(' AND ');
    }
    
    query += ' ORDER BY name ASC';
    
    const result = await pool.query(query, params);
    return result.rows;
  } catch (error) {
    console.error('Error getting component library:', error);
    throw error;
  }
}

/**
 * Create a component from a library template
 * @param {string} libraryItemId - Component library item ID
 * @param {Object} componentData - Component data overrides
 * @returns {Promise<Object>} - Created component
 */
async function createComponentFromLibrary(libraryItemId, componentData = {}) {
  if (!libraryItemId) {
    throw new Error('Library item ID is required');
  }

  const client = await pool.connect();
  
  try {
    await client.query('BEGIN');
    
    // Get library item
    const libraryQuery = `
      SELECT *
      FROM threat_model.component_library
      WHERE id = $1
    `;
    
    const libraryResult = await client.query(libraryQuery, [libraryItemId]);
    
    if (libraryResult.rows.length === 0) {
      throw new Error('Component library item not found');
    }
    
    const libraryItem = libraryResult.rows[0];
    
    // Create component
    const componentQuery = `
      INSERT INTO threat_model.components (
        name,
        type,
        description,
        version,
        category,
        subcategory,
        technology_stack,
        is_reusable,
        created_by
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
      RETURNING *
    `;
    
    const componentResult = await client.query(componentQuery, [
      componentData.name || libraryItem.name,
      componentData.type || 'Standard',
      componentData.description || libraryItem.description,
      componentData.version || libraryItem.version,
      componentData.category || libraryItem.category,
      componentData.subcategory || libraryItem.subcategory,
      componentData.technology_stack || libraryItem.technology_stack,
      componentData.is_reusable !== undefined ? componentData.is_reusable : true,
      componentData.created_by || 'system'
    ]);
    
    const component = componentResult.rows[0];
    
    // If library item has typical safeguards, create them
    if (libraryItem.typical_safeguards && libraryItem.typical_safeguards.length > 0) {
      // Get safeguards from safeguard library
      const safeguardQuery = `
        SELECT *
        FROM threat_model.safeguard_library
        WHERE name = ANY($1)
      `;
      
      const safeguardResult = await client.query(safeguardQuery, [libraryItem.typical_safeguards]);
      
      // Create safeguards for this component
      for (const safeguard of safeguardResult.rows) {
        // First create the safeguard if it doesn't exist
        const createSafeguardQuery = `
          INSERT INTO threat_model.safeguards (
            name,
            type,
            description,
            effectiveness,
            implementation_status,
            category,
            subcategory
          )
          VALUES ($1, $2, $3, $4, $5, $6, $7)
          ON CONFLICT (name) DO UPDATE
          SET updated_at = CURRENT_TIMESTAMP
          RETURNING id
        `;
        
        const createSafeguardResult = await client.query(createSafeguardQuery, [
          safeguard.name,
          safeguard.category,
          safeguard.description,
          safeguard.typical_effectiveness,
          'Planned',
          safeguard.category,
          safeguard.subcategory
        ]);
        
        const safeguardId = createSafeguardResult.rows[0].id;
        
        // Then associate it with the component
        const componentSafeguardQuery = `
          INSERT INTO threat_model.component_safeguards (
            component_id,
            safeguard_id,
            status
          )
          VALUES ($1, $2, $3)
          ON CONFLICT (component_id, safeguard_id) DO NOTHING
        `;
        
        await client.query(componentSafeguardQuery, [
          component.id,
          safeguardId,
          'Planned'
        ]);
      }
    }
    
    await client.query('COMMIT');
    return component;
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Error creating component from library:', error);
    throw error;
  } finally {
    client.release();
  }
}

/**
 * Get safeguard library items
 * @param {Object} filters - Optional filters
 * @returns {Promise<Array>} - Safeguard library items
 */
async function getSafeguardLibrary(filters = {}) {
  try {
    let query = `
      SELECT *
      FROM threat_model.safeguard_library
    `;
    
    const whereConditions = [];
    const params = [];
    
    if (filters.category) {
      whereConditions.push('category = $' + (params.length + 1));
      params.push(filters.category);
    }
    
    if (filters.name) {
      whereConditions.push('name ILIKE $' + (params.length + 1));
      params.push(`%${filters.name}%`);
    }
    
    if (whereConditions.length > 0) {
      query += ' WHERE ' + whereConditions.join(' AND ');
    }
    
    query += ' ORDER BY name ASC';
    
    const result = await pool.query(query, params);
    return result.rows;
  } catch (error) {
    console.error('Error getting safeguard library:', error);
    throw error;
  }
}

/**
 * Create or update business impact analysis for a component
 * @param {string} projectId - Project ID
 * @param {string} componentId - Component ID
 * @param {Object} impactData - Impact data
 * @returns {Promise<Object>} - Business impact analysis
 */
async function updateBusinessImpactAnalysis(projectId, componentId, impactData) {
  if (!projectId || !componentId) {
    throw new Error('Project ID and Component ID are required');
  }

  try {
    const query = `
      INSERT INTO threat_model.business_impact_analysis (
        project_id,
        component_id,
        confidentiality_impact,
        integrity_impact,
        availability_impact,
        financial_impact,
        reputational_impact,
        regulatory_impact,
        analysis_date,
        notes,
        created_by
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, CURRENT_TIMESTAMP, $9, $10)
      ON CONFLICT (project_id, component_id) 
      DO UPDATE SET
        confidentiality_impact = $3,
        integrity_impact = $4,
        availability_impact = $5,
        financial_impact = $6,
        reputational_impact = $7,
        regulatory_impact = $8,
        analysis_date = CURRENT_TIMESTAMP,
        notes = $9,
        updated_at = CURRENT_TIMESTAMP
      RETURNING *
    `;
    
    const result = await pool.query(query, [
      projectId,
      componentId,
      impactData.confidentiality_impact || 'Low',
      impactData.integrity_impact || 'Low',
      impactData.availability_impact || 'Low',
      impactData.financial_impact || 0,
      impactData.reputational_impact || 'Low',
      impactData.regulatory_impact || 'Low',
      impactData.notes || '',
      impactData.created_by || 'system'
    ]);
    
    // Update project risk exposure value based on components
    await updateProjectRiskExposure(projectId);
    
    return result.rows[0];
  } catch (error) {
    console.error('Error updating business impact analysis:', error);
    throw error;
  }
}

/**
 * Update project risk exposure value
 * @param {string} projectId - Project ID
 * @returns {Promise<number>} - Updated risk exposure value
 */
async function updateProjectRiskExposure(projectId) {
  if (!projectId) {
    throw new Error('Project ID is required');
  }

  try {
    // Get total financial impact from all components
    const impactQuery = `
      SELECT SUM(financial_impact) as total_financial_impact
      FROM threat_model.business_impact_analysis
      WHERE project_id = $1
    `;
    
    const impactResult = await pool.query(impactQuery, [projectId]);
    const totalFinancialImpact = impactResult.rows[0].total_financial_impact || 0;
    
    // Get security posture score
    const scoreQuery = `
      SELECT security_posture_score
      FROM threat_model.projects
      WHERE id = $1
    `;
    
    const scoreResult = await pool.query(scoreQuery, [projectId]);
    const securityPostureScore = scoreResult.rows[0]?.security_posture_score || 50;
    
    // Calculate risk exposure value
    // Formula: Total Financial Impact * (1 - Security Posture Score / 100)
    const riskExposureValue = totalFinancialImpact * (1 - securityPostureScore / 100);
    
    // Update project risk exposure value
    const updateQuery = `
      UPDATE threat_model.projects
      SET 
        risk_exposure_value = $1,
        updated_at = CURRENT_TIMESTAMP
      WHERE id = $2
      RETURNING risk_exposure_value
    `;
    
    const updateResult = await pool.query(updateQuery, [riskExposureValue, projectId]);
    
    return updateResult.rows[0].risk_exposure_value;
  } catch (error) {
    console.error('Error updating project risk exposure:', error);
    throw error;
  }
}

/**
 * Map a component to a Rapid7 asset
 * @param {string} componentId - Component ID
 * @param {string} rapid7AssetId - Rapid7 asset ID
 * @param {string} rapid7AssetName - Rapid7 asset name
 * @returns {Promise<Object>} - Mapping
 */
async function mapComponentToRapid7Asset(componentId, rapid7AssetId, rapid7AssetName) {
  if (!componentId || !rapid7AssetId) {
    throw new Error('Component ID and Rapid7 Asset ID are required');
  }

  try {
    const query = `
      INSERT INTO threat_model.rapid7_asset_mapping (
        component_id,
        rapid7_asset_id,
        rapid7_asset_name,
        mapping_confidence,
        last_sync_date,
        created_by
      )
      VALUES ($1, $2, $3, $4, CURRENT_TIMESTAMP, $5)
      ON CONFLICT (component_id, rapid7_asset_id) 
      DO UPDATE SET
        rapid7_asset_name = $3,
        mapping_confidence = $4,
        last_sync_date = CURRENT_TIMESTAMP,
        updated_at = CURRENT_TIMESTAMP
      RETURNING *
    `;
    
    const result = await pool.query(query, [
      componentId,
      rapid7AssetId,
      rapid7AssetName || '',
      100, // Default to 100% confidence for manual mappings
      'system'
    ]);
    
    return result.rows[0];
  } catch (error) {
    console.error('Error mapping component to Rapid7 asset:', error);
    throw error;
  }
}

/**
 * Get Rapid7 asset mappings for a component
 * @param {string} componentId - Component ID
 * @returns {Promise<Array>} - Rapid7 asset mappings
 */
async function getRapid7AssetMappings(componentId) {
  if (!componentId) {
    throw new Error('Component ID is required');
  }

  try {
    const query = `
      SELECT *
      FROM threat_model.rapid7_asset_mapping
      WHERE component_id = $1
      ORDER BY last_sync_date DESC
    `;
    
    const result = await pool.query(query, [componentId]);
    return result.rows;
  } catch (error) {
    console.error('Error getting Rapid7 asset mappings:', error);
    throw error;
  }
}

/**
 * Sync vulnerability data from Rapid7 for a specific project
 * @param {string} projectId - Project ID
 * @returns {Promise<Object>} - Sync results
 */
async function syncProjectVulnerabilities(projectId) {
  if (!projectId) {
    throw new Error('Project ID is required');
  }

  try {
    // Get all component-to-asset mappings for this project
    const mappingsQuery = `
      SELECT ram.* 
      FROM threat_model.rapid7_asset_mapping ram
      JOIN threat_model.project_components pc ON ram.component_id = pc.component_id
      WHERE pc.project_id = $1
    `;
    
    const mappingsResult = await pool.query(mappingsQuery, [projectId]);
    const mappings = mappingsResult.rows;
    
    if (mappings.length === 0) {
      return {
        success: true,
        message: 'No Rapid7 asset mappings found for this project',
        vulnerabilitiesFound: 0,
        vulnerabilitiesImported: 0
      };
    }
    
    // Get vulnerabilities for each mapped asset
    let totalVulnerabilities = 0;
    let importedVulnerabilities = 0;
    
    for (const mapping of mappings) {
      // Get vulnerabilities for this asset
      const assetVulnerabilities = await rapid7Service.getVulnerabilitiesForAsset(mapping.rapid7_asset_id);
      totalVulnerabilities += assetVulnerabilities.length;
      
      // Process each vulnerability
      for (const vuln of assetVulnerabilities) {
        // Get additional details and solutions
        const vulnDetails = await rapid7Service.getVulnerabilityById(vuln.id);
        const solutions = await rapid7Service.getSolutions(vuln.id);
        const remediation = solutions && solutions.length > 0 ? solutions[0].summary : null;
        
        // Save vulnerability to database and link to component
        const vulnData = {
          id: vuln.id,
          title: vuln.title,
          description: vulnDetails.description || vuln.title,
          severity: vuln.severity,
          cvss_score: vuln.cvss || 0,
          remediation: remediation,
          asset_id: mapping.rapid7_asset_id,
          asset_name: mapping.rapid7_asset_name,
          component_id: mapping.component_id
        };
        
        // Insert or update vulnerability
        const vulnQuery = `
          INSERT INTO threat_model.vulnerabilities 
            (external_id, title, description, severity, cvss_score, 
             status, remediation, asset_id, asset_name, component_id, first_found, last_found)
          VALUES 
            ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
          ON CONFLICT (external_id) 
          DO UPDATE SET 
            title = $2, 
            description = $3, 
            severity = $4, 
            cvss_score = $5, 
            status = $6, 
            remediation = $7,
            asset_id = $8,
            asset_name = $9,
            component_id = $10,
            last_found = $12,
            updated_at = CURRENT_TIMESTAMP
          RETURNING id`;

        const vulnResult = await pool.query(vulnQuery, [
          vuln.id, // external_id
          vuln.title, 
          vulnDetails.description || '',
          vuln.severity,
          vuln.cvss || 0, 
          'Open',  // default status
          remediation || '',
          mapping.rapid7_asset_id,
          mapping.rapid7_asset_name || '',
          mapping.component_id,
          new Date(), // first_found 
          new Date()  // last_found
        ]);
        
        importedVulnerabilities++;
      }
    }
    
    // Update the project's security posture score
    await updateProjectSecurityPostureScore(projectId);
    
    // Update the last sync time
    const syncTimeQuery = `
      UPDATE threat_model.projects
      SET 
        last_vulnerability_sync = CURRENT_TIMESTAMP,
        updated_at = CURRENT_TIMESTAMP
      WHERE id = $1
    `;
    
    await pool.query(syncTimeQuery, [projectId]);
    
    return {
      success: true,
      message: `Vulnerability sync completed for project ${projectId}`,
      vulnerabilitiesFound: totalVulnerabilities,
      vulnerabilitiesImported: importedVulnerabilities
    };
  } catch (error) {
    console.error('Error syncing project vulnerabilities:', error);
    throw error;
  }
}

/**
 * Get project vulnerabilities
 * @param {string} projectId - Project ID
 * @returns {Promise<Array>} - Vulnerabilities
 */
async function getProjectVulnerabilities(projectId) {
  if (!projectId) {
    throw new Error('Project ID is required');
  }

  try {
    const query = `
      SELECT v.*
      FROM threat_model.vulnerabilities v
      JOIN threat_model.project_components pc ON v.component_id = pc.component_id
      WHERE pc.project_id = $1
      ORDER BY v.cvss_score DESC NULLS LAST, v.severity DESC
    `;
    
    const result = await pool.query(query, [projectId]);
    return result.rows;
  } catch (error) {
    console.error('Error getting project vulnerabilities:', error);
    throw error;
  }
}

/**
 * Update vulnerability status
 * @param {string} vulnerabilityId - Vulnerability ID
 * @param {string} status - New status
 * @param {string} notes - Notes about the status change
 * @returns {Promise<Object>} - Updated vulnerability
 */
async function updateVulnerabilityStatus(vulnerabilityId, status, notes) {
  if (!vulnerabilityId || !status) {
    throw new Error('Vulnerability ID and status are required');
  }

  try {
    const query = `
      UPDATE threat_model.vulnerabilities
      SET 
        status = $1,
        notes = $2,
        updated_at = CURRENT_TIMESTAMP
      WHERE id = $3
      RETURNING *
    `;
    
    const result = await pool.query(query, [status, notes || '', vulnerabilityId]);
    
    if (result.rows.length === 0) {
      throw new Error(`Vulnerability with ID ${vulnerabilityId} not found`);
    }
    
    // Get the component ID and project ID to update security posture
    const componentId = result.rows[0].component_id;
    if (componentId) {
      const projectQuery = `
        SELECT project_id
        FROM threat_model.project_components
        WHERE component_id = $1
      `;
      
      const projectResult = await pool.query(projectQuery, [componentId]);
      
      if (projectResult.rows.length > 0) {
        const projectId = projectResult.rows[0].project_id;
        await updateProjectSecurityPostureScore(projectId);
      }
    }
    
    return result.rows[0];
  } catch (error) {
    console.error('Error updating vulnerability status:', error);
    throw error;
  }
}

module.exports = {
  getProjectSecurityPosture,
  updateProjectSecurityPostureScore,
  getSecurityMetricsHistory,
  getComponentLibrary,
  createComponentFromLibrary,
  getSafeguardLibrary,
  updateBusinessImpactAnalysis,
  updateProjectRiskExposure,
  mapComponentToRapid7Asset,
  getRapid7AssetMappings,
  syncProjectVulnerabilities,
  getProjectVulnerabilities,
  updateVulnerabilityStatus
};
