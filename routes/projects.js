/**
 * Projects route handler
 * Displays the projects list page and handles filtering
 */
const express = require('express');
const router = express.Router();
const db = require('../db/db');
const { ensureAuthenticated } = require('../middleware/auth');

// Helper function to get criticality class for badge styling
function getCriticalityClass(criticality) {
  switch (criticality) {
    case 'Critical': return 'danger';
    case 'High': return 'warning';
    case 'Medium': return 'info';
    case 'Low': return 'secondary';
    default: return 'secondary';
  }
}

// Helper function to get status class for badge styling
function getStatusClass(status) {
  switch (status) {
    case 'Active': return 'success';
    case 'Planning': return 'info';
    case 'Development': return 'primary';
    case 'Maintenance': return 'warning';
    case 'Archived': return 'secondary';
    default: return 'secondary';
  }
}

// Helper function to get risk score class
function getRiskClass(score) {
  if (score >= 7.5) return 'bg-danger';
  if (score >= 5) return 'bg-warning';
  if (score >= 2.5) return 'bg-info';
  return 'bg-success';
}

// Helper function to get threat model status class
function getThreatModelStatusClass(status) {
  switch(status) {
    case 'Draft': return 'warning';
    case 'Active': return 'success';
    case 'Archived': return 'secondary';
    case 'Reviewed': return 'info';
    default: return 'primary';
  }
}

// GET /projects/archived - Show archived projects list
router.get('/archived', async (req, res) => {
  try {
    // Get all archived projects
    const query = `
      SELECT 
        p.id, 
        p.name, 
        p.description, 
        p.business_unit, 
        p.criticality, 
        p.data_classification, 
        p.status,
        p.created_at,
        p.updated_at,
        COUNT(DISTINCT ptm.threat_model_id) as threat_model_count,
        COALESCE(AVG(tm.risk_score), 0) as avg_risk_score
      FROM 
        threat_model.projects p
      LEFT JOIN 
        threat_model.project_threat_models ptm ON p.id = ptm.project_id
      LEFT JOIN 
        threat_model.threat_models tm ON ptm.threat_model_id = tm.id
      WHERE
        p.status = 'Archived'
      GROUP BY 
        p.id, 
        p.name, 
        p.description, 
        p.business_unit, 
        p.criticality, 
        p.data_classification, 
        p.status,
        p.created_at,
        p.updated_at
      ORDER BY 
        p.name ASC
    `;
    
    const result = await db.query(query);
    const projects = result.rows;
    
    // Get aggregated statistics for charts
    const businessUnitStats = {};
    const criticalityStats = {
      Critical: 0,
      High: 0,
      Medium: 0,
      Low: 0
    };
    
    // Calculate statistics
    projects.forEach(project => {
      // Count by business unit
      if (project.business_unit) {
        businessUnitStats[project.business_unit] = (businessUnitStats[project.business_unit] || 0) + 1;
      }
      
      // Count by criticality
      if (project.criticality && criticalityStats.hasOwnProperty(project.criticality)) {
        criticalityStats[project.criticality]++;
      }
    });
    
    // Render the archived projects page
    res.render('projects-archived', {
      projects,
      businessUnitStats,
      criticalityStats,
      getCriticalityClass,
      getStatusClass,
      getRiskClass,
      getThreatModelStatusClass
    });
  } catch (error) {
    console.error('Error fetching archived projects:', error);
    res.status(500).render('error', {
      errorCode: 500,
      errorMessage: 'Error fetching archived projects',
      errorDetails: error.message
    });
  }
});

// Helper: Validate UUID v4
function isValidUUID(uuid) {
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
  return uuidRegex.test(uuid);
}

// GET /projects/:id/reports/new - Render report creation UI for a project
router.get('/:id/reports/new', ensureAuthenticated, async (req, res) => {
  try {
    const projectId = req.params.id;
    if (!isValidUUID(projectId)) {
      return res.status(404).render('error', {
        errorCode: 404,
        errorMessage: 'Invalid project ID. Please check the URL or contact support.'
      });
    }
    // Verify project exists and fetch its name for pre-filling the form
    const { rows } = await db.query('SELECT id, name FROM threat_model.projects WHERE id = $1', [projectId]);
    if (rows.length === 0) {
      return res.status(404).render('error', { errorCode: 404, errorMessage: 'Project not found' });
    }
    const projectTitle = rows[0]?.name || '';
    // Render the dedicated reports generation page (uses Report Templates, not Prompt Templates)
    return res.render('reports-generate', {
      title: 'Generate Report',
      user: req.session?.user || { username: 'Anonymous' },
      projectId,
      projectTitle
    });
  } catch (error) {
    console.error('[PROJECTS] Error rendering report create page:', error);
    return res.status(500).render('error', {
      errorCode: 500,
      errorMessage: 'Error loading report creation form',
      errorDetails: error.message
    });
  }
});

// GET /projects - Show projects list
router.get('/', async (req, res) => {
  try {
    // Get filter parameters from query string
    const { business_unit, criticality, status } = req.query;
    
    // Build SQL query with optional filters
    let query = `
      SELECT 
        p.id, 
        p.name, 
        p.description, 
        p.business_unit, 
        p.criticality, 
        p.data_classification, 
        p.status,
        p.created_at,
        p.updated_at,
        COUNT(DISTINCT ptm.threat_model_id) as threat_model_count,
        COALESCE(AVG(tm.risk_score), 0) as avg_risk_score
      FROM 
        threat_model.projects p
      LEFT JOIN 
        threat_model.project_threat_models ptm ON p.id = ptm.project_id
      LEFT JOIN 
        threat_model.threat_models tm ON ptm.threat_model_id = tm.id
    `;
    
    // Add WHERE clauses for filters
    const whereConditions = [];
    // Exclude archived projects by default
    if (!status) {
      whereConditions.push("p.status != 'Archived'");
    }
    const params = [];
    
    if (business_unit) {
      whereConditions.push('p.business_unit = $' + (params.length + 1));
      params.push(business_unit);
    }
    
    if (criticality) {
      whereConditions.push('p.criticality = $' + (params.length + 1));
      params.push(criticality);
    }
    
    if (status) {
      whereConditions.push('p.status = $' + (params.length + 1));
      params.push(status);
    }
    
    if (whereConditions.length > 0) {
      query += ' WHERE ' + whereConditions.join(' AND ');
    }
    
    // Add GROUP BY and ORDER BY
    query += `
      GROUP BY 
        p.id, p.name, p.description, p.business_unit, 
        p.criticality, p.data_classification, p.status,
        p.created_at, p.updated_at
      ORDER BY
        p.name ASC
    `;
    
    // Execute query
    const result = await db.query(query, params);
    const projects = result.rows;
    
    // Only use PostgreSQL threat model counts
    // No Redis logic needed; project.threat_model_count is already set from PostgreSQL.

    // Get list of unique business units for filter dropdown
    const businessUnitsResult = await db.query(`
      SELECT DISTINCT business_unit 
      FROM threat_model.projects 
      WHERE business_unit IS NOT NULL AND business_unit != ''
      ORDER BY business_unit ASC
    `);
    const businessUnits = businessUnitsResult.rows.map(row => row.business_unit);
    
    // If no business units found, provide some default options
    if (businessUnits.length === 0) {
      businessUnits.push('Engineering', 'Finance', 'HR', 'Marketing', 'Operations', 'Sales');
    }
    
    // Get statistics for criticality pie chart
    const criticalityResult = await db.query(`
      SELECT criticality, COUNT(*) as count
      FROM threat_model.projects
      GROUP BY criticality
    `);
    
    // Initialize stats with zero counts
    const criticalityStats = {
      Critical: 0,
      High: 0,
      Medium: 0,
      Low: 0
    };
    
    // Fill in actual counts from database
    criticalityResult.rows.forEach(row => {
      if (row.criticality in criticalityStats) {
        criticalityStats[row.criticality] = parseInt(row.count);
      }
    });
    
    // Get statistics for business unit chart
    const businessUnitResult = await db.query(`
      SELECT business_unit, COUNT(*) as count
      FROM threat_model.projects
      WHERE business_unit IS NOT NULL AND business_unit != ''
      GROUP BY business_unit
    `);
    
    // Initialize business unit stats
    const businessUnitStats = {};
    
    // Add default values for common business units if none exist
    if (businessUnitResult.rows.length === 0) {
      businessUnitStats['Engineering'] = 0;
      businessUnitStats['Finance'] = 0;
      businessUnitStats['HR'] = 0;
      businessUnitStats['Marketing'] = 0;
      businessUnitStats['Operations'] = 0;
      businessUnitStats['Sales'] = 0;
    } else {
      // Fill in actual counts from database
      businessUnitResult.rows.forEach(row => {
        if (row.business_unit) {
          businessUnitStats[row.business_unit] = parseInt(row.count);
        }
      });
    }
    
    // Render the projects page
    res.render('projects', {
      projects,
      businessUnits,
      getStatusClass,
      getCriticalityClass,
      getRiskClass,
      getThreatModelStatusClass,
      criticalityStats,
      businessUnitStats,
      filters: {
        business_unit,
        criticality,
        status
      }
    });
  } catch (error) {
    console.error('Error fetching projects:', error);
    res.status(500).render('projects', {
      projects: [],
      businessUnits: ['Engineering', 'Finance', 'HR', 'Marketing', 'Operations', 'Sales'],
      getStatusClass,
      getCriticalityClass,
      getRiskClass,
      criticalityStats: { Critical: 0, High: 0, Medium: 0, Low: 0 },
      businessUnitStats: { Engineering: 0, Finance: 0, HR: 0, Marketing: 0, Operations: 0, Sales: 0 },
      filters: {},
      message: { type: 'danger', text: 'Error loading projects: ' + error.message }
    });
  }
});

module.exports = router;
